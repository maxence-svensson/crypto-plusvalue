import { Dec } from '../../../shared/tax/decimal'
import type { PriceQuote } from '../../../shared/prices'

/**
 * Cours historique d'une crypto en euros, à la minute. Seuls le symbole et la minute arrivent
 * au serveur : jamais les quantités ni les montants de l'utilisateur.
 *
 * Sources, dans l'ordre (détails dans `docs/prix.md`) :
 * 1. Binance, paire en euros (BTCEUR…), si des échanges ont eu lieu dans la minute ;
 * 2. Binance, paire en USDT convertie avec EURUSDT, pour les actifs sans paire en euros active ;
 * 3. Coinbase Exchange, paire en euros, dernier cours des 10 minutes précédentes.
 *
 * Un cours de bougie est son prix moyen pondéré par les volumes (montant échangé / quantité).
 */

/** Requête HTTP GET renvoyant du JSON, ou `undefined` si la ressource n'existe pas. */
export type FetchJson = (url: string) => Promise<unknown>

const BINANCE = 'https://data-api.binance.vision/api/v3/klines'
const COINBASE = 'https://api.exchange.coinbase.com/products'

export async function resolvePriceEur(
  asset: string,
  minute: Date,
  fetchJson: FetchJson,
): Promise<PriceQuote | undefined> {
  const quote = (priceEur: Dec, source: string): PriceQuote => ({
    asset,
    minute: minute.toISOString(),
    priceEur: priceEur.toSignificantDigits(12).toString(),
    source,
  })

  const eur = await binanceCandle(`${asset}EUR`, minute, fetchJson)
  if (eur) return quote(eur, `Binance ${asset}/EUR`)

  // Prix d'un euro en USDT : sert à convertir les paires en USDT.
  const euroInUsdt = await binanceCandle('EURUSDT', minute, fetchJson)
  if (euroInUsdt) {
    if (asset === 'USDT') return quote(new Dec(1).div(euroInUsdt), 'Binance EUR/USDT')
    const usdt = await binanceCandle(`${asset}USDT`, minute, fetchJson)
    if (usdt) return quote(usdt.div(euroInUsdt), `Binance ${asset}/USDT et EUR/USDT`)
  }

  const coinbase = await coinbaseLastPrice(`${asset}-EUR`, minute, fetchJson)
  if (coinbase) return quote(coinbase, `Coinbase Exchange ${asset}-EUR`)

  return undefined
}

/** Prix moyen de la bougie Binance d'une minute, s'il y a eu des échanges. */
async function binanceCandle(symbol: string, minute: Date, fetchJson: FetchJson) {
  const url = `${BINANCE}?symbol=${symbol}&interval=1m&startTime=${minute.getTime()}&limit=1`
  const candles = await fetchJson(url)
  if (!Array.isArray(candles)) return undefined

  // [heure d'ouverture, ouverture, plus haut, plus bas, clôture, quantité, heure de clôture,
  //  montant échangé, …]
  const candle: unknown = candles[0]
  if (!Array.isArray(candle) || candle[0] !== minute.getTime()) return undefined

  const volume = new Dec(String(candle[5]))
  return volume.gt(0) ? new Dec(String(candle[7])).div(volume) : undefined
}

/** Clôture de la dernière bougie Coinbase des 10 minutes qui précèdent, `minute` comprise. */
async function coinbaseLastPrice(product: string, minute: Date, fetchJson: FetchJson) {
  const end = minute.getTime() / 1000
  const start = new Date((end - 600) * 1000).toISOString()
  const url = `${COINBASE}/${product}/candles?granularity=60&start=${start}&end=${minute.toISOString()}`
  const candles = await fetchJson(url)
  if (!Array.isArray(candles)) return undefined

  // [heure en secondes, plus bas, plus haut, ouverture, clôture, quantité], la plus récente
  // d'abord ; Coinbase ne renvoie que les minutes où il y a eu des échanges.
  const latest = candles
    .filter((candle): candle is number[] => Array.isArray(candle) && candle[0] <= end)
    .sort((a, b) => (b[0] ?? 0) - (a[0] ?? 0))[0]
  return latest?.[4] === undefined ? undefined : new Dec(String(latest[4]))
}
