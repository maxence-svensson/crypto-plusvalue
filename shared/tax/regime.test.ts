import { describe, expect, it } from 'vitest'

import { Dec } from './decimal'
import { compareRegimes, marginalRate, progressiveTax } from './regime'
import { taxRules, type TaxRules } from './rules'

const d = (value: number | string) => new Dec(value)

function rulesOf(year: number): TaxRules {
  const rules = taxRules(year)
  if (!rules?.progressive) throw new Error(`Barème ${year} attendu`)
  return rules
}
const RULES_2025 = rulesOf(2025)
const BRACKETS_2025 = RULES_2025.progressive?.brackets ?? []

describe('progressiveTax', () => {
  it('applique chaque tranche à la fraction de revenu qui la concerne', () => {
    // 17 979 € à 11 % (de 11 600 à 29 579) puis 421 € à 30 %.
    expect(progressiveTax(d(30000), d(1), BRACKETS_2025).toString()).toBe('2103.99')
  })

  it('divise le revenu par le nombre de parts puis multiplie l’impôt', () => {
    expect(progressiveTax(d(60000), d(2), BRACKETS_2025).toString()).toBe('4207.98')
  })

  it('n’impose rien sous le premier seuil', () => {
    expect(progressiveTax(d(11600), d(1), BRACKETS_2025).toString()).toBe('0')
  })
})

describe('marginalRate', () => {
  it('retrouve la tranche du dernier euro', () => {
    expect(marginalRate(d(10000), d(1), BRACKETS_2025).toString()).toBe('0')
    expect(marginalRate(d(20000), d(1), BRACKETS_2025).toString()).toBe('0.11')
    expect(marginalRate(d(30000), d(1), BRACKETS_2025).toString()).toBe('0.3')
    expect(marginalRate(d(60000), d(2.5), BRACKETS_2025).toString()).toBe('0.11')
    expect(marginalRate(d(200000), d(1), BRACKETS_2025).toString()).toBe('0.45')
  })
})

describe('compareRegimes', () => {
  it('conseille le barème dans la tranche à 11 %', () => {
    const comparison = compareRegimes(d(1000), { rate: d('0.11') }, RULES_2025)

    expect(comparison.flat.total.toString()).toBe('314')
    expect(comparison.progressive.total.toString()).toBe('296')
    expect(comparison.better).toBe('progressive')
    expect(comparison.difference.toString()).toBe('18')
    // 6,8 % de CSG déductible l'année suivante, à 11 %.
    expect(comparison.progressive.deductibleCsgSaving.toString()).toBe('7.48')
  })

  it('conseille le prélèvement forfaitaire dans la tranche à 30 %', () => {
    const comparison = compareRegimes(d(1000), { rate: d('0.3') }, RULES_2025)

    expect(comparison.progressive.total.toString()).toBe('486')
    expect(comparison.better).toBe('flat')
    expect(comparison.difference.toString()).toBe('172')
  })

  it('ne laisse que les prélèvements sociaux à un foyer non imposable', () => {
    const comparison = compareRegimes(d(1000), { taxableIncome: d(8000), parts: d(1) }, RULES_2025)

    expect(comparison.progressive.incomeTax.toString()).toBe('0')
    expect(comparison.progressive.total.toString()).toBe('186')
  })

  it('arrondit au centime pour que les totaux et l’écart affichés concordent', () => {
    const comparison = compareRegimes(d('331.3555'), { rate: d('0.11') }, RULES_2025)

    expect(comparison.flat.incomeTax.toString()).toBe('42.41')
    expect(comparison.flat.socialContributions.toString()).toBe('61.63')
    expect(comparison.flat.total.toString()).toBe('104.04')
    expect(comparison.progressive.total.toString()).toBe('98.08')
    expect(comparison.difference.toString()).toBe('5.96')
  })

  it('impose exactement une plus-value qui fait changer de tranche', () => {
    // De 29 000 à 31 000 € : 579 € à 11 % puis 1 421 € à 30 %.
    const comparison = compareRegimes(d(2000), { taxableIncome: d(29000), parts: d(1) }, RULES_2025)

    expect(comparison.progressive.incomeTax.toString()).toBe('489.99')
    expect(comparison.marginalRate.toString()).toBe('0.3')
    expect(comparison.better).toBe('flat')
  })
})

describe('règles des revenus 2024', () => {
  it('applique le barème 2024 et 17,2 % de prélèvements sociaux', () => {
    const rules = rulesOf(2024)
    // 17 818 € à 11 % (de 11 497 à 29 315) puis 685 € à 30 %.
    expect(progressiveTax(d(30000), d(1), rules.progressive?.brackets ?? []).toString()).toBe(
      '2165.48',
    )
    const comparison = compareRegimes(d(1000), { rate: d('0.11') }, rules)
    expect(comparison.flat.total.toString()).toBe('300')
    expect(comparison.progressive.total.toString()).toBe('282')
  })

  it('refuse la comparaison avant 2023, quand l’option n’existait pas', () => {
    const rules = taxRules(2022)
    if (!rules) throw new Error('Règles 2022 attendues')
    expect(() => compareRegimes(d(1000), { rate: d('0.11') }, rules)).toThrow(
      "n'existe pas pour les revenus 2022",
    )
  })
})
