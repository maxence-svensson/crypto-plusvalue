import { chronological, type Transaction } from '../portfolio/transaction'
import {
  amount,
  cell,
  cryptoSymbol,
  eachRow,
  emptyResult,
  readCsv,
  signedAmount,
  zonedDate,
  type CsvRow,
  type ImportResult,
} from './csv'

/**
 * Historique Bitvavo (Historique des transactions → Exporter, CSV). Une ligne par opération,
 * quantité signée ; date et heure dans le fuseau de la colonne `Timezone`. Pour un achat ou une
 * vente, `Received / Paid Amount` est le montant en euros réellement débité ou crédité, frais
 * compris. Expérimental : vérifié sur des exemples publics, pas encore sur un export réel. Format
 * détaillé dans `docs/imports.md`.
 */

const COLUMNS = [
  'Timezone',
  'Date',
  'Time',
  'Type',
  'Currency',
  'Amount',
  'Received / Paid Currency',
  'Received / Paid Amount',
  'Fee currency',
  'Fee amount',
  'Status',
  'Transaction ID',
]

const FIAT = new Set(['EUR', 'USD', 'GBP', 'CHF'])
/** Récompenses : staking, parrainage, prime de bienvenue, remise sur frais. */
const REWARD = new Set([
  'staking',
  'fixed_staking',
  'affiliate',
  'campaign_new_user_incentive',
  'rebate',
])
/** Opérations terminées ; « Pending », annulées ou échouées ne changent pas les avoirs. */
const DONE = new Set(['completed', 'distributed'])

export function importBitvavo(text: string): ImportResult {
  const result = emptyResult()

  eachRow(readCsv(text, COLUMNS), result, (row) => {
    if (!DONE.has(cell(row, 'Status').toLowerCase())) {
      result.skipped++
      return
    }
    const transaction = toTransaction(row)
    if (transaction === 'skipped') {
      result.skipped++
    } else if (transaction) {
      result.transactions.push(transaction)
    } else {
      result.unsupported.push({
        line: row.line,
        label: `${cell(row, 'Type')} ${cell(row, 'Amount')} ${cell(row, 'Currency')}`,
      })
    }
  })

  return { ...result, transactions: chronological(result.transactions) }
}

function toTransaction(row: CsvRow): Transaction | 'skipped' | undefined {
  const type = cell(row, 'Type').toLowerCase()
  const currency = cell(row, 'Currency').toUpperCase()
  // Dépôts et retraits d'euros, remises en euros : sans rapport avec le portefeuille crypto.
  if (FIAT.has(currency)) return 'skipped'

  const base = {
    id: `bitvavo:${cell(row, 'Transaction ID')}`,
    source: 'bitvavo' as const,
    date: zonedDate(row, cell(row, 'Date'), cell(row, 'Time'), cell(row, 'Timezone')),
    label: type,
  }
  const quantity = signedAmount(row, 'Amount')
  const crypto = { asset: cryptoSymbol(row, currency), quantity: quantity.abs() }
  const fee = amount(row, 'Fee amount')
  const feeCurrency = cell(row, 'Fee currency').toUpperCase()

  if (type === 'buy' || type === 'sell') {
    // Seuls les échanges contre des euros, frais en euros, sont lus.
    const paid = cell(row, 'Received / Paid Currency').toUpperCase()
    if (paid !== 'EUR' || (fee.gt(0) && feeCurrency !== 'EUR')) return undefined
    const moved = amount(row, 'Received / Paid Amount')
    // Achat : euros débités = prix + frais. Vente : euros crédités = prix − frais.
    return type === 'buy'
      ? { ...base, type: 'buy', received: crypto, amountEur: moved.minus(fee), feeEur: fee }
      : { ...base, type: 'sell', sent: crypto, amountEur: moved.plus(fee), feeEur: fee }
  }
  if (type === 'deposit' && quantity.gt(0)) {
    return { ...base, type: 'transfer-in', received: crypto }
  }
  if (type === 'withdrawal' && quantity.lt(0)) {
    return {
      ...base,
      type: 'transfer-out',
      sent: crypto,
      ...(fee.gt(0) && feeCurrency === currency
        ? { fee: { asset: crypto.asset, quantity: fee } }
        : {}),
    }
  }
  if (REWARD.has(type) && quantity.gt(0)) {
    return { ...base, type: 'reward', received: crypto }
  }
  // Prêt, types inconnus : à vérifier.
  return quantity.isZero() ? 'skipped' : undefined
}
