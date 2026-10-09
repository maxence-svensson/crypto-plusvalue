import { describe, expect, it } from 'vitest'

import { importBitvavo } from './bitvavo'

const HEADER =
  'Timezone,Date,Time,Type,Currency,Amount,Quote Currency,Quote Price,Received / Paid Currency,Received / Paid Amount,Fee currency,Fee amount,Status,Transaction ID,Address'
const ROWS = [
  'Europe/Amsterdam,2025-02-03,10:15:22,deposit,EUR,250,,,,,EUR,0,Completed,6f1d2c3b-0001,FR76************1234',
  'Europe/Amsterdam,2025-02-03,10:20:41.118,buy,BTC,0.00104856,EUR,95130.50,EUR,-100.00,EUR,0.25,Completed,a2b3c4d5-0002,',
  'Europe/Amsterdam,2025-03-01,04:00:12,staking,ETH,0.00031245,,,,,,,Distributed,c9d8e7f6-0003,',
  'Europe/Amsterdam,2025-04-10,15:02:09.904,sell,ETH,-0.25,EUR,1490.20,EUR,371.62,EUR,0.93,Completed,0e1f2a3b-0004,',
  'Europe/Amsterdam,2025-05-02,19:44:51,withdrawal,ETH,-0.1,,,,,ETH,0.0012,Completed,5b6c7d8e-0005,0x3fA9c21E',
  'Europe/Amsterdam,2025-05-03,09:00:00,buy,SOL,1.5,EUR,150,EUR,-225.38,EUR,0.38,Pending,7a7a7a7a-0006,',
]
const history = (...rows: string[]) => [HEADER, ...rows].join('\n') + '\n'

describe('importBitvavo', () => {
  it('lit achats, ventes, staking et retraits, à l’heure du fuseau indiqué', () => {
    const { transactions, skipped, unsupported } = importBitvavo(history(...ROWS))

    expect(unsupported).toEqual([])
    // Dépôt d'euros et achat en attente : ignorés.
    expect(skipped).toBe(2)
    expect(transactions.map((transaction) => transaction.type)).toEqual([
      'buy',
      'reward',
      'sell',
      'transfer-out',
    ])

    const [buy, , sell, withdrawal] = transactions
    if (buy?.type !== 'buy') throw new Error('Achat attendu')
    // 10:20 à Amsterdam en février (UTC+1) : 09:20 UTC.
    expect(buy.date.toISOString()).toBe('2025-02-03T09:20:41.118Z')
    // 100 € débités, dont 0,25 € de frais.
    expect(buy.amountEur.toString()).toBe('99.75')
    expect(buy.feeEur.toString()).toBe('0.25')

    if (sell?.type !== 'sell') throw new Error('Vente attendue')
    // 371,62 € crédités après 0,93 € de frais : prix brut 372,55 €.
    expect(sell.amountEur.toString()).toBe('372.55')
    expect(sell.date.toISOString()).toBe('2025-04-10T13:02:09.904Z')

    if (withdrawal?.type !== 'transfer-out') throw new Error('Retrait attendu')
    expect(withdrawal.sent.quantity.toString()).toBe('0.1')
    expect(withdrawal.fee?.quantity.toString()).toBe('0.0012')
  })

  it('accepte le point-virgule comme séparateur', () => {
    const semicolons = history(ROWS[1] ?? '').replaceAll(',', ';')
    expect(importBitvavo(semicolons).transactions).toHaveLength(1)
  })
})
