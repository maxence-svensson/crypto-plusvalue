import { describe, expect, it } from 'vitest'

import { buy, sell } from '../portfolio/fixtures'
import type { PriceLookup } from '../portfolio/tax-events'
import { Dec } from '../tax/decimal'
import { FLAT_TAX_RATE, simulateSale, simulateSimpleSale } from './sale'

const d = (value: number | string) => new Dec(value)
const NOW = new Date('2026-10-08T14:00:00Z')

/** Cours fictifs : { 'BTC@2026-03-10T10:00:00.000Z': 6000, … } */
function pricesFrom(table: Record<string, number>): PriceLookup {
  return (asset, date) => {
    const price = table[`${asset}@${date.toISOString()}`]
    return price === undefined ? undefined : d(price)
  }
}

function expectOk(result: ReturnType<typeof simulateSale>) {
  if (!result.ok) throw new Error(`Cours manquants : ${JSON.stringify(result.missingPrices)}`)
  return result
}

describe('simulateSale', () => {
  it('calcule la plus-value et l’impôt d’une vente aux cours du jour', () => {
    const result = expectOk(
      simulateSale(
        [buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000)],
        { asset: 'BTC', quantity: d('0.0375'), unitPriceEur: d(12000), feeEur: d(0), date: NOW },
        pricesFrom({ [`BTC@${NOW.toISOString()}`]: 12000 }),
      ),
    )

    // L'exemple de la notice : 450 € de vente sur un portefeuille de 1 200 €.
    expect(result.disposal.portfolioValue.toString()).toBe('1200')
    expect(result.disposal.gain.toString()).toBe('75')
    expect(result.extraTax.toString()).toBe('23.55')
    expect(result.netProceeds.toString()).toBe('426.45')
  })

  it('compense avec une moins-value déjà réalisée dans l’année', () => {
    const result = expectOk(
      simulateSale(
        [
          buy('b1', '2026-01-10T10:00:00Z', 'BTC', '0.1', 1000),
          // −200 € : 300 − 1 000 × 300 / 600
          sell('s1', '2026-03-10T10:00:00Z', 'BTC', '0.05', 300),
        ],
        { asset: 'BTC', quantity: d('0.05'), unitPriceEur: d(13000), feeEur: d(0), date: NOW },
        pricesFrom({ 'BTC@2026-03-10T10:00:00.000Z': 6000 }),
      ),
    )

    expect(result.disposal.gain.toString()).toBe('150')
    expect(result.yearAfter.netGain.toString()).toBe('-50')
    expect(result.extraTax.toString()).toBe('0')
  })

  it('rend imposables les ventes jusque-là exonérées quand le seuil de 305 € est franchi', () => {
    const result = expectOk(
      simulateSale(
        [
          buy('b1', '2026-01-10T10:00:00Z', 'BTC', '0.1', 1000),
          // 200 € de vente et 100 € de plus-value : exonérée, l'année ne dépasse pas 305 €.
          sell('s1', '2026-02-10T10:00:00Z', 'BTC', '0.01', 200),
        ],
        { asset: 'BTC', quantity: d('0.01'), unitPriceEur: d(20000), feeEur: d(0), date: NOW },
        pricesFrom({
          'BTC@2026-02-10T10:00:00.000Z': 20000,
          [`BTC@${NOW.toISOString()}`]: 20000,
        }),
      ),
    )

    expect(result.yearBefore.exempt).toBe(true)
    expect(result.yearAfter.exempt).toBe(false)
    // L'impôt porte sur les deux ventes (2 × 100 €), pas seulement sur la nouvelle.
    expect(result.extraTax.toString()).toBe('62.8')
  })

  it('demande les cours des autres cryptos détenues', () => {
    const result = simulateSale(
      [
        buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
        buy('b2', '2025-01-10T10:00:00Z', 'ETH', '1', 2000),
      ],
      { asset: 'BTC', quantity: d('0.1'), unitPriceEur: d(70000), feeEur: d(0), date: NOW },
      () => undefined,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.missingPrices.map((price) => price.asset)).toEqual(['ETH'])
  })
})

describe('simulateSimpleSale', () => {
  it('fonctionne sans historique, à partir de trois montants', () => {
    const result = simulateSimpleSale({
      acquisitionCost: d(1000),
      portfolioValue: d(1200),
      saleAmount: d(450),
      feeEur: d(0),
      date: NOW,
    })

    expect(result.disposal.gain.toString()).toBe('75')
    expect(result.extraTax.toString()).toBe(d(75).times(FLAT_TAX_RATE).toString())
  })

  it('n’impose rien sous le seuil de 305 €', () => {
    const result = simulateSimpleSale({
      acquisitionCost: d(100),
      portfolioValue: d(1000),
      saleAmount: d(300),
      feeEur: d(0),
      date: NOW,
    })

    expect(result.disposal.gain.toString()).toBe('270')
    expect(result.yearAfter.exempt).toBe(true)
    expect(result.extraTax.toString()).toBe('0')
  })
})
