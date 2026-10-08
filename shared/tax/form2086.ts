import { Dec, ZERO } from './decimal'

/**
 * Plus-values de cession d'actifs numériques des particuliers (article 150 VH bis du CGI),
 * calculées ligne par ligne comme sur le formulaire 2086 :
 *
 *   plus-value = prix de cession − prix total d'acquisition × prix de cession / valeur globale
 *
 * Le foyer fiscal n'a qu'un seul portefeuille, suivi depuis sa première acquisition : le prix
 * total d'acquisition et les fractions de capital déjà imputées se reportent d'une année sur
 * l'autre. Les règles et leurs sources sont détaillées dans `docs/regles-fiscales.md`.
 *
 * Aucun arrondi n'est fait en cours de calcul : les fractions de capital s'accumulent cession
 * après cession, un arrondi intermédiaire fausserait toutes les suivantes.
 */

export class TaxError extends Error {}

/** Achat d'actifs numériques, payé en euros ou avec un bien ou un service. */
export type Acquisition = {
  kind: 'acquisition'
  date: Date
  /** Prix payé en euros, ou valeur du bien ou du service remis (soulte versée comprise). */
  cost: Dec
}

/**
 * Cession imposable : vente contre des euros, paiement d'un bien ou d'un service en crypto,
 * ou échange entre actifs numériques avec soulte. Un échange sans soulte bénéficie du sursis
 * d'imposition : ce n'est pas une cession et il n'apparaît pas ici.
 */
export type Disposal = {
  kind: 'disposal'
  id: string
  /** Ligne 211. */
  date: Date
  /** Ligne 212 : valeur de tous les actifs numériques du foyer juste avant la cession. */
  portfolioValue: Dec
  /** Ligne 213 : prix perçu ou valeur de la contrepartie obtenue, hors soulte. */
  price: Dec
  /** Ligne 214 : frais de cession (plateforme, réseau), même payés en crypto. */
  fees?: Dec
  /** Ligne 216 : soulte reçue (positive) ou versée (négative). */
  balancingPayment?: Dec
  /** La contrepartie est un autre actif numérique (échange avec soulte). */
  exchange?: boolean
}

/** Cession à titre gratuit (don) : non imposable, mais elle réduit le prix total d'acquisition. */
export type Gift = {
  kind: 'gift'
  date: Date
  portfolioValue: Dec
  /** Valeur des actifs donnés. */
  value: Dec
}

export type PortfolioEvent = Acquisition | Disposal | Gift

/** Une colonne « Cession » du formulaire 2086. */
export type DisposalResult = {
  id: string
  /** Ligne 211 */
  date: Date
  /** Ligne 212 */
  portfolioValue: Dec
  /** Ligne 213 */
  price: Dec
  /** Ligne 214 */
  fees: Dec
  /** Ligne 215 : 213 − 214 */
  priceNetOfFees: Dec
  /** Ligne 216 : soulte reçue (positive) ou versée (négative) */
  balancingPayment: Dec
  /** Ligne 217 : 213 ± 216 */
  priceNetOfBalancing: Dec
  /** Ligne 218 : 213 − 214 ± 216 */
  netPrice: Dec
  /** Ligne 220 : somme des prix d'acquisition depuis l'origine du portefeuille */
  totalAcquisitionCost: Dec
  /** Ligne 221 : fractions de capital initial contenues dans les cessions antérieures */
  initialCapitalFractions: Dec
  /** Ligne 222 : soultes reçues lors d'échanges antérieurs */
  receivedBalancingPayments: Dec
  /** Ligne 223 : 220 − 221 − 222 */
  netAcquisitionCost: Dec
  /** Plus-value (positive) ou moins-value (négative) : 218 − 223 × 217 / 212 */
  gain: Dec
}

/** Calcule chaque cession imposable du portefeuille, toutes années confondues. */
export function computeDisposals(events: readonly PortfolioEvent[]): DisposalResult[] {
  let totalAcquisitionCost = ZERO
  let initialCapitalFractions = ZERO
  let receivedBalancingPayments = ZERO
  const results: DisposalResult[] = []

  // Tri stable : deux événements à la même date gardent l'ordre fourni.
  const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime())

  for (const event of sorted) {
    if (event.kind === 'acquisition') {
      assertNonNegative(event.cost, "Le prix d'acquisition")
      totalAcquisitionCost = totalAcquisitionCost.plus(event.cost)
      continue
    }

    const netAcquisitionCost = totalAcquisitionCost
      .minus(initialCapitalFractions)
      .minus(receivedBalancingPayments)

    if (event.kind === 'gift') {
      assertShareOfPortfolio(event.value, event.portfolioValue)
      initialCapitalFractions = initialCapitalFractions.plus(
        netAcquisitionCost.times(event.value).div(event.portfolioValue),
      )
      continue
    }

    const fees = event.fees ?? ZERO
    const balancingPayment = event.balancingPayment ?? ZERO
    assertNonNegative(event.price, 'Le prix de cession')
    assertNonNegative(fees, 'Le montant des frais de cession')

    const priceNetOfBalancing = event.price.plus(balancingPayment)
    assertShareOfPortfolio(priceNetOfBalancing, event.portfolioValue)

    const netPrice = priceNetOfBalancing.minus(fees)
    // Les frais réduisent le premier terme seulement, jamais le quotient (BOFiP, §50).
    const capitalFraction = netAcquisitionCost.times(priceNetOfBalancing).div(event.portfolioValue)

    results.push({
      id: event.id,
      date: event.date,
      portfolioValue: event.portfolioValue,
      price: event.price,
      fees,
      priceNetOfFees: event.price.minus(fees),
      balancingPayment,
      priceNetOfBalancing,
      netPrice,
      totalAcquisitionCost,
      initialCapitalFractions,
      receivedBalancingPayments,
      netAcquisitionCost,
      gain: netPrice.minus(capitalFraction),
    })

    initialCapitalFractions = initialCapitalFractions.plus(capitalFraction)

    if (event.exchange) {
      // Les actifs reçus lors d'un échange avec soulte entrent dans le prix total d'acquisition
      // pour la valeur des actifs remis, plus la soulte versée ; une soulte reçue le réduit
      // ensuite (ligne 222). Exemple officiel : BOFiP BOI-RPPM-PVBMC-30-20, §120.
      const paid = balancingPayment.lt(0) ? balancingPayment.negated() : ZERO
      const received = balancingPayment.gt(0) ? balancingPayment : ZERO
      totalAcquisitionCost = totalAcquisitionCost.plus(priceNetOfBalancing).plus(paid)
      receivedBalancingPayments = receivedBalancingPayments.plus(received)
    }
  }

  return results
}

/** Les cessions d'un foyer sont exonérées si la somme de leurs prix n'excède pas 305 €. */
export const EXEMPTION_THRESHOLD = new Dec(305)

export type YearSummary = {
  year: number
  disposals: DisposalResult[]
  /** Ligne 224 : somme des plus et moins-values de l'année */
  netGain: Dec
  /** Ligne 51 : somme des prix de cession de l'année (lignes 218), comparée au seuil */
  totalPrice: Dec
  exempt: boolean
  /** Case 3AN de la déclaration 2042 C : plus-value nette imposable, en euros entiers */
  box3AN: number
  /** Case 3BN : moins-value nette, en euros entiers. Elle n'est pas reportable. */
  box3BN: number
}

/** Regroupe les cessions d'une année civile et en déduit les montants à déclarer. */
export function summarizeYear(results: readonly DisposalResult[], year: number): YearSummary {
  const disposals = results.filter((result) => taxYear(result.date) === year)
  const netGain = sum(disposals.map((result) => result.gain))
  const totalPrice = sum(disposals.map((result) => result.netPrice))
  const exempt = totalPrice.lte(EXEMPTION_THRESHOLD)
  // La déclaration se remplit en euros entiers.
  const declared = exempt ? ZERO : netGain.toDecimalPlaces(0)

  return {
    year,
    disposals,
    netGain,
    totalPrice,
    exempt,
    box3AN: declared.gt(0) ? declared.toNumber() : 0,
    box3BN: declared.lt(0) ? declared.negated().toNumber() : 0,
  }
}

const parisYear = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric' })

/** Année d'imposition d'une opération : l'année civile à l'heure de Paris, pas en UTC. */
export function taxYear(date: Date): number {
  return Number(parisYear.format(date))
}

function sum(values: Dec[]): Dec {
  return values.reduce((total, value) => total.plus(value), ZERO)
}

function assertNonNegative(value: Dec, label: string) {
  if (value.lt(0)) {
    throw new TaxError(`${label} ne peut pas être négatif (${value}).`)
  }
}

function assertShareOfPortfolio(amount: Dec, portfolioValue: Dec) {
  if (portfolioValue.lte(0)) {
    throw new TaxError(`La valeur globale du portefeuille doit être positive (${portfolioValue}).`)
  }
  if (amount.gt(portfolioValue)) {
    throw new TaxError(
      `La valeur globale du portefeuille (${portfolioValue}) ne peut pas être inférieure à la valeur cédée (${amount}) : elle inclut les actifs cédés.`,
    )
  }
}
