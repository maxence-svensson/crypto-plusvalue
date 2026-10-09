import { describe, expect, it } from 'vitest'

import { buildTaxEvents } from './tax-events'
import { computeDisposals } from '../tax/form2086'
import { Dec } from '../tax/decimal'
import { flows, foldTail, gainsByYear, purchasesByAsset, volumeBySource } from './activity'
import { buy, pay, reward, sell } from './fixtures'
import type { Transaction } from './transaction'

const kraken = (transaction: Transaction): Transaction => ({ ...transaction, source: 'kraken' })

const LIST: Transaction[] = [
  // 31/12/2023 23:30 UTC : déjà 2024 à Paris.
  buy('a', '2023-12-31T23:30:00Z', 'BTC', '0.01', '400', '2'),
  kraken(buy('b', '2024-03-10T10:00:00Z', 'ETH', '1', '3000')),
  sell('c', '2024-03-20T10:00:00Z', 'BTC', '0.005', '300'),
  pay('d', '2024-11-05T10:00:00Z', 'ETH', '0.1', '350'),
  reward('e', '2024-11-06T10:00:00Z', 'SOL', '1', '150'),
  buy('f', '2025-02-01T10:00:00Z', 'SOL', '10', '1500'),
]

const plain = (items: { key: string; value: Dec }[]) =>
  items.map(({ key, value }) => [key, value.toNumber()])

describe('flows', () => {
  it('répartit achats et ventes par mois, heure de Paris, douze mois même vides', () => {
    const months = flows(LIST, 2024)
    expect(months).toHaveLength(12)
    expect(months[0]).toMatchObject({ key: '2024-01', label: 'janv.' })
    expect(months[0]?.bought.toNumber()).toBe(400)
    expect(months[2]?.bought.toNumber()).toBe(3000)
    expect(months[2]?.sold.toNumber()).toBe(300)
    // Paiement en crypto compté avec les ventes ; récompense ignorée.
    expect(months[10]?.sold.toNumber()).toBe(350)
    expect(months[10]?.bought.toNumber()).toBe(0)
  })

  it('répartit par année, de la première à la dernière', () => {
    const years = flows(LIST)
    expect(years.map(({ key, bought, sold }) => [key, bought.toNumber(), sold.toNumber()])).toEqual(
      [
        ['2024', 3400, 650],
        ['2025', 1500, 0],
      ],
    )
    expect(flows([])).toEqual([])
  })
})

describe('répartition', () => {
  it('classe les achats par crypto et le volume par source', () => {
    expect(plain(purchasesByAsset(LIST))).toEqual([
      ['ETH', 3000],
      ['SOL', 1500],
      ['BTC', 400],
    ])
    expect(plain(purchasesByAsset(LIST, 2025))).toEqual([['SOL', 1500]])
    expect(plain(volumeBySource(LIST, 2024))).toEqual([
      ['kraken', 3000],
      ['manual', 1050],
    ])
  })

  it('regroupe la fin de liste sous « Autres », sauf s’il ne reste qu’une part', () => {
    const shares = ['A', 'B', 'C', 'D'].map((key, index) => ({ key, value: new Dec(10 - index) }))
    expect(plain(foldTail(shares, 2))).toEqual([
      ['A', 10],
      ['B', 9],
      ['Autres', 15],
    ])
    expect(foldTail(shares, 3)).toHaveLength(4)
  })
})

describe('gainsByYear', () => {
  it('donne la plus-value nette de chaque année et signale les années exonérées', () => {
    const transactions = [
      buy('a', '2024-01-10T10:00:00Z', 'BTC', '1', '1000'),
      sell('b', '2024-06-10T10:00:00Z', 'BTC', '0.1', '200'),
      sell('c', '2025-06-10T10:00:00Z', 'BTC', '0.5', '2000'),
    ]
    const events = buildTaxEvents(transactions, () => new Dec(4000))
    if (!events.ok) throw new Error('Cours manquants')
    const gains = gainsByYear(computeDisposals(events.events), [2025, 2024])
    expect(gains.map(({ year, count, exempt }) => [year, count, exempt])).toEqual([
      [2024, 1, true],
      [2025, 1, false],
    ])
    expect(gains[1]?.gain.gt(0)).toBe(true)
  })
})
