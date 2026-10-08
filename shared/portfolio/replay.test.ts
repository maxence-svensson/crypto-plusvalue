import { describe, expect, it } from 'vitest'

import type { Holdings } from './replay'
import { replayPortfolio } from './replay'
import { buy, pay, reward, sell, swap, transferIn, transferOut } from './fixtures'

const plain = (holdings: Holdings | undefined) =>
  Object.fromEntries([...(holdings ?? [])].map(([asset, quantity]) => [asset, quantity.toString()]))

describe('replayPortfolio', () => {
  it('photographie les avoirs juste avant chaque cession', () => {
    const { disposals, holdings } = replayPortfolio([
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
      buy('b2', '2025-01-12T10:00:00Z', 'ETH', 2, 5000),
      sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.04', 450),
      sell('s2', '2025-08-10T10:00:00Z', 'ETH', 2, 6000),
    ])

    expect(disposals.map((disposal) => disposal.transaction.id)).toEqual(['s1', 's2'])
    expect(plain(disposals[0]?.holdingsBefore)).toEqual({ BTC: '0.1', ETH: '2' })
    // L'ETH entièrement vendu disparaît des avoirs.
    expect(plain(disposals[1]?.holdingsBefore)).toEqual({ BTC: '0.06', ETH: '2' })
    expect(plain(holdings)).toEqual({ BTC: '0.06' })
  })

  it('suit les échanges et les récompenses, sans en faire des cessions', () => {
    const { disposals, holdings } = replayPortfolio([
      buy('b1', '2025-01-10T10:00:00Z', 'ETH', 2, 5000),
      swap('x1', '2025-02-10T10:00:00Z', ['ETH', 1], ['SOL', 20]),
      reward('r1', '2025-03-01T10:00:00Z', 'SOL', '0.5'),
    ])

    expect(disposals).toHaveLength(0)
    expect(plain(holdings)).toEqual({ ETH: '1', SOL: '20.5' })
  })

  it('compte un paiement en crypto comme une cession', () => {
    const { disposals } = replayPortfolio([
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
      pay('p1', '2025-02-10T10:00:00Z', 'BTC', '0.001', 12),
    ])

    expect(disposals.map((disposal) => disposal.transaction.type)).toEqual(['payment'])
  })

  it('ignore les transferts entre portefeuilles du foyer, sauf leurs frais de réseau', () => {
    const { holdings, missingHistory } = replayPortfolio([
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
      transferOut('t1', '2025-02-10T10:00:00Z', 'BTC', '0.0999', '0.0001'),
      transferIn('t2', '2025-02-10T10:30:00Z', 'BTC', '0.0999'),
    ])

    expect(plain(holdings)).toEqual({ BTC: '0.0999' })
    expect(missingHistory).toHaveLength(0)
  })

  it("signale une vente d'actifs absents de l'historique", () => {
    const { disposals, missingHistory, holdings } = replayPortfolio([
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
      // 0,05 BTC reçus d'un portefeuille dont les achats n'ont pas été importés.
      transferIn('t1', '2025-02-10T10:00:00Z', 'BTC', '0.05'),
      sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.15', 1800),
    ])

    expect(missingHistory).toEqual([
      { transactionId: 's1', asset: 'BTC', shortfall: expect.anything() },
    ])
    expect(missingHistory[0]?.shortfall.toString()).toBe('0.05')
    expect(plain(disposals[0]?.holdingsBefore)).toEqual({ BTC: '0.1' })
    expect(plain(holdings)).toEqual({})
  })

  it("traite les transactions dans l'ordre chronologique", () => {
    const { missingHistory } = replayPortfolio([
      sell('s1', '2025-03-10T10:00:00Z', 'BTC', '0.05', 600),
      buy('b1', '2025-01-10T10:00:00Z', 'BTC', '0.1', 1000),
    ])

    expect(missingHistory).toHaveLength(0)
  })
})
