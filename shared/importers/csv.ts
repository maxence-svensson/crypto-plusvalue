import Papa from 'papaparse'

import type { Transaction } from '../portfolio/transaction'
import { Dec } from '../tax/decimal'

/** Fichier illisible ou d'un format inattendu : le message s'affiche tel quel. */
export class ImportError extends Error {}

export type ImportResult = {
  transactions: Transaction[]
  /** Lignes sans rapport avec la crypto (titres, espèces) : ignorées. */
  skipped: number
  /** Lignes crypto que l'import ne sait pas encore traiter : à vérifier par l'utilisateur. */
  unsupported: { line: number; label: string }[]
}

export type CsvRow = {
  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1), pour retrouver une erreur. */
  line: number
  cells: Record<string, string>
}

/** Lit un CSV avec en-tête, quel que soit son séparateur. */
export function readCsv(text: string, requiredColumns: readonly string[]): CsvRow[] {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  const missing = requiredColumns.filter((column) => !parsed.meta.fields?.includes(column))
  if (missing.length > 0) {
    throw new ImportError(`Colonnes absentes du fichier : ${missing.join(', ')}.`)
  }

  const error = parsed.errors[0]
  if (error) {
    throw new ImportError(`Ligne ${(error.row ?? 0) + 2} illisible : ${error.message}.`)
  }

  return parsed.data.map((cells, index) => ({ line: index + 2, cells }))
}

/** Contenu d'une cellule, sans espaces autour ; vide si la colonne manque. */
export function cell(row: CsvRow, column: string): string {
  return row.cells[column]?.trim() ?? ''
}

/** Valeur absolue d'un nombre écrit avec un point décimal ; une cellule vide vaut 0. */
export function amount(row: CsvRow, column: string): Dec {
  const raw = cell(row, column)
  if (raw === '') return new Dec(0)
  try {
    return new Dec(raw).abs()
  } catch {
    throw new ImportError(`Ligne ${row.line} : « ${raw} » n'est pas un nombre (colonne ${column}).`)
  }
}

/** Date ISO 8601 ; les fractions de seconde au-delà de la milliseconde sont tronquées. */
export function isoDate(row: CsvRow, column: string): Date {
  const raw = cell(row, column)
  const date = new Date(raw.replace(/(\.\d{3})\d+/, '$1'))
  if (raw === '' || Number.isNaN(date.getTime())) {
    throw new ImportError(`Ligne ${row.line} : « ${raw} » n'est pas une date (colonne ${column}).`)
  }
  return date
}
