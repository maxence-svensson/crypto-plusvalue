import type { Transaction } from './transaction'

/**
 * Doublons entre un nouvel import et les opérations déjà là. Un même identifiant signe une
 * opération déjà importée. Sans identifiant commun, deux opérations du même type, sur les mêmes
 * actifs, aux mêmes quantités et montants, à moins de deux minutes d'écart, sont probablement la
 * même : l'utilisateur tranche, rien n'est écarté en silence.
 */

/** Écart admis entre deux exports d'une même opération (secondes tronquées, horloges). */
const SAME_MOMENT_MS = 2 * 60_000

export type PossibleDuplicate = { incoming: Transaction; existing: Transaction }

export type DuplicateCheck = {
  /** Même identifiant qu'une opération déjà importée : ignorées. */
  known: Transaction[]
  /** Sans équivalent : à importer. */
  fresh: Transaction[]
  /** Probablement la même opération sous un autre identifiant : à confirmer. */
  possible: PossibleDuplicate[]
}

/** Ce qui caractérise une opération, hors identifiant et date. */
function signature(transaction: Transaction): string {
  const parts: string[] = [transaction.type]
  if ('sent' in transaction) {
    parts.push(`-${transaction.sent.asset}:${transaction.sent.quantity.toString()}`)
  }
  if ('received' in transaction) {
    parts.push(`+${transaction.received.asset}:${transaction.received.quantity.toString()}`)
  }
  if ('amountEur' in transaction) parts.push(`€${transaction.amountEur.toString()}`)
  return parts.join('|')
}

export function checkDuplicates(
  existing: readonly Transaction[],
  incoming: readonly Transaction[],
): DuplicateCheck {
  const ids = new Set(existing.map((transaction) => transaction.id))
  const bySignature = new Map<string, Transaction[]>()
  for (const transaction of existing) {
    const key = signature(transaction)
    bySignature.set(key, [...(bySignature.get(key) ?? []), transaction])
  }

  // Une opération déjà là ne sert de doublon qu'une fois.
  const matched = new Set<string>()
  const result: DuplicateCheck = { known: [], fresh: [], possible: [] }
  for (const transaction of incoming) {
    if (ids.has(transaction.id)) {
      result.known.push(transaction)
      continue
    }
    const twin = bySignature
      .get(signature(transaction))
      ?.find(
        (candidate) =>
          !matched.has(candidate.id) &&
          Math.abs(candidate.date.getTime() - transaction.date.getTime()) <= SAME_MOMENT_MS,
      )
    if (twin) {
      matched.add(twin.id)
      result.possible.push({ incoming: transaction, existing: twin })
    } else {
      result.fresh.push(transaction)
    }
  }
  return result
}
