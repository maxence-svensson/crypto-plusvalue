import { Dec } from '../tax/decimal'

/**
 * Conversion des données de l'application en objets simples, enregistrables dans IndexedDB ou
 * dans un fichier, et retour. Les décimaux deviennent `{ $dec: "0.0045" }` (aucune perte de
 * précision), les dates `{ $date: "2025-03-03T08:20:02.000Z" }`.
 */

export type Plain = null | boolean | number | string | Plain[] | { [key: string]: Plain }

export function toPlain(value: unknown): Plain {
  if (value === null || value === undefined) return null
  if (Dec.isDecimal(value)) return { $dec: (value as Dec).toString() }
  if (value instanceof Date) return { $date: value.toISOString() }
  if (Array.isArray(value)) return value.map(toPlain)
  if (typeof value === 'object') {
    const result: Record<string, Plain> = {}
    for (const [key, item] of Object.entries(value)) {
      // Les champs absents restent absents, plutôt que de devenir `null`.
      if (item !== undefined) result[key] = toPlain(item)
    }
    return result
  }
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value
  }
  throw new TypeError(`Valeur impossible à enregistrer : ${typeof value}`)
}

export function fromPlain<T>(value: Plain): T {
  return revive(value) as T
}

function revive(value: Plain): unknown {
  if (Array.isArray(value)) return value.map(revive)
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 1 && typeof value.$dec === 'string') return new Dec(value.$dec)
    if (keys.length === 1 && typeof value.$date === 'string') {
      const date = new Date(value.$date)
      if (Number.isNaN(date.getTime())) throw new TypeError(`Date illisible : ${value.$date}`)
      return date
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item)]))
  }
  return value
}
