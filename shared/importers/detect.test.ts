import { describe, expect, it } from 'vitest'

import { ImportError } from './csv'
import { importFile } from './detect'

describe('importFile', () => {
  it('reconnaît un export Trade Republic', () => {
    const text = [
      'datetime,date,account_type,category,type,asset_class,name,symbol,shares,price,amount,fee,tax,currency,original_amount,original_currency,fx_rate,description,transaction_id,counterparty_name,counterparty_iban,payment_reference,mcc_code',
      '"2025-03-03T07:41:42.619Z","2025-03-03","DEFAULT","TRADING","BUY","CRYPTO","XRP","XRP","3.774849","2.649112","-10.00","","","EUR","","","","Savings plan execution","a1","","","",""',
    ].join('\n')

    const result = importFile(text)

    expect(result.platform).toBe('trade-republic')
    expect(result.transactions).toHaveLength(1)
  })

  it('reconnaît un relevé Coinbase malgré les lignes avant l’en-tête', () => {
    const text = [
      'Transactions',
      'User,Jeanne Martin,0000-fictif',
      '',
      'ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes',
      'b1,2024-03-01 10:00:00 UTC,Buy,BTC,0.01,EUR,€60000.00,€600.00,€609.00,€9.00,Bought 0.01 BTC for €609.00 EUR',
    ].join('\n')

    expect(importFile(text).platform).toBe('coinbase')
  })

  it('reconnaît Kraken, Crypto.com et Bitvavo d’après leur en-tête', () => {
    const kraken =
      '"txid","refid","time","type","subtype","aclass","asset","amount","fee","balance"\n'
    const cryptoCom =
      '\uFEFFTimestamp (UTC),Transaction Description,Currency,Amount,To Currency,To Amount,Native Currency,Native Amount,Native Amount (in USD),Transaction Kind\n'
    const bitvavo =
      'Timezone,Date,Time,Type,Currency,Amount,Quote Currency,Quote Price,Received / Paid Currency,Received / Paid Amount,Fee currency,Fee amount,Status,Transaction ID,Address\n'

    expect(importFile(kraken).platform).toBe('kraken')
    expect(importFile(cryptoCom).platform).toBe('crypto-com')
    expect(importFile(bitvavo).platform).toBe('bitvavo')
  })

  it('refuse un autre fichier en citant les plateformes prises en charge', () => {
    expect(() => importFile('Date,Libellé,Montant\n2025-01-01,Café,-2.50\n')).toThrow(
      'Trade Republic, Coinbase, Kraken, Crypto.com ou Bitvavo',
    )
  })

  it('refuse un autre fichier', () => {
    expect(() => importFile('Date,Libellé,Montant\n2025-01-01,Café,-2.50\n')).toThrow(ImportError)
  })
})
