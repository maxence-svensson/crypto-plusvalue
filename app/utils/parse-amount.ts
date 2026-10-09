import { Dec } from '#shared/tax/decimal'

/**
 * Montant saisi à la française ou à l'anglaise (« 1 234,56 », « 1234.56 », « 5 000 € »).
 * Vide, invalide ou négatif : rien.
 */
export function parseAmount(text: string): Dec | undefined {
  const cleaned = text.replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.')
  if (cleaned === '') return undefined
  try {
    const value = new Dec(cleaned)
    return value.isNegative() ? undefined : value
  } catch {
    return undefined
  }
}
