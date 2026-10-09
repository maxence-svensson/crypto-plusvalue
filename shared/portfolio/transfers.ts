import { Dec } from '../tax/decimal'
import { chronological, type Transaction, type TransferIn, type TransferOut } from './transaction'

/**
 * Rapprochement des transferts : un envoi depuis une plateforme et la réception de la même crypto
 * sur une autre. Le calcul n'en dépend pas (un transfert entre portefeuilles du foyer est
 * neutre), mais un envoi ou une réception sans contrepartie signale un historique incomplet.
 */

/** Délai admis entre l'envoi et la réception : confirmations du réseau, retraits manuels. */
const MAX_DELAY_MS = 72 * 3600_000
/** Une réception peut précéder de peu l'envoi : horloges des plateformes. */
const CLOCK_SKEW_MS = 3600_000
/** Part minimale de la quantité envoyée qui doit arriver : 5 % au plus retenus en route. */
const MIN_KEPT = new Dec('0.95')

export type TransferPair = { out: TransferOut; in: TransferIn }

export type TransferMatching = {
  pairs: TransferPair[]
  /** Envoyées hors des comptes importés : autre portefeuille du foyer, ou paiement, ou don. */
  unmatchedOut: TransferOut[]
  /** Reçues d'un compte non importé : leur prix d'acquisition manque peut-être. */
  unmatchedIn: TransferIn[]
}

export function matchTransfers(transactions: readonly Transaction[]): TransferMatching {
  const sorted = chronological(transactions)
  const outs = sorted.filter(
    (transaction): transaction is TransferOut => transaction.type === 'transfer-out',
  )
  const ins = sorted.filter(
    (transaction): transaction is TransferIn => transaction.type === 'transfer-in',
  )

  const used = new Set<string>()
  const pairs: TransferPair[] = []
  const unmatchedOut: TransferOut[] = []
  for (const out of outs) {
    const sent = out.sent.quantity
    const match = ins.find((candidate) => {
      if (used.has(candidate.id) || candidate.received.asset !== out.sent.asset) return false
      const delay = candidate.date.getTime() - out.date.getTime()
      const quantity = candidate.received.quantity
      return (
        delay >= -CLOCK_SKEW_MS &&
        delay <= MAX_DELAY_MS &&
        quantity.lte(sent) &&
        quantity.gte(sent.times(MIN_KEPT))
      )
    })
    if (match) {
      used.add(match.id)
      pairs.push({ out, in: match })
    } else {
      unmatchedOut.push(out)
    }
  }
  return { pairs, unmatchedOut, unmatchedIn: ins.filter((transfer) => !used.has(transfer.id)) }
}
