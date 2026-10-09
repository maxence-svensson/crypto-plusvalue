import { taxYear } from '../tax/form2086'
import { FIRST_YEAR } from '../tax/rules'
import type { MissingHistory } from './replay'
import type { Transaction } from './transaction'
import { matchTransfers } from './transfers'

/**
 * Qualité des données importées : ce qui rend le calcul faux, ce qui peut le fausser, et les
 * choix de calcul à connaître. Le niveau qui en découle mesure la complétude de l'historique ;
 * ce n'est pas une garantie de conformité fiscale.
 */

export type Severity = 'bloquant' | 'à vérifier' | 'information'

export type QualityIssue = {
  id:
    | 'missing-history'
    | 'missing-prices'
    | 'unmatched-in'
    | 'unmatched-out'
    | 'unsupported'
    | 'anomalies'
    | 'before-2019'
    | 'free-rewards'
  /**
   * `bloquant` : le résultat est faux tant que ce n'est pas réglé ; `à vérifier` : il peut
   * l'être ; `information` : un choix de calcul à connaître.
   */
  severity: Severity
  count: number
  title: string
  detail: string
}

export type QualityLevel = 'complet' | 'à vérifier' | 'incomplet'

export type DataQuality = { level: QualityLevel; issues: QualityIssue[] }

export type QualityInput = {
  transactions: readonly Transaction[]
  missingHistory: readonly MissingHistory[]
  /** Cours introuvables et pas encore saisis. */
  missingPrices: number
  /** Lignes d'un type que l'import ne sait pas traiter. */
  unsupported: number
  /** Lignes illisibles écartées à l'import. */
  anomalies: number
}

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`

export function assessQuality(input: QualityInput): DataQuality {
  const issues: QualityIssue[] = []

  if (input.missingHistory.length > 0) {
    issues.push({
      id: 'missing-history',
      severity: 'bloquant',
      count: input.missingHistory.length,
      title: 'Achats manquants',
      detail: `${plural(input.missingHistory.length, 'vente ou envoi porte', 'ventes ou envois portent')} sur plus de cryptos que l'historique n'en contient : le prix d'acquisition est sous-estimé et la plus-value surestimée. Importez l'historique des autres plateformes ou portefeuilles.`,
    })
  }
  if (input.missingPrices > 0) {
    issues.push({
      id: 'missing-prices',
      severity: 'bloquant',
      count: input.missingPrices,
      title: 'Cours manquants',
      detail: `${plural(input.missingPrices, 'cours est introuvable', 'cours sont introuvables')} : saisissez-les pour terminer le calcul.`,
    })
  }

  const transfers = matchTransfers(input.transactions)
  if (transfers.unmatchedIn.length > 0) {
    issues.push({
      id: 'unmatched-in',
      severity: 'à vérifier',
      count: transfers.unmatchedIn.length,
      title: 'Réceptions sans envoi correspondant',
      detail: `${plural(transfers.unmatchedIn.length, 'réception vient', 'réceptions viennent')} d'un portefeuille ou d'une plateforme non importés. Si ces cryptos y avaient été achetées, importez cet historique : sinon leur prix d'acquisition manque.`,
    })
  }
  if (transfers.unmatchedOut.length > 0) {
    issues.push({
      id: 'unmatched-out',
      severity: 'à vérifier',
      count: transfers.unmatchedOut.length,
      title: 'Envois sans réception correspondante',
      detail: `${plural(transfers.unmatchedOut.length, 'envoi part', 'envois partent')} vers un compte non importé. Vers un autre de vos portefeuilles, rien à faire : ces cryptos restent dans votre portefeuille. Pour un paiement ou un don, ce n'est pas un simple transfert.`,
    })
  }
  if (input.unsupported > 0) {
    issues.push({
      id: 'unsupported',
      severity: 'à vérifier',
      count: input.unsupported,
      title: 'Opérations non prises en charge',
      detail: `${plural(input.unsupported, 'ligne crypto est', 'lignes crypto sont')} d'un type que l'import ne traite pas encore : absentes du calcul, à vérifier dans la liste des fichiers.`,
    })
  }
  if (input.anomalies > 0) {
    issues.push({
      id: 'anomalies',
      severity: 'à vérifier',
      count: input.anomalies,
      title: 'Lignes illisibles',
      detail: `${plural(input.anomalies, 'ligne a été écartée', 'lignes ont été écartées')} à l'import : date, montant ou symbole illisible.`,
    })
  }

  const early = input.transactions.filter((transaction) => taxYear(transaction.date) < FIRST_YEAR)
  if (early.length > 0) {
    issues.push({
      id: 'before-2019',
      severity: 'à vérifier',
      count: early.length,
      title: `Historique antérieur à ${FIRST_YEAR}`,
      detail: `${plural(early.length, 'opération date', 'opérations datent')} d'avant ${FIRST_YEAR} : le prix d'acquisition de ces cryptos obéit à des règles particulières (BOFiP BOI-RPPM-PVBMC-30-20, §130).`,
    })
  }

  const rewards = input.transactions.filter((transaction) => transaction.type === 'reward')
  if (rewards.length > 0) {
    issues.push({
      id: 'free-rewards',
      severity: 'information',
      count: rewards.length,
      title: 'Récompenses à prix d’acquisition nul',
      detail: `${plural(rewards.length, 'récompense (staking, bonus) entre', 'récompenses (staking, bonus) entrent')} dans le portefeuille sans prix d'acquisition : le choix prudent, faute de doctrine fixant leur valeur.`,
    })
  }

  const level: QualityLevel = issues.some((issue) => issue.severity === 'bloquant')
    ? 'incomplet'
    : issues.some((issue) => issue.severity === 'à vérifier')
      ? 'à vérifier'
      : 'complet'
  return { level, issues }
}
