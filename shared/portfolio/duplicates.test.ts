import { describe, expect, it } from 'vitest'

import { checkDuplicates } from './duplicates'
import { buy, sell } from './fixtures'

describe('checkDuplicates', () => {
  const existing = [
    buy('tr:1', '2025-03-03T08:40:00Z', 'BTC', '0.001084', 100),
    sell('tr:2', '2025-08-14T13:05:00Z', 'ETH', '0.387323', '1487.22', 1),
  ]

  it('ignore une opération déjà importée sous le même identifiant', () => {
    const check = checkDuplicates(existing, [existing[0]!])
    expect(check.known).toHaveLength(1)
    expect(check.fresh).toEqual([])
  })

  it('signale la même opération venue d’un autre export, à confirmer', () => {
    // Même achat, autre identifiant, 40 secondes d'écart.
    const twin = buy('autre:1', '2025-03-03T08:40:40Z', 'BTC', '0.0010840', 100)
    const check = checkDuplicates(existing, [twin])
    expect(check.possible).toEqual([{ incoming: twin, existing: existing[0] }])
    expect(check.fresh).toEqual([])
  })

  it('ne confond pas deux achats identiques à des moments différents', () => {
    // Plan d'épargne : 100 € de BTC chaque mois, même quantité possible.
    const nextMonth = buy('tr:3', '2025-04-03T08:40:00Z', 'BTC', '0.001084', 100)
    expect(checkDuplicates(existing, [nextMonth]).fresh).toEqual([nextMonth])
  })

  it('n’associe une opération existante qu’à un seul doublon', () => {
    const a = buy('x:1', '2025-03-03T08:40:10Z', 'BTC', '0.001084', 100)
    const b = buy('x:2', '2025-03-03T08:40:20Z', 'BTC', '0.001084', 100)
    const check = checkDuplicates(existing, [a, b])
    expect(check.possible).toHaveLength(1)
    expect(check.fresh).toEqual([b])
  })
})
