import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'

import type { YearSummary } from '../tax/form2086'
import { form2086Placements } from './form2086'

const FONT_SIZE = 9
/** Encre bleu nuit, comme un formulaire rempli au stylo. */
const INK = rgb(0.106, 0.133, 0.251)

/**
 * Remplit le formulaire 2086 officiel avec les cessions de l'année. Au-delà de 5 cessions, les
 * deux premières pages sont dupliquées en feuillets supplémentaires, placés à la suite.
 * Tout se passe dans le navigateur : le formulaire rempli n'est envoyé nulle part.
 */
export async function fillForm2086(
  template: ArrayBuffer | Uint8Array,
  summary: YearSummary,
): Promise<Uint8Array> {
  const placements = form2086Placements(summary)
  const pdf = await PDFDocument.load(template)

  const sheets: PDFPage[][] = [pdf.getPages()]
  const sheetCount = Math.max(1, ...placements.map((placement) => placement.sheet + 1))
  for (let sheet = 1; sheet < sheetCount; sheet++) {
    const source = await PDFDocument.load(template)
    const [first, second] = await pdf.copyPages(source, [0, 1])
    if (!first || !second) throw new Error('Formulaire 2086 incomplet.')
    pdf.insertPage(2 * sheet, first)
    pdf.insertPage(2 * sheet + 1, second)
    sheets.push([first, second])
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (const { sheet, page, box, text } of placements) {
    const target = sheets[sheet]?.[page]
    if (!target) continue
    const [, top, right, bottom] = box
    const width = font.widthOfTextAtSize(text, FONT_SIZE)
    target.drawText(text, {
      x: right - 4 - width,
      // Le PDF compte les ordonnées depuis le bas de la page.
      y: target.getHeight() - (top + bottom) / 2 - FONT_SIZE * 0.35,
      size: FONT_SIZE,
      font,
      color: INK,
    })
  }

  pdf.setTitle(`Formulaire 2086, revenus ${summary.year}`)
  pdf.setCreator('CryptoPlusValue')
  return pdf.save()
}
