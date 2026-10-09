import { describe, expect, it } from 'vitest'

import { parisParts, parisTimestamp, zonedInstant } from './time'

describe('zonedInstant', () => {
  it('convertit l’heure de Paris, heure d’hiver comme d’été', () => {
    expect(zonedInstant('2025-01-15', '10:00', 'Europe/Paris')?.toISOString()).toBe(
      '2025-01-15T09:00:00.000Z',
    )
    expect(zonedInstant('2025-07-15', '10:00:30', 'Europe/Paris')?.toISOString()).toBe(
      '2025-07-15T08:00:30.000Z',
    )
  })

  it('gère les jours de changement d’heure', () => {
    // 30 mars 2025 : 2 h → 3 h. 26 octobre 2025 : 3 h → 2 h.
    expect(zonedInstant('2025-03-30', '03:30', 'Europe/Paris')?.toISOString()).toBe(
      '2025-03-30T01:30:00.000Z',
    )
    expect(zonedInstant('2025-10-26', '04:00', 'Europe/Paris')?.toISOString()).toBe(
      '2025-10-26T03:00:00.000Z',
    )
  })

  it('refuse une date, une heure ou un fuseau illisibles', () => {
    expect(zonedInstant('15/01/2025', '10:00', 'Europe/Paris')).toBeUndefined()
    expect(zonedInstant('2025-01-15', '10h00', 'Europe/Paris')).toBeUndefined()
    expect(zonedInstant('2025-01-15', '10:00', 'Mars/Olympus')).toBeUndefined()
  })
})

describe('parisParts et parisTimestamp', () => {
  it('affichent l’instant à l’heure de Paris', () => {
    const instant = new Date('2025-12-31T23:30:15Z')
    expect(parisParts(instant)).toEqual(['2026-01-01', '00:30'])
    expect(parisTimestamp(instant)).toBe('2026-01-01 00:30:15')
  })

  it('reviennent au même instant, à la minute près', () => {
    const instant = new Date('2025-06-02T12:47:00Z')
    const [date, time] = parisParts(instant)
    expect(zonedInstant(date, time, 'Europe/Paris')).toEqual(instant)
  })
})
