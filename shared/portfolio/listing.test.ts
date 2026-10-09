import { describe, expect, it } from 'vitest'

import { buy, reward, sell, swap, transferOut } from './fixtures'
import {
  NO_FILTERS,
  activeFilters,
  filterTransactions,
  sortTransactions,
  transactionsCsv,
  type ListFilters,
} from './listing'
import type { ProblemId } from './problems'
import type { Transaction } from './transaction'

const fromKraken = (transaction: Transaction): Transaction => ({
  ...transaction,
  source: 'kraken',
})

const LIST: Transaction[] = [
  buy('cb:1', '2024-12-31T23:30:00Z', 'BTC', '0.01', '900', '1'),
  fromKraken(sell('kr:1', '2025-03-03T08:20:00Z', 'BTC', '0.005', '450')),
  swap('cb:2', '2025-04-01T10:00:00Z', ['ETH', '1'], ['USDC', '3000']),
  reward('cb:3', '2025-04-07T01:14:30Z', 'SOL', '0.01'),
  transferOut('cb:4', '2025-05-20T18:44:02Z', 'BTC', '0.002', '0.000015'),
]
const PROBLEMS = new Map<string, ProblemId[]>([['kr:1', ['missing-history']]])

const ids = (filters: Partial<ListFilters>) =>
  filterTransactions(LIST, { ...NO_FILTERS, ...filters }, PROBLEMS).map(({ id }) => id)

describe('filterTransactions', () => {
  it('cherche dans l’actif, le type, la plateforme et la date, sans tenir compte des accents', () => {
    expect(ids({ query: 'usdc' })).toEqual(['cb:2'])
    expect(ids({ query: 'echange' })).toEqual(['cb:2'])
    expect(ids({ query: 'kraken btc' })).toEqual(['kr:1'])
    expect(ids({ query: '03/03/2025' })).toEqual(['kr:1'])
    expect(ids({ query: 'introuvable' })).toEqual([])
  })

  it('combine les filtres', () => {
    expect(ids({ asset: 'BTC' })).toEqual(['cb:1', 'kr:1', 'cb:4'])
    expect(ids({ asset: 'BTC', type: 'transfer-out' })).toEqual(['cb:4'])
    expect(ids({ source: 'kraken' })).toEqual(['kr:1'])
    expect(ids({ problemsOnly: true })).toEqual(['kr:1'])
  })

  it('compte les années et les jours à l’heure de Paris', () => {
    // 31/12/2024 23:30 UTC : déjà le 1er janvier 2025 à Paris.
    expect(ids({ year: '2025' })).toContain('cb:1')
    expect(ids({ year: '2024' })).toEqual([])
    expect(ids({ from: '2025-01-01', to: '2025-03-03' })).toEqual(['cb:1', 'kr:1'])
  })

  it('filtre par montant en écartant les opérations sans montant', () => {
    expect(ids({ minEur: '500' })).toEqual(['cb:1'])
    expect(ids({ maxEur: '1 000' })).toEqual(['cb:1', 'kr:1'])
  })

  it('compte les filtres actifs', () => {
    expect(activeFilters(NO_FILTERS)).toBe(0)
    expect(activeFilters({ ...NO_FILTERS, query: '  ', asset: 'BTC', problemsOnly: true })).toBe(2)
  })
})

describe('sortTransactions', () => {
  const order = (key: Parameters<typeof sortTransactions>[1], direction: 'asc' | 'desc') =>
    sortTransactions(LIST, key, direction).map(({ id }) => id)

  it('trie par date, type, actif ou montant', () => {
    expect(order('date', 'desc')).toEqual(['cb:4', 'cb:3', 'cb:2', 'kr:1', 'cb:1'])
    expect(order('type', 'asc')).toEqual(['cb:1', 'cb:2', 'cb:4', 'cb:3', 'kr:1'])
    expect(order('asset', 'asc').slice(0, 3)).toEqual(['cb:4', 'kr:1', 'cb:1'])
    // Sans montant (échange, récompense sans valeur, envoi) : en dernier, quel que soit le sens.
    expect(order('amount', 'asc')).toEqual(['kr:1', 'cb:1', 'cb:4', 'cb:3', 'cb:2'])
    expect(order('amount', 'desc')).toEqual(['cb:1', 'kr:1', 'cb:4', 'cb:3', 'cb:2'])
  })
})

describe('transactionsCsv', () => {
  it('produit un CSV pour tableur français', () => {
    const csv = transactionsCsv(LIST.slice(0, 2), PROBLEMS)
    const [header, first, second] = csv.replace(/^\uFEFF/, '').split('\r\n')
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(header?.split(';')).toHaveLength(14)
    expect(first).toBe(
      '2025-01-01 00:30:00;2024-12-31T23:30:00.000Z;Achat;Saisie manuelle;;;BTC;0,01;900;1;;cb:1;cb:1;',
    )
    expect(second).toContain(';Vente;Kraken;BTC;0,005;;;450;0;;')
    expect(second?.endsWith(';Achats manquants')).toBe(true)
  })

  it('neutralise les formules et protège les séparateurs', () => {
    const tricky = { ...LIST[0]!, label: '=HYPERLINK("http://x";"clic")' }
    const line = transactionsCsv([tricky]).split('\r\n')[1]
    expect(line).toContain(';"\'=HYPERLINK(""http://x"";""clic"")";')
  })
})
