import { describe, expect, it } from 'vitest'

import { computeDisposals, summarizeYear } from '../tax/form2086'
import { replayPortfolio } from '../portfolio/replay'
import { buildTaxEvents } from '../portfolio/tax-events'
import { ImportError } from './csv'
import { importTradeRepublic } from './trade-republic'

const HEADER =
  'datetime,date,account_type,category,type,asset_class,name,symbol,shares,price,amount,fee,tax,currency,original_amount,original_currency,fx_rate,description,transaction_id,counterparty_name,counterparty_iban,payment_reference,mcc_code'

type Row = {
  datetime: string
  category: string
  type: string
  asset_class?: string
  name?: string
  symbol?: string
  shares?: string
  price?: string
  amount?: string
  fee?: string
  description?: string
  id: string
}

/** Une ligne au format de l'export, toutes les valeurs entre guillemets. */
function line(row: Row): string {
  const cells = [
    row.datetime,
    row.datetime.slice(0, 10),
    'DEFAULT',
    row.category,
    row.type,
    row.asset_class ?? '',
    row.name ?? '',
    row.symbol ?? '',
    row.shares ?? '',
    row.price ?? '',
    row.amount ?? '',
    row.fee ?? '',
    '',
    'EUR',
    '',
    '',
    '',
    row.description ?? '',
    row.id,
    '',
    '',
    '',
    '',
  ]
  return cells.map((value) => `"${value}"`).join(',')
}

const csv = (...rows: Row[]) => [HEADER, ...rows.map(line)].join('\n') + '\n'

const savingsPlan: Row = {
  datetime: '2025-03-03T07:41:42.619Z',
  category: 'TRADING',
  type: 'BUY',
  asset_class: 'CRYPTO',
  name: 'XRP',
  symbol: 'XRP',
  shares: '3.7748490000',
  price: '2.649112',
  amount: '-10.00',
  description: 'Savings plan execution XF000XRP0018 XRP, quantity: 3.774849',
  id: 'a1',
}

describe('importTradeRepublic', () => {
  it("lit l'exécution d'un plan d'épargne crypto", () => {
    const { transactions, skipped, unsupported } = importTradeRepublic(csv(savingsPlan))

    expect(skipped).toBe(0)
    expect(unsupported).toEqual([])
    expect(transactions).toHaveLength(1)

    const [buy] = transactions
    expect(buy).toMatchObject({
      id: 'trade-republic:a1',
      source: 'trade-republic',
      type: 'buy',
      label: 'Savings plan execution XF000XRP0018 XRP, quantity: 3.774849',
    })
    expect(buy?.date.toISOString()).toBe('2025-03-03T07:41:42.619Z')
    if (buy?.type !== 'buy') throw new Error('Achat attendu')
    expect(buy.received.asset).toBe('XRP')
    expect(buy.received.quantity.toString()).toBe('3.774849')
    expect(buy.amountEur.toString()).toBe('10')
    expect(buy.feeEur.toString()).toBe('0')
  })

  it('lit un achat ponctuel et une vente avec leurs frais', () => {
    const { transactions } = importTradeRepublic(
      csv(
        {
          datetime: '2026-01-05T09:00:00.000Z',
          category: 'TRADING',
          type: 'BUY',
          asset_class: 'CRYPTO',
          symbol: 'BTC',
          shares: '0.0100000000',
          amount: '-900.00',
          fee: '-1.00',
          id: 'b1',
        },
        {
          datetime: '2026-02-05T09:00:00.000Z',
          category: 'TRADING',
          type: 'SELL',
          asset_class: 'CRYPTO',
          symbol: 'BTC',
          shares: '-0.0040000000',
          amount: '400.00',
          fee: '-1.00',
          id: 's1',
        },
      ),
    )

    const [buy, sell] = transactions
    if (buy?.type !== 'buy' || sell?.type !== 'sell') throw new Error('Achat puis vente attendus')
    expect(buy.amountEur.toString()).toBe('900')
    expect(buy.feeEur.toString()).toBe('1')
    expect(sell.sent.quantity.toString()).toBe('0.004')
    expect(sell.amountEur.toString()).toBe('400')
    expect(sell.feeEur.toString()).toBe('1')
  })

  it('ignore les titres, y compris les fonds et ETF sur le thème de la crypto', () => {
    const { transactions, skipped } = importTradeRepublic(
      csv(
        savingsPlan,
        {
          datetime: '2025-06-02T10:38:53.106Z',
          category: 'TRADING',
          type: 'BUY',
          asset_class: 'FUND',
          name: 'Crypto &amp; Blockchain Innovators USD (Acc)',
          symbol: 'IE00BMDKNW35',
          shares: '0.8692410000',
          amount: '-7.00',
          id: 'f1',
        },
        {
          datetime: '2025-06-03T12:00:00.000Z',
          category: 'CASH',
          type: 'CARD_TRANSACTION',
          id: 'c1',
        },
      ),
    )

    expect(transactions.map((transaction) => transaction.id)).toEqual(['trade-republic:a1'])
    expect(skipped).toBe(2)
  })

  it('lit les récompenses de staking, avec leur valeur au cours du jour', () => {
    const { transactions } = importTradeRepublic(
      csv({
        datetime: '2025-11-24T19:30:13.670Z',
        category: 'DELIVERY',
        type: 'FREE_RECEIPT',
        asset_class: 'CRYPTO',
        name: 'Solana',
        symbol: 'SOL',
        shares: '0.0004110000',
        price: '118.7000000000',
        description: 'FREE_RECEIPT SOL',
        id: 'r1',
      }),
    )

    const [reward] = transactions
    if (reward?.type !== 'reward') throw new Error('Récompense attendue')
    expect(reward.received.asset).toBe('SOL')
    expect(reward.received.quantity.toString()).toBe('0.000411')
    expect(reward.valueEur?.toString()).toBe('0.0487857')
  })

  it('traite les envois comme des transferts, et ignore les migrations internes', () => {
    const delivery = (type: string, shares: string, id: string): Row => ({
      datetime: '2026-03-01T10:00:00Z',
      category: 'DELIVERY',
      type,
      asset_class: 'CRYPTO',
      symbol: 'BTC',
      shares,
      id,
    })

    const { transactions, unsupported } = importTradeRepublic(
      csv(
        delivery('FREE_DELIVERY', '-0.0200000000', 'd1'),
        delivery('MIGRATION', '-0.0300000000', 'm1'),
        delivery('MIGRATION', '0.0300000000', 'm2'),
      ),
    )

    expect(transactions.map((transaction) => transaction.type)).toEqual(['transfer-out'])
    expect(unsupported).toEqual([])
  })

  it('retrouve le symbole derrière un pseudo-ISIN', () => {
    const { transactions } = importTradeRepublic(
      csv({
        ...savingsPlan,
        name: 'Render',
        symbol: 'XF0RENDER015',
        description: 'Buy trade XF0RENDER015 Render Token, quantity: 100',
      }),
    )

    const [buy] = transactions
    if (buy?.type !== 'buy') throw new Error('Achat attendu')
    expect(buy.received.asset).toBe('RENDER')
  })

  it('compte le staking dans les avoirs vendus ensuite', () => {
    const { transactions } = importTradeRepublic(
      csv(
        { ...savingsPlan, symbol: 'NEAR', shares: '390.1371', amount: '-500.00' },
        {
          datetime: '2025-12-01T18:01:04.792Z',
          category: 'DELIVERY',
          type: 'FREE_RECEIPT',
          asset_class: 'CRYPTO',
          symbol: 'NEAR',
          shares: '7.532401',
          price: '1.35',
          id: 'r1',
        },
        {
          datetime: '2026-09-27T05:59:25.530Z',
          category: 'TRADING',
          type: 'SELL',
          asset_class: 'CRYPTO',
          symbol: 'NEAR',
          shares: '-397.6695010000',
          price: '4.6418000000',
          amount: '1845.90',
          fee: '-1.00',
          id: 's1',
        },
      ),
    )

    expect(replayPortfolio(transactions).missingHistory).toEqual([])
  })

  it('signale les lignes crypto inconnues au lieu de les perdre', () => {
    const { transactions, unsupported } = importTradeRepublic(
      csv({
        datetime: '2025-11-20T10:00:00Z',
        category: 'CASH',
        type: 'BONUS',
        asset_class: 'CRYPTO',
        symbol: 'BTC',
        shares: '0.0001',
        description: 'Bonus',
        id: 'x1',
      }),
    )

    expect(transactions).toEqual([])
    expect(unsupported).toEqual([{ line: 2, label: 'CASH BONUS : Bonus' }])
  })

  it('accepte des microsecondes et le séparateur point-virgule', () => {
    const text = [
      'datetime;category;type;asset_class;symbol;shares;amount;fee;currency;description;transaction_id;value_date',
      '2025-01-23T08:05:37.248276Z;TRADING;BUY;CRYPTO;ETH;0.01;-30.00;;EUR;Buy trade;e1;2025-01-23',
    ].join('\n')

    const [buy] = importTradeRepublic(text).transactions

    expect(buy?.date.toISOString()).toBe('2025-01-23T08:05:37.248Z')
  })

  it('accepte un fichier commençant par une marque d’ordre des octets (BOM)', () => {
    expect(importTradeRepublic('\uFEFF' + csv(savingsPlan)).transactions).toHaveLength(1)
  })

  it("refuse un fichier qui n'est pas un export Trade Republic", () => {
    expect(() => importTradeRepublic('Date,Montant\n2025-01-01,10\n')).toThrow(ImportError)
  })

  it('indique la ligne fautive', () => {
    expect(() => importTradeRepublic(csv({ ...savingsPlan, shares: 'abc' }))).toThrow(
      "Ligne 2 : « abc » n'est pas un nombre (colonne shares).",
    )
  })

  it('refuse une devise autre que l’euro', () => {
    const text = csv(savingsPlan).replace('"EUR"', '"USD"')
    expect(() => importTradeRepublic(text)).toThrow('seuls les euros')
  })

  it('alimente le calcul du 2086 de bout en bout', () => {
    const { transactions } = importTradeRepublic(
      csv(
        {
          ...savingsPlan,
          datetime: '2025-01-10T10:00:00Z',
          symbol: 'BTC',
          shares: '0.1',
          amount: '-1000.00',
          fee: '',
        },
        {
          datetime: '2025-08-10T10:00:00Z',
          category: 'TRADING',
          type: 'SELL',
          asset_class: 'CRYPTO',
          symbol: 'BTC',
          shares: '-0.1',
          amount: '1300.00',
          fee: '-1.00',
          id: 's1',
        },
      ),
    )

    const result = buildTaxEvents(transactions, () => undefined)
    if (!result.ok) throw new Error('Aucun cours ne devrait manquer')
    const summary = summarizeYear(computeDisposals(result.events), 2025)

    // 1 300 − 1 € de frais − 1 000 € investis
    expect(summary.netGain.toString()).toBe('299')
    expect(summary.box3AN).toBe(299)
  })
})
