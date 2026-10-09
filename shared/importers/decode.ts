/** Taille maximale d'un fichier importé : au-delà, le navigateur peinerait à le lire. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024

/**
 * Explique pourquoi un fichier binaire ne peut pas être lu : un classeur Excel ou une archive
 * (même signature ZIP), un PDF. `undefined` pour un fichier texte.
 */
export function binaryFormat(bytes: Uint8Array): string | undefined {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte)
  if (starts(0x50, 0x4b, 0x03, 0x04)) {
    return 'Ce fichier est un classeur Excel ou une archive ZIP : exportez votre historique au format CSV.'
  }
  if (starts(0x25, 0x50, 0x44, 0x46)) {
    return 'Ce fichier est un PDF : les relevés PDF ne contiennent pas tout le détail, exportez votre historique au format CSV.'
  }
  return undefined
}

/**
 * Texte d'un fichier, quel que soit son encodage : UTF-8 avec ou sans BOM, UTF-16 (« texte
 * Unicode » d'Excel), ou Windows-1252 (CSV réenregistré par Excel sous Windows).
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
