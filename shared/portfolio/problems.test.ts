import { describe, expect, it } from 'vitest'

import { Dec } from '../tax/decimal'
import { buy, sell, transferIn, transferOut } from './fixtures'
import { transactionProblems } from './problems'

describe('transactionProblems', () => {
  it('rattache chaque point à vérifier à son opération', () => {
    const old = buy('old', '2018-06-01T10:00:00Z', 'BTC', '1', '5000')
    const sale = sell('sale', '2025-02-01T10:00:00Z', 'ETH', '1', '3000')
    const lonelyIn = transferIn('in', '2025-03-01T10:00:00Z', 'SOL', '5')
    const lonelyOut = transferOut('out', '2025-04-01T10:00:00Z', 'BTC', '0.5')
    const problems = transactionProblems({
      transactions: [old, sale, lonelyIn, lonelyOut],
      missingHistory: [{ transactionId: 'sale', asset: 'ETH', shortfall: new Dec(1) }],
      missingPriceIds: ['sale', 'sale'],
    })
    expect(Object.fromEntries(problems)).toEqual({
      old: ['before-2019'],
      sale: ['missing-history', 'missing-price'],
      in: ['unmatched-in'],
      out: ['unmatched-out'],
    })
  })
})
