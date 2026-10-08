import Decimal from 'decimal.js'

/**
 * Tous les montants sont en décimal exact (decimal.js) : en flottant, 0.1 + 0.2 !== 0.3.
 * Une instance dédiée évite de modifier la configuration globale de decimal.js.
 */
export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })
export type Dec = Decimal

export const ZERO = new Dec(0)
