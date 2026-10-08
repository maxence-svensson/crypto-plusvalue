import { defineStore } from 'pinia'

import { importFile, type Platform } from '#shared/importers/detect'
import { replayPortfolio } from '#shared/portfolio/replay'
import { buildTaxEvents, requiredPrices } from '#shared/portfolio/tax-events'
import type { Transaction } from '#shared/portfolio/transaction'
import { startOfMinute, type PriceQuote } from '#shared/prices'
import { Dec } from '#shared/tax/decimal'
import { computeDisposals, summarizeYear, taxYear, type DisposalResult } from '#shared/tax/form2086'

export type ImportedFile =
  | {
      name: string
      platform: Platform
      transactions: number
      skipped: number
      unsupported: { line: number; label: string }[]
    }
  | { name: string; error: string }

export type Price = { priceEur: Dec; source: string }

export type PriceRequest = { key: string; asset: string; minute: Date }

const priceKey = (asset: string, date: Date) => `${asset}@${startOfMinute(date).toISOString()}`

/**
 * État de l'application, entièrement dans le navigateur : les fichiers importés ne quittent
 * jamais l'appareil. Seules les demandes de cours (un symbole et une minute) partent au serveur.
 */
export const usePortfolioStore = defineStore('portfolio', () => {
  const files = ref<ImportedFile[]>([])
  // Tableaux et décimaux ne sont jamais modifiés en place : inutile de les rendre réactifs en
  // profondeur, ce qui ralentirait decimal.js.
  const transactions = shallowRef<Transaction[]>([])
  const prices = shallowRef(new Map<string, Price>())
  const priceErrors = shallowRef(new Map<string, string>())
  const fetchingPrices = ref(false)

  async function importFiles(list: Iterable<{ name: string; text: () => Promise<string> }>) {
    for (const file of list) {
      try {
        const result = importFile(await file.text())
        // Un même fichier importé deux fois ne double pas les transactions.
        const known = new Set(transactions.value.map((transaction) => transaction.id))
        const added = result.transactions.filter((transaction) => !known.has(transaction.id))
        transactions.value = [...transactions.value, ...added]
        files.value.push({
          name: file.name,
          platform: result.platform,
          transactions: result.transactions.length,
          skipped: result.skipped,
          unsupported: result.unsupported,
        })
      } catch (error) {
        files.value.push({ name: file.name, error: (error as Error).message })
      }
    }
    await fetchPrices()
  }

  function reset() {
    files.value = []
    transactions.value = []
    prices.value = new Map()
    priceErrors.value = new Map()
  }

  const replay = computed(() => replayPortfolio(transactions.value))

  /** Cours nécessaires au calcul, une seule fois par actif et par minute. */
  const neededPrices = computed<PriceRequest[]>(() => {
    const unique = new Map<string, PriceRequest>()
    for (const { asset, date } of requiredPrices(transactions.value)) {
      const key = priceKey(asset, date)
      unique.set(key, { key, asset, minute: startOfMinute(date) })
    }
    return [...unique.values()]
  })

  async function fetchPrices() {
    const missing = neededPrices.value.filter(({ key }) => !prices.value.has(key))
    if (missing.length === 0) return

    fetchingPrices.value = true
    const errors = new Map(priceErrors.value)
    // Quelques requêtes à la fois, pour ménager les sources de cours.
    const queue = [...missing]
    const worker = async () => {
      for (let request = queue.shift(); request; request = queue.shift()) {
        try {
          const quote = await $fetch<PriceQuote>('/api/price', {
            query: { asset: request.asset, at: request.minute.toISOString() },
          })
          setPrice(request.key, { priceEur: new Dec(quote.priceEur), source: quote.source })
          errors.delete(request.key)
        } catch {
          errors.set(request.key, 'Cours introuvable : saisissez-le vous-même.')
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    priceErrors.value = errors
    fetchingPrices.value = false
  }

  function setPrice(key: string, price: Price) {
    prices.value = new Map(prices.value).set(key, price)
  }

  function setManualPrice(key: string, value: string) {
    const price = new Dec(value.replace(',', '.'))
    if (price.lte(0)) throw new Error('Le cours doit être positif.')
    setPrice(key, { priceEur: price, source: 'Saisi par vous' })
    const errors = new Map(priceErrors.value)
    errors.delete(key)
    priceErrors.value = errors
  }

  /** Les cessions, quand tous les cours nécessaires sont connus. */
  const computation = computed<
    | { status: 'empty' }
    | { status: 'missing-prices' }
    | { status: 'error'; message: string }
    | { status: 'ready'; disposals: DisposalResult[] }
  >(() => {
    if (transactions.value.length === 0) return { status: 'empty' }
    const events = buildTaxEvents(
      transactions.value,
      (asset, date) => prices.value.get(priceKey(asset, date))?.priceEur,
    )
    if (!events.ok) return { status: 'missing-prices' }
    try {
      return { status: 'ready', disposals: computeDisposals(events.events) }
    } catch (error) {
      return { status: 'error', message: (error as Error).message }
    }
  })

  /** Années couvertes par l'historique, de la plus récente à la plus ancienne. */
  const years = computed(() => {
    const all = transactions.value.map((transaction) => taxYear(transaction.date))
    if (all.length === 0) return []
    const first = Math.min(...all)
    const last = Math.max(...all)
    return Array.from({ length: last - first + 1 }, (_, index) => last - index)
  })

  function summary(year: number) {
    const state = computation.value
    return state.status === 'ready' ? summarizeYear(state.disposals, year) : undefined
  }

  return {
    files,
    transactions,
    prices,
    priceErrors,
    fetchingPrices,
    replay,
    neededPrices,
    computation,
    years,
    importFiles,
    fetchPrices,
    setManualPrice,
    summary,
    reset,
  }
})
