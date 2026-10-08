import { describe, expect, it } from 'vitest'

import { Dec } from './decimal'
import {
  TaxError,
  computeDisposals,
  summarizeYear,
  taxYear,
  type DisposalResult,
  type PortfolioEvent,
} from './form2086'

const d = (value: number | string) => new Dec(value)
const at = (iso: string) => new Date(iso)

const buy = (date: string, cost: number): PortfolioEvent => ({
  kind: 'acquisition',
  date: at(date),
  cost: d(cost),
})

const sell = (
  date: string,
  portfolioValue: number,
  price: number,
  extra: { fees?: number; balancingPayment?: number; exchange?: boolean } = {},
): PortfolioEvent => ({
  kind: 'disposal',
  id: date,
  date: at(date),
  portfolioValue: d(portfolioValue),
  price: d(price),
  fees: extra.fees === undefined ? undefined : d(extra.fees),
  balancingPayment: extra.balancingPayment === undefined ? undefined : d(extra.balancingPayment),
  exchange: extra.exchange,
})

/** Les lignes d'une colonne du 2086, en chaînes pour des comparaisons exactes. */
function lines(result: DisposalResult | undefined) {
  if (!result) throw new Error('Cession manquante')
  return {
    212: result.portfolioValue.toString(),
    213: result.price.toString(),
    214: result.fees.toString(),
    215: result.priceNetOfFees.toString(),
    216: result.balancingPayment.toString(),
    217: result.priceNetOfBalancing.toString(),
    218: result.netPrice.toString(),
    220: result.totalAcquisitionCost.toString(),
    221: result.initialCapitalFractions.toString(),
    222: result.receivedBalancingPayments.toString(),
    223: result.netAcquisitionCost.toString(),
    gain: result.gain.toString(),
  }
}

describe('computeDisposals : exemples officiels', () => {
  it("réduit le prix total d'acquisition de la fraction déjà imputée (notice 2086, BOFiP §110)", () => {
    const [first, second] = computeDisposals([
      buy('2025-01-10T10:00:00Z', 1000),
      sell('2025-03-10T10:00:00Z', 1200, 450),
      sell('2025-08-10T10:00:00Z', 1300, 1300),
    ])

    expect(lines(first)).toMatchObject({
      212: '1200',
      218: '450',
      220: '1000',
      221: '0',
      223: '1000',
    })
    expect(first?.gain.toString()).toBe('75')
    expect(lines(second)).toMatchObject({
      212: '1300',
      218: '1300',
      220: '1000',
      221: '375',
      223: '625',
    })
    expect(second?.gain.toString()).toBe('675')
  })

  it('traite un échange avec soulte reçue (BOFiP §120)', () => {
    const [exchange, sale] = computeDisposals([
      buy('2025-01-10T10:00:00Z', 500),
      // Actifs remis contre d'autres actifs valant 600 €, plus 150 € reçus en euros.
      sell('2025-03-10T10:00:00Z', 750, 600, { balancingPayment: 150, exchange: true }),
      sell('2025-10-10T10:00:00Z', 800, 800),
    ])

    expect(lines(exchange)).toMatchObject({
      213: '600',
      216: '150',
      217: '750',
      218: '750',
      223: '500',
    })
    expect(exchange?.gain.toString()).toBe('250')
    expect(lines(sale)).toMatchObject({ 220: '1250', 221: '500', 222: '150', 223: '600' })
    expect(sale?.gain.toString()).toBe('200')
  })

  it('ajoute au prix total les biens remis et la soulte versée (BOFiP §70)', () => {
    const [sale] = computeDisposals([
      buy('2025-01-10T10:00:00Z', 500),
      // Biens d'une valeur de 200 € plus une soulte de 100 € versée, contre des actifs numériques.
      buy('2025-03-10T10:00:00Z', 300),
      sell('2025-06-10T10:00:00Z', 1000, 1000),
    ])

    expect(sale?.totalAcquisitionCost.toString()).toBe('800')
  })
})

describe('computeDisposals : frais et cas particuliers', () => {
  it('déduit les frais du prix mais pas du quotient', () => {
    const [first, second] = computeDisposals([
      buy('2025-01-10T10:00:00Z', 2000),
      sell('2025-03-15T10:00:00Z', 3000, 1000, { fees: 10 }),
      buy('2025-06-01T10:00:00Z', 1500),
      sell('2025-09-20T10:00:00Z', 4000, 2000, { fees: 20 }),
    ])

    expect(lines(first)).toMatchObject({ 214: '10', 215: '990', 217: '1000', 218: '990' })
    // 990 − 2 000 × 1 000 / 3 000 ; avec les frais dans le quotient, on trouverait 330.
    expect(first?.gain.toFixed(2)).toBe('323.33')

    // Achat entre les deux cessions, et fraction imputée gardée en pleine précision.
    expect(second?.totalAcquisitionCost.toString()).toBe('3500')
    expect(second?.initialCapitalFractions.toFixed(10)).toBe('666.6666666667')
    expect(second?.gain.toFixed(2)).toBe('563.33')
  })

  it('peut dégager une moins-value', () => {
    const [sale] = computeDisposals([
      buy('2025-01-10T10:00:00Z', 10000),
      sell('2025-05-10T10:00:00Z', 6000, 3000),
    ])

    expect(sale?.gain.toString()).toBe('-2000')
  })

  it('traite un échange avec soulte versée', () => {
    const [exchange, sale] = computeDisposals([
      buy('2025-01-10T10:00:00Z', 1000),
      // Actifs valant 600 € plus 100 € versés, contre des actifs valant 700 €.
      sell('2025-03-10T10:00:00Z', 1200, 700, { balancingPayment: -100, exchange: true }),
      sell('2025-09-10T10:00:00Z', 1300, 1300),
    ])

    expect(lines(exchange)).toMatchObject({ 216: '-100', 217: '600', 218: '600' })
    expect(exchange?.gain.toString()).toBe('100')
    // 1 000 € versés au départ, 100 € de soulte, 1 300 € récupérés : 200 € de gain au total.
    expect(lines(sale)).toMatchObject({ 220: '1700', 221: '500', 223: '1200' })
    expect(sale?.gain.toString()).toBe('100')
  })

  it("réduit le prix total d'acquisition après un don, sans le compter comme une cession", () => {
    const results = computeDisposals([
      buy('2025-01-10T10:00:00Z', 1000),
      { kind: 'gift', date: at('2025-02-10T10:00:00Z'), portfolioValue: d(1200), value: d(300) },
      sell('2025-04-10T10:00:00Z', 900, 900),
    ])

    expect(results).toHaveLength(1)
    expect(lines(results[0])).toMatchObject({ 221: '250', 223: '750', gain: '150' })
  })

  it('traite les événements dans l’ordre chronologique', () => {
    const [sale] = computeDisposals([
      sell('2025-03-10T10:00:00Z', 1200, 450),
      buy('2025-01-10T10:00:00Z', 1000),
    ])

    expect(sale?.gain.toString()).toBe('75')
  })

  it('refuse une valeur de portefeuille inférieure au prix de cession', () => {
    expect(() =>
      computeDisposals([buy('2025-01-10T10:00:00Z', 1000), sell('2025-03-10T10:00:00Z', 400, 450)]),
    ).toThrow(TaxError)
  })

  it('refuse une valeur de portefeuille nulle et des frais négatifs', () => {
    expect(() => computeDisposals([sell('2025-03-10T10:00:00Z', 0, 0)])).toThrow(TaxError)
    expect(() => computeDisposals([sell('2025-03-10T10:00:00Z', 100, 50, { fees: -1 })])).toThrow(
      TaxError,
    )
  })
})

describe('summarizeYear', () => {
  it('reporte la plus-value nette en case 3AN (exemple de la notice)', () => {
    const results = computeDisposals([
      buy('2025-01-10T10:00:00Z', 1000),
      sell('2025-03-10T10:00:00Z', 1200, 450),
      sell('2025-08-10T10:00:00Z', 1300, 1300),
    ])
    const summary = summarizeYear(results, 2025)

    expect(summary.netGain.toString()).toBe('750')
    expect(summary.totalPrice.toString()).toBe('1750')
    expect(summary.exempt).toBe(false)
    expect(summary.box3AN).toBe(750)
    expect(summary.box3BN).toBe(0)
  })

  it('compense plus et moins-values de l’année (BOFiP 30-20 §160)', () => {
    // Trois allers-retours où tout le portefeuille est vendu : +400, +150 puis −50.
    const results = computeDisposals([
      buy('2025-01-01T10:00:00Z', 100),
      sell('2025-02-01T10:00:00Z', 500, 500),
      buy('2025-03-01T10:00:00Z', 100),
      sell('2025-04-01T10:00:00Z', 250, 250),
      buy('2025-05-01T10:00:00Z', 100),
      sell('2025-06-01T10:00:00Z', 50, 50),
    ])

    expect(results.map((result) => result.gain.toString())).toEqual(['400', '150', '-50'])
    expect(summarizeYear(results, 2025).box3AN).toBe(500)
  })

  it('déclare une moins-value nette en case 3BN', () => {
    const results = computeDisposals([
      buy('2025-01-10T10:00:00Z', 10000),
      sell('2025-05-10T10:00:00Z', 6000, 3000),
    ])
    const summary = summarizeYear(results, 2025)

    expect(summary.box3AN).toBe(0)
    expect(summary.box3BN).toBe(2000)
  })

  it('arrondit les cases à l’euro le plus proche', () => {
    const results = computeDisposals([
      buy('2025-01-10T10:00:00Z', 2000),
      sell('2025-03-15T10:00:00Z', 3000, 1000, { fees: 10 }),
      buy('2025-06-01T10:00:00Z', 1500),
      sell('2025-09-20T10:00:00Z', 4000, 2000, { fees: 20 }),
    ])
    const summary = summarizeYear(results, 2025)

    expect(summary.netGain.toFixed(2)).toBe('886.67')
    expect(summary.totalPrice.toString()).toBe('2970')
    expect(summary.box3AN).toBe(887)
  })

  describe('seuil de 305 € (BOFiP 30-10 §90 à §110)', () => {
    // n ventes de 100 € dégageant chacune 30 € de plus-value.
    function salesOf100(count: number) {
      const events: PortfolioEvent[] = []
      for (let i = 0; i < count; i++) {
        events.push(buy(`2025-0${i + 1}-01T10:00:00Z`, 70))
        events.push(sell(`2025-0${i + 1}-15T10:00:00Z`, 100, 100))
      }
      return summarizeYear(computeDisposals(events), 2025)
    }

    it('exonère 3 cessions de 100 €', () => {
      const summary = salesOf100(3)
      expect(summary.totalPrice.toString()).toBe('300')
      expect(summary.exempt).toBe(true)
      expect(summary.box3AN).toBe(0)
    })

    it('impose dès le premier euro 4 cessions de 100 €', () => {
      const summary = salesOf100(4)
      expect(summary.exempt).toBe(false)
      expect(summary.box3AN).toBe(120)
    })

    it('exonère un total de 305 € exactement', () => {
      const results = computeDisposals([
        buy('2025-01-10T10:00:00Z', 100),
        sell('2025-03-10T10:00:00Z', 305, 305),
      ])
      expect(summarizeYear(results, 2025).exempt).toBe(true)
    })

    it('compare le seuil au prix net de frais (ligne 218)', () => {
      const results = computeDisposals([
        buy('2025-01-10T10:00:00Z', 100),
        sell('2025-03-10T10:00:00Z', 310, 310, { fees: 6 }),
      ])
      expect(summarizeYear(results, 2025).exempt).toBe(true)
    })
  })

  it("reporte le prix total d'acquisition d'une année sur l'autre", () => {
    const results = computeDisposals([
      buy('2025-01-10T10:00:00Z', 1000),
      sell('2025-03-10T10:00:00Z', 1200, 450),
      sell('2026-08-10T10:00:00Z', 1300, 1300),
    ])

    const summary2026 = summarizeYear(results, 2026)
    expect(summary2026.disposals).toHaveLength(1)
    expect(lines(summary2026.disposals[0])).toMatchObject({ 221: '375', 223: '625', gain: '675' })
  })
})

describe('taxYear', () => {
  it('rattache une cession du 31 décembre au soir (UTC) à l’année suivante, heure de Paris', () => {
    expect(taxYear(at('2025-12-31T22:59:59Z'))).toBe(2025)
    expect(taxYear(at('2025-12-31T23:30:00Z'))).toBe(2026)
  })
})
