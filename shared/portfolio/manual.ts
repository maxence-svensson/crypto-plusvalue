import { Dec } from '../tax/decimal'
import { parisParts, zonedInstant } from '../time'
import type { CryptoAmount, Source, Transaction } from './transaction'

/**
 * Saisie d'une opération à la main : une opération absente des exports, ou une ligne importée à
 * corriger. Les champs arrivent tels que tapés (« 0,0015 », « 1 234,56 ») et sont vérifiés avant
 * de devenir une transaction ; rien n'est deviné.
 */

export type TransactionType = Transaction['type']

export type ManualForm = {
  type: TransactionType
  /** Date et heure à Paris : « 2025-03-03 » et « 09:20 ». */
  date: string
  time: string
  /** Actif reçu (achat, récompense, réception) ou envoyé (vente, paiement, échange, envoi). */
  asset: string
  quantity: string
  /** Achat : payé hors frais ; vente et paiement : obtenu avant frais ; récompense : valeur. */
  amountEur: string
  feeEur: string
  /** Échange : actif et quantité reçus. */
  toAsset: string
  toQuantity: string
  /** Envoi : frais de réseau, dans l'actif envoyé. */
  networkFee: string
  label: string
}

export type ManualErrors = Partial<Record<keyof ManualForm, string>>

export type ManualResult =
  { ok: true; transaction: Transaction } | { ok: false; errors: ManualErrors }

/** Champs utiles à chaque type d'opération, pour le formulaire comme pour la vérification. */
export const FORM_FIELDS: Record<TransactionType, (keyof ManualForm)[]> = {
  buy: ['asset', 'quantity', 'amountEur', 'feeEur'],
  sell: ['asset', 'quantity', 'amountEur', 'feeEur'],
  payment: ['asset', 'quantity', 'amountEur', 'feeEur'],
  swap: ['asset', 'quantity', 'toAsset', 'toQuantity'],
  reward: ['asset', 'quantity', 'amountEur'],
  'transfer-in': ['asset', 'quantity'],
  'transfer-out': ['asset', 'quantity', 'networkFee'],
}

/** Le Bitcoin n'existait pas avant : une date plus ancienne est une faute de frappe. */
const FIRST_DAY = '2009-01-03'

export function emptyForm(now: Date = new Date()): ManualForm {
  const [date, time] = parisParts(now)
  return {
    type: 'buy',
    date,
    time,
    asset: '',
    quantity: '',
    amountEur: '',
    feeEur: '',
    toAsset: '',
    toQuantity: '',
    networkFee: '',
    label: '',
  }
}

/** Décimal sans notation scientifique, virgule française : « 0,0000001 ». */
const typed = (value: Dec | undefined) => (value ? value.toFixed().replace('.', ',') : '')

/** Le formulaire d'une opération existante, pour la modifier. */
export function formOf(transaction: Transaction): ManualForm {
  const [date, time] = parisParts(transaction.date)
  const main: CryptoAmount = 'sent' in transaction ? transaction.sent : transaction.received
  return {
    type: transaction.type,
    date,
    time,
    asset: main.asset,
    quantity: typed(main.quantity),
    amountEur:
      'amountEur' in transaction
        ? typed(transaction.amountEur)
        : transaction.type === 'reward'
          ? typed(transaction.valueEur)
          : '',
    feeEur: 'feeEur' in transaction ? typed(transaction.feeEur) : '',
    toAsset: transaction.type === 'swap' ? transaction.received.asset : '',
    toQuantity: transaction.type === 'swap' ? typed(transaction.received.quantity) : '',
    networkFee: transaction.type === 'transfer-out' ? typed(transaction.fee?.quantity) : '',
    label: transaction.label,
  }
}

/** Lit un nombre tapé à la française ou à l'anglaise, espaces de milliers compris. */
export function parseDecimal(text: string): Dec | undefined {
  const compact = text.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(compact) && !/^\.\d+$/.test(compact)) return undefined
  return new Dec(compact)
}

export type ManualTarget = {
  id: string
  source: Source
  /** L'opération modifiée : sa date exacte est gardée si la minute affichée n'a pas changé. */
  original?: Transaction
}

/**
 * Vérifie le formulaire et construit l'opération. Chaque erreur est rattachée à son champ, dans
 * des termes qui disent quoi corriger.
 */
export function buildManualTransaction(
  form: ManualForm,
  target: ManualTarget,
  now: Date = new Date(),
): ManualResult {
  const errors: ManualErrors = {}
  const fields = FORM_FIELDS[form.type]

  const date = readDate(form, target.original, now, errors)
  const asset = readAsset(form.asset, 'asset', errors)
  const quantity = readQuantity(form.quantity, 'quantity', errors)

  const optional = (field: 'feeEur' | 'networkFee' | 'amountEur') => {
    if (form[field].trim() === '') return undefined
    const value = parseDecimal(form[field])
    if (!value) errors[field] = 'Nombre attendu, par exemple 1,50.'
    return value
  }

  let amountEur: Dec | undefined
  if (fields.includes('amountEur')) {
    amountEur = optional('amountEur')
    if (form.type !== 'reward' && !errors.amountEur && (!amountEur || amountEur.isZero())) {
      errors.amountEur = 'Montant en euros obligatoire.'
    }
  }
  const feeEur = fields.includes('feeEur') ? optional('feeEur') : undefined
  const networkFee = fields.includes('networkFee') ? optional('networkFee') : undefined

  let toAsset: string | undefined
  let toQuantity: Dec | undefined
  if (form.type === 'swap') {
    toAsset = readAsset(form.toAsset, 'toAsset', errors)
    toQuantity = readQuantity(form.toQuantity, 'toQuantity', errors)
    if (toAsset && toAsset === asset)
      errors.toAsset = 'Un échange porte sur deux actifs différents.'
  }

  if (Object.keys(errors).length > 0 || !date || !asset || !quantity) return { ok: false, errors }

  const label = form.label.trim() || 'Saisie manuelle'
  const base = { id: target.id, source: target.source, date, label }
  const crypto = { asset, quantity }
  const fee = feeEur ?? new Dec(0)

  switch (form.type) {
    case 'buy':
    case 'sell':
    case 'payment': {
      const amounts = { amountEur: amountEur as Dec, feeEur: fee }
      return {
        ok: true,
        transaction:
          form.type === 'buy'
            ? { ...base, type: 'buy', received: crypto, ...amounts }
            : { ...base, type: form.type, sent: crypto, ...amounts },
      }
    }
    case 'swap':
      return {
        ok: true,
        transaction: {
          ...base,
          type: 'swap',
          sent: crypto,
          received: { asset: toAsset as string, quantity: toQuantity as Dec },
        },
      }
    case 'reward':
      return {
        ok: true,
        transaction: {
          ...base,
          type: 'reward',
          received: crypto,
          ...(amountEur && !amountEur.isZero() ? { valueEur: amountEur } : {}),
        },
      }
    case 'transfer-in':
      return { ok: true, transaction: { ...base, type: 'transfer-in', received: crypto } }
    case 'transfer-out':
      return {
        ok: true,
        transaction: {
          ...base,
          type: 'transfer-out',
          sent: crypto,
          ...(networkFee && !networkFee.isZero() ? { fee: { asset, quantity: networkFee } } : {}),
        },
      }
  }
}

function readDate(
  form: ManualForm,
  original: Transaction | undefined,
  now: Date,
  errors: ManualErrors,
): Date | undefined {
  if (original) {
    // Minute inchangée : les secondes d'origine comptent pour l'ordre des opérations.
    const [date, time] = parisParts(original.date)
    if (form.date === date && form.time === time) return original.date
  }
  const instant = zonedInstant(form.date, form.time, 'Europe/Paris')
  if (!instant) {
    errors.date = 'Date et heure attendues.'
    return undefined
  }
  if (form.date < FIRST_DAY) {
    errors.date = 'Date antérieure au premier bloc Bitcoin (3 janvier 2009).'
  } else if (instant.getTime() > now.getTime()) {
    errors.date = 'Date dans le futur.'
  }
  return instant
}

function readAsset(text: string, field: 'asset' | 'toAsset', errors: ManualErrors) {
  const asset = text.trim().toUpperCase()
  if (!/^[A-Z0-9]{1,15}$/.test(asset)) {
    errors[field] = asset === '' ? 'Symbole obligatoire, par exemple BTC.' : 'Symbole invalide.'
    return undefined
  }
  if (['EUR', 'USD', 'GBP', 'CHF'].includes(asset)) {
    errors[field] = 'Une monnaie officielle n’est pas un actif numérique.'
    return undefined
  }
  return asset
}

function readQuantity(text: string, field: 'quantity' | 'toQuantity', errors: ManualErrors) {
  const quantity = parseDecimal(text)
  if (!quantity || quantity.isZero()) {
    errors[field] = text.trim() === '' ? 'Quantité obligatoire.' : 'Quantité positive attendue.'
    return undefined
  }
  return quantity
}
