import { ZERO, type Dec } from '../tax/decimal'
import type { PortfolioEvent } from '../tax/form2086'
import { replayPortfolio } from './replay'
import { chronological, type Transaction } from './transaction'
import { valuePortfolio } from './valuation'

/** Cours en euros d'une unité de l'actif à cette date, s'il est connu. */
export type PriceLookup = (asset: string, date: Date) => Dec | undefined

export type TaxOptions = {
  /** Ajouter les frais d'achat au prix d'acquisition. */
  includeAcquisitionFees: boolean
  /** Prix d'acquisition des récompenses : nul, ou leur valeur à la réception. */
  rewardCost: 'zero' | 'value'
}

/** Choix par défaut, justifiés dans `docs/regles-fiscales.md`. */
export const DEFAULT_TAX_OPTIONS: TaxOptions = {
  includeAcquisitionFees: true,
  rewardCost: 'zero',
}

export type MissingPrice = {
  asset: string
  date: Date
  transactionId: string
}

export type TaxEventsResult =
  { ok: true; events: PortfolioEvent[] } | { ok: false; missingPrices: MissingPrice[] }

/**
 * Traduit les transactions en événements du formulaire 2086 : acquisitions et cessions
 * imposables. Les échanges entre cryptos et les transferts n'en produisent pas.
 *
 * Pour la valeur globale du portefeuille, les actifs cédés sont comptés pour leur prix de
 * cession, connu exactement, et les autres au cours du marché fourni par `prices`. Sans tous les
 * cours, aucun calcul n'est possible : la liste de ceux qui manquent est renvoyée.
 */
export function buildTaxEvents(
  transactions: readonly Transaction[],
  prices: PriceLookup,
  options: TaxOptions = DEFAULT_TAX_OPTIONS,
): TaxEventsResult {
  const events: PortfolioEvent[] = []
  const missingPrices: MissingPrice[] = []

  const priceOf = (asset: string, date: Date, transactionId: string) => {
    const price = prices(asset, date)
    if (!price) missingPrices.push({ asset, date, transactionId })
    return price
  }

  for (const transaction of chronological(transactions)) {
    if (transaction.type === 'buy') {
      const fees = options.includeAcquisitionFees ? transaction.feeEur : ZERO
      events.push({
        kind: 'acquisition',
        date: transaction.date,
        cost: transaction.amountEur.plus(fees),
      })
    }

    if (transaction.type === 'reward' && options.rewardCost === 'value') {
      const { asset, quantity } = transaction.received
      const value =
        transaction.valueEur ?? priceOf(asset, transaction.date, transaction.id)?.times(quantity)
      if (value) events.push({ kind: 'acquisition', date: transaction.date, cost: value })
    }
  }

  for (const { transaction, holdingsBefore } of replayPortfolio(transactions).disposals) {
    const valuation = valuePortfolio(transaction, holdingsBefore, (asset) =>
      priceOf(asset, transaction.date, transaction.id),
    )

    events.push({
      kind: 'disposal',
      id: transaction.id,
      date: transaction.date,
      portfolioValue: valuation.total,
      price: transaction.amountEur,
      fees: transaction.feeEur,
    })
  }

  return missingPrices.length > 0 ? { ok: false, missingPrices } : { ok: true, events }
}

/** Les cours à récupérer avant de pouvoir calculer. */
export function requiredPrices(
  transactions: readonly Transaction[],
  options: TaxOptions = DEFAULT_TAX_OPTIONS,
): MissingPrice[] {
  const result = buildTaxEvents(transactions, () => undefined, options)
  return result.ok ? [] : result.missingPrices
}
