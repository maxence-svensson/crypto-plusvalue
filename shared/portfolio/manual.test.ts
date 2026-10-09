import { describe, expect, it } from 'vitest'

import { Dec } from '../tax/decimal'
import { buy, reward, swap, transferOut } from './fixtures'
import { buildManualTransaction, emptyForm, formOf, parseDecimal, type ManualForm } from './manual'

const NOW = new Date('2026-10-09T12:00:00Z')
const target = { id: 'manual:1', source: 'manual' as const }

const form = (fields: Partial<ManualForm>): ManualForm => ({
  ...emptyForm(NOW),
  date: '2025-03-03',
  time: '09:20',
  ...fields,
})

function built(fields: Partial<ManualForm>) {
  const result = buildManualTransaction(form(fields), target, NOW)
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.transaction
}

describe('parseDecimal', () => {
  it('lit les nombres tapés à la française ou à l’anglaise', () => {
    expect(parseDecimal('1 234,56')?.toString()).toBe('1234.56')
    expect(parseDecimal('1\u202f234,5')?.toString()).toBe('1234.5')
    expect(parseDecimal('0.0015')?.toString()).toBe('0.0015')
    expect(parseDecimal(',5')?.toString()).toBe('0.5')
  })

  it('refuse le reste : signe, lettres, deux séparateurs', () => {
    for (const text of ['-1', '1e5', 'abc', '1,2,3', '', '1.234,56']) {
      expect(parseDecimal(text)).toBeUndefined()
    }
  })
})

describe('buildManualTransaction', () => {
  it('construit un achat, date à l’heure de Paris, frais à zéro par défaut', () => {
    const transaction = built({ asset: 'btc', quantity: '0,0045', amountEur: '400' })
    expect(transaction).toEqual({
      id: 'manual:1',
      source: 'manual',
      date: new Date('2025-03-03T08:20:00Z'),
      label: 'Saisie manuelle',
      type: 'buy',
      received: { asset: 'BTC', quantity: new Dec('0.0045') },
      amountEur: new Dec(400),
      feeEur: new Dec(0),
    })
  })

  it('construit vente, échange, récompense et envoi', () => {
    const sale = built({
      type: 'sell',
      asset: 'ETH',
      quantity: '0,5',
      amountEur: '1500',
      feeEur: '2',
    })
    expect(sale).toMatchObject({ type: 'sell', sent: { asset: 'ETH' }, feeEur: new Dec(2) })

    const exchange = built({
      type: 'swap',
      asset: 'ETH',
      quantity: '1',
      toAsset: 'usdc',
      toQuantity: '3000',
    })
    expect(exchange).toMatchObject({
      type: 'swap',
      sent: { asset: 'ETH', quantity: new Dec(1) },
      received: { asset: 'USDC', quantity: new Dec(3000) },
    })

    // Valeur d'une récompense : facultative.
    expect(built({ type: 'reward', asset: 'SOL', quantity: '0,01' })).not.toHaveProperty('valueEur')
    expect(
      built({ type: 'reward', asset: 'SOL', quantity: '0,01', amountEur: '1,5' }),
    ).toMatchObject({
      valueEur: new Dec('1.5'),
    })

    expect(
      built({ type: 'transfer-out', asset: 'BTC', quantity: '0,002', networkFee: '0,000015' }),
    ).toMatchObject({ fee: { asset: 'BTC', quantity: new Dec('0.000015') } })
  })

  it('rattache chaque erreur à son champ', () => {
    const result = buildManualTransaction(
      form({ type: 'buy', date: '2026-12-01', asset: 'EUR', quantity: '0', amountEur: '' }),
      target,
      NOW,
    )
    expect(result).toEqual({
      ok: false,
      errors: {
        date: 'Date dans le futur.',
        asset: 'Une monnaie officielle n’est pas un actif numérique.',
        quantity: 'Quantité positive attendue.',
        amountEur: 'Montant en euros obligatoire.',
      },
    })
  })

  it('refuse un échange vers le même actif et une date avant 2009', () => {
    const result = buildManualTransaction(
      form({
        type: 'swap',
        date: '2008-12-31',
        asset: 'BTC',
        quantity: '1',
        toAsset: 'btc',
        toQuantity: '1',
      }),
      target,
      NOW,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.toAsset).toMatch(/deux actifs différents/)
    expect(result.errors.date).toMatch(/premier bloc/)
  })

  it('ignore les champs qui ne concernent pas le type choisi', () => {
    const transfer = built({
      type: 'transfer-in',
      asset: 'BTC',
      quantity: '1',
      amountEur: 'n’importe quoi',
    })
    expect(transfer).not.toHaveProperty('amountEur')
  })
})

describe('formOf', () => {
  it('redonne une opération à l’identique quand rien ne change', () => {
    const originals = [
      buy('cb:1', '2025-03-03T08:20:02.123Z', 'BTC', '0.0000001', '400', '1.5'),
      swap('cb:2', '2025-04-01T10:00:00Z', ['ETH', '1'], ['USDC', '3000']),
      reward('cb:3', '2025-04-07T01:14:30Z', 'SOL', '0.0004017', '0.06'),
      transferOut('cb:4', '2025-05-20T18:44:02Z', 'BTC', '0.002', '0.000015'),
    ]
    for (const original of originals) {
      const result = buildManualTransaction(
        formOf(original),
        { id: original.id, source: original.source, original },
        NOW,
      )
      expect(result).toEqual({ ok: true, transaction: original })
    }
  })

  it('écrit les quantités sans notation scientifique', () => {
    expect(formOf(buy('a', '2025-01-01T00:00:00Z', 'BTC', '0.00000001', '1')).quantity).toBe(
      '0,00000001',
    )
  })

  it('prend la nouvelle date quand la minute change', () => {
    const original = buy('cb:1', '2025-03-03T08:20:02Z', 'BTC', '1', '400')
    const result = buildManualTransaction(
      { ...formOf(original), time: '09:21' },
      { id: original.id, source: original.source, original },
      NOW,
    )
    expect(result.ok && result.transaction.date).toEqual(new Date('2025-03-03T08:21:00Z'))
  })
})
