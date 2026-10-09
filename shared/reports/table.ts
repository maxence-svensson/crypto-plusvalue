import type { Dec } from '../tax/decimal'
import { parisTimestamp } from '../time'
import type { Cell, Sheet } from './xlsx'

/**
 * Un tableau de rapport, écrit une fois et exporté en CSV ou en feuille Excel. Les montants
 * restent des décimaux exacts jusqu'à l'export.
 */
export type ReportCell =
  string | null | { euros: Dec } | { quantity: Dec } | { date: Date } | { count: number }

export type ReportTable = {
  /** Nom de la feuille Excel. */
  name: string
  columns: string[]
  rows: ReportCell[][]
  /** Largeur des colonnes dans Excel, en caractères. */
  widths?: number[]
}

/** Décimal au format français, sans notation scientifique : « 0,0015 ». */
const decimal = (value: Dec) => value.toFixed().replace('.', ',')

/**
 * Cellule CSV : entre guillemets si besoin. Un texte qui commence par =, +, - ou @ serait pris
 * pour une formule par un tableur : il est neutralisé par une apostrophe.
 */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function csvText(cell: ReportCell): string {
  if (cell === null) return ''
  if (typeof cell === 'string') return cell
  if ('euros' in cell) return decimal(cell.euros)
  if ('quantity' in cell) return decimal(cell.quantity)
  if ('date' in cell) return parisTimestamp(cell.date)
  return String(cell.count)
}

/**
 * CSV pour un tableur français : point-virgule, virgule décimale, UTF-8 avec marque d'ordre des
 * octets pour qu'Excel lise les accents.
 */
export function toCsv(table: ReportTable): string {
  const lines = [table.columns, ...table.rows.map((row) => row.map(csvText))]
  return '\uFEFF' + lines.map((line) => line.map(csvCell).join(';')).join('\r\n') + '\r\n'
}

function sheetCell(cell: ReportCell): Cell {
  if (cell === null || typeof cell === 'string') return cell
  if ('euros' in cell) return { euros: cell.euros.toNumber() }
  if ('quantity' in cell) return { quantity: cell.quantity.toNumber() }
  if ('date' in cell) return { date: cell.date }
  return cell.count
}

export function toSheet(table: ReportTable): Sheet {
  return {
    name: table.name,
    header: true,
    widths: table.widths,
    rows: [table.columns, ...table.rows.map((row) => row.map(sheetCell))],
  }
}
