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
  saveFile(await fillForm2086(template, summary), `formulaire-2086-revenus-${summary.year}.pdf`)
}
