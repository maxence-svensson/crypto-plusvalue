import { describe, expect, it } from 'vitest'

import { resolvePriceEur, type FetchJson } from './resolve'

// Minute de la vente de NEAR du second export réel, et bougies Binance relevées à cette minute.
const MINUTE = new Date('2026-09-27T05:59:00Z')
const T = MINUTE.getTime()

const candle = (open: number, volume: string, quoteVolume: string, close = '1') => [
  open,
  '1',
  '1',
  '1',
  close,
  volume,
  open + 59_999,
  quoteVolume,
  1,
  '0',
  '0',
  '0',
]

const BINANCE: Record<string, unknown> = {
  SOLEUR: [candle(T, '5.28600000', '562.18690000')],
  // Paire en euros sans aucun échange dans la minute : son cours de clôture est périmé.
  RENDEREUR: [candle(T, '0.00000000', '0.00000000', '1.79900000')],
  RENDERUSDT: [candle(T, '2048.54000000', '4175.25806000')],
  EURUSDT: [candle(T, '5045.20000000', '5745.94325000')],
}

/** Faux réseau : Binance et Coinbase répondent comme les vraies API. */
function fakeFetch(coinbase: Record<string, unknown> = {}): FetchJson & { urls: string[] } {
  const urls: string[] = []
  const fetchJson = async (url: string) => {
    urls.push(url)
    const binance = /symbol=(\w+)&interval=1m&startTime=(\d+)/.exec(url)
    if (binance?.[1]) return binance[2] === String(T) ? BINANCE[binance[1]] : []
    const product = /products\/([\w-]+)\/candles/.exec(url)?.[1]
    return product ? coinbase[product] : undefined
  }
  return Object.assign(fetchJson, { urls })
}

describe('resolvePriceEur', () => {
  it('prend le prix moyen de la bougie Binance en euros', async () => {
    const quote = await resolvePriceEur('SOL', MINUTE, fakeFetch())

    expect(quote).toEqual({
      asset: 'SOL',
      minute: '2026-09-27T05:59:00.000Z',
      // 562,1869 € échangés pour 5,286 SOL
      priceEur: '106.353934922',
      source: 'Binance SOL/EUR',
    })
  })

  it('passe par l’USDT quand la paire en euros n’a eu aucun échange', async () => {
    const quote = await resolvePriceEur('RENDER', MINUTE, fakeFetch())

    // (4 175,25806 / 2 048,54) USDT par RENDER, divisés par (5 745,94325 / 5 045,2) USDT par euro
    expect(quote?.priceEur).toBe('1.78959982791')
    expect(quote?.source).toBe('Binance RENDER/USDT et EUR/USDT')
  })

  it('convertit l’USDT lui-même avec la paire EUR/USDT', async () => {
    const quote = await resolvePriceEur('USDT', MINUTE, fakeFetch())
    expect(quote?.priceEur).toBe('0.878045567192')
  })

  it('se rabat sur le dernier cours Coinbase des minutes précédentes', async () => {
    const minuteInSeconds = T / 1000
    const fetchJson = fakeFetch({
      // Coinbase ne renvoie que les minutes avec des échanges, la plus récente d'abord.
      'NEAR-EUR': [
        [minuteInSeconds - 120, 4.6, 4.7, 4.6, 4.65, 12],
        [minuteInSeconds - 300, 4.5, 4.6, 4.5, 4.55, 8],
      ],
    })

    const quote = await resolvePriceEur('NEAR', MINUTE, fetchJson)

    expect(quote).toMatchObject({ priceEur: '4.65', source: 'Coinbase Exchange NEAR-EUR' })
    expect(fetchJson.urls.at(-1)).toBe(
      'https://api.exchange.coinbase.com/products/NEAR-EUR/candles?granularity=60&start=2026-09-27T05:49:00.000Z&end=2026-09-27T05:59:00.000Z',
    )
  })

  it("ignore une bougie Binance d'une autre minute (paire pas encore cotée)", async () => {
    const quote = await resolvePriceEur('SOL', new Date('2026-09-27T06:30:00Z'), fakeFetch())
    expect(quote).toBeUndefined()
  })

  it('ne renvoie rien quand aucune source ne connaît l’actif', async () => {
    expect(await resolvePriceEur('INCONNU', MINUTE, fakeFetch())).toBeUndefined()
  })
})
