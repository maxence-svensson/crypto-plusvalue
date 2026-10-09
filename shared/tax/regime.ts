import { Dec, ZERO } from './decimal'
import type { Bracket, TaxRules } from './rules'

/**
 * Prélèvement forfaitaire unique ou barème progressif (case 3CN de la 2042 C) pour les
 * plus-values crypto, avec les taux et le barème de l'année (rules.ts). Sources dans
 * docs/regles-fiscales.md.
 */

/**
 * Impôt brut du barème : le revenu est divisé par le nombre de parts, chaque tranche taxée à son
 * taux, puis le résultat multiplié par le nombre de parts. Sans décote, plafonnement du quotient
 * familial ni réductions d'impôt.
 */
export function progressiveTax(taxableIncome: Dec, parts: Dec, brackets: readonly Bracket[]): Dec {
  const perPart = taxableIncome.div(parts)
  let tax = ZERO
  brackets.forEach((bracket, index) => {
    const next = brackets[index + 1]
    const top = next ? Dec.min(perPart, next.from) : perPart
    if (top.gt(bracket.from)) tax = tax.plus(top.minus(bracket.from).times(bracket.rate))
  })
  return tax.times(parts)
}

/** Taux de la tranche dans laquelle tombe le dernier euro de revenu. */
export function marginalRate(taxableIncome: Dec, parts: Dec, brackets: readonly Bracket[]): Dec {
  const perPart = taxableIncome.div(parts)
  const bracket = [...brackets].reverse().find((candidate) => perPart.gt(candidate.from))
  return new Dec(bracket?.rate ?? '0')
}

/** Tranches marginales possibles, pour un choix direct. */
export function marginalRates(brackets: readonly Bracket[]): Dec[] {
  return brackets.map((bracket) => new Dec(bracket.rate))
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
  rules: TaxRules,
): RegimeComparison {
  if (!rules.progressive) {
    throw new Error(`L'option pour le barème n'existe pas pour les revenus ${rules.year}.`)
  }
  const { brackets } = rules.progressive
  // Montants au centime : les totaux et l'écart affichés tombent juste à la lecture.
  const cents = (value: Dec) => value.toDecimalPlaces(2)
  const socialContributions = cents(gain.times(rules.socialContributions))
  const flatIncomeTax = cents(gain.times(rules.flatIncomeTax))

  const rate =
    'rate' in household
      ? household.rate
      : marginalRate(household.taxableIncome.plus(gain), household.parts, brackets)
  const progressiveIncomeTax = cents(
    'rate' in household
      ? gain.times(household.rate)
      : progressiveTax(household.taxableIncome.plus(gain), household.parts, brackets).minus(
          progressiveTax(household.taxableIncome, household.parts, brackets),
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
    deductibleCsgSaving: cents(gain.times(rules.deductibleCsg).times(rate)),
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
