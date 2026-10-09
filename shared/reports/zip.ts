/**
 * Archive ZIP sans compression (méthode « stored ») : ce qu'il faut pour un classeur XLSX, sans
 * dépendance. Dates des fichiers fixées au 1er janvier 1980 : deux archives du même contenu sont
 * identiques octet pour octet.
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** 1er janvier 1980, 00:00, au format MS-DOS. */
const DOS_TIME = 0
const DOS_DATE = (0 << 9) | (1 << 5) | 1

export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const crc = crc32(file.data)
    const size = file.data.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // version nécessaire : 2.0
    local.setUint16(6, 0x0800, true) // noms en UTF-8
    local.setUint16(8, 0, true) // sans compression
    local.setUint16(10, DOS_TIME, true)
    local.setUint16(12, DOS_DATE, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true)
    local.setUint32(22, size, true)
    local.setUint16(26, name.length, true)
    local.setUint16(28, 0, true)
    chunks.push(new Uint8Array(local.buffer), name, file.data)

    const entry = new DataView(new ArrayBuffer(46))
    entry.setUint32(0, 0x02014b50, true)
    entry.setUint16(4, 20, true)
    entry.setUint16(6, 20, true)
    entry.setUint16(8, 0x0800, true)
    entry.setUint16(10, 0, true)
    entry.setUint16(12, DOS_TIME, true)
    entry.setUint16(14, DOS_DATE, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, size, true)
    entry.setUint32(24, size, true)
    entry.setUint16(28, name.length, true)
    entry.setUint32(42, offset, true)
    central.push(new Uint8Array(entry.buffer), name)

    offset += 30 + name.length + size
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  const all = [...chunks, ...central, new Uint8Array(end.buffer)]
  const result = new Uint8Array(all.reduce((sum, chunk) => sum + chunk.length, 0))
  let position = 0
  for (const chunk of all) {
    result.set(chunk, position)
    position += chunk.length
  }
  return result
}
