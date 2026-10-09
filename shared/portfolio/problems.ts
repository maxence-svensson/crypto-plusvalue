import { taxYear } from '../tax/form2086'
import { FIRST_YEAR } from '../tax/rules'
import type { MissingHistory } from './replay'
import type { Transaction } from './transaction'
import { matchTransfers } from './transfers'

/**
 * Points à vérifier opération par opération : le détail de ce que le diagnostic compte en bloc,
 * pour retrouver dans la liste les lignes concernées.
 */

export type ProblemId =
  'missing-history' | 'missing-price' | 'unmatched-in' | 'unmatched-out' | 'before-2019'

export const PROBLEMS: Record<ProblemId, { title: string; detail: string; blocking: boolean }> = {
  'missing-history': {
    title: 'Achats manquants',
    detail:
      'Cette opération fait sortir plus de cryptos que l’historique n’en contient : il manque des achats, sur une autre plateforme ou un autre portefeuille.',
    blocking: true,
  },
  'missing-price': {
    title: 'Cours manquant',
    detail: 'Un cours nécessaire au calcul est introuvable : saisissez-le sur la page Fiscalité.',
    blocking: true,
  },
  'unmatched-in': {
    title: 'Réception sans envoi',
    detail:
      'Aucun envoi correspondant dans les historiques importés : si ces cryptos ont été achetées ailleurs, importez cet historique.',
    blocking: false,
  },
  'unmatched-out': {
    title: 'Envoi sans réception',
    detail:
      'Aucune réception correspondante dans les historiques importés. Vers un autre de vos portefeuilles, rien à faire ; pour un paiement ou un don, ce n’est pas un simple transfert.',
    blocking: false,
  },
  'before-2019': {
    title: `Antérieure à ${FIRST_YEAR}`,
    detail: `Le prix d’acquisition des cryptos achetées avant ${FIRST_YEAR} obéit à des règles particulières (BOFiP BOI-RPPM-PVBMC-30-20, §130).`,
    blocking: false,
  },
}

export type ProblemsInput = {
  transactions: readonly Transaction[]
  missingHistory: readonly MissingHistory[]
  /** Opérations dont un cours nécessaire est introuvable et pas encore saisi. */
  missingPriceIds: Iterable<string>
}

export function transactionProblems(input: ProblemsInput): Map<string, ProblemId[]> {
  const problems = new Map<string, ProblemId[]>()
  const flag = (id: string, problem: ProblemId) => {
    const list = problems.get(id) ?? []
    if (!list.includes(problem)) problems.set(id, [...list, problem])
  }

  for (const { transactionId } of input.missingHistory) flag(transactionId, 'missing-history')
  for (const id of input.missingPriceIds) flag(id, 'missing-price')
  const transfers = matchTransfers(input.transactions)
  for (const { id } of transfers.unmatchedIn) flag(id, 'unmatched-in')
  for (const { id } of transfers.unmatchedOut) flag(id, 'unmatched-out')
  for (const transaction of input.transactions) {
    if (taxYear(transaction.date) < FIRST_YEAR) flag(transaction.id, 'before-2019')
  }
  return problems
}
