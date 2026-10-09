import { SOURCE_NAMES, transactionsTable } from '../portfolio/listing'
import { PROBLEMS, type ProblemId } from '../portfolio/problems'
import type { DataQuality } from '../portfolio/quality'
import { TRANSACTION_LABELS, type Transaction } from '../portfolio/transaction'
import type { Dec } from '../tax/decimal'
import { summarizeYear, taxYear, type DisposalResult } from '../tax/form2086'
import { flatTax, taxRules } from '../tax/rules'
import { toSheet, type ReportCell, type ReportTable } from './table'
import { buildXlsx, type Cell } from './xlsx'

/**
 * Rapports d'une année pour un comptable, un conseiller ou ses propres archives : le résumé, les
 * cessions ligne à ligne (lignes 211 à 224 du 2086), les opérations et les points à vérifier.
 * Les montants calculés sont arrondis au centime ; le calcul, lui, n'arrondit rien en route.
 */

export type ReportFile =
  | {
      name: string
      platform: string
      unsupported: { line: number; label: string }[]
      anomalies: { line: number; message: string }[]
    }
  | { name: string; error: string }

export type ReportInput = {
  year: number
  transactions: readonly Transaction[]
  /** Toutes les cessions calculées, toutes années confondues. */
  disposals: readonly DisposalResult[]
  problems: ReadonlyMap<string, readonly ProblemId[]>
  quality: DataQuality
  files: readonly ReportFile[]
  generatedAt: Date
}

const cents = (value: Dec): ReportCell => ({ euros: value.toDecimalPlaces(2) })

/** Une ligne par cession imposable de l'année, avec les lignes du 2086. */
export function disposalsTable(input: ReportInput): ReportTable {
  const byId = new Map(input.transactions.map((transaction) => [transaction.id, transaction]))
  const { disposals } = summarizeYear([...input.disposals], input.year)
  return {
    name: `Cessions ${input.year}`,
    columns: [
      'N°',
      'Date (Paris)',
      'Opération',
      'Crypto cédée',
      'Quantité',
      '212 Valeur globale du portefeuille',
      '213 Prix de cession',
      '214 Frais de cession',
      '216 Soulte',
      '218 Prix de cession net',
      '220 Prix total d’acquisition',
      '221 Fractions de capital initial',
      '222 Soultes reçues',
      '223 Prix total d’acquisition net',
      'Plus ou moins-value',
      'Identifiant',
    ],
    widths: [5, 20, 18, 12, 14, 18, 16, 14, 10, 18, 18, 18, 14, 18, 16, 30],
    rows: disposals.map((result, index) => {
      const transaction = byId.get(result.id)
      const sent = transaction && 'sent' in transaction ? transaction.sent : undefined
      return [
        { count: index + 1 },
        { date: result.date },
        transaction ? TRANSACTION_LABELS[transaction.type] : null,
        sent?.asset ?? null,
        sent ? { quantity: sent.quantity } : null,
        cents(result.portfolioValue),
        cents(result.price),
        cents(result.fees),
        cents(result.balancingPayment),
        cents(result.netPrice),
        cents(result.totalAcquisitionCost),
        cents(result.initialCapitalFractions),
        cents(result.receivedBalancingPayments),
        cents(result.netAcquisitionCost),
        cents(result.gain),
        result.id,
      ]
    }),
  }
}

const SEVERITY_LABELS = {
  bloquant: 'Bloquant',
  'à vérifier': 'À vérifier',
  information: 'Information',
}

/**
 * Points à vérifier : le diagnostic d'ensemble, puis chaque opération concernée, puis les lignes
 * des fichiers écartées ou non prises en charge.
 */
export function issuesTable(input: ReportInput): ReportTable {
  const rows: ReportCell[][] = []
  for (const issue of input.quality.issues) {
    rows.push([
      SEVERITY_LABELS[issue.severity],
      'Ensemble des données',
      null,
      issue.title,
      `${issue.count} : ${issue.detail}`,
    ])
  }
  const byId = new Map(input.transactions.map((transaction) => [transaction.id, transaction]))
  for (const [id, problems] of input.problems) {
    const transaction = byId.get(id)
    if (!transaction) continue
    for (const problem of problems) {
      rows.push([
        PROBLEMS[problem].blocking ? 'Bloquant' : 'À vérifier',
        `${TRANSACTION_LABELS[transaction.type]}, ${SOURCE_NAMES[transaction.source]} (${id})`,
        { date: transaction.date },
        PROBLEMS[problem].title,
        PROBLEMS[problem].detail,
      ])
    }
  }
  for (const file of input.files) {
    if ('error' in file) {
      rows.push(['Bloquant', file.name, null, 'Fichier non importé', file.error])
      continue
    }
    for (const { line, message } of file.anomalies) {
      rows.push(['À vérifier', `${file.name}, ligne ${line}`, null, 'Ligne illisible', message])
    }
    for (const { line, label } of file.unsupported) {
      rows.push(['À vérifier', `${file.name}, ligne ${line}`, null, 'Non prise en charge', label])
    }
  }
  return {
    name: 'Points à vérifier',
    columns: ['Gravité', 'Concerne', 'Date (Paris)', 'Point', 'Détail'],
    widths: [12, 45, 20, 32, 90],
    rows,
  }
}

const QUALITY_LABELS = { complet: 'Complet', 'à vérifier': 'À vérifier', incomplet: 'Incomplet' }

/** Feuille de résumé : l'année en quelques chiffres, et ce que le rapport ne garantit pas. */
function summarySheet(input: ReportInput) {
  const summary = summarizeYear([...input.disposals], input.year)
  const tax = flatTax(summary)
  const rules = taxRules(input.year)
  const platforms = [
    ...new Set(
      input.transactions
        .filter((transaction) => taxYear(transaction.date) <= input.year)
        .map((transaction) => SOURCE_NAMES[transaction.source]),
    ),
  ]
  const euros = (value: Dec): Cell => ({ euros: value.toDecimalPlaces(2).toNumber() })
  const rows: Cell[][] = [
    [{ bold: `Cessions d'actifs numériques : revenus ${input.year}` }],
    ['Établi le', { date: input.generatedAt }],
    ['Par', 'CryptoPlusValue, outil indépendant, sans lien avec l’administration fiscale'],
    [],
    [{ bold: 'Formulaire 2086 et déclaration 2042 C' }],
    ['Cessions imposables', summary.disposals.length],
    ['Somme des prix de cession (lignes 218)', euros(summary.totalPrice)],
    ['Plus ou moins-value nette (ligne 224)', euros(summary.netGain)],
    [
      'Exonération (cessions de 305 € au plus)',
      summary.disposals.length === 0 ? 'Sans objet' : summary.exempt ? 'Oui' : 'Non',
    ],
    ['Case 3AN (plus-value, euros entiers)', summary.box3AN],
    ['Case 3BN (moins-value, euros entiers)', summary.box3BN],
    [
      'Impôt estimé au prélèvement forfaitaire',
      tax ? euros(tax) : 'Non estimé : taux de l’année inconnus',
    ],
    ...(rules
      ? [
          [
            'Taux appliqués',
            `${rules.flatIncomeTax.times(100).toString().replace('.', ',')} % d’impôt et ${rules.socialContributions.times(100).toString().replace('.', ',')} % de prélèvements sociaux`,
          ] as Cell[],
        ]
      : []),
    [],
    [{ bold: 'Données' }],
    ['Qualité des données', QUALITY_LABELS[input.quality.level]],
    [
      'Opérations jusqu’à fin ' + input.year,
      input.transactions.filter((t) => taxYear(t.date) <= input.year).length,
    ],
    ['Sources', platforms.join(', ') || 'aucune'],
    [],
    [
      'Ces montants sont indicatifs : ils dépendent de l’exhaustivité des historiques importés et des cours retenus. Vérifiez-les avant de déclarer ; ils ne remplacent pas un conseil fiscal.',
    ],
  ]
  return { name: 'Résumé', rows, widths: [44, 70] }
}

/**
 * Classeur Excel pour le comptable : résumé, cessions de l'année, opérations jusqu'à la fin de
 * l'année (le calcul en dépend), points à vérifier.
 */
export function accountantWorkbook(input: ReportInput): Uint8Array {
  const untilYearEnd = input.transactions.filter(
    (transaction) => taxYear(transaction.date) <= input.year,
  )
  return buildXlsx([
    summarySheet(input),
    toSheet(disposalsTable(input)),
    toSheet(transactionsTable(untilYearEnd, input.problems)),
    toSheet(issuesTable(input)),
  ])
}
