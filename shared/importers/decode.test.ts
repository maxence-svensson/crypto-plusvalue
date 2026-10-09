import { describe, expect, it } from 'vitest'

import { binaryFormat, decodeText } from './decode'

const bytes = (...values: number[]) => new Uint8Array(values)

describe('decodeText', () => {
  it('lit l’UTF-8, avec ou sans BOM', () => {
    const text = 'Libellé,Montant'
    const utf8 = new TextEncoder().encode(text)
    expect(decodeText(utf8)).toBe(text)
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe(text)
  })

  it('lit l’UTF-16 d’Excel', () => {
    // « Aé » en UTF-16 petit-boutiste, précédé de son BOM.
    expect(decodeText(bytes(0xff, 0xfe, 0x41, 0x00, 0xe9, 0x00))).toBe('Aé')
    expect(decodeText(bytes(0xfe, 0xff, 0x00, 0x41, 0x00, 0xe9))).toBe('Aé')
  })

  it('se rabat sur Windows-1252 pour un CSV réenregistré sous Windows', () => {
    // « Libellé € » : é = 0xE9 et € = 0x80 en Windows-1252, invalides en UTF-8.
    expect(decodeText(bytes(0x4c, 0x69, 0x62, 0x65, 0x6c, 0x6c, 0xe9, 0x20, 0x80))).toBe(
      'Libellé €',
    )
  })
})

describe('binaryFormat', () => {
  it('reconnaît un classeur Excel ou une archive, et un PDF', () => {
    expect(binaryFormat(bytes(0x50, 0x4b, 0x03, 0x04, 0x14))).toContain('Excel')
    expect(binaryFormat(new TextEncoder().encode('%PDF-1.7'))).toContain('PDF')
    expect(binaryFormat(new TextEncoder().encode('datetime,type'))).toBeUndefined()
  })
})
