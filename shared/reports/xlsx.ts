import { parisTimestamp } from '../time'
import { zip } from './zip'

/**
 * Classeur Excel (XLSX) minimal, sans dépendance : plusieurs feuilles, texte en ligne, nombres,
 * montants en euros, quantités et dates à l'heure de Paris, première ligne en gras et figée.
 * Le texte n'est jamais interprété comme une formule : un libellé importé qui commence par « = »
 * reste du texte.
 */

export type Cell =
  | string
  | number
  | null
  | { euros: number }
  | { quantity: number }
  | { date: Date }
  | { bold: string }

export type Sheet = {
  /** 31 caractères au plus, sans [ ] : * ? / \ */
  name: string
  rows: Cell[][]
  /** Largeur de chaque colonne, en caractères. */
  widths?: number[]
  /** Première ligne en gras et figée au défilement. */
  header?: boolean
}

const STYLE = { plain: 0, bold: 1, euros: 2, quantity: 3, date: 4 } as const

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** Échappe le texte et retire les caractères interdits en XML 1.0. */
function escape(text: string): string {
  return (
    text
      // Caractères de contrôle interdits en XML 1.0 : un libellé importé peut en contenir.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
  )
}

/** A, B… Z, AA, AB… */
export function columnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  }
  return name
}

/** Date au format d'Excel : jours depuis le 30/12/1899, à l'heure de Paris (Excel n'a pas de fuseau). */
export function excelDate(date: Date): number {
  const [day, time] = parisTimestamp(date).split(' ')
  const [year, month, dayOfMonth] = (day ?? '').split('-').map(Number)
  const [hours, minutes, seconds] = (time ?? '').split(':').map(Number)
  const local = Date.UTC(year ?? 0, (month ?? 1) - 1, dayOfMonth ?? 1, hours, minutes, seconds)
  return local / 86_400_000 + 25_569
}

function cellXml(cell: Cell, reference: string, bold: boolean): string {
  if (cell === null || cell === '') return ''
  const text = (value: string, style: number) =>
    `<c r="${reference}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${escape(value)}</t></is></c>`
  const number = (value: number, style: number) =>
    Number.isFinite(value)
      ? `<c r="${reference}"${style ? ` s="${style}"` : ''}><v>${value}</v></c>`
      : ''
  if (typeof cell === 'string') return text(cell, bold ? STYLE.bold : STYLE.plain)
  if (typeof cell === 'number') return number(cell, bold ? STYLE.bold : STYLE.plain)
  if ('bold' in cell) return text(cell.bold, STYLE.bold)
  if ('euros' in cell) return number(cell.euros, STYLE.euros)
  if ('quantity' in cell) return number(cell.quantity, STYLE.quantity)
  return number(excelDate(cell.date), STYLE.date)
}

function sheetXml(sheet: Sheet): string {
  const frozen = sheet.header
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : ''
  const columns = sheet.widths?.length
    ? `<cols>${sheet.widths
        .map(
          (width, index) =>
            `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
        )
        .join('')}</cols>`
    : ''
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) =>
          cellXml(
            cell,
            `${columnName(columnIndex)}${rowIndex + 1}`,
            Boolean(sheet.header) && rowIndex === 0,
          ),
        )
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')
  return `${XML}<worksheet xmlns="${MAIN}">${frozen}${columns}<sheetData>${rows}</sheetData></worksheet>`
}

const STYLES = `${XML}<styleSheet xmlns="${MAIN}">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="0.########"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy\\ hh:mm:ss"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

export function buildXlsx(sheets: Sheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error('Un classeur a au moins une feuille.')
  for (const { name } of sheets) {
    if (name.length === 0 || name.length > 31 || /[[\]:*?/\\]/.test(name)) {
      throw new Error(`Nom de feuille invalide : « ${name} ».`)
    }
  }
  const encoder = new TextEncoder()
  const file = (name: string, content: string) => ({ name, data: encoder.encode(content) })

  const contentTypes = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')}</Types>`
  const rootRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${RELATIONSHIPS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  const workbook = `${XML}<workbook xmlns="${MAIN}" xmlns:r="${RELATIONSHIPS}"><sheets>${sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('')}</sheets></workbook>`
  const workbookRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="${RELATIONSHIPS}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join(
      '',
    )}<Relationship Id="rId${sheets.length + 1}" Type="${RELATIONSHIPS}/styles" Target="styles.xml"/></Relationships>`

  return zip([
    file('[Content_Types].xml', contentTypes),
    file('_rels/.rels', rootRels),
    file('xl/workbook.xml', workbook),
    file('xl/_rels/workbook.xml.rels', workbookRels),
    file('xl/styles.xml', STYLES),
    ...sheets.map((sheet, index) => file(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet))),
  ])
}
