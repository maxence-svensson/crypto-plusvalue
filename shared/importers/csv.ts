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

/** Nom d'une colonne, ou ses variantes selon les versions de l'export (la première présente compte). */
export type Column = string | readonly string[]

/**
 * Lit un CSV avec en-tête, quel que soit son séparateur. `headerLine` est le numéro de la ligne
 * d'en-tête dans le fichier, quand des lignes la précèdent.
 */
export function readCsv(
  text: string,
  requiredColumns: readonly Column[],
  headerLine = 1,
): CsvRow[] {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  const fields = parsed.meta.fields ?? []
  const missing = requiredColumns
    .filter((column) => !variants(column).some((name) => fields.includes(name)))
    .map((column) => variants(column)[0])
  if (missing.length > 0) {
    throw new ImportError(`Colonnes absentes du fichier : ${missing.join(', ')}.`)
  }

  const error = parsed.errors[0]
  if (error) {
    throw new ImportError(
      `Ligne ${(error.row ?? 0) + headerLine + 1} illisible : ${error.message}.`,
    )
  }

  return parsed.data.map((cells, index) => ({ line: index + headerLine + 1, cells }))
}

function variants(column: Column): readonly string[] {
  return typeof column === 'string' ? [column] : column
}

/** Contenu d'une cellule, sans espaces autour ; vide si la colonne manque. */
export function cell(row: CsvRow, column: Column): string {
  const name = variants(column).find((candidate) => candidate in row.cells)
  return name === undefined ? '' : (row.cells[name]?.trim() ?? '')
}

/** Valeur absolue d'un nombre écrit avec un point décimal ; une cellule vide vaut 0. */
export function amount(row: CsvRow, column: Column): Dec {
  const raw = cell(row, column)
  if (raw === '') return new Dec(0)
  try {
    return new Dec(raw).abs()
  } catch {
    throw new ImportError(
      `Ligne ${row.line} : « ${raw} » n'est pas un nombre (colonne ${variants(column)[0]}).`,
    )
  }
}

/**
 * Date ISO 8601, ou au format `2024-12-05 06:33:40 UTC`. Les fractions de seconde au-delà de la
 * milliseconde sont tronquées.
 */
export function isoDate(row: CsvRow, column: Column): Date {
  const raw = cell(row, column)
  const iso = raw
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?) UTC$/, '$1T$2Z')
    .replace(/(\.\d{3})\d+/, '$1')
  const date = new Date(iso)
  if (raw === '' || Number.isNaN(date.getTime())) {
    throw new ImportError(
      `Ligne ${row.line} : « ${raw} » n'est pas une date (colonne ${variants(column)[0]}).`,
    )
  }
  return date
}
