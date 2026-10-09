import { Dec, ZERO } from './decimal'
import type { YearSummary } from './form2086'

/**
 * Règles fiscales des plus-values crypto des particuliers (article 150 VH bis du CGI), année par
 * année. Une année absente n'a pas de règles connues : rien n'est alors estimé, plutôt que
 * d'appliquer en silence les taux d'une autre année. Sources dans docs/regles-fiscales.md.
 */

/** Tranche du barème progressif, par part de quotient familial. */
export type Bracket = { from: number; rate: string }

export type TaxRules = {
  /** Année des revenus. */
  year: number
  /** Impôt sur le revenu du prélèvement forfaitaire (CGI, art. 200 C). */
  flatIncomeTax: Dec
  /** Prélèvements sociaux sur les revenus du patrimoine. */
  socialContributions: Dec
  /** Part de la CSG déductible du revenu de l'année suivante, en cas d'option pour le barème. */
  deductibleCsg: Dec
  /**
   * Option pour le barème progressif (case 3CN), ouverte aux cessions réalisées depuis le
   * 1er janvier 2023. `bracketsYear` est l'année du barème utilisé : celle des revenus, ou la
   * dernière connue tant que le barème de l'année n'est pas voté.
   */
  progressive?: { brackets: readonly Bracket[]; bracketsYear: number }
}

const IR = new Dec('0.128')
/** CSG 9,2 %, CRDS 0,5 %, prélèvement de solidarité 7,5 %. */
const PS_2018 = new Dec('0.172')
/** CSG portée à 10,6 % sur les revenus du patrimoine à compter des revenus 2025 (LFSS 2026). */
const PS_2025 = new Dec('0.186')
const CSG_DEDUCTIBLE = new Dec('0.068')

/** Barèmes par année de revenus (lois de finances pour 2024, 2025 et 2026). */
const BRACKETS: Record<number, readonly Bracket[]> = {
  2023: [
    { from: 0, rate: '0' },
    { from: 11_294, rate: '0.11' },
    { from: 28_797, rate: '0.30' },
    { from: 82_341, rate: '0.41' },
    { from: 177_106, rate: '0.45' },
  ],
  2024: [
    { from: 0, rate: '0' },
    { from: 11_497, rate: '0.11' },
    { from: 29_315, rate: '0.30' },
    { from: 83_823, rate: '0.41' },
    { from: 180_294, rate: '0.45' },
  ],
  2025: [
    { from: 0, rate: '0' },
    { from: 11_600, rate: '0.11' },
    { from: 29_579, rate: '0.30' },
    { from: 84_577, rate: '0.41' },
    { from: 181_917, rate: '0.45' },
  ],
}

/** Première année du régime de l'article 150 VH bis : cessions depuis le 1er janvier 2019. */
export const FIRST_YEAR = 2019
/** Dernière année dont les taux sont en vigueur (le barème 2026 n'est pas encore voté). */
export const LAST_KNOWN_YEAR = 2026
const LATEST_BRACKETS = Math.max(...Object.keys(BRACKETS).map(Number))

export function taxRules(year: number): TaxRules | undefined {
  if (year < FIRST_YEAR || year > LAST_KNOWN_YEAR) return undefined
  const bracketsYear = Math.min(year, LATEST_BRACKETS)
  const brackets = BRACKETS[bracketsYear]
  return {
    year,
    flatIncomeTax: IR,
    socialContributions: year >= 2025 ? PS_2025 : PS_2018,
    deductibleCsg: CSG_DEDUCTIBLE,
    ...(year >= 2023 && brackets ? { progressive: { brackets, bracketsYear } } : {}),
  }
}

/** Taux global du prélèvement forfaitaire : impôt sur le revenu et prélèvements sociaux. */
export function flatRate(rules: TaxRules): Dec {
  return rules.flatIncomeTax.plus(rules.socialContributions)
}

/**
 * Impôt dû au titre des plus-values crypto d'une année, au prélèvement forfaitaire de cette
 * année-là ; `undefined` si ses taux ne sont pas connus. Nul en cas d'exonération ou de
 * moins-value. Impôt et prélèvements sociaux sont arrondis au centime chacun, comme dans la
 * comparaison des régimes, pour que les deux montants affichés concordent.
 */
export function flatTax(summary: YearSummary): Dec | undefined {
  if (summary.exempt || summary.netGain.lte(0)) return ZERO
  const rules = taxRules(summary.year)
  if (!rules) return undefined
  const cents = (rate: Dec) => summary.netGain.times(rate).toDecimalPlaces(2)
  return cents(rules.flatIncomeTax).plus(cents(rules.socialContributions))
}
