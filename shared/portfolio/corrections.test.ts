import { describe, expect, it } from 'vitest'

import {
  applyCorrection,
  correctedIds,
  deletedIds,
  deletion,
  revertCorrection,
  type Correction,
} from './corrections'
import { buy, sell } from './fixtures'

const AT = new Date('2026-10-09T12:00:00Z')
const a = buy('a', '2025-01-01T10:00:00Z', 'BTC', '1', '100')
const b = buy('b', '2025-01-01T10:00:00Z', 'ETH', '1', '50')
const c = sell('c', '2025-02-01T10:00:00Z', 'BTC', '0.5', '80')
const d = sell('d', '2025-03-01T10:00:00Z', 'ETH', '0.5', '40')
const list = [a, b, c, d]

describe('corrections', () => {
  it('ajoute, modifie et supprime', () => {
    const added = buy('manual:1', '2025-01-15T10:00:00Z', 'SOL', '2', '300')
    expect(applyCorrection(list, { kind: 'add', at: AT, transaction: added })).toEqual([
      ...list,
      added,
    ])
    const edited = { ...c, label: 'corrigée' }
    expect(applyCorrection(list, { kind: 'edit', at: AT, before: c, after: edited })).toEqual([
      a,
      b,
      edited,
      d,
    ])
    expect(applyCorrection(list, deletion(list, ['b', 'd'], AT))).toEqual([a, c])
  })

  it('annule chaque correction en rendant la liste exactement comme avant', () => {
    const corrections: Correction[] = [
      {
        kind: 'add',
        at: AT,
        transaction: buy('manual:1', '2025-01-15T10:00:00Z', 'SOL', '2', '300'),
      },
      { kind: 'edit', at: AT, before: c, after: { ...c, label: 'corrigée' } },
      // Supprimer « a » et « b », à la même minute : l'ordre entre eux doit revenir à l'identique.
      deletion(list, ['a', 'b', 'd'], AT),
    ]
    for (const correction of corrections) {
      const after = applyCorrection(list, correction)
      expect(revertCorrection(after, correction)).toEqual(list)
    }
  })

  it('retient les opérations supprimées et celles corrigées à la main', () => {
    const journal: Correction[] = [
      deletion(list, ['b'], AT),
      { kind: 'edit', at: AT, before: c, after: { ...c, label: 'corrigée' } },
    ]
    expect([...deletedIds(journal)]).toEqual(['b'])
    expect([...correctedIds(journal)]).toEqual(['c'])
  })
})
