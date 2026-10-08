import { readFileSync } from 'node:fs'

import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { Dec } from '../tax/decimal'
import { computeDisposals, summarizeYear, type PortfolioEvent } from '../tax/form2086'
import { fillForm2086 } from './fill'
import { FORM_2086, form2086Placements, formatAmount, hasForm2086 } from './form2086'

const d = (value: number | string) => new Dec(value)
const buy = (date: string, cost: number): PortfolioEvent => ({
  kind: 'acquisition',
  date: new Date(date),
  cost: d(cost),
})
const sell = (date: string, portfolioValue: number, price: number, fees = 0): PortfolioEvent => ({
  kind: 'disposal',
  id: date,
  date: new Date(date),
  portfolioValue: d(portfolioValue),
  price: d(price),
  fees: d(fees),
})

/** Exemple de la notice : 75 € puis 675 € de plus-value en 2025. */
const NOTICE = summarizeYear(
  computeDisposals([
    buy('2025-01-10T10:00:00Z', 1000),
    sell('2025-03-10T10:00:00Z', 1200, 450),
    sell('2025-08-10T10:00:00Z', 1300, 1300),
  ]),
  2025,
)

const texts = (summary = NOTICE) =>
  form2086Placements(summary).map(({ sheet, page, box, text }) => ({
    sheet,
    page,
    left: box[0],
    top: box[1],
    text,
  }))

describe('form2086Placements', () => {
  it('écrit chaque cession dans sa colonne, ligne par ligne', () => {
    const placed = texts()

    // Ligne 211, colonnes 1 et 2 de la page 1.
    expect(placed).toContainEqual({ sheet: 0, page: 0, left: 154, top: 445, text: '10/03/2025' })
    expect(placed).toContainEqual({ sheet: 0, page: 0, left: 240, top: 445, text: '10/08/2025' })
    // Ligne 212, valeur globale du portefeuille.
    expect(placed).toContainEqual({ sheet: 0, page: 0, left: 154, top: 465, text: '1 200' })
    // Ligne 221 en page 2 : la fraction de capital déjà imputée.
    expect(placed).toContainEqual({ sheet: 0, page: 1, left: 237, top: 124, text: '375' })
    // Plus-values signées, comme le demande le formulaire.
    expect(placed).toContainEqual({ sheet: 0, page: 1, left: 156, top: 264, text: '+75' })
    expect(placed).toContainEqual({ sheet: 0, page: 1, left: 237, top: 264, text: '+675' })
  })

  it('reporte les totaux en lignes 224, 51 et 52', () => {
    const totals = form2086Placements(NOTICE).filter(
      ({ box }) => box[0] >= 447 && box[2] - box[0] > 60,
    )
    expect(totals.map(({ page, text }) => [page, text])).toEqual([
      [4, '1 750'],
      [1, '+750'],
      [4, '+750'],
    ])
  })

  it('ne remplit que les prix quand les cessions sont exonérées (ligne 51 ≤ 305 €)', () => {
    const exempt = summarizeYear(
      computeDisposals([buy('2025-01-10T10:00:00Z', 100), sell('2025-03-10T10:00:00Z', 300, 300)]),
      2025,
    )
    const rows = form2086Placements(exempt).map(({ page, box }) => `${page}:${box[1]}`)

    expect(rows).toContain('0:532') // ligne 213, prix de cession
    expect(rows).toContain('4:434') // ligne 51
    expect(rows).not.toContain('0:465') // ligne 212
    expect(rows).not.toContain('1:264') // plus-value
    expect(rows).not.toContain('4:539') // ligne 52
  })

  it('passe à un feuillet supplémentaire au-delà de 5 cessions', () => {
    const events: PortfolioEvent[] = []
    for (let month = 1; month <= 6; month++) {
      events.push(buy(`2025-0${month}-01T10:00:00Z`, 100))
      events.push(sell(`2025-0${month}-15T10:00:00Z`, 150, 150))
    }
    const placed = texts(summarizeYear(computeDisposals(events), 2025))
    const dates = placed.filter(({ page, top }) => page === 0 && top === 445)

    expect(dates.map(({ sheet, left }) => `${sheet}:${left}`)).toEqual([
      '0:154',
      '0:240',
      '0:327',
      '0:411',
      '0:496',
      '1:154',
    ])
  })

  it('refuse une autre année que celle du formulaire', () => {
    expect(hasForm2086(2025)).toBe(true)
    expect(hasForm2086(2026)).toBe(false)
    expect(() => form2086Placements({ ...NOTICE, year: 2026 })).toThrow('revenus 2025')
  })
})

describe('formatAmount', () => {
  it('écrit des euros entiers, avec le signe si demandé', () => {
    expect(formatAmount(d('1487.22'))).toBe('1 487')
    expect(formatAmount(d('1234567.5'))).toBe('1 234 568')
    expect(formatAmount(d('336.87'), true)).toBe('+337')
    expect(formatAmount(d('-5.52'), true)).toBe('-6')
    expect(formatAmount(d('0.2'), true)).toBe('0')
  })
})

describe('fillForm2086', () => {
  const template = readFileSync(new URL(`../../public${FORM_2086.path}`, import.meta.url))

  it('remplit le formulaire officiel sans changer ses pages', async () => {
    const filled = await PDFDocument.load(await fillForm2086(template, NOTICE))

    expect(filled.getPageCount()).toBe(7)
    expect(filled.getTitle()).toBe('Formulaire 2086, revenus 2025')
  })

  it('ajoute deux pages par feuillet supplémentaire', async () => {
    const events: PortfolioEvent[] = []
    for (let month = 1; month <= 6; month++) {
      events.push(buy(`2025-0${month}-01T10:00:00Z`, 100))
      events.push(sell(`2025-0${month}-15T10:00:00Z`, 150, 150))
    }
    const summary = summarizeYear(computeDisposals(events), 2025)
    const filled = await PDFDocument.load(await fillForm2086(template, summary))

    expect(filled.getPageCount()).toBe(9)
  })
})
