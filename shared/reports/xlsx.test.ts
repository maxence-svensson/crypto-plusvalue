import { describe, expect, it } from 'vitest'

import { buildXlsx, columnName, excelDate } from './xlsx'
import { crc32, zip } from './zip'

/** Lit une archive ZIP sans compression : nom et contenu de chaque fichier. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const files = new Map<string, string>()
  let offset = 0
  while (view.getUint32(offset, true) === 0x04034b50) {
    expect(view.getUint16(offset + 8, true)).toBe(0)
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength))
    const data = bytes.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size)
    expect(crc32(data)).toBe(view.getUint32(offset + 14, true))
    files.set(name, new TextDecoder().decode(data))
    offset += 30 + nameLength + size
  }
  return files
}

describe('zip', () => {
  it('calcule le CRC-32 de référence', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('produit une archive lisible et identique pour un même contenu', () => {
    const files = [{ name: 'a.txt', data: new TextEncoder().encode('bonjour') }]
    const archive = zip(files)
    expect([...unzip(archive)]).toEqual([['a.txt', 'bonjour']])
    expect(zip(files)).toEqual(archive)
  })
})

describe('buildXlsx', () => {
  it('écrit les feuilles, les styles et les types de cellules', () => {
    const files = unzip(
      buildXlsx([
        {
          name: 'Résumé',
          header: true,
          widths: [20, 10],
          rows: [
            ['Libellé', 'Valeur'],
            ['=HYPERLINK("x")', { euros: 1234.5 }],
            [{ bold: 'Total & <reste>' }, { quantity: 0.00000001 }],
            ['Date', { date: new Date('2025-07-01T10:00:00Z') }],
          ],
        },
        { name: 'Cessions 2025', rows: [[1, null, 'texte']] },
      ]),
    )
    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ])
    expect(files.get('xl/workbook.xml')).toContain('<sheet name="Résumé" sheetId="1" r:id="rId1"/>')
    const sheet = files.get('xl/worksheets/sheet1.xml') ?? ''
    // Une formule importée reste du texte.
    expect(sheet).toContain(
      't="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;x&quot;)</t>',
    )
    expect(sheet).not.toContain('<f>')
    expect(sheet).toContain('<c r="B2" s="2"><v>1234.5</v></c>')
    expect(sheet).toContain('Total &amp; &lt;reste&gt;')
    expect(sheet).toContain('state="frozen"')
    // 1er juillet 2025, 12 h à Paris.
    expect(sheet).toContain(`<c r="B4" s="4"><v>${45839 + 0.5}</v></c>`)
  })

  it('refuse un nom de feuille qu’Excel n’accepte pas', () => {
    expect(() => buildXlsx([{ name: 'a/b', rows: [] }])).toThrow(/Nom de feuille/)
    expect(() => buildXlsx([])).toThrow()
  })
})

describe('utilitaires', () => {
  it('nomme les colonnes et convertit les dates', () => {
    expect([0, 25, 26, 51, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'AAA'])
    expect(excelDate(new Date('2024-12-31T23:00:00Z'))).toBe(45658)
  })
})
