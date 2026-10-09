import {
  buildTaxEvents,
  DEFAULT_TAX_OPTIONS,
  type MissingPrice,
  type PriceLookup,
  type TaxOptions,
} from '../portfolio/tax-events'
import type { Sell, Transaction } from '../portfolio/transaction'
import { Dec } from '../tax/decimal'
import { flatTax, taxRules, type TaxRules } from '../tax/rules'
import {
  computeDisposals,
  summarizeYear,
  taxYear,
  type DisposalResult,
  type PortfolioEvent,
  type YearSummary,
} from '../tax/form2086'

export type SimulatedSale = {
  asset: string
  quantity: Dec
  /** Cours d'une unité, en euros. */
  unitPriceEur: Dec
  feeEur: Dec
  date: Date
}

export type SaleSimulation = {
  /** La colonne du 2086 qu'aurait cette vente. */
  disposal: DisposalResult
  yearBefore: YearSummary
  yearAfter: YearSummary
  /** Règles de l'année de la vente ; absentes si ses taux ne sont pas connus. */
  rules?: TaxRules
  /**
   * Impôt que la vente ajoute à l'année : compensation et seuil de 305 € compris. Absent quand
   * les taux de l'année ne sont pas connus.
   */
  extraTax?: Dec
  /** Ce qu'il resterait en poche : prix de vente, moins les frais et l'impôt supplémentaire. */
  netProceeds?: Dec
}

export type SimulationResult =
  ({ ok: true } & SaleSimulation) | { ok: false; missingPrices: MissingPrice[] }

const SIMULATION_ID = 'simulation'

/** La vente fictive, sous forme de transaction, pour réutiliser tout le calcul. */
export function simulatedTransaction(sale: SimulatedSale): Sell {
  return {
    id: SIMULATION_ID,
    source: 'manual',
    date: sale.date,
    label: 'Vente simulée',
    type: 'sell',
    sent: { asset: sale.asset, quantity: sale.quantity },
    amountEur: sale.quantity.times(sale.unitPriceEur),
    feeEur: sale.feeEur,
  }
}

/**
 * Simule une vente à partir de l'historique réel : le prix total d'acquisition restant et les
 * ventes déjà faites dans l'année comptent, comme dans une vraie déclaration.
 */
export function simulateSale(
  transactions: readonly Transaction[],
  sale: SimulatedSale,
  prices: PriceLookup,
  options: TaxOptions = DEFAULT_TAX_OPTIONS,
): SimulationResult {
  const sell = simulatedTransaction(sale)
  const after = buildTaxEvents([...transactions, sell], prices, options)
  const before = buildTaxEvents(transactions, prices, options)
  if (!after.ok) return { ok: false, missingPrices: after.missingPrices }
  if (!before.ok) return { ok: false, missingPrices: before.missingPrices }

  return {
    ok: true,
    ...compare(before.events, after.events, taxYear(sale.date), sell),
  }
}

/**
 * Version sans historique : l'utilisateur donne lui-même le prix total d'acquisition restant et
 * la valeur de son portefeuille. La vente est supposée être la seule de l'année.
 */
export function simulateSimpleSale(input: {
  acquisitionCost: Dec
  portfolioValue: Dec
  saleAmount: Dec
  feeEur: Dec
  date: Date
}): SaleSimulation {
  const sell = simulatedTransaction({
    asset: 'CRYPTO',
    quantity: new Dec(1),
    unitPriceEur: input.saleAmount,
    feeEur: input.feeEur,
    date: input.date,
  })
  const acquisition: PortfolioEvent = {
    kind: 'acquisition',
    date: new Date(input.date.getTime() - 1),
    cost: input.acquisitionCost,
  }
  const disposal: PortfolioEvent = {
    kind: 'disposal',
    id: SIMULATION_ID,
    date: input.date,
    portfolioValue: input.portfolioValue,
    price: input.saleAmount,
    fees: input.feeEur,
  }
  return compare([acquisition], [acquisition, disposal], taxYear(input.date), sell)
}

function compare(
  before: PortfolioEvent[],
  after: PortfolioEvent[],
  year: number,
  sell: Sell,
): SaleSimulation {
  const disposalsAfter = computeDisposals(after)
  const disposal = disposalsAfter.find((result) => result.id === SIMULATION_ID)
  if (!disposal) throw new Error('La vente simulée est introuvable dans le calcul.')

  const yearBefore = summarizeYear(computeDisposals(before), year)
  const yearAfter = summarizeYear(disposalsAfter, year)
  const taxAfter = flatTax(yearAfter)
  const taxBefore = flatTax(yearBefore)
  const extraTax = taxAfter && taxBefore ? taxAfter.minus(taxBefore) : undefined
  const rules = taxRules(year)

  return {
    disposal,
    yearBefore,
    yearAfter,
    ...(rules ? { rules } : {}),
    ...(extraTax
      ? { extraTax, netProceeds: sell.amountEur.minus(sell.feeEur).minus(extraTax) }
      : {}),
  }
}
