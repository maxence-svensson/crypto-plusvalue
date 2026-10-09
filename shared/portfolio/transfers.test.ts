import { describe, expect, it } from 'vitest'

import { transferIn, transferOut } from './fixtures'
import { matchTransfers } from './transfers'

describe('matchTransfers', () => {
  it('rapproche un envoi et la réception de la même crypto, frais de route déduits', () => {
    const out = transferOut('a:1', '2025-05-20T18:44:00Z', 'BTC', '0.004', '0.000015')
    const into = transferIn('b:1', '2025-05-20T19:30:00Z', 'BTC', '0.0039')
    const matching = matchTransfers([out, into])
    expect(matching.pairs).toEqual([{ out, in: into }])
    expect(matching.unmatchedIn).toEqual([])
    expect(matching.unmatchedOut).toEqual([])
  })

  it('laisse sans contrepartie un autre actif, une quantité trop différente ou trop tard', () => {
    const out = transferOut('a:1', '2025-05-20T18:44:00Z', 'BTC', '0.004')
    const otherAsset = transferIn('b:1', '2025-05-20T19:00:00Z', 'ETH', '0.004')
    const tooSmall = transferIn('b:2', '2025-05-20T19:00:00Z', 'BTC', '0.003')
    const tooLate = transferIn('b:3', '2025-05-25T19:00:00Z', 'BTC', '0.004')
    const matching = matchTransfers([out, otherAsset, tooSmall, tooLate])
    expect(matching.pairs).toEqual([])
    expect(matching.unmatchedOut).toEqual([out])
    expect(matching.unmatchedIn).toHaveLength(3)
  })

  it('tolère une réception horodatée un peu avant l’envoi', () => {
    const out = transferOut('a:1', '2025-05-20T18:44:00Z', 'SOL', '2')
    const into = transferIn('b:1', '2025-05-20T18:20:00Z', 'SOL', '2')
    expect(matchTransfers([out, into]).pairs).toHaveLength(1)
  })
})
