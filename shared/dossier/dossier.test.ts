import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { buy, reward, sell } from '../portfolio/fixtures'
import type { Transaction } from '../portfolio/transaction'
import { Dec } from '../tax/decimal'
import { buildDossier, type QuotedPrice } from './dossier'
import { dateTime, day, euros, quantity, unitPrice, wholeEuros } from './format'
import { renderDossier } from './pdf'

/** Cours fictifs : { 'BTC@2025-03-10T10:00:00Z': 12000, … }, tous de la même source. */
function pricesFrom(table: Record<string, number>) {
  return (asset: string, date: Date): QuotedPrice | undefined => {
    const price = table[`${asset}@${date.toISOString().replace('.000', '')}`]
    return price === undefined ? undefined : { priceEur: new Dec(price), source: 'Binance test' }
  }
}

const NOTICE = {
  transactions: [
    buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
    sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.0375', 450),
    sell('s2', '2025-08-10T10:00:00Z', 'BTC', '0.0625', 1300),
  ],
  priceAt: pricesFrom({ 'BTC@2025-03-10T10:00:00Z': 12000 }),
}

const dossierOf = (year: number, transactions: Transaction[], priceAt = NOTICE.priceAt) =>
  buildDossier({ year, transactions, priceAt, files: [], generatedAt: new Date() })

describe('buildDossier', () => {
  it('détaille la valeur globale du portefeuille actif par actif', () => {
    const dossier = dossierOf(2025, NOTICE.transactions)
    const [first, second] = dossier.disposals

    // Exemple de la notice : 450 € vendus, il reste 0,0625 BTC à 12 000 €.
    expect(
      first?.valuation.map((line) => [line.basis, line.value.toString(), line.source]),
    ).toEqual([
      ['sale', '450', undefined],
      ['market', '750', 'Binance test'],
    ])
    expect(first?.result.portfolioValue.toString()).toBe('1200')
    // 1 000 × 450 / 1 200, et 450 − 375 = 75 € de plus-value.
    expect(first?.capitalFraction.toString()).toBe('375')
    expect(first?.result.gain.toString()).toBe('75')
    // Tout est vendu à la seconde cession : aucun cours du marché.
    expect(second?.valuation.map((line) => line.basis)).toEqual(['sale'])
    expect(dossier.prices).toEqual([
      {
        asset: 'BTC',
        minute: new Date('2025-03-10T10:00:00Z'),
        priceEur: new Dec(12000),
        source: 'Binance test',
      },
    ])
  })

  it('justifie les lignes 220 et 221 avec les années précédentes', () => {
    const transactions = [
      buy('b1', '2024-02-01T10:00:00Z', 'BTC', '0.1', 1000, 10),
      sell('s1', '2024-06-01T10:00:00Z', 'BTC', '0.05', 800),
      reward('r1', '2024-07-01T10:00:00Z', 'BTC', '0.001'),
      buy('b2', '2025-01-15T10:00:00Z', 'BTC', '0.05', 2000, 5),
      sell('s2', '2025-05-01T10:00:00Z', 'BTC', '0.02', 900),
      // Après la dernière cession de l'année, et l'année suivante : hors du dossier 2025.
      buy('b3', '2025-11-01T10:00:00Z', 'BTC', '0.01', 400),
      sell('s3', '2026-03-01T10:00:00Z', 'BTC', '0.01', 500),
    ]
    const priceAt = pricesFrom({
      'BTC@2024-06-01T10:00:00Z': 16000,
      'BTC@2025-05-01T10:00:00Z': 45000,
      'BTC@2026-03-01T10:00:00Z': 50000,
    })

    const dossier = dossierOf(2025, transactions, priceAt)
    const [disposal] = dossier.disposals

    // Frais d'achat compris : 1 010 + 2 005.
    expect(dossier.acquisitions.map((item) => item.cost.toString())).toEqual(['1010', '2005'])
    expect(dossier.acquisitions.at(-1)?.cumulative.toString()).toBe(
      disposal?.result.totalAcquisitionCost.toString(),
    )
    expect(dossier.earlierDisposals).toHaveLength(1)
    expect(dossier.earlierDisposals[0]?.capitalFraction.toString()).toBe(
      disposal?.result.initialCapitalFractions.toString(),
    )
    expect(dossier.freeRewards).toBe(1)
    expect(dossier.transactions.map((transaction) => transaction.id)).toEqual([
      'b1',
      's1',
      'r1',
      'b2',
      's2',
      'b3',
    ])
  })

  it('suit le choix de ne pas compter les frais d’achat', () => {
    const dossier = buildDossier({
      year: 2025,
      transactions: [
        buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000, 12),
        ...NOTICE.transactions.slice(1),
      ],
      priceAt: NOTICE.priceAt,
      files: [],
      generatedAt: new Date(),
      options: { includeAcquisitionFees: false, rewardCost: 'zero' },
    })

    expect(dossier.acquisitions[0]?.cost.toString()).toBe('1000')
  })

  it('refuse un dossier tant qu’un cours manque', () => {
    expect(() => dossierOf(2025, NOTICE.transactions, () => undefined)).toThrow(/cours/)
  })
})

describe('mise en forme', () => {
  it('écrit les montants à la française, sans caractères absents des polices du PDF', () => {
    expect(euros(new Dec('1487.224'))).toBe('1 487,22 €')
    expect(euros(new Dec('-5.52'))).toBe('-5,52 €')
    expect(euros(new Dec('336.87'), true)).toBe('+336,87 €')
    expect(euros(new Dec(0), true)).toBe('0,00 €')
    expect(wholeEuros(1331)).toBe('1 331 €')
    expect(quantity(new Dec('1234567.0625'))).toBe('1 234 567,0625')
    expect(unitPrice(new Dec('92266.1658'))).toBe('92 266,17 €')
    expect(unitPrice(new Dec('0.123456789'))).toBe('0,123457 €')
  })

  it('donne les dates à l’heure de Paris', () => {
    expect(dateTime(new Date('2025-08-14T13:05:41Z'))).toBe('14/08/2025 15:05')
    expect(day(new Date('2025-12-31T23:30:00Z'))).toBe('01/01/2026')
  })
})

describe('renderDossier', () => {
  it('produit un PDF paginé, même avec un long historique', async () => {
    const purchases = Array.from({ length: 150 }, (_, index) =>
      buy(`b${index}`, new Date(Date.UTC(2025, 0, 1, 10, index)).toISOString(), 'BTC', '0.001', 50),
    )
    const dossier = buildDossier({
      year: 2025,
      transactions: [...purchases, sell('s1', '2025-06-01T10:00:00Z', 'BTC', '0.15', 9000)],
      priceAt: () => undefined,
      files: [
        {
          name: 'Un nom de fichier très long sans espaces_export_transactions_2025.csv → ✓',
          platform: 'Trade Republic',
          transactions: 151,
          skipped: 3,
        },
      ],
      generatedAt: new Date('2026-04-10T08:00:00Z'),
    })

    const bytes = await renderDossier(dossier, { rulesUrl: 'https://example.org/regles' })
    const pdf = await PDFDocument.load(bytes)

    expect(pdf.getPageCount()).toBeGreaterThan(3)
    expect(pdf.getTitle()).toContain('revenus 2025')
  })
})
