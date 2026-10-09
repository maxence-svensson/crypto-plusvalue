import type { Dec } from '../tax/decimal'

/**
 * Mise en forme française pour le PDF, sans Intl pour les nombres : les polices standard du PDF
 * ne connaissent ni l'espace fine insécable ni le signe moins typographique que produit Intl.
 */

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

function decimal(value: Dec, places?: number): string {
  const fixed = places === undefined ? value.abs().toFixed() : value.abs().toFixed(places)
  const [whole = '0', fraction] = fixed.split('.')
  return fraction ? `${group(whole)},${fraction}` : group(whole)
}

/** « 1 487,22 € », « -5,52 € », ou « +336,87 € » avec `signed`. */
export function euros(value: Dec, signed = false): string {
  const rounded = value.toDecimalPlaces(2)
  const sign = rounded.lt(0) ? '-' : signed && rounded.gt(0) ? '+' : ''
  return `${sign}${decimal(rounded, 2)} €`
}

/** « 1 331 € » : les cases de la déclaration se remplissent en euros entiers. */
export function wholeEuros(value: number): string {
  return `${group(String(Math.round(value)))} €`
}

/** Montant sans symbole, pour les formules : « 2 102,00 ». */
export function amount(value: Dec): string {
  const rounded = value.toDecimalPlaces(2)
  return `${rounded.lt(0) ? '-' : ''}${decimal(rounded, 2)}`
}

/** Quantité exacte, sans arrondi : « 0,387323 ». */
export function quantity(value: Dec): string {
  return `${value.lt(0) ? '-' : ''}${decimal(value)}`
}

/** Cours unitaire : au centime au-delà d'un euro, à six décimales en dessous. */
export function unitPrice(value: Dec): string {
  const places = value.gte(1) ? 2 : 6
  return `${decimal(value.toDecimalPlaces(places), places)} €`
}

const paris = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function parisParts(date: Date) {
  const parts = Object.fromEntries(paris.formatToParts(date).map((part) => [part.type, part.value]))
  return parts as Record<'day' | 'month' | 'year' | 'hour' | 'minute', string>
}

/** « 14/08/2025 », heure de Paris. */
export function day(date: Date): string {
  const { day, month, year } = parisParts(date)
  return `${day}/${month}/${year}`
}

/** « 14/08/2025 15:05 », heure de Paris. */
export function dateTime(date: Date): string {
  const { hour, minute } = parisParts(date)
  return `${day(date)} ${hour}:${minute}`
}
