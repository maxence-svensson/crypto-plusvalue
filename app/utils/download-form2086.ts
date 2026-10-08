import { FORM_2086 } from '#shared/cerfa/form2086'
import type { YearSummary } from '#shared/tax/form2086'

/**
 * Remplit le formulaire 2086 officiel dans le navigateur et le propose au téléchargement.
 * pdf-lib n'est chargé qu'à ce moment-là, pour ne pas alourdir la page.
 */
export async function downloadForm2086(summary: YearSummary) {
  const [{ fillForm2086 }, template] = await Promise.all([
    import('#shared/cerfa/fill'),
    $fetch<ArrayBuffer>(FORM_2086.path, { responseType: 'arrayBuffer' }),
  ])
  const bytes = await fillForm2086(template, summary)

  const url = URL.createObjectURL(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `formulaire-2086-revenus-${summary.year}.pdf`
  link.click()
  // Laisse au navigateur le temps de lancer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
