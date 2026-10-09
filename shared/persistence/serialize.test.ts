import { describe, expect, it } from 'vitest'

import { buy, reward, sell, transferOut } from '../portfolio/fixtures'
import type { Transaction } from '../portfolio/transaction'
import { Dec } from '../tax/decimal'
import { fromPlain, toPlain } from './serialize'

describe('toPlain / fromPlain', () => {
  it('retrouve les mêmes transactions, décimaux et dates compris', () => {
    const transactions = [
      buy('b1', '2025-03-03T08:20:02.123Z', 'BTC', '0.0045123456789', '400.1', '1'),
      sell('s1', '2025-05-02T12:00:00Z', 'BTC', '0.0015', 150, '0.4'),
      reward('r1', '2025-04-07T01:14:30Z', 'SOL', '0.0004017'),
      transferOut('t1', '2025-05-20T18:44:02Z', 'BTC', '0.002', '0.000015'),
    ]

    const plain = toPlain(transactions)
    const back = fromPlain<Transaction[]>(JSON.parse(JSON.stringify(plain)))

    expect(back).toEqual(transactions)
    const first = back[0]
    if (first?.type !== 'buy') throw new Error('Achat attendu')
    expect(first.received.quantity).toBeInstanceOf(Dec)
    expect(first.received.quantity.toString()).toBe('0.0045123456789')
    expect(first.date.toISOString()).toBe('2025-03-03T08:20:02.123Z')
  })

  it('omet les champs absents au lieu de les écrire à null', () => {
    const plain = toPlain(reward('r1', '2025-04-07T01:14:30Z', 'SOL', '1'))
    expect(plain).not.toHaveProperty('valueEur')
  })

  it('refuse une date illisible', () => {
    expect(() => fromPlain({ $date: 'hier' })).toThrow('Date illisible')
  })
})
