import { buildDossier } from '#shared/dossier/dossier'
import { PLATFORM_NAMES } from '#shared/importers/detect'

/**
 * Établit le dossier justificatif d'une année et le propose au téléchargement, sans rien envoyer
 * à un serveur. La mise en page (pdf-lib) n'est chargée qu'à ce moment-là.
 */
export async function downloadDossier(year: number) {
  const store = usePortfolioStore()
  const { renderDossier } = await import('#shared/dossier/pdf')
  const dossier = buildDossier({
    year,
    transactions: store.transactions,
    priceAt: store.priceAt,
    files: store.files.flatMap((file) =>
      'error' in file
        ? []
        : [
            {
              name: file.name,
              platform: PLATFORM_NAMES[file.platform],
              transactions: file.transactions,
              skipped: file.skipped,
            },
          ],
    ),
    generatedAt: new Date(),
  })
  const bytes = await renderDossier(dossier, { rulesUrl: docUrl('regles-fiscales') })
  saveFile(bytes, `dossier-justificatif-crypto-revenus-${year}.pdf`)
}
