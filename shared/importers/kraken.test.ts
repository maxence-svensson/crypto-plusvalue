import { describe, expect, it } from 'vitest'

import { buildTaxEvents } from '../portfolio/tax-events'
import type { Transaction } from '../portfolio/transaction'
import { Dec } from '../tax/decimal'
import { computeDisposals } from '../tax/form2086'
import { importKraken } from './kraken'

// Grand livre fictif au format 2025 (douze colonnes), d'après la documentation de Kraken.
const HEADER =
  '"txid","refid","time","type","subtype","aclass","subclass","asset","wallet","amount","fee","balance"'
const ROWS = [
  '"LDEP01","FTDEP01","2025-03-03 08:12:45","deposit","","currency","fiat","EUR","spot / main",1000.0000,0,1000.0000',
  '"LTR01A","TRADE01","2025-03-03 08:20:02","trade","tradespot","currency","fiat","EUR","spot / main",-400.0000,1.0000,599.0000',
  '"LTR01B","TRADE01","2025-03-03 08:20:02","trade","tradespot","currency","crypto","BTC","spot / main",0.0045000000,0,0.0045000000',
  '"LSP01A","INSTANT1","2025-04-01 10:00:15","spend","","currency","fiat","EUR","spot / main",-49.2500,0.7500,549.0000',
  '"LSP01B","INSTANT1","2025-04-01 10:00:15","receive","","currency","crypto","SOL","spot / main",0.3412000000,0,0.3412000000',
  '"LRW01","REWARD1","2025-04-07 01:14:30","earn","reward","currency","crypto","SOL.S","earn / locked",0.0004120000,0.0000103000,0.3416017000',
  '"LAL01","ALLOC1","2025-04-08 01:00:00","earn","allocation","currency","crypto","SOL","spot / main",-0.3000000000,0,0.0416017000',
  '"LAL02","ALLOC1","2025-04-08 01:00:00","earn","allocation","currency","crypto","SOL.S","earn / locked",0.3000000000,0,0.3000000000',
  '"LTR02A","TRADE02","2025-05-02 12:00:00","trade","tradespot","currency","crypto","BTC","spot / main",-0.0015000000,0,0.0030000000',
  '"LTR02B","TRADE02","2025-05-02 12:00:00","trade","tradespot","currency","fiat","EUR","spot / main",150.0000,0.4000,698.6000',
  '"LWD01","WITHDRAW1","2025-05-20 18:44:02","withdrawal","","currency","crypto","BTC","spot / main",-0.0020000000,0.0000150000,0.0009850000',
]
const ledger = (...rows: string[]) => [HEADER, ...rows].join('\n') + '\n'

function byId(transactions: Transaction[], id: string) {
  const found = transactions.find((transaction) => transaction.id === `kraken:${id}`)
  if (!found) throw new Error(`Opération ${id} absente`)
  return found
}

describe('importKraken', () => {
  it('lit achats, ventes, achats instantanés, récompenses et retraits', () => {
    const { transactions, skipped, unsupported, anomalies } = importKraken(ledger(...ROWS))

    expect(unsupported).toEqual([])
    expect(anomalies).toEqual([])
    // Le dépôt d'euros est ignoré ; l'allocation vers Earn est un mouvement interne.
    expect(skipped).toBe(1)
    expect(transactions.map((transaction) => transaction.type)).toEqual([
      'buy',
      'buy',
      'reward',
      'sell',
      'transfer-out',
    ])

    const buy = byId(transactions, 'TRADE01')
    if (buy.type !== 'buy') throw new Error('Achat attendu')
    expect(buy.received).toEqual({ asset: 'BTC', quantity: new Dec('0.0045') })
    expect(buy.amountEur.toString()).toBe('400')
    expect(buy.feeEur.toString()).toBe('1')

    // Récompense sur SOL.S : le SOL lui-même, frais déduits.
    const reward = byId(transactions, 'LRW01')
    if (reward.type !== 'reward') throw new Error('Récompense attendue')
    expect(reward.received.asset).toBe('SOL')
    expect(reward.received.quantity.toString()).toBe('0.0004017')

    const sell = byId(transactions, 'TRADE02')
    if (sell.type !== 'sell') throw new Error('Vente attendue')
    expect(sell.sent.quantity.toString()).toBe('0.0015')
    expect(sell.amountEur.toString()).toBe('150')
    expect(sell.feeEur.toString()).toBe('0.4')

    const withdrawal = byId(transactions, 'LWD01')
    if (withdrawal.type !== 'transfer-out') throw new Error('Retrait attendu')
    expect(withdrawal.sent.quantity.toString()).toBe('0.002')
    expect(withdrawal.fee?.quantity.toString()).toBe('0.000015')
  })

  it('traduit les codes historiques sans abîmer les symboles récents', () => {
    const old = [
      '"txid","refid","time","type","subtype","aclass","asset","amount","fee","balance"',
      '"","DEP1","2021-11-01 09:00:00.0000","deposit","","currency","ZEUR",1000.0000,0.0000,""',
      '"LJ1","DEP1","2021-11-01 09:04:12.5530","deposit","","currency","ZEUR",1000.0000,0.0000,1000.0000',
      '"L71","T1","2021-11-02 14:03:51.2214","trade","","currency","ZEUR",-250.0000,0.4000,749.6000',
      '"L72","T1","2021-11-02 14:03:51.2214","trade","","currency","XXBT",0.0046210000,0.0000000000,0.0046210000',
      '"L81","T2","2021-11-03 10:00:00.0000","trade","","currency","ZEUR",-50.0000,0.1000,699.5000',
      '"L82","T2","2021-11-03 10:00:00.0000","trade","","currency","XTZ",10.0000000000,0,10.0000000000',
    ].join('\n')
    const { transactions, skipped } = importKraken(old)

    // La ligne de dépôt en attente (sans txid) et le dépôt d'euros sont ignorés.
    expect(skipped).toBe(2)
    expect(
      transactions.map((transaction) => 'received' in transaction && transaction.received.asset),
    ).toEqual(['BTC', 'XTZ'])
    expect(transactions[0]?.date.toISOString()).toBe('2021-11-02T14:03:51.221Z')
  })

  it('signale ce qui ne se calcule pas sans analyse : marge, échange en dollars', () => {
    const { transactions, unsupported } = importKraken(
      ledger(
        '"LM1","MARGIN1","2025-06-01 10:00:00","margin","","currency","fiat","EUR","spot / main",-5.0000,0,0',
        '"LU1","USD1","2025-06-02 10:00:00","trade","tradespot","currency","fiat","USD","spot / main",-100.0000,0.2,0',
        '"LU2","USD1","2025-06-02 10:00:00","trade","tradespot","currency","crypto","ETH","spot / main",0.04,0,0.04',
      ),
    )

    expect(transactions).toEqual([])
    expect(unsupported.map((item) => item.line)).toEqual([2, 3, 4])
  })

  it('alimente le calcul du 2086', () => {
    const { transactions } = importKraken(ledger(...ROWS))
    const prices = (asset: string) => new Dec(asset === 'BTC' ? 100000 : 150)
    const events = buildTaxEvents(transactions, prices)
    if (!events.ok) throw new Error('Cours manquants')
    const [disposal] = computeDisposals(events.events)

    // Vente de 0,0015 BTC pour 150 € : portefeuille = 150 + 0,003 × 100 000 + 0,3416017 × 150.
    expect(disposal?.portfolioValue.toString()).toBe('501.240255')
    // Prix total d'acquisition : 401 € (BTC) + 50 € (SOL, frais compris).
    expect(disposal?.totalAcquisitionCost.toString()).toBe('451')
  })
})
