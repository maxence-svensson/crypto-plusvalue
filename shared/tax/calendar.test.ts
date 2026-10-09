import { describe, expect, it } from 'vitest'

import { claimDeadline, declarationStatus } from './calendar'

const at = (iso: string) => new Date(iso)

describe('declarationStatus', () => {
  it('donne les dates limites tant qu’elles ne sont pas passées', () => {
    expect(declarationStatus(2025, at('2026-04-20T10:00:00Z')).kind).toBe('open')
    // Le 4 juin 2026 à 23 h 30, heure de Paris : encore dans les temps pour la dernière zone.
    expect(declarationStatus(2025, at('2026-06-04T21:30:00Z')).kind).toBe('open')
  })

  it('renvoie vers la correction en ligne jusqu’au 30 novembre', () => {
    expect(declarationStatus(2025, at('2026-06-05T08:00:00Z')).kind).toBe('correction')
    expect(declarationStatus(2025, at('2026-11-30T20:00:00Z')).kind).toBe('correction')
  })

  it('ne laisse ensuite que la réclamation, jusqu’à fin 2028 pour les revenus 2025', () => {
    expect(declarationStatus(2025, at('2026-12-01T10:00:00Z'))).toEqual({
      kind: 'claim',
      until: claimDeadline(2025),
    })
    expect(claimDeadline(2025).getUTCFullYear()).toBe(2028)
    expect(declarationStatus(2025, at('2029-01-05T10:00:00Z')).kind).toBe('closed')
  })

  it('annonce la campagne suivante avant la publication de son calendrier', () => {
    expect(declarationStatus(2026, at('2026-10-09T10:00:00Z'))).toEqual({
      kind: 'unpublished',
      declarationYear: 2027,
    })
  })

  it('applique le délai de réclamation aux années sans calendrier enregistré', () => {
    expect(declarationStatus(2024, at('2026-10-09T10:00:00Z')).kind).toBe('claim')
  })
})
