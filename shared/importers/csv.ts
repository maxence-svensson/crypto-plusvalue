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
  /** Lignes illisibles (date, montant, symbole, devise) : écartées, les autres sont importées. */
  anomalies: { line: number; message: string }[]
}

export function emptyResult(): ImportResult {
  return { transactions: [], skipped: 0, unsupported: [], anomalies: [] }
}

export type CsvRow = {
  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1), pour retrouver une erreur. */
  line: number
  cells: Record<string, string>
  /** Ligne mal formée (guillemets, nombre de colonnes) : elle sera signalée et écartée. */
  error?: string
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

  const errors = new Map(
    parsed.errors.flatMap((error) => (error.row === undefined ? [] : [[error.row, error.message]])),
  )
  // Un fichier dont la majorité des lignes est mal formée n'est pas du bon format.
  const first = parsed.errors[0]
  if (first && (first.row === undefined || errors.size > parsed.data.length / 2)) {
    throw new ImportError(
      `Ligne ${(first.row ?? 0) + headerLine + 1} illisible : ${first.message}.`,
    )
  }

  return parsed.data.map((cells, index) => {
    const error = errors.get(index)
    return {
      line: index + headerLine + 1,
      cells,
      ...(error ? { error: `ligne mal formée (${error})` } : {}),
    }
  })
}

/**
 * Traite chaque ligne. Une ligne illisible est signalée dans `anomalies` et écartée ; les autres
 * sont importées, pour que l'utilisateur voie tout de suite ce qui est à corriger.
 */
export function eachRow(rows: CsvRow[], result: ImportResult, handle: (row: CsvRow) => void) {
  for (const row of rows) {
    if (row.error) {
      result.anomalies.push({ line: row.line, message: row.error })
      continue
    }
    try {
      handle(row)
    } catch (error) {
      if (!(error instanceof ImportError)) throw error
      result.anomalies.push({
        line: row.line,
        message: error.message.replace(/^Ligne \d+ : /, ''),
      })
    }
  }
}

/** Symbole d'une crypto en majuscules (BTC, RENDER, 1INCH) ; tout autre texte est refusé. */
export function cryptoSymbol(row: CsvRow, raw: string): string {
  const symbol = raw.trim().toUpperCase()
  if (!/^[A-Z0-9]{1,15}$/.test(symbol)) {
    throw new ImportError(`Ligne ${row.line} : « ${raw} » n'est pas un symbole de crypto valide.`)
  }
  return symbol
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

/** Nombre signé (« -0.0045 », « 1E-8 ») ; une cellule vide vaut 0. */
export function signedAmount(row: CsvRow, column: Column): Dec {
  const raw = cell(row, column)
  if (raw === '') return new Dec(0)
  try {
    return new Dec(raw)
  } catch {
    throw new ImportError(
      `Ligne ${row.line} : « ${raw} » n'est pas un nombre (colonne ${variants(column)[0]}).`,
    )
  }
}

/** Date au format `2025-03-03 08:20:02`, en UTC ; fractions de seconde tronquées à la milliseconde. */
export function utcDate(row: CsvRow, column: Column): Date {
  const raw = cell(row, column)
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d{1,3})?\d*$/.exec(raw)
  const date = match ? new Date(`${match[1]}T${match[2]}${match[3] ?? ''}Z`) : undefined
  if (!date || Number.isNaN(date.getTime())) {
    throw new ImportError(
      `Ligne ${row.line} : « ${raw} » n'est pas une date (colonne ${variants(column)[0]}).`,
    )
  }
  return date
}

/**
 * Date et heure locales d'un fuseau horaire (`Europe/Amsterdam`), converties en instant. Le
 * décalage est celui du fuseau à cette date : heure d'été comprise.
 */
export function zonedDate(row: CsvRow, date: string, time: string, timeZone: string): Date {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const clock = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3})\d*)?$/.exec(time)
  if (!day || !clock) {
    throw new ImportError(`Ligne ${row.line} : « ${date} ${time} » n'est pas une date.`)
  }
  const local = Date.UTC(
    Number(day[1]),
    Number(day[2]) - 1,
    Number(day[3]),
    Number(clock[1]),
    Number(clock[2]),
    Number(clock[3]),
    Number((clock[4] ?? '0').padEnd(3, '0')),
  )
  let format: Intl.DateTimeFormat
  try {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    throw new ImportError(`Ligne ${row.line} : fuseau horaire « ${timeZone} » inconnu.`)
  }
  // Décalage du fuseau à un instant : heure affichée dans le fuseau moins l'heure UTC.
  const offset = (instant: number) => {
    const parts = Object.fromEntries(
      format.formatToParts(new Date(instant)).map((part) => [part.type, Number(part.value)]),
    )
    const shown = Date.UTC(
      parts.year ?? 0,
      (parts.month ?? 1) - 1,
      parts.day ?? 1,
      parts.hour ?? 0,
      parts.minute ?? 0,
      parts.second ?? 0,
    )
    return shown - Math.floor(instant / 1000) * 1000
  }
  // Deux passes : le décalage peut changer entre l'heure locale et l'instant cherché.
  const first = local - offset(local)
  return new Date(local - offset(first))
}
