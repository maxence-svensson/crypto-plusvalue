import { chronological, type Transaction } from '../portfolio/transaction'
import { ZERO } from '../tax/decimal'
import {
  amount,
  cell,
  cryptoSymbol,
  eachRow,
  emptyResult,
  readCsv,
  signedAmount,
  utcDate,
  type CsvRow,
  type ImportResult,
} from './csv'

/**
 * Historique de l'application Crypto.com (Comptes → Historique → Export → Token Wallet), fichier
 * `crypto_transactions_record_….csv`. Une ligne par opération ; un échange tient sur une ligne
 * avec les colonnes `To Currency` et `To Amount`. Heures en UTC. La valeur en euros vient de
 * `Native Amount` quand la monnaie d'affichage de l'application est l'euro. Pas d'identifiant :
 * il est tiré du contenu de la ligne. Expérimental : vérifié sur des exemples publics, pas encore
 * sur un export réel. Format détaillé dans `docs/imports.md`.
 */

const COLUMNS = [
  'Timestamp (UTC)',
  'Transaction Description',
  'Currency',
  'Amount',
  'To Currency',
  'To Amount',
  'Native Currency',
  'Native Amount',
  'Transaction Kind',
]

const FIAT = new Set(['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD'])

/** Achat payé en euros depuis le portefeuille espèces de l'application. */
const BUY_WITH_CASH = new Set([
  'viban_purchase',
  'van_purchase',
  'recurring_buy_order',
  'trading.limit_order.fiat_wallet.purchase_commit',
  'trading.limit_order.cash_account.purchase_commit',
])
/** Achat par carte bancaire : une seule ligne, coût en `Native Amount`. */
const BUY_WITH_CARD = new Set([
  'crypto_purchase',
  'trading.crypto_purchase.google_pay',
  'trading.crypto_purchase.apple_pay',
])
const SELL = new Set([
  'crypto_viban_exchange',
  'crypto_to_van_sell_order',
  'trading.limit_order.fiat_wallet.sell_commit',
  'trading.limit_order.cash_account.sell_commit',
  // Crypto convertie en euros sur le solde de la carte.
  'card_top_up',
])
const EXCHANGE = new Set(['crypto_exchange', 'trading.limit_order.crypto_wallet.exchange'])
const DEPOSIT = new Set(['crypto_deposit', 'exchange_to_crypto_transfer'])
const WITHDRAWAL = new Set(['crypto_withdrawal', 'crypto_to_exchange_transfer'])
const PAYMENT = new Set(['crypto_payment'])
const REWARD = new Set([
  'crypto_earn_interest_paid',
  'crypto_earn_extra_interest_paid',
  'finance.crypto_earn.loyalty_program_extra_interest_paid.crypto_wallet',
  'mco_stake_reward',
  'finance.lockup.dpos_compound_interest.crypto_wallet',
  'finance.dpos.compound_interest.crypto_wallet',
  'finance.dpos.non_compound_interest.crypto_wallet',
  'finance.dpos.non_compound_restaking_interest.crypto_wallet',
  'finance.defi_staking.non_compound_interest.crypto_wallet',
  'finance.defi_lending.compound_interest.crypto_wallet',
  'staking_reward',
  'supercharger_reward_to_app_credited',
  'referral_bonus',
  'referral_gift',
  'referral_card_cashback',
  'transfer_cashback',
  'reimbursement',
  'gift_card_reward',
  'campaign_reward',
  'admin_wallet_credited',
  'rewards_platform_deposit_credited',
  'pay_checkout_reward',
  'mobile_airtime_reward',
  'reward.loyalty_program.trading_rebate.crypto_wallet',
])
/** Fonds bloqués puis débloqués, placements Earn et staking : sans effet sur les avoirs. */
const INTERNAL = new Set([
  'crypto_earn_program_created',
  'crypto_earn_program_withdrawn',
  'lockup_lock',
  'lockup_unlock',
  'lockup_upgrade',
  'finance.lockup.dpos_lock.crypto_wallet',
  'finance.lockup.dpos_unlock.crypto_wallet',
  'finance.dpos.staking.crypto_wallet',
  'finance.dpos.unstaking.crypto_wallet',
  'finance.defi_staking.staking.crypto_wallet',
  'supercharger_deposit',
  'supercharger_withdrawal',
])

export function importCryptoCom(text: string): ImportResult {
  const result = emptyResult()
  // Lignes identiques dans le même fichier : le numéro d'occurrence les distingue.
  const seen = new Map<string, number>()

  eachRow(readCsv(text, COLUMNS), result, (row) => {
    const kind = cell(row, 'Transaction Kind')
    const currency = cell(row, 'Currency').toUpperCase()
    // Ordres à cours limité : blocage puis déblocage des fonds, avant l'exécution (`_commit`).
    if (INTERNAL.has(kind) || /_(lock|unlock)$/.test(kind)) return

    const content = [
      cell(row, 'Timestamp (UTC)'),
      kind,
      currency,
      cell(row, 'Amount'),
      cell(row, 'To Currency'),
      cell(row, 'To Amount'),
    ].join('|')
    const occurrence = (seen.get(content) ?? 0) + 1
    seen.set(content, occurrence)

    const transaction = toTransaction(row, kind, currency, `crypto-com:${content}#${occurrence}`)
    if (transaction === 'skipped') {
      result.skipped++
    } else if (transaction) {
      result.transactions.push(transaction)
    } else {
      result.unsupported.push({
        line: row.line,
        label: `${kind || 'sans type'} : ${cell(row, 'Transaction Description')}`,
      })
    }
  })

  return { ...result, transactions: chronological(result.transactions) }
}

function toTransaction(
  row: CsvRow,
  kind: string,
  currency: string,
  id: string,
): Transaction | 'skipped' | undefined {
  const base = {
    id,
    source: 'crypto-com' as const,
    date: utcDate(row, 'Timestamp (UTC)'),
    label: cell(row, 'Transaction Description') || kind,
  }
  const value = signedAmount(row, 'Amount')
  const toCurrency = cell(row, 'To Currency').toUpperCase()
  const native = amount(row, 'Native Amount')
  const nativeInEuros = cell(row, 'Native Currency').toUpperCase() === 'EUR'

  if (BUY_WITH_CASH.has(kind)) {
    // Le montant réellement débité, en euros, plutôt que la valeur affichée.
    if (currency !== 'EUR' || FIAT.has(toCurrency)) return undefined
    return {
      ...base,
      type: 'buy',
      received: { asset: cryptoSymbol(row, toCurrency), quantity: amount(row, 'To Amount') },
      amountEur: value.abs(),
      feeEur: ZERO,
    }
  }

  // Dépôts, retraits et mouvements d'espèces : sans rapport avec le portefeuille crypto.
  if (FIAT.has(currency)) return 'skipped'
  const crypto = { asset: cryptoSymbol(row, currency), quantity: value.abs() }

  if (BUY_WITH_CARD.has(kind)) {
    if (!nativeInEuros || value.lte(0)) return undefined
    return { ...base, type: 'buy', received: crypto, amountEur: native, feeEur: ZERO }
  }
  if (SELL.has(kind)) {
    // Vente vers le portefeuille espèces : `To Amount` en euros ; recharge de carte : valeur affichée.
    const toEuros = toCurrency === 'EUR'
    if (!toEuros && !(toCurrency === '' && nativeInEuros)) return undefined
    const proceeds = toEuros ? amount(row, 'To Amount') : native
    return { ...base, type: 'sell', sent: crypto, amountEur: proceeds, feeEur: ZERO }
  }
  if (EXCHANGE.has(kind)) {
    if (toCurrency === '' || FIAT.has(toCurrency)) return undefined
    return {
      ...base,
      type: 'swap',
      sent: crypto,
      received: { asset: cryptoSymbol(row, toCurrency), quantity: amount(row, 'To Amount') },
    }
  }
  if (DEPOSIT.has(kind) && value.gt(0)) return { ...base, type: 'transfer-in', received: crypto }
  if (WITHDRAWAL.has(kind) && value.lt(0)) return { ...base, type: 'transfer-out', sent: crypto }
  if (PAYMENT.has(kind) && value.lt(0) && nativeInEuros) {
    return { ...base, type: 'payment', sent: crypto, amountEur: native, feeEur: ZERO }
  }
  if (REWARD.has(kind) && value.gt(0)) {
    return {
      ...base,
      type: 'reward',
      received: crypto,
      ...(nativeInEuros ? { valueEur: native } : {}),
    }
  }
  // Conversions groupées, transferts entre utilisateurs, paniers, annulations : à vérifier.
  return undefined
}
