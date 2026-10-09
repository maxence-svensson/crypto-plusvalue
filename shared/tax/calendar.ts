/**
 * Calendrier de la déclaration des revenus, par année de revenus. À compléter chaque printemps,
 * quand la DGFiP publie les dates ; sources dans docs/regles-fiscales.md.
 */

export type Campaign = {
  /** Année des revenus déclarés. */
  year: number
  /** Dernier jour pour la déclaration papier. */
  paperDeadline: Date
  /** Dernier jour pour la déclaration en ligne, selon le département du domicile au 1er janvier. */
  onlineDeadlines: { departments: string; deadline: Date }[]
  /** Dernier jour du service de correction en ligne, ouvert après l'avis d'impôt. */
  correctionUntil: Date
  /** Page officielle du calendrier. */
  source: string
}

export const CAMPAIGNS: readonly Campaign[] = [
  {
    year: 2025,
    paperDeadline: new Date('2026-05-19T23:59:59+02:00'),
    onlineDeadlines: [
      { departments: '01 à 19 et non-résidents', deadline: new Date('2026-05-21T23:59:59+02:00') },
      { departments: '20 à 54', deadline: new Date('2026-05-28T23:59:59+02:00') },
      { departments: '55 à 974 et 976', deadline: new Date('2026-06-04T23:59:59+02:00') },
    ],
    correctionUntil: new Date('2026-11-30T23:59:59+01:00'),
    source: 'https://www.impots.gouv.fr/les-modalites-de-la-declaration-de-revenus-en-2026',
  },
]

/**
 * Fin du délai de réclamation : le 31 décembre de la deuxième année qui suit la mise en
 * recouvrement, soit fin 2028 pour les revenus 2025.
 */
export function claimDeadline(year: number): Date {
  return new Date(`${year + 3}-12-31T23:59:59+01:00`)
}

export type DeclarationStatus =
  /** Les dates limites ne sont pas encore passées. */
  | { kind: 'open'; campaign: Campaign }
  /** Dates limites passées, correction en ligne encore possible. */
  | { kind: 'correction'; campaign: Campaign }
  /** Correction en ligne fermée : il reste la réclamation. */
  | { kind: 'claim'; until: Date }
  /** Délai de réclamation écoulé. */
  | { kind: 'closed'; until: Date }
  /** Revenus à déclarer l'an prochain, calendrier pas encore publié. */
  | { kind: 'unpublished'; declarationYear: number }

/** Où en est la déclaration des revenus d'une année, à une date donnée. */
export function declarationStatus(year: number, now: Date): DeclarationStatus {
  const campaign = CAMPAIGNS.find((candidate) => candidate.year === year)
  if (campaign) {
    const last = Math.max(...campaign.onlineDeadlines.map(({ deadline }) => deadline.getTime()))
    if (now.getTime() <= last) return { kind: 'open', campaign }
    if (now <= campaign.correctionUntil) return { kind: 'correction', campaign }
  } else if (now < new Date(`${year + 1}-07-01T00:00:00+02:00`)) {
    return { kind: 'unpublished', declarationYear: year + 1 }
  }
  const until = claimDeadline(year)
  return now <= until ? { kind: 'claim', until } : { kind: 'closed', until }
}
