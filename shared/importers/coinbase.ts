import { chronological, type Transaction } from '../portfolio/transaction'
import { Dec } from '../tax/decimal'
import {
  ImportError,
  cell,
  isoDate,
  readCsv,
  type Column,
  type CsvRow,
  type ImportResult,
} from './csv'

/**
 * Relevé Coinbase (Relevés → Générer un relevé personnalisé → CSV). Quelques lignes
 * d'information précèdent l'en-tête, et plusieurs colonnes ont changé de nom selon les années.
 * Format détaillé dans `docs/imports.md`. Vérifié seulement sur des exemples publics.
 */

const CURRENCY = ['Price Currency', 'Spot Price Currency']
const TOTAL = ['Total (inclusive of fees and/or spread)', 'Total (inclusive of fees)']
const FEES = ['Fees and/or Spread', 'Fees']
const COLUMNS = [
  'Timestamp',
  'Transaction Type',
  'Asset',
  'Quantity Transacted',
  CURRENCY,
  'Subtotal',
  TOTAL,
  FEES,
  'Notes',
]

const BUY = new Set(['Buy', 'Advanced Trade Buy', 'Advance Trade Buy'])
const SELL = new Set(['Sell', 'Advanced Trade Sell', 'Advance Trade Sell', 'Retail Simple Dust'])
const REWARD = new Set([
  'Staking Income',
  'Rewards Income',
  'Reward Income',
  'Inflation Reward',
  'Coinbase Earn',
  'Learning Reward',
  'Interest payout',
  'Subscription Rebate',
  'Subscription Rebates (24 Hours)',
])
const PAYMENT = new Set(['Card Spend', 'Subscription'])
/** Mouvements entre comptes Coinbase (Coinbase Pro, staking…) : sans effet sur les avoirs. */
const INTERNAL = new Set([
  'Pro Deposit',
  'Pro Withdrawal',
  'Exchange Deposit',
  'Exchange Withdrawal',
  'Prime Deposit',
  'Retail Staking Transfer',
  'Retail Unstaking Transfer',
  'Transfer',
  'Vault Withdrawal',
  'Cash to Savings',
  'Savings to Cash',
])
const FIAT = new Set(['EUR', 'USD', 'GBP', 'CHF', 'CAD'])
/** ETH2 était l'ETH placé en staking chez Coinbase, redevenu de l'ETH en 2025 : le même actif. */
const ALIASES: Record<string, string> = { ETH2: 'ETH' }

function asset(symbol: string): string {
  const upper = symbol.toUpperCase()
  return ALIASES[upper] ?? upper
}

export function importCoinbase(text: string): ImportResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const headerIndex = lines.findIndex((line) => /^"?(ID|Timestamp)"?,/.test(line))
  if (headerIndex === -1) {
    throw new ImportError("En-tête introuvable : ce fichier n'est pas un relevé Coinbase.")
  }

  const result: ImportResult = { transactions: [], skipped: 0, unsupported: [] }
  const rows = readCsv(lines.slice(headerIndex).join('\n'), COLUMNS, headerIndex + 1)

  for (const row of rows) {
    // Dépôts et retraits d'euros : rien à voir avec le portefeuille crypto.
    if (FIAT.has(cell(row, 'Asset').toUpperCase())) {
      result.skipped++
      continue
    }

    const transaction = toTransaction(row)
    if (transaction === 'ignored') continue
    if (transaction) {
      result.transactions.push(transaction)
    } else {
      const currency = cell(row, CURRENCY)
      const label = [cell(row, 'Transaction Type'), cell(row, 'Notes')].filter(Boolean).join(' : ')
      result.unsupported.push({
        line: row.line,
        label: currency === 'EUR' ? label : `${label} (montants en ${currency})`,
      })
    }
  }

  // Coinbase liste les opérations de la plus récente à la plus ancienne.
  return { ...result, transactions: chronological(result.transactions) }
}

function toTransaction(row: CsvRow): Transaction | 'ignored' | undefined {
  const type = cell(row, 'Transaction Type')
  const notes = cell(row, 'Notes')
  // Les relevés antérieurs à 2024 n'ont pas de colonne ID.
  const id = cell(row, 'ID') || `${cell(row, 'Timestamp')}#${row.line}`
  const base = {
    id: `coinbase:${id}`,
    source: 'coinbase' as const,
    date: isoDate(row, 'Timestamp'),
    label: notes || type,
  }
  const crypto = {
    asset: asset(cell(row, 'Asset')),
    quantity: money(row, 'Quantity Transacted'),
  }
  // Un relevé peut mêler plusieurs devises. Une opération en dollars reste lisible quand son
  // montant ne sert pas au calcul (échange, transfert) ; sinon elle est à vérifier.
  const inEuros = cell(row, CURRENCY) === 'EUR'

  if (BUY.has(type) || SELL.has(type)) {
    // « Bought 0.01 BTC for €609.00 EUR » : seuls les échanges contre des euros sont lus. Un
    // ordre avancé contre une autre crypto (BTC-USDC…) est à vérifier par l'utilisateur.
    const quote = /^(?:Bought|Sold) [\d.,]+ \w+ for \D?[\d.,]+ (\w+)/.exec(notes)?.[1] ?? 'EUR'
    if (quote !== 'EUR' || !inEuros) return undefined

    // `Subtotal` est le montant avant frais ; `Total` l'inclut.
    const amounts = { amountEur: money(row, 'Subtotal'), feeEur: money(row, FEES) }
    return BUY.has(type)
      ? { ...base, type: 'buy', received: crypto, ...amounts }
      : { ...base, type: 'sell', sent: crypto, ...amounts }
  }

  if (type === 'Convert') {
    // « Converted 0.002 BTC to 0.05 ETH » : l'actif reçu n'apparaît que dans les notes.
    const converted = /^Converted [\d.,]+ \w+ to ([\d.,]+) (\w+)/.exec(notes)
    if (!converted?.[1] || !converted[2]) return undefined
    const received = { asset: asset(converted[2]), quantity: number(row, converted[1]) }
    // ETH → ETH2 : le même actif, rien ne change.
    if (received.asset === crypto.asset) return 'ignored'
    return { ...base, type: 'swap', sent: crypto, received }
  }

  if (REWARD.has(type) || (type === 'Receive' && /Coinbase (Earn|Rewards|Referral)/.test(notes))) {
    const valueEur = inEuros ? money(row, 'Subtotal') : undefined
    return { ...base, type: 'reward', received: crypto, valueEur }
  }

  if (PAYMENT.has(type) && inEuros) {
    return {
      ...base,
      type: 'payment',
      sent: crypto,
      amountEur: money(row, 'Subtotal'),
      feeEur: money(row, FEES),
    }
  }

  if (type === 'Receive') return { ...base, type: 'transfer-in', received: crypto }
  if (type === 'Send') return { ...base, type: 'transfer-out', sent: crypto }
  if (INTERNAL.has(type)) return 'ignored'
  return undefined
}

/** Montant au format anglais, avec symbole et séparateur de milliers : « -€1,234.56 ». */
function money(row: CsvRow, column: Column): Dec {
  return number(row, cell(row, column))
}

function number(row: CsvRow, raw: string): Dec {
  const cleaned = raw.replace(/[€$£,\s]/g, '')
  if (cleaned === '') return new Dec(0)
  try {
    return new Dec(cleaned).abs()
  } catch {
    throw new ImportError(`Ligne ${row.line} : « ${raw} » n'est pas un montant.`)
  }
}
