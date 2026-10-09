import { describe, expect, it } from 'vitest'

import { formatCompactEuros, niceTicks } from './chart'

describe('niceTicks', () => {
  it('couvre les valeurs avec des pas ronds, zéro compris', () => {
    expect(niceTicks(0, 1487)).toEqual([0, 500, 1000, 1500])
    expect(niceTicks(0, 3400)).toEqual([0, 1000, 2000, 3000, 4000])
    expect(niceTicks(-120, 360)).toEqual([-200, 0, 200, 400])
    expect(niceTicks(-50, -10)).toEqual([-60, -40, -20, 0])
    expect(niceTicks(0, 0)).toEqual([0])
  })
})

describe('formatCompactEuros', () => {
  it('abrège les milliers', () => {
    expect(formatCompactEuros(1500).replace(/\s/g, ' ')).toBe('1,5 k €')
    expect(formatCompactEuros(250).replace(/\s/g, ' ')).toBe('250 €')
  })
})
