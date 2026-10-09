import { ZERO, type Dec } from '../tax/decimal'
import type { Holdings } from './replay'
import type { TaxableTransaction } from './transaction'

/** Une ligne de la valeur globale du portefeuille (ligne 212 du 2086). */
export type ValuationLine = {
  asset: string
  quantity: Dec
  /**
   * `sale` : la part cédée, comptée pour son prix de cession, connu exactement.
   * `market` : le reste, compté au cours du marché à la minute de la cession.
   */
  basis: 'sale' | 'market'
  /** Cours unitaire en euros, pour les lignes au cours du marché. */
  unitPrice?: Dec
  value: Dec
}

export type Valuation = {
  lines: ValuationLine[]
  total: Dec
  /** Actifs dont le cours manque : leur valeur n'est pas comptée. */
  missing: string[]
}

/**
 * Valeur de tous les actifs numériques du foyer juste avant une cession : les actifs cédés pour
 * leur prix de cession, les autres au cours fourni par `priceOf`.
 */
export function valuePortfolio(
  transaction: TaxableTransaction,
  holdingsBefore: Holdings,
  priceOf: (asset: string) => Dec | undefined,
): Valuation {
  const lines: ValuationLine[] = [
    {
      asset: transaction.sent.asset,
      quantity: transaction.sent.quantity,
      basis: 'sale',
      value: transaction.amountEur,
    },
  ]
  const missing: string[] = []

  for (const [asset, held] of holdingsBefore) {
    const notSold = asset === transaction.sent.asset ? held.minus(transaction.sent.quantity) : held
    if (notSold.lte(0)) continue

    const price = priceOf(asset)
    if (!price) {
      missing.push(asset)
      continue
    }
    lines.push({
      asset,
      quantity: notSold,
      basis: 'market',
      unitPrice: price,
      value: notSold.times(price),
    })
  }

  const total = lines.reduce((sum, line) => sum.plus(line.value), ZERO)
  return { lines, total, missing }
}
