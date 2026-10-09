import { Dec, ZERO } from './decimal'

/**
 * Prélèvement forfaitaire unique ou barème progressif (case 3CN de la 2042 C) pour les
 * plus-values crypto. Règles et sources dans docs/regles-fiscales.md.
 */

/** Impôt sur le revenu du prélèvement forfaitaire (art. 200 C du CGI). */
export const FLAT_INCOME_TAX_RATE = new Dec('0.128')
/** Prélèvements sociaux, dus dans les deux cas depuis la LFSS 2026 (CSG 10,6 %). */
export const SOCIAL_CONTRIBUTIONS_RATE = new Dec('0.186')
/** Part de la CSG déductible du revenu de l'année suivante, au barème seulement. */
export const DEDUCTIBLE_CSG_RATE = new Dec('0.068')

/**
 * Barème de l'impôt sur les revenus 2025, par part de quotient familial
 * (service-public.gouv.fr, page F1419 vérifiée le 15 avril 2026).
 */
export const BRACKETS_2025: readonly { from: number; rate: string }[] = [
  { from: 0, rate: '0' },
  { from: 11_600, rate: '0.11' },
  { from: 29_579, rate: '0.30' },
  { from: 84_577, rate: '0.41' },
  { from: 181_917, rate: '0.45' },
]

/** Tranches marginales possibles, pour un choix direct. */
export const MARGINAL_RATES = BRACKETS_2025.map((bracket) => new Dec(bracket.rate))

/**
 * Impôt brut du barème : le revenu est divisé par le nombre de parts, chaque tranche taxée à son
 * taux, puis le résultat multiplié par le nombre de parts. Sans décote, plafonnement du quotient
 * familial ni réductions d'impôt.
 */
export function progressiveTax(taxableIncome: Dec, parts: Dec): Dec {
  const perPart = taxableIncome.div(parts)
  let tax = ZERO
  BRACKETS_2025.forEach((bracket, index) => {
    const next = BRACKETS_2025[index + 1]
    const top = next ? Dec.min(perPart, next.from) : perPart
    if (top.gt(bracket.from)) tax = tax.plus(top.minus(bracket.from).times(bracket.rate))
  })
  return tax.times(parts)
}

/** Taux de la tranche dans laquelle tombe le dernier euro de revenu. */
export function marginalRate(taxableIncome: Dec, parts: Dec): Dec {
  const perPart = taxableIncome.div(parts)
  const bracket = [...BRACKETS_2025].reverse().find((candidate) => perPart.gt(candidate.from))
  return new Dec(bracket?.rate ?? '0')
}

export type RegimeCost = {
  incomeTax: Dec
  socialContributions: Dec
  total: Dec
}

export type RegimeComparison = {
  flat: RegimeCost
  progressive: RegimeCost & {
    /** Impôt en moins l'année suivante grâce à la CSG déductible, estimé à la même tranche. */
    deductibleCsgSaving: Dec
  }
  /** Tranche marginale retenue pour le barème. */
  marginalRate: Dec
  /** Le moins cher cette année ; égalité si les totaux sont identiques. */
  better: 'flat' | 'progressive' | 'equal'
  /** Écart entre les deux totaux de l'année. */
  difference: Dec
}

/**
 * Compare les deux régimes pour une plus-value nette positive. La tranche est soit donnée
 * directement, soit déduite du revenu imposable du foyer (hors plus-values crypto) et du nombre
 * de parts : dans ce cas, une plus-value qui fait changer de tranche est imposée exactement.
 */
export function compareRegimes(
  gain: Dec,
  household: { rate: Dec } | { taxableIncome: Dec; parts: Dec },
): RegimeComparison {
  // Montants au centime : les totaux et l'écart affichés tombent juste à la lecture.
  const cents = (value: Dec) => value.toDecimalPlaces(2)
  const socialContributions = cents(gain.times(SOCIAL_CONTRIBUTIONS_RATE))
  const flatIncomeTax = cents(gain.times(FLAT_INCOME_TAX_RATE))

  const rate =
    'rate' in household
      ? household.rate
      : marginalRate(household.taxableIncome.plus(gain), household.parts)
  const progressiveIncomeTax = cents(
    'rate' in household
      ? gain.times(household.rate)
      : progressiveTax(household.taxableIncome.plus(gain), household.parts).minus(
          progressiveTax(household.taxableIncome, household.parts),
        ),
  )

  const flat = {
    incomeTax: flatIncomeTax,
    socialContributions,
    total: flatIncomeTax.plus(socialContributions),
  }
  const progressive = {
    incomeTax: progressiveIncomeTax,
    socialContributions,
    total: progressiveIncomeTax.plus(socialContributions),
    deductibleCsgSaving: cents(gain.times(DEDUCTIBLE_CSG_RATE).times(rate)),
  }
  const difference = flat.total.minus(progressive.total)

  return {
    flat,
    progressive,
    marginalRate: rate,
    better: difference.isZero() ? 'equal' : difference.gt(0) ? 'progressive' : 'flat',
    difference: difference.abs(),
  }
}
