import { describe, expect, it } from 'vitest'

import { ImportError, utcDate, zonedDate, type CsvRow } from './csv'

const row: CsvRow = { line: 7, cells: { time: '' } }

describe('zonedDate', () => {
  it('convertit une heure d’Amsterdam en UTC, heure d’été comprise', () => {
    // Hiver : UTC+1 ; été : UTC+2.
    expect(zonedDate(row, '2025-02-03', '10:20:41.118', 'Europe/Amsterdam').toISOString()).toBe(
      '2025-02-03T09:20:41.118Z',
    )
    expect(zonedDate(row, '2025-07-01', '10:00:00', 'Europe/Amsterdam').toISOString()).toBe(
      '2025-07-01T08:00:00.000Z',
    )
    expect(zonedDate(row, '2025-07-01', '10:00:00', 'UTC').toISOString()).toBe(
      '2025-07-01T10:00:00.000Z',
    )
  })

  it('refuse une date ou un fuseau illisible', () => {
    expect(() => zonedDate(row, '03/02/2025', '10:00:00', 'Europe/Paris')).toThrow(ImportError)
    expect(() => zonedDate(row, '2025-02-03', '10:00:00', 'Mars/Olympus')).toThrow('fuseau horaire')
  })
})

describe('utcDate', () => {
  it('lit les dates Kraken et Crypto.com, fractions de seconde comprises', () => {
    const at = (time: string) => utcDate({ line: 2, cells: { time } }, 'time').toISOString()
    expect(at('2025-03-03 08:20:02')).toBe('2025-03-03T08:20:02.000Z')
    expect(at('2020-12-30 21:39:54.7679')).toBe('2020-12-30T21:39:54.767Z')
    expect(() => at('demain')).toThrow(ImportError)
  })
})
