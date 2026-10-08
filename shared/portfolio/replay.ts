import { ZERO, type Dec } from '../tax/decimal'
import {
  chronological,
  isTaxable,
  type CryptoAmount,
  type TaxableTransaction,
  type Transaction,
} from './transaction'

export type Holdings = ReadonlyMap<string, Dec>

export type DisposalSnapshot = {
  transaction: TaxableTransaction
  /** Tous les actifs détenus par le foyer juste avant la cession, actifs cédés compris. */
  holdingsBefore: Holdings
}

/**
 * Une sortie d'actifs plus grande que ce que l'historique importé contient : il manque des
 * achats, souvent ceux d'une autre plateforme ou d'un portefeuille personnel.
 */
export type MissingHistory = {
  transactionId: string
  asset: string
  shortfall: Dec
}

export type Replay = {
  disposals: DisposalSnapshot[]
  /** Actifs détenus après la dernière transaction. */
  holdings: Holdings
  missingHistory: MissingHistory[]
}

/**
 * Rejoue l'historique pour connaître les actifs détenus avant chaque cession imposable, ce qui
 * sert à calculer la valeur globale du portefeuille (ligne 212 du 2086).
 *
 * On suit ce que possède le foyer, pas l'endroit où c'est conservé : un transfert entre deux de
 * ses portefeuilles ne change rien, seuls ses frais de réseau sortent du portefeuille.
 */
export function replayPortfolio(transactions: readonly Transaction[]): Replay {
  const holdings = new Map<string, Dec>()
  const disposals: DisposalSnapshot[] = []
  const missingHistory: MissingHistory[] = []

  const add = ({ asset, quantity }: CryptoAmount) => {
    holdings.set(asset, (holdings.get(asset) ?? ZERO).plus(quantity))
  }

  const remove = (transaction: Transaction, { asset, quantity }: CryptoAmount) => {
    const held = holdings.get(asset) ?? ZERO
    if (quantity.gt(held)) {
      missingHistory.push({ transactionId: transaction.id, asset, shortfall: quantity.minus(held) })
    }
    holdings.set(asset, quantity.gt(held) ? ZERO : held.minus(quantity))
  }

  for (const transaction of chronological(transactions)) {
    if (isTaxable(transaction)) {
      disposals.push({ transaction, holdingsBefore: snapshot(holdings) })
    }

    switch (transaction.type) {
      case 'buy':
      case 'reward':
        add(transaction.received)
        break
      case 'sell':
      case 'payment':
        remove(transaction, transaction.sent)
        break
      case 'swap':
        remove(transaction, transaction.sent)
        add(transaction.received)
        break
      case 'transfer-in':
        break
      case 'transfer-out':
        if (transaction.fee) remove(transaction, transaction.fee)
        break
    }
  }

  return { disposals, holdings: snapshot(holdings), missingHistory }
}

function snapshot(holdings: Map<string, Dec>): Holdings {
  return new Map([...holdings].filter(([, quantity]) => quantity.gt(0)))
}
