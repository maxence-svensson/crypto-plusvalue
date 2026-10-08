import { Dec } from '../tax/decimal'
import type { Transaction } from './transaction'

/** Constructeurs de transactions pour les tests : montants en nombres, dates ISO. */

type Num = number | string

const d = (value: Num) => new Dec(value)
const base = (id: string, date: string) => ({
  id,
  source: 'manual' as const,
  date: new Date(date),
  label: id,
})

export const buy = (
  id: string,
  date: string,
  asset: string,
  quantity: Num,
  eur: Num,
  fee: Num = 0,
): Transaction => ({
  ...base(id, date),
  type: 'buy',
  received: { asset, quantity: d(quantity) },
  amountEur: d(eur),
  feeEur: d(fee),
})

export const sell = (
  id: string,
  date: string,
  asset: string,
  quantity: Num,
  eur: Num,
  fee: Num = 0,
): Transaction => ({
  ...base(id, date),
  type: 'sell',
  sent: { asset, quantity: d(quantity) },
  amountEur: d(eur),
  feeEur: d(fee),
})

export const pay = (
  id: string,
  date: string,
  asset: string,
  quantity: Num,
  eur: Num,
): Transaction => ({
  ...base(id, date),
  type: 'payment',
  sent: { asset, quantity: d(quantity) },
  amountEur: d(eur),
  feeEur: d(0),
})

export const swap = (
  id: string,
  date: string,
  sent: [string, Num],
  received: [string, Num],
): Transaction => ({
  ...base(id, date),
  type: 'swap',
  sent: { asset: sent[0], quantity: d(sent[1]) },
  received: { asset: received[0], quantity: d(received[1]) },
})

export const reward = (
  id: string,
  date: string,
  asset: string,
  quantity: Num,
  valueEur?: Num,
): Transaction => ({
  ...base(id, date),
  type: 'reward',
  received: { asset, quantity: d(quantity) },
  valueEur: valueEur === undefined ? undefined : d(valueEur),
})

export const transferIn = (
  id: string,
  date: string,
  asset: string,
  quantity: Num,
): Transaction => ({
  ...base(id, date),
  type: 'transfer-in',
  received: { asset, quantity: d(quantity) },
})

export const transferOut = (
  id: string,
  date: string,
  asset: string,
  quantity: Num,
  fee?: Num,
): Transaction => ({
  ...base(id, date),
  type: 'transfer-out',
  sent: { asset, quantity: d(quantity) },
  fee: fee === undefined ? undefined : { asset, quantity: d(fee) },
})
