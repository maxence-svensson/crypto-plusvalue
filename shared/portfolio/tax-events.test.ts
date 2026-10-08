import { describe, expect, it } from 'vitest'

import { Dec } from '../tax/decimal'
import { computeDisposals, summarizeYear, type PortfolioEvent } from '../tax/form2086'
import { buy, pay, reward, sell, swap } from './fixtures'
import { buildTaxEvents, requiredPrices, type PriceLookup } from './tax-events'

/** Cours fictifs : { 'BTC@2025-03-10T10:00:00Z': 12000, … } */
function pricesFrom(table: Record<string, number>): PriceLookup {
  return (asset, date) => {
    const price = table[`${asset}@${date.toISOString().replace('.000', '')}`]
    return price === undefined ? undefined : new Dec(price)
  }
}

function events(result: ReturnType<typeof buildTaxEvents>): PortfolioEvent[] {
  if (!result.ok) throw new Error(`Cours manquants : ${JSON.stringify(result.missingPrices)}`)
  return result.events
}

describe('buildTaxEvents', () => {
  it("retrouve l'exemple officiel de la notice 2086 à partir de transactions", () => {
    const transactions = [
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
      // Le BTC vaut 12 000 € : 0,0375 BTC vendus 450 €, il en reste 0,0625 (750 €).
      sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.0375', 450),
      // Tout le reste est vendu 1 300 €.
      sell('s2', '2025-08-10T10:00:00Z', 'BTC', '0.0625', 1300),
    ]
    const prices = pricesFrom({ 'BTC@2025-03-10T10:00:00Z': 12000 })

    const results = computeDisposals(events(buildTaxEvents(transactions, prices)))

    expect(results.map((result) => result.portfolioValue.toString())).toEqual(['1200', '1300'])
    expect(results.map((result) => result.gain.toString())).toEqual(['75', '675'])
    expect(summarizeYear(results, 2025).box3AN).toBe(750)
  })

  it('valorise tous les actifs du foyer, y compris ceux obtenus par échange', () => {
    const transactions = [
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
      buy('b2', '2025-01-12T10:00:00Z', 'ETH', 2, 5000),
      swap('x1', '2025-02-10T10:00:00Z', ['ETH', 1], ['SOL', 20]),
      sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.05', 600),
    ]
    const prices = pricesFrom({
      'BTC@2025-03-10T10:00:00Z': 12000,
      'ETH@2025-03-10T10:00:00Z': 2500,
      'SOL@2025-03-10T10:00:00Z': 150,
    })

    const [disposal] = computeDisposals(events(buildTaxEvents(transactions, prices)))

    // 600 (BTC vendus) + 0,05 × 12 000 + 1 × 2 500 + 20 × 150
    expect(disposal?.portfolioValue.toString()).toBe('6700')
    // L'échange ETH → SOL est en sursis : le prix total d'acquisition reste 6 000 €.
    expect(disposal?.totalAcquisitionCost.toString()).toBe('6000')
  })

  it('valorise les actifs cédés à leur prix de cession, pas au cours du marché', () => {
    const transactions = [
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
      // Tout vendre 1 250 € alors que le cours affiché donnerait 1 200 € : la valeur globale ne
      // peut pas être inférieure au prix obtenu.
      sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.1', 1250),
    ]

    const [disposal] = computeDisposals(events(buildTaxEvents(transactions, () => undefined)))

    expect(disposal?.portfolioValue.toString()).toBe('1250')
    expect(disposal?.gain.toString()).toBe('250')
  })

  it("ajoute les frais d'achat au prix d'acquisition, sauf si l'option est désactivée", () => {
    const transactions = [
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000, 15),
      sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.1', 1200, 10),
    ]

    const [withFees] = computeDisposals(events(buildTaxEvents(transactions, () => undefined)))
    expect(withFees?.totalAcquisitionCost.toString()).toBe('1015')
    expect(withFees?.fees.toString()).toBe('10')
    expect(withFees?.gain.toString()).toBe('175')

    const [withoutFees] = computeDisposals(
      events(
        buildTaxEvents(transactions, () => undefined, {
          includeAcquisitionFees: false,
          rewardCost: 'zero',
        }),
      ),
    )
    expect(withoutFees?.totalAcquisitionCost.toString()).toBe('1000')
  })

  it('compte un paiement par carte comme une cession au prix du bien acheté', () => {
    const transactions = [
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
      pay('p1', '2025-03-10T10:00:00Z', 'BTC', '0.001', 12),
    ]
    const prices = pricesFrom({ 'BTC@2025-03-10T10:00:00Z': 12000 })

    const [disposal] = computeDisposals(events(buildTaxEvents(transactions, prices)))

    expect(disposal?.price.toString()).toBe('12')
    expect(disposal?.portfolioValue.toString()).toBe('1200')
  })

  describe('récompenses', () => {
    const transactions = [
      buy('b1', '2025-01-10T10:00:00Z', 'ETH', 1, 2000),
      reward('r1', '2025-02-01T10:00:00Z', 'ETH', '0.1'),
      reward('r2', '2025-02-15T10:00:00Z', 'ETH', '0.1', 260),
      sell('s1', '2025-03-10T10:00:00Z', 'ETH', '1.2', 3000),
    ]

    it("ont un prix d'acquisition nul par défaut", () => {
      const [disposal] = computeDisposals(events(buildTaxEvents(transactions, () => undefined)))
      expect(disposal?.totalAcquisitionCost.toString()).toBe('2000')
    })

    it('peuvent entrer pour leur valeur, indiquée par la plateforme ou tirée du cours', () => {
      const prices = pricesFrom({ 'ETH@2025-02-01T10:00:00Z': 2400 })
      const [disposal] = computeDisposals(
        events(
          buildTaxEvents(transactions, prices, {
            includeAcquisitionFees: true,
            rewardCost: 'value',
          }),
        ),
      )
      expect(disposal?.totalAcquisitionCost.toString()).toBe('2500')
    })
  })
})

describe('requiredPrices', () => {
  it('liste les cours nécessaires au calcul de chaque valeur globale', () => {
    const transactions = [
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
      buy('b2', '2025-01-12T10:00:00Z', 'ETH', 2, 5000),
      sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.05', 600),
      sell('s2', '2025-04-10T10:00:00Z', 'BTC', '0.05', 650),
    ]

    const needed = requiredPrices(transactions).map(
      (price) => `${price.asset} ${price.date.toISOString()} ${price.transactionId}`,
    )

    // La deuxième vente solde le BTC : seul l'ETH restant a besoin d'un cours.
    expect(needed).toEqual([
      'BTC 2025-03-10T10:00:00.000Z s1',
      'ETH 2025-03-10T10:00:00.000Z s1',
      'ETH 2025-04-10T10:00:00.000Z s2',
    ])
  })

  it("ne demande rien quand aucune cession n'a lieu", () => {
    expect(requiredPrices([buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000)])).toEqual([])
  })
})
