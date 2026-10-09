import { PLATFORM_NAMES } from '../importers/detect'
import { taxYear } from '../tax/form2086'
import type { Dec } from '../tax/decimal'
import { toCsv, type ReportTable } from '../reports/table'
import { parisTimestamp } from '../time'
import { parseDecimal } from './manual'
import { PROBLEMS, type ProblemId } from './problems'
import { TRANSACTION_LABELS, type Source, type Transaction } from './transaction'

/** Recherche, filtres, tri et export de la liste des opérations. */

export const SOURCE_NAMES: Record<Source, string> = {
  ...PLATFORM_NAMES,
  manual: 'Saisie manuelle',
}

export type ListFilters = {
  /** Mots cherchés dans l'actif, le type, la plateforme, le libellé et l'identifiant. */
  query: string
  type: '' | Transaction['type']
  source: '' | Source
  asset: string
  /** Année fiscale, « 2025 ». */
  year: string
  /** Jours à Paris, bornes comprises : « 2025-01-01 ». */
  from: string
  to: string
  /** Montant en euros, bornes comprises ; les opérations sans montant sont alors écartées. */
  minEur: string
  maxEur: string
  /** Seulement les opérations qui ont un point à vérifier. */
  problemsOnly: boolean
}

export const NO_FILTERS: ListFilters = {
  query: '',
  type: '',
  source: '',
  asset: '',
  year: '',
  from: '',
  to: '',
  minEur: '',
  maxEur: '',
  problemsOnly: false,
}

/** Nombre de filtres actifs, recherche comprise. */
export function activeFilters(filters: ListFilters): number {
  return (Object.keys(NO_FILTERS) as (keyof ListFilters)[]).filter(
    (key) => filters[key] !== NO_FILTERS[key] && String(filters[key]).trim() !== '',
  ).length
}

/** Actifs concernés par l'opération : envoyé, reçu, frais de réseau. */
export function assetsOf(transaction: Transaction): string[] {
  const assets: string[] = []
  if ('sent' in transaction) assets.push(transaction.sent.asset)
  if ('received' in transaction) assets.push(transaction.received.asset)
  if (transaction.type === 'transfer-out' && transaction.fee) assets.push(transaction.fee.asset)
  return [...new Set(assets)]
}

/** Montant en euros : payé, obtenu, ou valeur d'une récompense quand elle est connue. */
export function eurosOf(transaction: Transaction): Dec | undefined {
  if ('amountEur' in transaction) return transaction.amountEur
  if (transaction.type === 'reward') return transaction.valueEur
  return undefined
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function searchable(transaction: Transaction): string {
  const [day] = parisTimestamp(transaction.date).split(' ')
  const [year, month, date] = (day ?? '').split('-')
  return fold(
    [
      ...assetsOf(transaction),
      TRANSACTION_LABELS[transaction.type],
      SOURCE_NAMES[transaction.source],
      transaction.label,
      transaction.id,
      `${date}/${month}/${year}`,
    ].join(' '),
  )
}

export function filterTransactions(
  list: readonly Transaction[],
  filters: ListFilters,
  problems: ReadonlyMap<string, readonly ProblemId[]>,
): Transaction[] {
  const words = fold(filters.query).split(/\s+/).filter(Boolean)
  const min = filters.minEur.trim() ? parseDecimal(filters.minEur) : undefined
  const max = filters.maxEur.trim() ? parseDecimal(filters.maxEur) : undefined
  const amountFilter = filters.minEur.trim() !== '' || filters.maxEur.trim() !== ''

  return list.filter((transaction) => {
    if (filters.type && transaction.type !== filters.type) return false
    if (filters.source && transaction.source !== filters.source) return false
    if (filters.asset && !assetsOf(transaction).includes(filters.asset)) return false
    if (filters.year && String(taxYear(transaction.date)) !== filters.year) return false
    if (filters.from || filters.to) {
      const day = parisTimestamp(transaction.date).slice(0, 10)
      if (filters.from && day < filters.from) return false
      if (filters.to && day > filters.to) return false
    }
    if (amountFilter) {
      const euros = eurosOf(transaction)
      if (!euros) return false
      if (min && euros.lt(min)) return false
      if (max && euros.gt(max)) return false
    }
    if (filters.problemsOnly && !problems.get(transaction.id)?.length) return false
    if (words.length > 0) {
      const text = searchable(transaction)
      if (!words.every((word) => text.includes(word))) return false
    }
    return true
  })
}

export type SortKey = 'date' | 'type' | 'asset' | 'amount'
export type SortDirection = 'asc' | 'desc'

/** Tri stable ; à valeur égale, la plus récente d'abord. Sans montant : toujours en dernier. */
export function sortTransactions(
  list: readonly Transaction[],
  key: SortKey,
  direction: SortDirection,
): Transaction[] {
  const sign = direction === 'asc' ? 1 : -1
  const byDate = (a: Transaction, b: Transaction) => b.date.getTime() - a.date.getTime()
  const compare = (a: Transaction, b: Transaction): number => {
    switch (key) {
      case 'date':
        return sign * (a.date.getTime() - b.date.getTime())
      case 'type':
        return sign * TRANSACTION_LABELS[a.type].localeCompare(TRANSACTION_LABELS[b.type], 'fr')
      case 'asset':
        return sign * (assetsOf(a)[0] ?? '').localeCompare(assetsOf(b)[0] ?? '', 'fr')
      case 'amount': {
        const left = eurosOf(a)
        const right = eurosOf(b)
        if (!left || !right) return left ? -1 : right ? 1 : 0
        return sign * left.comparedTo(right)
      }
    }
  }
  return [...list].sort((a, b) => compare(a, b) || byDate(a, b))
}

const CSV_COLUMNS = [
  'Date (Paris)',
  'Date (UTC)',
  'Type',
  'Plateforme',
  'Actif envoyé',
  'Quantité envoyée',
  'Actif reçu',
  'Quantité reçue',
  'Montant (€)',
  'Frais (€)',
  'Frais de réseau',
  'Libellé d’origine',
  'Identifiant',
  'Points à vérifier',
]

/** La liste des opérations, en tableau de rapport (CSV ou feuille Excel). */
export function transactionsTable(
  list: readonly Transaction[],
  problems: ReadonlyMap<string, readonly ProblemId[]> = new Map(),
): ReportTable {
  const amount = (value: Dec | undefined) => (value ? { euros: value } : null)
  const quantity = (value: Dec | undefined) => (value ? { quantity: value } : null)
  return {
    name: 'Opérations',
    columns: CSV_COLUMNS,
    widths: [20, 25, 18, 16, 12, 14, 12, 14, 12, 10, 16, 40, 30, 30],
    rows: list.map((transaction) => {
      const sent = 'sent' in transaction ? transaction.sent : undefined
      const received = 'received' in transaction ? transaction.received : undefined
      const networkFee = transaction.type === 'transfer-out' ? transaction.fee : undefined
      return [
        { date: transaction.date },
        transaction.date.toISOString(),
        TRANSACTION_LABELS[transaction.type],
        SOURCE_NAMES[transaction.source],
        sent?.asset ?? null,
        quantity(sent?.quantity),
        received?.asset ?? null,
        quantity(received?.quantity),
        amount(eurosOf(transaction)),
        'feeEur' in transaction ? amount(transaction.feeEur) : null,
        networkFee
          ? `${networkFee.quantity.toFixed().replace('.', ',')} ${networkFee.asset}`
          : null,
        transaction.label,
        transaction.id,
        (problems.get(transaction.id) ?? []).map((id) => PROBLEMS[id].title).join(', '),
      ]
    }),
  }
}

/** La liste au format CSV pour un tableur français. */
export function transactionsCsv(
  list: readonly Transaction[],
  problems: ReadonlyMap<string, readonly ProblemId[]> = new Map(),
): string {
  return toCsv(transactionsTable(list, problems))
}
