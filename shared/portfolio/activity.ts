import { ZERO, type Dec } from '../tax/decimal'
import { summarizeYear, taxYear, type DisposalResult } from '../tax/form2086'
import { parisTimestamp } from '../time'
import type { Transaction } from './transaction'

/**
 * Chiffres des graphiques du tableau de bord : achats et ventes dans le temps, répartition des
 * achats et du volume, plus ou moins-value par année. Montants en euros hors frais.
 */

export type Flow = { key: string; label: string; bought: Dec; sold: Dec }

const MONTHS = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })

const inYear = (transaction: Transaction, year?: number) =>
  year === undefined || taxYear(transaction.date) === year

/**
 * Achats et ventes, paiements en crypto compris : par mois d'une année (douze mois, même vides),
 * ou par année de la première à la dernière opération.
 */
export function flows(transactions: readonly Transaction[], year?: number): Flow[] {
  const buckets = new Map<string, Flow>()
  if (year !== undefined) {
    for (let month = 0; month < 12; month++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      const label = MONTHS.format(new Date(Date.UTC(year, month, 15)))
      buckets.set(key, { key, label, bought: ZERO, sold: ZERO })
    }
  } else {
    const years = transactions.map((transaction) => taxYear(transaction.date))
    if (years.length === 0) return []
    for (let each = Math.min(...years); each <= Math.max(...years); each++) {
      buckets.set(String(each), {
        key: String(each),
        label: String(each),
        bought: ZERO,
        sold: ZERO,
      })
    }
  }

  for (const transaction of transactions) {
    if (!inYear(transaction, year)) continue
    const key =
      year === undefined
        ? String(taxYear(transaction.date))
        : parisTimestamp(transaction.date).slice(0, 7)
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (transaction.type === 'buy') bucket.bought = bucket.bought.plus(transaction.amountEur)
    if (transaction.type === 'sell' || transaction.type === 'payment') {
      bucket.sold = bucket.sold.plus(transaction.amountEur)
    }
  }
  return [...buckets.values()]
}

export type Share = { key: string; value: Dec }

function ranked(totals: Map<string, Dec>): Share[] {
  return [...totals]
    .map(([key, value]) => ({ key, value }))
    .filter(({ value }) => value.gt(0))
    .sort((a, b) => b.value.comparedTo(a.value) || a.key.localeCompare(b.key))
}

/** Montants achetés en euros, crypto par crypto, du plus grand au plus petit. */
export function purchasesByAsset(transactions: readonly Transaction[], year?: number): Share[] {
  const totals = new Map<string, Dec>()
  for (const transaction of transactions) {
    if (transaction.type !== 'buy' || !inYear(transaction, year)) continue
    const { asset } = transaction.received
    totals.set(asset, (totals.get(asset) ?? ZERO).plus(transaction.amountEur))
  }
  return ranked(totals)
}

/** Volume en euros (achats, ventes et paiements) par source, du plus grand au plus petit. */
export function volumeBySource(transactions: readonly Transaction[], year?: number): Share[] {
  const totals = new Map<string, Dec>()
  for (const transaction of transactions) {
    if (!('amountEur' in transaction) || !inYear(transaction, year)) continue
    totals.set(
      transaction.source,
      (totals.get(transaction.source) ?? ZERO).plus(transaction.amountEur),
    )
  }
  return ranked(totals)
}

/** Les `keep` premières parts, et le reste regroupé sous « Autres ». */
export function foldTail(shares: readonly Share[], keep: number, other = 'Autres'): Share[] {
  if (shares.length <= keep + 1) return [...shares]
  const rest = shares.slice(keep).reduce((total, { value }) => total.plus(value), ZERO)
  return [...shares.slice(0, keep), { key: other, value: rest }]
}

export type YearGain = {
  year: number
  gain: Dec
  /** Cessions imposables de l'année. */
  count: number
  /** Total des cessions sous 305 € : rien à déclarer. */
  exempt: boolean
}

/** Plus ou moins-value nette de chaque année, de la plus ancienne à la plus récente. */
export function gainsByYear(
  disposals: readonly DisposalResult[],
  years: readonly number[],
): YearGain[] {
  return [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      const summary = summarizeYear(disposals, year)
      return {
        year,
        gain: summary.netGain,
        count: summary.disposals.length,
        exempt: summary.disposals.length > 0 && summary.exempt,
      }
    })
}
