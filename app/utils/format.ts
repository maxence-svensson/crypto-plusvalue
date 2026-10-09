import type { Dec } from '#shared/tax/decimal'

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const wholeEuros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const signedEuros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  signDisplay: 'exceptZero',
})
const quantities = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 8 })
const dateTimes = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})
const days = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeZone: 'Europe/Paris' })
const longDays = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

/** 1 845,90 € */
export function formatEuros(value: Dec | number): string {
  return euros.format(typeof value === 'number' ? value : value.toNumber())
}

/** 331 € : les cases de la déclaration se remplissent en euros entiers. */
export function formatWholeEuros(value: number): string {
  return wholeEuros.format(value)
}

/** +336,79 € ou −5,52 € : le signe accompagne toujours la couleur. */
export function formatSignedEuros(value: Dec): string {
  return signedEuros.format(value.toNumber())
}

/** 0,00683 : jusqu'à 8 décimales. */
export function formatQuantity(value: Dec): string {
  return quantities.format(value.toNumber())
}

/** 14/08/2025 15:05, heure de Paris. */
export function formatDateTime(date: Date): string {
  return dateTimes.format(date)
}

/** 14/08/2025, heure de Paris. */
export function formatDay(date: Date): string {
  return days.format(date)
}

/** 21 mai 2026, heure de Paris. */
export function formatLongDay(date: Date): string {
  return longDays.format(date)
}
