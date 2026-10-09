import { describe, expect, it } from 'vitest'

import { buy, sell, transferIn } from '../portfolio/fixtures'
import { transactionProblems } from '../portfolio/problems'
import { assessQuality } from '../portfolio/quality'
import { buildTaxEvents } from '../portfolio/tax-events'
import { Dec } from '../tax/decimal'
import { computeDisposals } from '../tax/form2086'
import { accountantWorkbook, disposalsTable, issuesTable, type ReportInput } from './reports'
import { toCsv } from './table'

const transactions = [
  buy('a', '2025-01-10T10:00:00Z', 'BTC', '0.01', '600', '2'),
  sell('b', '2025-06-10T10:00:00Z', 'BTC', '0.004', '400', '1'),
  transferIn('c', '2025-07-01T10:00:00Z', 'SOL', '3'),
]
const events = buildTaxEvents(transactions, () => new Dec(100000))
if (!events.ok) throw new Error('Cours manquants')
const disposals = computeDisposals(events.events)

const INPUT: ReportInput = {
  year: 2025,
  transactions,
  disposals,
  problems: transactionProblems({ transactions, missingHistory: [], missingPriceIds: [] }),
  quality: assessQuality({
    transactions,
    missingHistory: [],
    missingPrices: 0,
    unsupported: 1,
    anomalies: 0,
  }),
  files: [
    {
      name: 'export.csv',
      platform: 'kraken',
      anomalies: [],
      unsupported: [{ line: 7, label: 'margin -5 EUR' }],
    },
  ],
  generatedAt: new Date('2026-10-09T12:00:00Z'),
}

describe('disposalsTable', () => {
  it('reprend les lignes du 2086 au centime', () => {
    const table = disposalsTable(INPUT)
    expect(table.rows).toHaveLength(1)
    const csv = toCsv(table).split('\r\n')
    // 212 = 400 + 0,006 × 100 000 ; 220 = 602 ; gain = 399 − 602 × 400 / 1 000 = 158,20.
    expect(csv[1]).toBe(
      '1;2025-06-10 12:00:00;Vente;BTC;0,004;1000;400;1;0;399;602;0;0;602;158,2;b',
    )
  })
})

describe('issuesTable', () => {
  it('liste le diagnostic, les opérations concernées et les lignes de fichiers', () => {
    const rows = toCsv(issuesTable(INPUT)).split('\r\n')
    expect(
      rows.some((row) =>
        row.startsWith('À vérifier;Ensemble des données;;Réceptions sans envoi correspondant'),
      ),
    ).toBe(true)
    expect(
      rows.some((row) =>
        row.includes('Réception, Saisie manuelle (c);2025-07-01 12:00:00;Réception sans envoi'),
      ),
    ).toBe(true)
    expect(
      rows.some((row) =>
        row.startsWith('À vérifier;export.csv, ligne 7;;Non prise en charge;margin -5 EUR'),
      ),
    ).toBe(true)
  })
})

describe('accountantWorkbook', () => {
  it('assemble quatre feuilles', () => {
    const bytes = accountantWorkbook(INPUT)
    const text = new TextDecoder('latin1').decode(bytes)
    for (const name of ['Résumé', 'Cessions 2025', 'Opérations', 'Points à vérifier']) {
      expect(new TextDecoder().decode(bytes)).toContain(`<sheet name="${name}"`)
    }
    expect(text.startsWith('PK')).toBe(true)
  })
})
