import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib'

import { PLATFORM_NAMES } from '../importers/detect'
import { TRANSACTION_LABELS, type Transaction } from '../portfolio/transaction'
import { EXEMPTION_THRESHOLD } from '../tax/form2086'
import type { Dossier, DossierDisposal } from './dossier'
import { amount, dateTime, day, euros, quantity, unitPrice, wholeEuros } from './format'

/**
 * Met en page le dossier justificatif en PDF, dans le navigateur : rien n'est envoyé à un
 * serveur. Polices standard du PDF (Helvetica), A4, une table par sujet.
 */

const PAGE: [number, number] = [595.28, 841.89]
const MARGIN = 50
const FOOTER = 28
const CONTENT = PAGE[0] - 2 * MARGIN

const INK = rgb(0.114, 0.114, 0.122)
const MUTED = rgb(0.431, 0.431, 0.451)
const RULE = rgb(0.86, 0.86, 0.88)
const FIELD = rgb(0.957, 0.957, 0.961)
const HIGHLIGHT = rgb(1, 0.878, 0.4)

/**
 * Chasse du signe €, en millièmes de corps : Aperçu (macOS) le dessine plus large que la valeur
 * standard de 556 et il mordait sur le caractère suivant.
 */
const EURO_ADVANCE = 720

/** Caractères WinAnsi de 32 à 255 (encodage des polices standard du PDF). */
const WIN_ANSI = [
  ...Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index)),
  '',
  ...'€\u0000‚ƒ„…†‡ˆ‰Š‹Œ\u0000Ž\u0000\u0000‘’“”•–—˜™š›œ\u0000žŸ',
  ...Array.from({ length: 96 }, (_, index) => String.fromCharCode(160 + index)),
]

type Column = { header: string; width: number; align?: 'left' | 'right' }
type TextStyle = { size?: number; bold?: boolean; color?: RGB; indent?: number }
type RowStyle = { size: number; bold?: boolean; color?: RGB }

class Writer {
  private page: PDFPage
  private y = 0
  private readonly charset: Set<number>

  constructor(
    private readonly pdf: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.charset = new Set(regular.getCharacterSet())
    this.page = this.newPage()
  }

  private newPage(): PDFPage {
    this.page = this.pdf.addPage(PAGE)
    this.y = PAGE[1] - MARGIN
    return this.page
  }

  /** Passe à la page suivante s'il reste moins de `height` points. */
  ensure(height: number) {
    if (this.y - height < MARGIN + FOOTER) this.newPage()
  }

  space(height: number) {
    this.y -= height
  }

  /** Largeur d'un texte, avec la chasse élargie du signe €. */
  private measure(text: string, font: PDFFont, size: number): number {
    const parts = text.split('€')
    const width = parts.reduce((sum, part) => sum + font.widthOfTextAtSize(part, size), 0)
    return width + ((parts.length - 1) * EURO_ADVANCE * size) / 1000
  }

  /** Remplace ce que les polices standard du PDF ne savent pas écrire (espaces fines, etc.). */
  private clean(text: string): string {
    const normalized = text.replace(/[\u00a0\u2009\u202f]/g, ' ').replace(/\u2212/g, '-')
    return [...normalized]
      .map((char) => (this.charset.has(char.codePointAt(0) ?? 0) ? char : '?'))
      .join('')
  }

  private wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const fits = (candidate: string) => this.measure(candidate, font, size) <= width
    const lines: string[] = []
    for (const paragraph of this.clean(text).split('\n')) {
      let line = ''
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word
        if (fits(candidate)) {
          line = candidate
          continue
        }
        if (line) lines.push(line)
        // Un mot plus long que la ligne (nom de fichier) est coupé au caractère.
        let rest = word
        while (!fits(rest) && rest.length > 1) {
          let cut = rest.length - 1
          while (cut > 1 && !fits(rest.slice(0, cut))) cut--
          lines.push(rest.slice(0, cut))
          rest = rest.slice(cut)
        }
        line = rest
      }
      lines.push(line)
    }
    return lines
  }

  text(content: string, style: TextStyle = {}) {
    const size = style.size ?? 9.5
    const font = style.bold ? this.bold : this.regular
    const indent = style.indent ?? 0
    const lineHeight = size * 1.4
    for (const line of this.wrap(content, font, size, CONTENT - indent)) {
      this.ensure(lineHeight)
      this.y -= lineHeight
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y + size * 0.3,
        size,
        font,
        color: style.color ?? INK,
      })
    }
  }

  heading(content: string, level: 1 | 2 = 1) {
    const size = level === 1 ? 15 : 11
    this.space(level === 1 ? 22 : 14)
    // Un titre ne reste jamais seul en bas de page.
    this.ensure(size * 1.4 + 60)
    this.text(content, { size, bold: true })
    if (level === 1) {
      this.space(5)
      this.rule(INK)
    }
    this.space(6)
  }

  rule(color = RULE) {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT, y: this.y },
      thickness: color === INK ? 0.8 : 0.5,
      color,
    })
  }

  /** Encadré gris avec un montant à recopier, surligné en jaune comme à l'écran. */
  callout(label: string, value: string, note: string) {
    const height = 64
    this.ensure(height + 10)
    const top = this.y
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: CONTENT,
      height,
      color: FIELD,
    })
    this.page.drawText(this.clean(label), {
      x: MARGIN + 16,
      y: top - 24,
      size: 10,
      font: this.bold,
      color: INK,
    })
    this.page.drawText(this.clean(note), {
      x: MARGIN + 16,
      y: top - 42,
      size: 8.5,
      font: this.regular,
      color: MUTED,
    })
    const size = 22
    const text = this.clean(value)
    const width = this.measure(text, this.bold, size)
    const x = MARGIN + CONTENT - 16 - width
    this.page.drawRectangle({
      x: x - 6,
      y: top - height / 2 - size * 0.55,
      width: width + 12,
      height: size * 1.25,
      color: HIGHLIGHT,
    })
    this.page.drawText(text, {
      x,
      y: top - height / 2 - size * 0.3,
      size,
      font: this.bold,
      color: INK,
    })
    this.y = top - height
  }

  private row(columns: Column[], cells: string[], style: RowStyle) {
    const font = style.bold ? this.bold : this.regular
    const lineHeight = style.size * 1.35
    const wrapped = cells.map((cell, index) =>
      this.wrap(cell, font, style.size, (columns[index]?.width ?? 0) - 6),
    )
    const height = Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + 7
    let x = MARGIN
    wrapped.forEach((lines, index) => {
      const column = columns[index]
      if (!column) return
      lines.forEach((line, number) => {
        const width = this.measure(line, font, style.size)
        this.page.drawText(line, {
          x: column.align === 'right' ? x + column.width - 3 - width : x + 3,
          y: this.y - 3.5 - (number + 1) * lineHeight + style.size * 0.3,
          size: style.size,
          font,
          color: style.color ?? INK,
        })
      })
      x += column.width
    })
    return height
  }

  private rowHeight(columns: Column[], cells: string[], style: RowStyle) {
    const font = style.bold ? this.bold : this.regular
    const lines = cells.map(
      (cell, index) => this.wrap(cell, font, style.size, (columns[index]?.width ?? 0) - 6).length,
    )
    return Math.max(...lines) * style.size * 1.35 + 7
  }

  /**
   * Tableau : largeurs relatives, ramenées à la largeur de la page. L'en-tête se répète en haut
   * de chaque page ; `total` ajoute une dernière ligne en gras.
   */
  table(
    spec: Column[],
    rows: string[][],
    options: { size?: number; total?: string[]; header?: boolean } = {},
  ) {
    const scale = CONTENT / spec.reduce((sum, column) => sum + column.width, 0)
    const columns = spec.map((column) => ({ ...column, width: column.width * scale }))
    const size = options.size ?? 8.5
    const headerStyle: RowStyle = { size, bold: true, color: MUTED }
    const header = () => {
      if (options.header === false) return
      const headers = columns.map((column) => column.header)
      this.ensure(this.rowHeight(columns, headers, headerStyle) + size * 3)
      this.y -= this.row(columns, headers, headerStyle)
      this.rule(INK)
    }

    header()
    for (const cells of rows) {
      const height = this.rowHeight(columns, cells, { size })
      if (this.y - height < MARGIN + FOOTER) {
        this.newPage()
        header()
      }
      this.y -= this.row(columns, cells, { size })
      this.rule()
    }
    if (options.total) {
      const style = { size, bold: true }
      this.ensure(this.rowHeight(columns, options.total, style))
      this.y -= this.row(columns, options.total, style)
    }
  }

  /** Numéro de page et titre en pied de chaque page, une fois toutes les pages connues. */
  footers(title: string) {
    const pages = this.pdf.getPages()
    pages.forEach((page, index) => {
      const size = 7.5
      const number = `Page ${index + 1} sur ${pages.length}`
      page.drawText(this.clean(title), {
        x: MARGIN,
        y: MARGIN - 14,
        size,
        font: this.regular,
        color: MUTED,
      })
      page.drawText(number, {
        x: MARGIN + CONTENT - this.measure(number, this.regular, size),
        y: MARGIN - 14,
        size,
        font: this.regular,
        color: MUTED,
      })
    })
  }
}

const platform = (transaction: Transaction) =>
  transaction.source === 'manual' ? 'Saisie' : PLATFORM_NAMES[transaction.source]

/** « -0,387323 ETH » pour ce qui sort, « +20 SOL » pour ce qui entre. */
function movement(transaction: Transaction): string {
  const parts: string[] = []
  if ('sent' in transaction) {
    parts.push(`-${quantity(transaction.sent.quantity)} ${transaction.sent.asset}`)
  }
  if ('received' in transaction) {
    parts.push(`+${quantity(transaction.received.quantity)} ${transaction.received.asset}`)
  }
  return parts.join(', ')
}

function amountOf(transaction: Transaction): string {
  if ('amountEur' in transaction) return euros(transaction.amountEur)
  if (transaction.type === 'reward' && transaction.valueEur) return euros(transaction.valueEur)
  return ''
}

function feeOf(transaction: Transaction): string {
  if ('feeEur' in transaction) return euros(transaction.feeEur)
  if (transaction.type === 'transfer-out' && transaction.fee) {
    return `${quantity(transaction.fee.quantity)} ${transaction.fee.asset}`
  }
  return ''
}

function cover(writer: Writer, dossier: Dossier) {
  const { summary, year } = dossier
  writer.text('Dossier justificatif', { size: 24, bold: true })
  writer.text(`Plus-values sur actifs numériques, revenus ${year}`, { size: 13, color: MUTED })
  writer.space(10)
  writer.text(
    `Établi le ${dateTime(dossier.generatedAt)} avec CryptoPlusValue, à partir des fichiers listés ` +
      'ci-dessous. Ce dossier détaille le calcul du formulaire 2086 : chaque montant peut être ' +
      'refait à la main, et il se conserve avec la déclaration en cas de contrôle.',
  )
  writer.space(14)

  if (summary.exempt) {
    writer.callout(
      'Cases 3AN et 3BN de la déclaration 2042 C',
      '0 €',
      `Cessions de ${year} exonérées : leur total ne dépasse pas ${EXEMPTION_THRESHOLD} €.`,
    )
  } else if (summary.box3BN > 0) {
    writer.callout(
      'Case 3BN de la déclaration 2042 C',
      wholeEuros(summary.box3BN),
      'Moins-value nette de l’année, en euros entiers. Elle n’est pas reportable.',
    )
  } else {
    writer.callout(
      'Case 3AN de la déclaration 2042 C',
      wholeEuros(summary.box3AN),
      'Plus-value nette de l’année, en euros entiers.',
    )
  }
  writer.space(8)
  writer.table(
    [
      { header: '', width: 3 },
      { header: '', width: 1, align: 'right' },
    ],
    [
      ['Ligne 224 du 2086 : plus ou moins-value nette', euros(summary.netGain, true)],
      ['Ligne 51 du 2086 : total des prix de cession', euros(summary.totalPrice)],
      ['Cessions imposables dans l’année', String(summary.disposals.length)],
      [
        `Seuil d’exonération de ${EXEMPTION_THRESHOLD} €`,
        summary.exempt ? 'non dépassé' : 'dépassé',
      ],
    ],
    { size: 9.5, header: false },
  )

  if (dossier.files.length > 0) {
    writer.heading('Fichiers importés')
    writer.table(
      [
        { header: 'Fichier', width: 3 },
        { header: 'Plateforme', width: 1.3 },
        { header: 'Opérations crypto lues', width: 1.3, align: 'right' },
        { header: 'Lignes ignorées', width: 1.1, align: 'right' },
      ],
      dossier.files.map((file) => [
        file.name,
        file.platform,
        String(file.transactions),
        String(file.skipped),
      ]),
    )
    writer.space(4)
    writer.text(
      'Les lignes ignorées sont les opérations sans rapport avec les cryptos : espèces, actions, ' +
        'fonds.',
      { size: 8.5, color: MUTED },
    )
  }
}

function method(writer: Writer, dossier: Dossier, rulesUrl: string) {
  const { options } = dossier
  const bullet = (text: string) => {
    writer.space(3)
    writer.text(`- ${text}`, { indent: 4 })
  }
  writer.heading('Méthode')
  writer.text(
    'Calcul de l’article 150 VH bis du code général des impôts, ligne par ligne comme sur le ' +
      'formulaire 2086 (BOFiP BOI-RPPM-PVBMC-30-20). Pour chaque cession :',
  )
  writer.space(4)
  writer.text('plus ou moins-value = 218 – 223 × 217 / 212', { bold: true, indent: 16 })
  writer.space(2)
  bullet(
    'Valeur globale du portefeuille (ligne 212) : tous les actifs numériques du foyer juste ' +
      'avant la cession, les actifs cédés pour leur prix de cession, les autres au cours de la ' +
      'minute de la cession. Ce cours est le prix moyen pondéré par les volumes sur Binance (en ' +
      'euros, ou en USDT converti en euros) ou sur Coinbase Exchange ; la source de chaque cours ' +
      'est indiquée.',
  )
  bullet(
    'Prix total d’acquisition (ligne 220) : la somme des prix payés depuis l’origine du ' +
      `portefeuille, ${options.includeAcquisitionFees ? 'frais d’achat compris' : 'hors frais d’achat'}.` +
      (options.rewardCost === 'zero'
        ? ' Les récompenses (staking, bonus) entrent avec un prix d’acquisition nul, faute de ' +
          'doctrine fixant leur valeur.'
        : ' Les récompenses (staking, bonus) entrent pour leur valeur à la réception.'),
  )
  bullet(
    'Fractions de capital initial (ligne 221) : la part du prix d’acquisition déjà consommée ' +
      'par les cessions antérieures, années précédentes comprises.',
  )
  bullet(
    'Les échanges entre cryptos sans soulte sont en sursis d’imposition : ce ne sont pas des ' +
      'cessions.',
  )
  bullet(
    `Les cessions de l’année sont exonérées si leur total (ligne 51) ne dépasse pas ` +
      `${EXEMPTION_THRESHOLD} €.`,
  )
  bullet(
    'Heures de Paris. Aucun arrondi en cours de calcul : les montants sont affichés au centime, ' +
      'et la déclaration se remplit en euros entiers.',
  )
  writer.space(8)
  writer.text(
    'CryptoPlusValue est un outil indépendant, sans lien avec l’administration fiscale. Ses ' +
      `résultats sont indicatifs : vérifiez-les avant de déclarer. Règles et sources : ${rulesUrl}`,
    { size: 8.5, color: MUTED },
  )
}

function disposal(writer: Writer, item: DossierDisposal) {
  const { transaction, result } = item
  writer.heading(`Cession ${item.number} : ${dateTime(transaction.date)}`, 2)
  writer.text(
    `${TRANSACTION_LABELS[transaction.type]} de ${quantity(transaction.sent.quantity)} ` +
      `${transaction.sent.asset} sur ${platform(transaction)}, pour ${euros(transaction.amountEur)} ` +
      `(frais : ${euros(transaction.feeEur)}). Libellé d’origine : « ${transaction.label} ».`,
  )
  writer.space(8)
  writer.text('Valeur globale du portefeuille juste avant la cession', { bold: true, size: 9 })
  writer.space(2)
  writer.table(
    [
      { header: 'Actif', width: 0.9 },
      { header: 'Quantité', width: 1.5, align: 'right' },
      { header: 'Évalué au', width: 1.3 },
      { header: 'Cours unitaire', width: 1.3, align: 'right' },
      { header: 'Source', width: 1.6 },
      { header: 'Valeur', width: 1.2, align: 'right' },
    ],
    item.valuation.map((line) => [
      line.asset,
      quantity(line.quantity),
      line.basis === 'sale' ? 'prix de cession' : 'cours du marché',
      line.unitPrice ? unitPrice(line.unitPrice) : '',
      line.basis === 'sale' ? 'cette cession' : (line.source ?? ''),
      euros(line.value),
    ]),
    { total: ['Ligne 212', '', '', '', '', euros(result.portfolioValue)] },
  )

  writer.space(10)
  writer.text('Lignes du formulaire 2086', { bold: true, size: 9 })
  writer.space(2)
  const lines: [string, string, string][] = [
    ['211', 'Date de la cession', day(result.date)],
    ['212', 'Valeur globale du portefeuille', euros(result.portfolioValue)],
    ['213', 'Prix de cession', euros(result.price)],
    ['214', 'Frais de cession', euros(result.fees)],
    ['215', 'Prix de cession net des frais', euros(result.priceNetOfFees)],
    ['216', 'Soulte reçue ou versée', euros(result.balancingPayment)],
    ['217', 'Prix de cession net des soultes', euros(result.priceNetOfBalancing)],
    ['218', 'Prix de cession net des frais et soultes', euros(result.netPrice)],
    ['220', 'Prix total d’acquisition', euros(result.totalAcquisitionCost)],
    ['221', 'Fractions de capital initial', euros(result.initialCapitalFractions)],
    ['222', 'Soultes reçues lors d’échanges antérieurs', euros(result.receivedBalancingPayments)],
    ['223', 'Prix total d’acquisition net', euros(result.netAcquisitionCost)],
  ]
  writer.table(
    [
      { header: 'Ligne', width: 0.6 },
      { header: 'Libellé', width: 3.6 },
      { header: 'Montant', width: 1.4, align: 'right' },
    ],
    lines,
  )

  writer.space(10)
  writer.text('Calcul', { bold: true, size: 9 })
  writer.space(2)
  writer.text('plus ou moins-value = 218 – 223 × 217 / 212', { indent: 16 })
  writer.text(
    `= ${amount(result.netPrice)} – ${amount(result.netAcquisitionCost)} × ` +
      `${amount(result.priceNetOfBalancing)} / ${amount(result.portfolioValue)}`,
    { indent: 16 },
  )
  writer.text(
    `= ${amount(result.netPrice)} – ${amount(item.capitalFraction)} = ${euros(result.gain, true)}`,
    { indent: 16, bold: true },
  )
}

function disposals(writer: Writer, dossier: Dossier) {
  writer.heading(`Cessions de ${dossier.year}`)
  if (dossier.disposals.length === 0) {
    writer.text(`Aucune cession imposable en ${dossier.year}.`)
    return
  }
  writer.text(
    'Une section par colonne « Cession » du formulaire 2086, dans le même ordre. Les cours sont ' +
      'arrondis à l’affichage ; le calcul utilise leur valeur exacte.',
    { color: MUTED, size: 8.5 },
  )
  for (const item of dossier.disposals) disposal(writer, item)
}

function acquisitions(writer: Writer, dossier: Dossier) {
  writer.heading('Prix total d’acquisition (ligne 220)')
  writer.text(
    dossier.disposals.length > 0
      ? 'Les acquisitions ci-dessous composent le prix total d’acquisition. Pour chaque cession, ' +
          'la ligne 220 est le cumul à sa date.'
      : `Acquisitions jusqu’à la fin de ${dossier.year}.`,
  )
  writer.space(4)
  if (dossier.acquisitions.length === 0) {
    writer.text('Aucune acquisition payée.')
  } else {
    writer.table(
      [
        { header: 'Date', width: 1.25 },
        { header: 'Plateforme', width: 1.15 },
        { header: 'Opération', width: 0.95 },
        { header: 'Reçu', width: 1.55, align: 'right' },
        { header: 'Montant', width: 1.05, align: 'right' },
        { header: 'Frais', width: 0.85, align: 'right' },
        { header: 'Prix retenu', width: 1.05, align: 'right' },
        { header: 'Cumul', width: 1.15, align: 'right' },
      ],
      dossier.acquisitions.map(({ transaction, cost, cumulative }) => [
        dateTime(transaction.date),
        platform(transaction),
        TRANSACTION_LABELS[transaction.type],
        `${quantity(transaction.received.quantity)} ${transaction.received.asset}`,
        amountOf(transaction),
        feeOf(transaction),
        euros(cost),
        euros(cumulative),
      ]),
      { size: 7.5 },
    )
  }
  if (dossier.freeRewards > 0) {
    writer.space(6)
    writer.text(
      `${dossier.freeRewards} ${dossier.freeRewards > 1 ? 'récompenses' : 'récompense'} ` +
        '(staking, bonus) entrées avec un prix d’acquisition nul : elles comptent dans la valeur ' +
        'globale du portefeuille, pas dans la ligne 220.',
      { size: 8.5, color: MUTED },
    )
  }
}

function earlierDisposals(writer: Writer, dossier: Dossier) {
  if (dossier.earlierDisposals.length === 0) return
  writer.heading('Cessions des années précédentes (ligne 221)')
  writer.text(
    'Le prix d’acquisition se suit depuis l’origine du portefeuille : chaque cession antérieure ' +
      'en a consommé une fraction, reprise en ligne 221.',
  )
  writer.space(4)
  const first = dossier.disposals[0]
  writer.table(
    [
      { header: 'Date', width: 1.2 },
      { header: '217 Prix net des soultes', width: 1.3, align: 'right' },
      { header: '212 Valeur globale', width: 1.3, align: 'right' },
      { header: '223 Prix d’acquisition net', width: 1.4, align: 'right' },
      { header: 'Fraction : 223 × 217 / 212', width: 1.5, align: 'right' },
    ],
    dossier.earlierDisposals.map(({ result, capitalFraction }) => [
      dateTime(result.date),
      euros(result.priceNetOfBalancing),
      euros(result.portfolioValue),
      euros(result.netAcquisitionCost),
      euros(capitalFraction),
    ]),
    {
      size: 8,
      total: first
        ? ['Ligne 221', '', '', '', euros(first.result.initialCapitalFractions)]
        : undefined,
    },
  )
}

function prices(writer: Writer, dossier: Dossier) {
  writer.heading('Cours utilisés')
  if (dossier.prices.length === 0) {
    writer.text(
      'Aucun cours du marché n’a été nécessaire : le portefeuille ne contenait que les actifs cédés.',
    )
    return
  }
  writer.text('Cours d’une unité en euros, à la minute de chaque cession (heure de Paris).')
  writer.space(4)
  writer.table(
    [
      { header: 'Actif', width: 0.9 },
      { header: 'Minute', width: 1.4 },
      { header: 'Cours', width: 1.4, align: 'right' },
      { header: 'Source', width: 2.6 },
    ],
    dossier.prices.map((price) => [
      price.asset,
      dateTime(price.minute),
      unitPrice(price.priceEur),
      price.source,
    ]),
  )
}

function history(writer: Writer, dossier: Dossier) {
  writer.heading(`Historique des opérations jusqu’au 31/12/${dossier.year}`)
  writer.text(
    `${dossier.transactions.length} opérations crypto importées, dans l’ordre chronologique.`,
  )
  writer.space(4)
  writer.table(
    [
      { header: 'Date', width: 1.25 },
      { header: 'Plateforme', width: 1.1 },
      { header: 'Opération', width: 1.1 },
      { header: 'Mouvement', width: 2.3 },
      { header: 'Montant', width: 1.05, align: 'right' },
      { header: 'Frais', width: 1, align: 'right' },
    ],
    dossier.transactions.map((transaction) => [
      dateTime(transaction.date),
      platform(transaction),
      TRANSACTION_LABELS[transaction.type],
      movement(transaction),
      amountOf(transaction),
      feeOf(transaction),
    ]),
    { size: 7.5 },
  )
}

/**
 * Les polices standard du PDF n'ont pas de chasses déclarées : chaque lecteur applique les
 * siennes, un peu différentes de celles de la mise en page. On les déclare, comme pour une police
 * intégrée, pour que le texte tombe au même endroit partout.
 */
async function declareWidths(pdf: PDFDocument, font: PDFFont) {
  await font.embed()
  const widths = WIN_ANSI.map((char) => {
    if (char === '€') return EURO_ADVANCE
    return char && char !== '\u0000' ? font.widthOfTextAtSize(char, 1000) : 0
  })
  const dict = pdf.context.lookup(font.ref, PDFDict)
  dict.set(PDFName.of('FirstChar'), PDFNumber.of(32))
  dict.set(PDFName.of('LastChar'), PDFNumber.of(255))
  dict.set(PDFName.of('Widths'), pdf.context.obj(widths))
}

export async function renderDossier(
  dossier: Dossier,
  { rulesUrl }: { rulesUrl: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const [regular, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ])
  const writer = new Writer(pdf, regular, bold)

  cover(writer, dossier)
  method(writer, dossier, rulesUrl)
  disposals(writer, dossier)
  acquisitions(writer, dossier)
  earlierDisposals(writer, dossier)
  prices(writer, dossier)
  history(writer, dossier)

  const title = `Dossier justificatif, plus-values sur actifs numériques, revenus ${dossier.year}`
  writer.footers(title)
  pdf.setTitle(title)
  pdf.setLanguage('fr-FR')
  pdf.setCreator('CryptoPlusValue')
  pdf.setCreationDate(dossier.generatedAt)
  // Après tout le texte : une police modifiée ensuite serait intégrée à nouveau, sans chasses.
  await declareWidths(pdf, regular)
  await declareWidths(pdf, bold)
  return pdf.save()
}
