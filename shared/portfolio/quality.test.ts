import { describe, expect, it } from 'vitest'

import { Dec } from '../tax/decimal'
import { buy, reward, sell, transferIn } from './fixtures'
import { assessQuality } from './quality'

const base = { missingHistory: [], missingPrices: 0, unsupported: 0, anomalies: 0 }

describe('assessQuality', () => {
  it('juge complet un historique sans manque', () => {
    const quality = assessQuality({
      ...base,
      transactions: [
        buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
        sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.05', 600),
      ],
    })
    expect(quality).toEqual({ level: 'complet', issues: [] })
  })

  it('juge incomplet un historique où il manque des achats ou des cours', () => {
    const quality = assessQuality({
      ...base,
      transactions: [sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.05', 600)],
      missingHistory: [{ transactionId: 's1', asset: 'BTC', shortfall: new Dec('0.05') }],
      missingPrices: 2,
    })
    expect(quality.level).toBe('incomplet')
    expect(quality.issues.map((issue) => issue.id)).toEqual(['missing-history', 'missing-prices'])
    expect(quality.issues[1]?.detail).toContain('2 cours sont introuvables')
  })

  it('demande de vérifier une réception venue d’un compte non importé', () => {
    const quality = assessQuality({
      ...base,
      transactions: [transferIn('t1', '2025-02-01T10:00:00Z', 'ETH', '1')],
    })
    expect(quality.level).toBe('à vérifier')
    expect(quality.issues[0]?.id).toBe('unmatched-in')
  })

  it('mentionne les récompenses à coût nul sans en faire un défaut', () => {
    const quality = assessQuality({
      ...base,
      transactions: [reward('r1', '2025-02-01T10:00:00Z', 'SOL', '0.01')],
    })
    expect(quality.level).toBe('complet')
    expect(quality.issues).toMatchObject([{ id: 'free-rewards', severity: 'information' }])
  })

  it('signale un historique antérieur à 2019', () => {
    const quality = assessQuality({
      ...base,
      transactions: [buy('b0', '2017-12-01T10:00:00Z', 'BTC', '0.1', 1000)],
    })
    expect(quality.issues[0]).toMatchObject({ id: 'before-2019', severity: 'à vérifier' })
  })
})
