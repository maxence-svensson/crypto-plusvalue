import { PLATFORM_NAMES } from '#shared/importers/detect'

export type ReportKind = 'classeur' | 'cessions' | 'points'

/**
 * Rapports d'une année, produits dans le navigateur : classeur Excel pour le comptable, cessions
 * ou points à vérifier en CSV. Le code des rapports n'est chargé qu'à ce moment-là.
 */
export async function downloadReport(kind: ReportKind, year: number) {
  const store = usePortfolioStore()
  const state = store.computation
  if (state.status !== 'ready') throw new Error('Le calcul n’est pas terminé.')
  const [{ accountantWorkbook, disposalsTable, issuesTable }, { toCsv }] = await Promise.all([
    import('#shared/reports/reports'),
    import('#shared/reports/table'),
  ])
  const input = {
    year,
    transactions: store.transactions,
    disposals: state.disposals,
    problems: store.problems,
    quality: store.quality,
    files: store.files.map((file) =>
      'error' in file
        ? { name: file.name, error: file.error }
        : {
            name: file.name,
            platform: PLATFORM_NAMES[file.platform],
            unsupported: file.unsupported,
            anomalies: file.anomalies,
          },
    ),
    generatedAt: new Date(),
  }
  const encode = (text: string) => new TextEncoder().encode(text)
  if (kind === 'classeur') {
    saveFile(
      accountantWorkbook(input),
      `crypto-revenus-${year}-pour-le-comptable.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
  } else if (kind === 'cessions') {
    saveFile(encode(toCsv(disposalsTable(input))), `cessions-crypto-${year}.csv`, 'text/csv')
  } else {
    saveFile(encode(toCsv(issuesTable(input))), `points-a-verifier-${year}.csv`, 'text/csv')
  }
}
