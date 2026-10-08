import { z } from 'zod'

import { startOfMinute } from '../../shared/prices'
import { resolvePriceEur } from '../utils/prices/resolve'

const query = z.object({
  asset: z.string().regex(/^[A-Z0-9]{1,15}$/, 'Symbole invalide'),
  at: z.iso.datetime({ offset: true }).transform((value) => startOfMinute(new Date(value))),
})

/**
 * GET /api/price?asset=BTC&at=2026-09-27T05:59:00Z : cours de l'actif en euros à cette minute.
 * Un cours passé ne change plus : la réponse est mise en cache par le CDN pour un an.
 */
export default defineEventHandler(async (event) => {
  const { asset, at } = await getValidatedQuery(event, query.parse)

  // La bougie de la minute en cours n'est pas encore close.
  if (at.getTime() > Date.now() - 2 * 60_000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cours disponible après la minute écoulée',
    })
  }

  const quote = await resolvePriceEur(asset, at, fetchJson)
  // Une erreur n'est jamais mise en cache : une source peut n'être que momentanément muette.
  if (!quote) {
    throw createError({ statusCode: 404, statusMessage: `Aucun cours trouvé pour ${asset}` })
  }

  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=31536000, immutable')
  return quote
})

/** GET JSON avec délai maximal ; une ressource absente (4xx) vaut `undefined`. */
async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'crypto-plusvalue (https://crypto-plusvalue.vercel.app)' },
    signal: AbortSignal.timeout(5000),
  })
  if (response.status >= 400 && response.status < 500 && response.status !== 429) return undefined
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Source de prix indisponible (${response.status})`,
    })
  }
  return response.json()
}
