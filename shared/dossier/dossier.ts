import { replayPortfolio } from '../portfolio/replay'
import { buildTaxEvents, DEFAULT_TAX_OPTIONS, type TaxOptions } from '../portfolio/tax-events'
import {
  chronological,
  type Buy,
  type Reward,
  type TaxableTransaction,
  type Transaction,
} from '../portfolio/transaction'
import { valuePortfolio, type ValuationLine } from '../portfolio/valuation'
import { startOfMinute } from '../prices'
import { ZERO, type Dec } from '../tax/decimal'
import {
  computeDisposals,
  summarizeYear,
  taxYear,
  type DisposalResult,
  type YearSummary,
} from '../tax/form2086'

/**
 * Dossier justificatif d'une année : tout ce qui permet de refaire le calcul du 2086 à la main,
 * en cas de contrôle. Ce module rassemble les données ; `pdf.ts` les met en page.
 */

export type QuotedPrice = { priceEur: Dec; source: string }

export type DossierFile = {
  name: string
  platform: string
  transactions: number
  skipped: number
}

export type DossierInput = {
  year: number
  transactions: readonly Transaction[]
  priceAt: (asset: string, date: Date) => QuotedPrice | undefined
  files: readonly DossierFile[]
  generatedAt: Date
  options?: TaxOptions
}

export type DossierDisposal = {
  /** Numéro de la colonne « Cession » du 2086, à partir de 1. */
  number: number
  transaction: TaxableTransaction
  result: DisposalResult
  /** Valeur globale du portefeuille, actif par actif ; leur somme est la ligne 212. */
  valuation: (ValuationLine & { source?: string })[]
  /** Fraction de capital initial contenue dans la cession : 223 × 217 / 212. */
  capitalFraction: Dec
}

export type DossierAcquisition = {
  transaction: Buy | Reward
  /** Prix retenu dans le prix total d'acquisition. */
  cost: Dec
  /** Prix total d'acquisition après cette opération. */
  cumulative: Dec
}

export type EarlierDisposal = { result: DisposalResult; capitalFraction: Dec }

export type DossierPrice = { asset: string; minute: Date; priceEur: Dec; source: string }

export type Dossier = {
  year: number
  generatedAt: Date
  options: TaxOptions
  summary: YearSummary
  files: readonly DossierFile[]
  disposals: DossierDisposal[]
  /** Acquisitions qui composent le prix total d'acquisition (ligne 220) des cessions de l'année. */
  acquisitions: DossierAcquisition[]
  /** Cessions des années précédentes, dont les fractions de capital forment la ligne 221. */
  earlierDisposals: EarlierDisposal[]
  /** Cours du marché utilisés pour la valeur globale du portefeuille. */
  prices: DossierPrice[]
  /** Récompenses reçues jusqu'à la fin de l'année, entrées avec un prix d'acquisition nul. */
  freeRewards: number
  /** Toutes les opérations importées jusqu'à la fin de l'année, dans l'ordre chronologique. */
  transactions: Transaction[]
}

export function buildDossier(input: DossierInput): Dossier {
  const options = input.options ?? DEFAULT_TAX_OPTIONS
  const priceOf = (asset: string, date: Date) => input.priceAt(asset, date)?.priceEur

  const events = buildTaxEvents(input.transactions, priceOf, options)
  if (!events.ok) throw new Error('Il manque des cours pour établir le dossier.')
  const results = computeDisposals(events.events)
  const summary = summarizeYear(results, input.year)

  // Gain = 218 − fraction de capital, d'où la fraction.
  const capitalFraction = (result: DisposalResult) => result.netPrice.minus(result.gain)

  const snapshots = new Map(
    replayPortfolio(input.transactions).disposals.map((snapshot) => [
      snapshot.transaction.id,
      snapshot,
    ]),
  )

  const disposals = summary.disposals.map((result, index): DossierDisposal => {
    const snapshot = snapshots.get(result.id)
    if (!snapshot) throw new Error(`Cession introuvable : ${result.id}.`)
    const { transaction, holdingsBefore } = snapshot
    const valuation = valuePortfolio(transaction, holdingsBefore, (asset) =>
      priceOf(asset, transaction.date),
    )
    return {
      number: index + 1,
      transaction,
      result,
      valuation: valuation.lines.map((line) =>
        line.basis === 'market'
          ? { ...line, source: input.priceAt(line.asset, transaction.date)?.source }
          : line,
      ),
      capitalFraction: capitalFraction(result),
    }
  })

  const prices = new Map<string, DossierPrice>()
  for (const { transaction, valuation } of disposals) {
    for (const line of valuation) {
      if (line.basis !== 'market' || !line.unitPrice) continue
      const minute = startOfMinute(transaction.date)
      prices.set(`${line.asset}@${minute.toISOString()}`, {
        asset: line.asset,
        minute,
        priceEur: line.unitPrice,
        source: line.source ?? '',
      })
    }
  }

  const inYear = chronological(input.transactions).filter(
    (transaction) => taxYear(transaction.date) <= input.year,
  )

  // Le prix total d'acquisition de la dernière cession de l'année contient tous les achats
  // faits jusqu'à elle, comme dans buildTaxEvents.
  const cutoff = disposals.at(-1)?.transaction.date
  let cumulative = ZERO
  const acquisitions: DossierAcquisition[] = []
  const costOf = (transaction: Buy | Reward): Dec | undefined => {
    if (transaction.type === 'buy') {
      return options.includeAcquisitionFees
        ? transaction.amountEur.plus(transaction.feeEur)
        : transaction.amountEur
    }
    if (options.rewardCost === 'zero') return undefined
    const { asset, quantity } = transaction.received
    return transaction.valueEur ?? priceOf(asset, transaction.date)?.times(quantity)
  }
  for (const transaction of inYear) {
    if (cutoff && transaction.date > cutoff) break
    if (transaction.type !== 'buy' && transaction.type !== 'reward') continue
    const cost = costOf(transaction)
    if (!cost) continue
    cumulative = cumulative.plus(cost)
    acquisitions.push({ transaction, cost, cumulative })
  }

  return {
    year: input.year,
    generatedAt: input.generatedAt,
    options,
    summary,
    files: input.files,
    disposals,
    acquisitions,
    earlierDisposals: results
      .filter((result) => taxYear(result.date) < input.year)
      .map((result) => ({ result, capitalFraction: capitalFraction(result) })),
    prices: [...prices.values()].sort(
      (a, b) => a.minute.getTime() - b.minute.getTime() || a.asset.localeCompare(b.asset),
    ),
    freeRewards:
      options.rewardCost === 'zero'
        ? inYear.filter((transaction) => transaction.type === 'reward').length
        : 0,
    transactions: inYear,
  }
}
