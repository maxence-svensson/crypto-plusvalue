import type { Dec } from '../tax/decimal'

/**
 * Transaction normalisée, quelle que soit la plateforme d'origine. Les importeurs (Coinbase,
 * Trade Republic…) produisent ce format, et le calcul fiscal ne connaît que lui.
 *
 * Les montants en euros sont positifs ; les quantités sont celles réellement reçues ou envoyées,
 * frais déjà déduits quand la plateforme les prélève sur la quantité.
 */

export type Source = 'coinbase' | 'trade-republic' | 'manual'

export type CryptoAmount = {
  /** Symbole de l'actif en majuscules (BTC, ETH, USDC…). */
  asset: string
  quantity: Dec
}

type Base = {
  /** Identifiant unique toutes plateformes confondues, par exemple `coinbase:6751…`. */
  id: string
  source: Source
  date: Date
  /** Libellé d'origine, affiché pour aider à vérifier l'import. */
  label: string
}

/** Achat de crypto payé en euros. */
export type Buy = Base & {
  type: 'buy'
  received: CryptoAmount
  /** Montant payé en euros, hors frais. */
  amountEur: Dec
  feeEur: Dec
}

/** Vente de crypto contre des euros. */
export type Sell = Base & {
  type: 'sell'
  sent: CryptoAmount
  /** Montant brut obtenu en euros, avant déduction des frais. */
  amountEur: Dec
  feeEur: Dec
}

/** Paiement d'un bien ou d'un service en crypto, par exemple avec une carte de paiement. */
export type Payment = Base & {
  type: 'payment'
  sent: CryptoAmount
  /** Valeur en euros du bien ou du service obtenu. */
  amountEur: Dec
  feeEur: Dec
}

/** Échange entre actifs numériques sans soulte, stablecoins compris : sursis d'imposition. */
export type Swap = Base & {
  type: 'swap'
  sent: CryptoAmount
  received: CryptoAmount
}

/** Actifs reçus sans rien payer en euros : staking, airdrop, bonus, cashback. */
export type Reward = Base & {
  type: 'reward'
  received: CryptoAmount
  /** Valeur en euros à la réception, quand la plateforme l'indique. */
  valueEur?: Dec
}

/** Réception depuis un autre portefeuille du foyer. */
export type TransferIn = Base & {
  type: 'transfer-in'
  received: CryptoAmount
}

/** Envoi vers un autre portefeuille du foyer. */
export type TransferOut = Base & {
  type: 'transfer-out'
  /** Quantité envoyée, hors frais de réseau. */
  sent: CryptoAmount
  /** Frais de réseau, qui sortent du portefeuille du foyer. */
  fee?: CryptoAmount
}

export type Transaction = Buy | Sell | Payment | Swap | Reward | TransferIn | TransferOut

/** Libellés français des types d'opération, à l'écran comme dans le dossier justificatif. */
export const TRANSACTION_LABELS: Record<Transaction['type'], string> = {
  buy: 'Achat',
  sell: 'Vente',
  payment: 'Paiement en crypto',
  swap: 'Échange',
  reward: 'Récompense',
  'transfer-in': 'Réception',
  'transfer-out': 'Envoi',
}

/** Cessions imposables : la contrepartie n'est pas un actif numérique. */
export type TaxableTransaction = Sell | Payment

export function isTaxable(transaction: Transaction): transaction is TaxableTransaction {
  return transaction.type === 'sell' || transaction.type === 'payment'
}

/** Ordre chronologique, stable : deux transactions à la même date gardent l'ordre de l'import. */
export function chronological<T extends { date: Date }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.date.getTime() - b.date.getTime())
}
