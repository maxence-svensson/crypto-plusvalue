import type { Transaction } from './transaction'

/**
 * Journal des corrections : chaque ajout, modification ou suppression faite à la main, avec ce
 * qu'il y avait avant. Il sert de trace (ce qui a été changé par rapport aux exports) et permet
 * d'annuler, de la plus récente à la plus ancienne.
 */
export type Correction =
  | { kind: 'add'; at: Date; transaction: Transaction }
  | { kind: 'edit'; at: Date; before: Transaction; after: Transaction }
  | {
      kind: 'delete'
      at: Date
      /** Opérations supprimées et leur place dans la liste, pour les remettre à l'identique. */
      removed: { index: number; transaction: Transaction }[]
    }

export function applyCorrection(
  list: readonly Transaction[],
  correction: Correction,
): Transaction[] {
  switch (correction.kind) {
    case 'add':
      return [...list, correction.transaction]
    case 'edit':
      return list.map((transaction) =>
        transaction.id === correction.before.id ? correction.after : transaction,
      )
    case 'delete': {
      const ids = new Set(correction.removed.map(({ transaction }) => transaction.id))
      return list.filter((transaction) => !ids.has(transaction.id))
    }
  }
}

/** Défait la dernière correction appliquée : la liste redevient exactement ce qu'elle était. */
export function revertCorrection(
  list: readonly Transaction[],
  correction: Correction,
): Transaction[] {
  switch (correction.kind) {
    case 'add':
      return list.filter((transaction) => transaction.id !== correction.transaction.id)
    case 'edit':
      return list.map((transaction) =>
        transaction.id === correction.after.id ? correction.before : transaction,
      )
    case 'delete': {
      const restored = [...list]
      const ordered = [...correction.removed].sort((a, b) => a.index - b.index)
      for (const { index, transaction } of ordered) restored.splice(index, 0, transaction)
      return restored
    }
  }
}

/** Prépare la suppression de ces opérations, en notant leur place. */
export function deletion(
  list: readonly Transaction[],
  ids: Iterable<string>,
  at: Date,
): Correction {
  const wanted = new Set(ids)
  const removed = list.flatMap((transaction, index) =>
    wanted.has(transaction.id) ? [{ index, transaction }] : [],
  )
  return { kind: 'delete', at, removed }
}

/** Identifiants supprimés à la main : un nouvel import du même fichier ne les remet pas. */
export function deletedIds(journal: readonly Correction[]): Set<string> {
  return new Set(
    journal.flatMap((correction) =>
      correction.kind === 'delete'
        ? correction.removed.map(({ transaction }) => transaction.id)
        : [],
    ),
  )
}

/** Identifiants des opérations ajoutées ou modifiées à la main, encore présentes. */
export function correctedIds(journal: readonly Correction[]): Set<string> {
  return new Set(
    journal.flatMap((correction) =>
      correction.kind === 'add'
        ? [correction.transaction.id]
        : correction.kind === 'edit'
          ? [correction.after.id]
          : [],
    ),
  )
}
