/** Réponse de `GET /api/price` : le cours d'un actif en euros à une minute donnée. */
export type PriceQuote = {
  asset: string
  /** Début de la minute (ISO 8601, UTC). */
  minute: string
  /** Cours en euros, en chaîne pour garder toute la précision décimale. */
  priceEur: string
  /** D'où vient le cours, pour que l'utilisateur puisse le justifier. */
  source: string
}

/** Début de la minute UTC qui contient `date` : la granularité des cours historiques. */
export function startOfMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000)
}
