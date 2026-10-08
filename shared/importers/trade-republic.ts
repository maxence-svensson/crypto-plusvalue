import type { Transaction } from '../portfolio/transaction'
import { ImportError, amount, cell, isoDate, readCsv, type CsvRow, type ImportResult } from './csv'

/**
 * Export officiel de Trade Republic (application mobile, Profil → Relevés → Export de
 * transactions, depuis avril 2026). Un seul fichier couvre le compte espèces, les titres et la
 * crypto : seules les lignes `asset_class = CRYPTO` concernent le 2086. Les ETF et ETN crypto
 * sont des titres (formulaire 2074) et sont ignorés comme les autres. Format détaillé dans
 * `docs/imports.md`.
 */

const COLUMNS = [
  'datetime',
  'category',
  'type',
  'asset_class',
  'symbol',
  'shares',
  'amount',
  'fee',
  'currency',
  'description',
  'transaction_id',
]

export function importTradeRepublic(text: string): ImportResult {
  const result: ImportResult = { transactions: [], skipped: 0, unsupported: [] }

  for (const row of readCsv(text, COLUMNS)) {
    if (cell(row, 'asset_class') !== 'CRYPTO') {
      result.skipped++
      continue
    }

    const transaction = toTransaction(row)
    if (transaction === 'ignored') continue
    if (transaction) {
      result.transactions.push(transaction)
    } else {
      const kind = `${cell(row, 'category')} ${cell(row, 'type')}`
      result.unsupported.push({ line: row.line, label: `${kind} : ${cell(row, 'description')}` })
    }
  }

  return result
}

function toTransaction(row: CsvRow): Transaction | 'ignored' | undefined {
  const currency = cell(row, 'currency')
  if (currency !== '' && currency !== 'EUR') {
    throw new ImportError(
      `Ligne ${row.line} : montant en ${currency}, seuls les euros sont pris en charge.`,
    )
  }

  const base = {
    id: `trade-republic:${cell(row, 'transaction_id')}`,
    source: 'trade-republic' as const,
    date: isoDate(row, 'datetime'),
    label: cell(row, 'description'),
  }
  const crypto = { asset: cell(row, 'symbol').toUpperCase(), quantity: amount(row, 'shares') }

  // `amount` est le montant brut (quantité × prix), `fee` les frais d'ordre, tous deux signés.
  switch (`${cell(row, 'category')}/${cell(row, 'type')}`) {
    case 'TRADING/BUY':
      return {
        ...base,
        type: 'buy',
        received: crypto,
        amountEur: amount(row, 'amount'),
        feeEur: amount(row, 'fee'),
      }
    case 'TRADING/SELL':
      return {
        ...base,
        type: 'sell',
        sent: crypto,
        amountEur: amount(row, 'amount'),
        feeEur: amount(row, 'fee'),
      }
    // Réception et envoi depuis ou vers un portefeuille externe.
    case 'DELIVERY/FREE_RECEIPT':
      return { ...base, type: 'transfer-in', received: crypto }
    case 'DELIVERY/FREE_DELIVERY':
      return { ...base, type: 'transfer-out', sent: crypto }
    // Migration interne : des paires −x / +x sans effet sur les avoirs.
    case 'DELIVERY/MIGRATION':
      return 'ignored'
    default:
      return undefined
  }
}
