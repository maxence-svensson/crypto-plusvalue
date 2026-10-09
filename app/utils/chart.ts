/**
 * Graduations d'axe « rondes » (0, 500, 1 000…) couvrant [min, max], zéro toujours compris :
 * les colonnes partent toutes de la même ligne de base.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const low = Math.min(0, min)
  const high = Math.max(0, max)
  if (low === high) return [0]
  const raw = (high - low) / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= raw)!
  const ticks: number[] = []
  for (let tick = Math.floor(low / step) * step; tick <= high + step * 1e-9; tick += step) {
    ticks.push(Math.round(tick / step) * step)
  }
  if (ticks.at(-1)! < high) ticks.push(ticks.at(-1)! + step)
  return ticks
}

const compact = new Intl.NumberFormat('fr-FR', {
  notation: 'compact',
  maximumFractionDigits: 1,
  style: 'currency',
  currency: 'EUR',
})

/** « 1,5 k€ », « 12 k€ », « 250 € » : les graduations d'un axe en euros. */
export function formatCompactEuros(value: number): string {
  return compact.format(value)
}
