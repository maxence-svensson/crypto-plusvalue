import type { Correction } from '#shared/portfolio/corrections'
import { TRANSACTION_LABELS, type Source, type Transaction } from '#shared/portfolio/transaction'

/** Ce qui entre (+) et ce qui sort (−) du portefeuille : « −0,5 ETH contre +3 000 USDC ». */
export function formatMovements(transaction: Transaction): string {
  const parts: string[] = []
  if ('sent' in transaction) {
    parts.push(`−${formatQuantity(transaction.sent.quantity)} ${transaction.sent.asset}`)
  }
  if ('received' in transaction) {
    parts.push(`+${formatQuantity(transaction.received.quantity)} ${transaction.received.asset}`)
  }
  return parts.join(' contre ')
}

/** « Achat de 0,0045 BTC », « Échange de 1 ETH » : l'opération en quelques mots. */
export function describeTransaction(transaction: Transaction): string {
  const main = 'sent' in transaction ? transaction.sent : transaction.received
  return `${TRANSACTION_LABELS[transaction.type]} de ${formatQuantity(main.quantity)} ${main.asset}`
}

/** « Suppression de 3 opérations », « Modification : Vente de 0,5 ETH du 03/03/2025 ». */
export function describeCorrection(correction: Correction): string {
  switch (correction.kind) {
    case 'add':
      return `Ajout : ${describeTransaction(correction.transaction)} du ${formatDay(correction.transaction.date)}`
    case 'edit':
      return `Modification : ${describeTransaction(correction.before)} du ${formatDay(correction.before.date)}`
    case 'delete': {
      const [only] = correction.removed
      return correction.removed.length === 1 && only
        ? `Suppression : ${describeTransaction(only.transaction)} du ${formatDay(only.transaction.date)}`
        : `Suppression de ${correction.removed.length} opérations`
    }
  }
}

/** Horloge des dates de chaque source : ce que l'export indique, avant conversion. */
export const SOURCE_CLOCKS: Record<Source, string> = {
  'trade-republic': 'date ISO avec son décalage horaire, telle que dans l’export',
  coinbase: 'temps universel (UTC)',
  kraken: 'temps universel (UTC)',
  'crypto-com': 'temps universel (UTC)',
  bitvavo: 'fuseau indiqué dans l’export (colonne Timezone)',
  manual: 'heure de Paris, saisie à la main',
}
