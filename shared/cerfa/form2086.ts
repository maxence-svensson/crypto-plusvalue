import type { Dec } from '../tax/decimal'
import type { DisposalResult, YearSummary } from '../tax/form2086'

/**
 * Remplissage du formulaire officiel 2086 (cerfa n° 16043*07, revenus 2025), tel que publié sur
 * impots.gouv.fr. Le PDF n'a pas de champs de saisie : les montants sont écrits aux coordonnées
 * des cases, relevées sur les traits du formulaire (en points, origine en haut à gauche).
 *
 * Seules les cases calculées sont remplies. L'identité, l'adresse et le déclarant 2 restent à
 * compléter par l'utilisateur.
 */

export const FORM_2086 = {
  year: 2025,
  path: '/cerfa/2086-revenus-2025.pdf',
  pageHeight: 841.92,
  /** Cinq colonnes « Cession » par feuillet ; leur position diffère un peu d'une page à l'autre. */
  columns: {
    0: [
      [154, 227],
      [240, 313],
      [327, 398],
      [411, 484],
      [496, 577],
    ],
    1: [
      [156, 225],
      [237, 308],
      [321, 388],
      [406, 481],
      [496, 565],
    ],
  },
  /** Ligne → page (0 = première) et haut et bas des cases. */
  rows: {
    211: [0, 445, 459],
    212: [0, 465, 494],
    213: [0, 532, 546],
    214: [0, 560, 575],
    215: [0, 589, 611],
    216: [0, 625, 646],
    217: [0, 661, 687],
    218: [0, 702, 736],
    220: [1, 86, 110],
    221: [1, 124, 151],
    222: [1, 165, 192],
    223: [1, 206, 250],
    // Plus ou moins-value de chaque cession : la ligne n'a pas de numéro sur le formulaire.
    gain: [1, 264, 298],
  },
  /** Cases uniques : page et rectangle [gauche, haut, droite, bas]. */
  totals: {
    224: [1, [498, 312, 565, 339]],
    51: [4, [447, 434, 572, 458]],
    52: [4, [447, 539, 572, 582]],
  },
  columnsPerSheet: 5,
} as const

type Row = keyof typeof FORM_2086.rows

/** Un texte à écrire dans une case, aligné à droite. */
export type Placement = {
  /** Feuillet : 0 pour le formulaire, puis un par groupe de 5 cessions supplémentaires. */
  sheet: number
  /** Page du feuillet (0 = première page du formulaire). */
  page: number
  box: readonly [number, number, number, number]
  text: string
}

const ROW_VALUES: [Row, (disposal: DisposalResult) => Dec][] = [
  [212, (d) => d.portfolioValue],
  [213, (d) => d.price],
  [214, (d) => d.fees],
  [215, (d) => d.priceNetOfFees],
  [216, (d) => d.balancingPayment],
  [217, (d) => d.priceNetOfBalancing],
  [218, (d) => d.netPrice],
  [220, (d) => d.totalAcquisitionCost],
  [221, (d) => d.initialCapitalFractions],
  [222, (d) => d.receivedBalancingPayments],
  [223, (d) => d.netAcquisitionCost],
]

/** Lignes à laisser vides quand les cessions de l'année sont exonérées (notice, ligne 51). */
const ONLY_IF_TAXABLE = new Set<Row>([212, 220, 221, 222, 223, 'gain'])

/**
 * Ce qu'il faut écrire, et où. Les montants sont en euros entiers, comme sur la déclaration ; les
 * plus ou moins-values sont précédées de leur signe, comme le demande le formulaire.
 */
export function form2086Placements(summary: YearSummary): Placement[] {
  if (summary.year !== FORM_2086.year) {
    throw new Error(`Ce formulaire concerne les revenus ${FORM_2086.year}, pas ${summary.year}.`)
  }

  const placements: Placement[] = []
  const cell = (sheet: number, column: number, row: Row, text: string) => {
    const [page, top, bottom] = FORM_2086.rows[row]
    const [left, right] = FORM_2086.columns[page as 0 | 1][column] ?? [0, 0]
    placements.push({ sheet, page, box: [left, top, right, bottom], text })
  }

  summary.disposals.forEach((disposal, index) => {
    const sheet = Math.floor(index / FORM_2086.columnsPerSheet)
    const column = index % FORM_2086.columnsPerSheet
    const taxable = (row: Row) => !summary.exempt || !ONLY_IF_TAXABLE.has(row)

    cell(sheet, column, 211, formatDate(disposal.date))
    for (const [row, value] of ROW_VALUES) {
      if (taxable(row)) cell(sheet, column, row, formatAmount(value(disposal)))
    }
    if (taxable('gain')) cell(sheet, column, 'gain', formatAmount(disposal.gain, true))
  })

  const total = (line: keyof typeof FORM_2086.totals, text: string) => {
    const [page, box] = FORM_2086.totals[line]
    placements.push({ sheet: 0, page, box, text })
  }
  total(51, formatAmount(summary.totalPrice))
  if (!summary.exempt) {
    total(224, formatAmount(summary.netGain, true))
    total(52, formatAmount(summary.netGain, true))
  }

  return placements
}

/** « 1 487 » ou « -6 » : euros entiers, espace ordinaire entre les milliers. */
export function formatAmount(value: Dec, signed = false): string {
  const rounded = value.toDecimalPlaces(0)
  const digits = rounded
    .abs()
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  if (rounded.isZero()) return '0'
  if (rounded.lt(0)) return `-${digits}`
  return signed ? `+${digits}` : digits
}

/** « 14/08/2025 », à l'heure de Paris comme l'année d'imposition. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/** Le formulaire officiel existe-t-il pour cette année ? */
export function hasForm2086(year: number): boolean {
  return year === FORM_2086.year
}
