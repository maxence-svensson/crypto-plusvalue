import { describe, expect, it } from 'vitest'

import { buildTaxEvents } from '../portfolio/tax-events'
import type { Transaction } from '../portfolio/transaction'
import { computeDisposals, summarizeYear } from '../tax/form2086'
import { importCoinbase } from './coinbase'
import { ImportError } from './csv'

// Relevé fictif au format de 2024 et après : deux lignes d'information avant l'en-tête.
const PREAMBLE = ['Transactions', 'User,Jeanne Martin,0000-fictif', '']
const HEADER =
  'ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes'

const statement = (...rows: string[]) => [...PREAMBLE, HEADER, ...rows].join('\n') + '\n'

const BUY =
  'b1,2024-03-01 10:00:00 UTC,Buy,BTC,0.01,EUR,€60000.00,€600.00,€609.00,€9.00,Bought 0.01 BTC for €609.00 EUR'
const SELL =
  's1,2024-06-01 10:00:00 UTC,Sell,BTC,-0.004,EUR,€70000.00,€280.00,€275.80,€4.20,Sold 0.004 BTC for €275.80 EUR'
const CONVERT =
  'c1,2024-05-01 10:00:00 UTC,Convert,BTC,-0.002,EUR,€65000.00,€130.00,€131.95,€1.95,Converted 0.002 BTC to 0.05 ETH'
const STAKING =
  'r1,2024-04-01 10:00:00 UTC,Staking Income,ETH,0.0001,EUR,€3000.00,€0.30,€0.30,€0.00,'
const DEPOSIT =
  'd1,2024-02-28 10:00:00 UTC,Deposit,EUR,1000,EUR,€1.00,"€1,000.00","€1,000.00",€0.00,'

function byId(transactions: Transaction[], id: string) {
  const transaction = transactions.find((candidate) => candidate.id === `coinbase:${id}`)
  if (!transaction) throw new Error(`Transaction ${id} absente`)
  return transaction
}

describe('importCoinbase', () => {
  it('lit achats, ventes, conversions et récompenses, dans l’ordre chronologique', () => {
    // Coinbase liste les opérations de la plus récente à la plus ancienne.
    const { transactions, skipped, unsupported } = importCoinbase(
      statement(SELL, CONVERT, STAKING, BUY, DEPOSIT),
    )

    expect(unsupported).toEqual([])
    expect(skipped).toBe(1)
    expect(transactions.map((transaction) => transaction.id)).toEqual([
      'coinbase:b1',
      'coinbase:r1',
      'coinbase:c1',
      'coinbase:s1',
    ])

    const buy = byId(transactions, 'b1')
    if (buy.type !== 'buy') throw new Error('Achat attendu')
    expect(buy.date.toISOString()).toBe('2024-03-01T10:00:00.000Z')
    expect(buy.received.quantity.toString()).toBe('0.01')
    expect(buy.amountEur.toString()).toBe('600')
    expect(buy.feeEur.toString()).toBe('9')

    const sell = byId(transactions, 's1')
    if (sell.type !== 'sell') throw new Error('Vente attendue')
    expect(sell.sent.quantity.toString()).toBe('0.004')
    expect(sell.amountEur.toString()).toBe('280')
    expect(sell.feeEur.toString()).toBe('4.2')

    const convert = byId(transactions, 'c1')
    if (convert.type !== 'swap') throw new Error('Échange attendu')
    expect(convert.sent).toMatchObject({ asset: 'BTC' })
    expect(convert.received.asset).toBe('ETH')
    expect(convert.received.quantity.toString()).toBe('0.05')

    const staking = byId(transactions, 'r1')
    if (staking.type !== 'reward') throw new Error('Récompense attendue')
    expect(staking.valueEur?.toString()).toBe('0.3')
  })

  it('lit les envois, les réceptions et les paiements par carte', () => {
    const { transactions } = importCoinbase(
      statement(
        'e1,2024-07-01 10:00:00 UTC,Send,ETH,-0.01,EUR,€3000.00,€30.00,€30.00,€0.00,Sent to 0x0000',
        'e2,2024-07-02 10:00:00 UTC,Receive,ETH,0.02,EUR,€3000.00,€60.00,€60.00,€0.00,Received from 0x0000',
        'e3,2024-07-03 10:00:00 UTC,Receive,XLM,5,EUR,€0.10,€0.50,€0.50,€0.00,Received 5 XLM from Coinbase Earn',
        'e4,2024-07-04 10:00:00 UTC,Card Spend,BTC,-0.0002,EUR,€60000.00,€12.00,€12.30,€0.30,',
      ),
    )

    expect(transactions.map((transaction) => transaction.type)).toEqual([
      'transfer-out',
      'transfer-in',
      'reward',
      'payment',
    ])
    const payment = byId(transactions, 'e4')
    if (payment.type !== 'payment') throw new Error('Paiement attendu')
    expect(payment.amountEur.toString()).toBe('12')
    expect(payment.feeEur.toString()).toBe('0.3')
  })

  it('ignore les mouvements internes et signale ce qu’il ne sait pas lire', () => {
    const { transactions, unsupported } = importCoinbase(
      statement(
        'i1,2024-08-01 10:00:00 UTC,Pro Deposit,BTC,-0.001,EUR,€60000.00,€60.00,€60.00,€0.00,',
        'a1,2024-08-02 10:00:00 UTC,Advanced Trade Buy,BTC,0.001,EUR,€60000.00,€60.00,€60.10,€0.10,Bought 0.001 BTC for 65 USDC on BTC-USDC at 65000 USDC/BTC',
        'g1,2024-08-03 10:00:00 UTC,Donation,BTC,-0.001,EUR,€60000.00,€60.00,€60.00,€0.00,',
      ),
    )

    expect(transactions).toEqual([])
    expect(unsupported).toEqual([
      {
        line: 6,
        label: 'Advanced Trade Buy : Bought 0.001 BTC for 65 USDC on BTC-USDC at 65000 USDC/BTC',
      },
      { line: 7, label: 'Donation' },
    ])
  })

  it('traite l’ETH2 de Coinbase comme de l’ETH', () => {
    // Exemple réel : ETH converti en ETH2 en 2023, rendu sous forme d'ETH en 2025.
    const { transactions, unsupported } = importCoinbase(
      statement(
        'm2,2025-01-07 19:26:56 UTC,Receive,ETH,0.180914809326,EUR,€3302.65,€597.49846,€597.49846,€0.00,Received 0.180914809326 ETHs',
        'm1,2025-01-07 19:26:56 UTC,Send,ETH2,-0.180914809326,EUR,€3302.65,-€597.49846,-€597.49846,€0.00,Sent 0.180914809326 ETH2s',
        'm0,2023-05-28 06:23:38 UTC,Convert,ETH,0.17305191,EUR,€1723.88,€298.32163,€298.21913,,Converted 0.17305191 ETH to 0.17305191 ETH2',
      ),
    )

    expect(unsupported).toEqual([])
    expect(
      transactions.map((transaction) => {
        const moved = 'sent' in transaction ? transaction.sent : transaction.received
        return `${transaction.type} ${moved.asset}`
      }),
    ).toEqual(['transfer-in ETH', 'transfer-out ETH'])
  })

  it('lit les relevés plus anciens (sans ID, dates ISO, colonnes renommées)', () => {
    const text = [
      'You can use this transaction report to inform your likely tax obligations.',
      '',
      'Transactions',
      'User,Jeanne Martin,0000-fictif',
      '',
      'Timestamp,Transaction Type,Asset,Quantity Transacted,Spot Price Currency,Spot Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes',
      '2023-07-14T10:40:14Z,Buy,ETH,0.5,EUR,1700.00,850.00,862.50,12.50,Bought 0.5 ETH for €862.50 EUR',
    ].join('\n')

    const [buy] = importCoinbase(text).transactions

    expect(buy?.id).toBe('coinbase:2023-07-14T10:40:14Z#7')
    expect(buy?.date.toISOString()).toBe('2023-07-14T10:40:14.000Z')
    if (buy?.type !== 'buy') throw new Error('Achat attendu')
    expect(buy.amountEur.toString()).toBe('850')
  })

  it('lit les montants avec séparateur de milliers', () => {
    const { transactions } = importCoinbase(
      statement(
        's2,2024-09-01 10:00:00 UTC,Sell,BTC,-0.05,EUR,"€61,000.00","€3,050.00","€3,031.70",€18.30,"Sold 0.05 BTC for €3,031.70 EUR"',
      ),
    )

    const [sell] = transactions
    if (sell?.type !== 'sell') throw new Error('Vente attendue')
    expect(sell.amountEur.toString()).toBe('3050')
  })

  it('indique la ligne fautive, en comptant les lignes avant l’en-tête', () => {
    expect(() => importCoinbase(statement(BUY.replace('€600.00', '€six cents')))).toThrow(
      'Ligne 5 :',
    )
  })

  it('signale les achats en dollars, mais lit les échanges en dollars', () => {
    const { transactions, unsupported } = importCoinbase(
      statement(
        'u1,2022-03-25 06:45:27 UTC,Buy,BTC,0.00166779,USD,$39999.33,$67.01,$70.00,$2.99,Bought 0.00166779 BTC for 70 USD',
        'u2,2022-04-01 10:00:00 UTC,Convert,BTC,-0.001,USD,$40000.00,$40.00,$40.50,,Converted 0.001 BTC to 0.012 ETH',
      ),
    )

    expect(unsupported).toEqual([
      {
        line: 5,
        label: 'Buy : Bought 0.00166779 BTC for 70 USD (montants en USD)',
      },
    ])
    expect(transactions.map((transaction) => transaction.type)).toEqual(['swap'])
  })

  it("refuse un fichier qui n'est pas un relevé Coinbase", () => {
    expect(() => importCoinbase('Date,Montant\n2024-01-01,10\n')).toThrow(ImportError)
  })

  it('alimente le calcul du 2086 de bout en bout', () => {
    const { transactions } = importCoinbase(
      statement(
        's3,2024-10-01 10:00:00 UTC,Sell,BTC,-0.01,EUR,€80000.00,€800.00,€792.00,€8.00,Sold 0.01 BTC for €792.00 EUR',
        BUY,
      ),
    )

    const result = buildTaxEvents(transactions, () => undefined)
    if (!result.ok) throw new Error('Aucun cours ne devrait manquer')
    const summary = summarizeYear(computeDisposals(result.events), 2024)

    // 800 − 8 € de frais − (600 + 9 €) payés à l'achat
    expect(summary.netGain.toString()).toBe('183')
  })
})
