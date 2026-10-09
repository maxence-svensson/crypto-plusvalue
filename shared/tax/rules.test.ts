import { describe, expect, it } from 'vitest'

import { Dec } from './decimal'
import { summarizeYear, type DisposalResult } from './form2086'
import { flatRate, flatTax, taxRules } from './rules'

describe('taxRules', () => {
  it('applique 30 % jusqu’aux revenus 2024, 31,4 % ensuite', () => {
    // 12,8 % d'impôt et 17,2 % de prélèvements sociaux, puis CSG à 10,6 % (LFSS 2026).
    expect(flatRate(taxRules(2019)!).toString()).toBe('0.3')
    expect(flatRate(taxRules(2024)!).toString()).toBe('0.3')
    expect(flatRate(taxRules(2025)!).toString()).toBe('0.314')
    expect(flatRate(taxRules(2026)!).toString()).toBe('0.314')
  })

  it('n’ouvre l’option pour le barème qu’à partir des revenus 2023', () => {
    expect(taxRules(2022)?.progressive).toBeUndefined()
    expect(taxRules(2023)?.progressive?.brackets[1]).toEqual({ from: 11_294, rate: '0.11' })
    expect(taxRules(2024)?.progressive?.brackets[1]).toEqual({ from: 11_497, rate: '0.11' })
    expect(taxRules(2025)?.progressive?.brackets[1]).toEqual({ from: 11_600, rate: '0.11' })
  })

  it('signale le barème emprunté tant que celui de l’année n’est pas voté', () => {
    expect(taxRules(2026)?.progressive?.bracketsYear).toBe(2025)
    expect(taxRules(2025)?.progressive?.bracketsYear).toBe(2025)
  })

  it('ne donne aucune règle hors du régime connu', () => {
    // Avant 2019, autre régime ; après 2026, taux pas encore fixés.
    expect(taxRules(2018)).toBeUndefined()
    expect(taxRules(2027)).toBeUndefined()
  })
})

describe('flatTax', () => {
  it('arrondit impôt et prélèvements sociaux au centime chacun', () => {
    // Plus-value nette de 331,3555 € en 2025 : 42,41 € + 61,63 € (et non 104,05 € d'un bloc).
    const disposal = {
      date: new Date('2025-08-14T13:05:00Z'),
      gain: new Dec('331.3555'),
      netPrice: new Dec(1000),
    } as DisposalResult
    expect(flatTax(summarizeYear([disposal], 2025))?.toString()).toBe('104.04')
  })
})
