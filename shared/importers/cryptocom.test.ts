import { describe, expect, it } from 'vitest'

import { importCryptoCom } from './cryptocom'

// Relevé fictif au format de l'application (onze colonnes, avec `Transaction Hash`).
const HEADER =
  'Timestamp (UTC),Transaction Description,Currency,Amount,To Currency,To Amount,Native Currency,Native Amount,Native Amount (in USD),Transaction Kind,Transaction Hash'
const ROWS = [
  '2025-01-10 08:15:02,EUR -> BTC,EUR,-150.0,BTC,0.00163104,EUR,150.0,155.31,viban_purchase,',
  '2025-01-10 09:00:41,Buy ETH,ETH,0.0312,,,EUR,100.12,103.67,crypto_purchase,',
  '2025-02-01 03:12:55,Crypto Earn,USDC,0.42181,,,EUR,0.41,0.42,crypto_earn_interest_paid,',
  '2025-02-14 18:30:11,BTC -> EUR,BTC,-0.0005,EUR,47.92,EUR,47.92,49.62,crypto_viban_exchange,',
  '2025-02-20 12:01:07,ETH -> SOL,ETH,-0.01,SOL,0.21,EUR,31.20,32.31,crypto_exchange,',
  '2025-03-03 11:22:33,Withdraw BTC,BTC,-0.0004,,,EUR,-33.80,-35.00,crypto_withdrawal,4f0c9d2a',
  '2025-03-04 10:00:00,Ordre limite,EUR,-50.0,,,EUR,50.0,51.0,trading.limit_order.fiat_wallet.purchase_lock,',
  '2025-03-05 06:00:00,Dust,BTC,-0.000001,,,EUR,0.09,0.09,dust_conversion_debited,',
  '2025-03-06 09:00:00,Dépôt,EUR,500.0,,,EUR,500.0,520.0,viban_deposit,',
]
const record = (...rows: string[]) => [HEADER, ...rows].join('\n') + '\n'

describe('importCryptoCom', () => {
  it('lit achats, ventes, échanges, récompenses et retraits', () => {
    const { transactions, unsupported, skipped } = importCryptoCom(record(...ROWS))

    expect(transactions.map((transaction) => transaction.type)).toEqual([
      'buy',
      'buy',
      'reward',
      'sell',
      'swap',
      'transfer-out',
    ])
    // Le dépôt d'euros est ignoré ; le blocage d'un ordre limite aussi, sans compter.
    expect(skipped).toBe(1)
    // La conversion de poussières se fait sur plusieurs lignes : à vérifier.
    expect(unsupported.map((item) => item.line)).toEqual([9])

    const [cashBuy, cardBuy, reward, sell, swap] = transactions
    if (cashBuy?.type !== 'buy' || cardBuy?.type !== 'buy') throw new Error('Achats attendus')
    expect(cashBuy.received.asset).toBe('BTC')
    expect(cashBuy.received.quantity.toString()).toBe('0.00163104')
    expect(cashBuy.amountEur.toString()).toBe('150')
    expect(cardBuy.amountEur.toString()).toBe('100.12')
    if (reward?.type !== 'reward') throw new Error('Récompense attendue')
    expect(reward.valueEur?.toString()).toBe('0.41')
    if (sell?.type !== 'sell') throw new Error('Vente attendue')
    expect(sell.sent.quantity.toString()).toBe('0.0005')
    expect(sell.amountEur.toString()).toBe('47.92')
    if (swap?.type !== 'swap') throw new Error('Échange attendu')
    expect(swap.received).toMatchObject({ asset: 'SOL' })
  })

  it('donne le même identifiant à une opération présente dans deux exports', () => {
    const first = importCryptoCom(record(ROWS[0] ?? '', ROWS[1] ?? ''))
    const second = importCryptoCom(record(ROWS[1] ?? '', ROWS[3] ?? ''))

    expect(first.transactions[1]?.id).toBe(second.transactions[0]?.id)
  })

  it('distingue deux lignes identiques du même fichier', () => {
    const row = ROWS[2] ?? ''
    const { transactions } = importCryptoCom(record(row, row))

    expect(new Set(transactions.map((transaction) => transaction.id)).size).toBe(2)
  })

  it('signale un achat par carte quand la monnaie d’affichage n’est pas l’euro', () => {
    const { transactions, unsupported } = importCryptoCom(
      record('2025-01-10 09:00:41,Buy ETH,ETH,0.0312,,,USD,103.67,103.67,crypto_purchase,'),
    )

    expect(transactions).toEqual([])
    expect(unsupported).toHaveLength(1)
  })
})
