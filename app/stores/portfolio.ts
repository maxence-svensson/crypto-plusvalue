import { defineStore } from 'pinia'

import { MAX_FILE_BYTES, binaryFormat, decodeText } from '#shared/importers/decode'
import type { ImportResult } from '#shared/importers/csv'
import { importFile, type Platform } from '#shared/importers/detect'
import { checkDuplicates, type DuplicateCheck } from '#shared/portfolio/duplicates'
import { assessQuality } from '#shared/portfolio/quality'
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
      anomalies: { line: number; message: string }[]
      /** Opérations déjà présentes, ou doublons probables que l'utilisateur a écartés. */
      duplicates: number
    }
  | { name: string; error: string }

/** Un fichier lu, en attente de confirmation : l'utilisateur voit ce qui sera importé. */
export type PendingImport = {
  name: string
  platform: Platform
  result: ImportResult
  duplicates: DuplicateCheck
  /** Première et dernière opération du fichier. */
  period?: { from: Date; to: Date }
  /** Doublons probables que l'utilisateur choisit d'importer quand même. */
  keep: string[]
}

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

  /** Fichiers lus, en attente de confirmation. */
  const pending = ref<PendingImport[]>([])

  /** Un fichier à importer : son nom, sa taille si elle est connue, et de quoi lire son contenu. */
  type FileSource = { name: string; size?: number; bytes: () => Promise<ArrayBuffer> }

  /**
   * Lit les fichiers et prépare leur import, sans rien ajouter : chaque fichier est comparé aux
   * opérations déjà là et aux fichiers en attente avant lui, pour repérer les doublons.
   */
  async function prepareImport(list: Iterable<FileSource>) {
    for (const file of list) {
      try {
        if ((file.size ?? 0) > MAX_FILE_BYTES) {
          throw new Error('Fichier trop volumineux : 50 Mo au maximum.')
        }
        const bytes = new Uint8Array(await file.bytes())
        const binary = binaryFormat(bytes)
        if (binary) throw new Error(binary)
        const { platform, ...result } = importFile(decodeText(bytes))
        const before = [...transactions.value, ...pending.value.flatMap((item) => accepted(item))]
        const dates = result.transactions.map((transaction) => transaction.date.getTime())
        pending.value.push({
          name: file.name,
          platform,
          result,
          duplicates: checkDuplicates(before, result.transactions),
          ...(dates.length > 0
            ? { period: { from: new Date(Math.min(...dates)), to: new Date(Math.max(...dates)) } }
            : {}),
          keep: [],
        })
      } catch (error) {
        files.value.push({ name: file.name, error: (error as Error).message })
      }
    }
  }

  /** Ce qu'un fichier en attente ajoutera : les nouvelles opérations et les doublons gardés. */
  function accepted(item: PendingImport): Transaction[] {
    const kept = new Set(item.keep)
    return [
      ...item.duplicates.fresh,
      ...item.duplicates.possible
        .map(({ incoming }) => incoming)
        .filter((transaction) => kept.has(transaction.id)),
    ]
  }

  function toggleKeep(index: number, id: string) {
    const item = pending.value[index]
    if (!item) return
    item.keep = item.keep.includes(id)
      ? item.keep.filter((kept) => kept !== id)
      : [...item.keep, id]
  }

  /** Importe les fichiers en attente (tous, ou celui d'indice `index`), puis cherche les cours. */
  async function confirmImport(index?: number) {
    const chosen =
      index === undefined ? pending.value : pending.value.filter((_, at) => at === index)
    for (const item of chosen) {
      const added = accepted(item)
      transactions.value = [...transactions.value, ...added]
      files.value.push({
        name: item.name,
        platform: item.platform,
        transactions: added.length,
        skipped: item.result.skipped,
        unsupported: item.result.unsupported,
        anomalies: item.result.anomalies,
        duplicates: item.result.transactions.length - added.length,
      })
    }
    pending.value = index === undefined ? [] : pending.value.filter((_, at) => at !== index)
    await fetchPrices()
  }

  function cancelImport(index: number) {
    pending.value = pending.value.filter((_, at) => at !== index)
  }

  /** Lit et importe sans demander : pour l'exemple fictif. */
  async function importFiles(list: Iterable<FileSource>) {
    const start = pending.value.length
    await prepareImport(list)
    for (let index = pending.value.length - 1; index >= start; index--) {
      await confirmImport(index)
    }
  }

  /** Exemple fictif au format Trade Republic, pour essayer sans fichier. */
  async function loadExample() {
    await importFiles([
      {
        name: 'Exemple fictif (Trade Republic)',
        bytes: () =>
          $fetch<ArrayBuffer>('/exemples/trade-republic.csv', { responseType: 'arrayBuffer' }),
      },
    ])
  }

  function reset() {
    files.value = []
    pending.value = []
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
    await fetchPricesFor(neededPrices.value)
  }

  /** Récupère les cours manquants, quelques requêtes à la fois pour ménager les sources. */
  async function fetchPricesFor(requests: { asset: string; minute: Date }[]) {
    const missing = requests
      .map(({ asset, minute }) => ({ key: priceKey(asset, minute), asset, minute }))
      .filter(({ key }) => !prices.value.has(key))
    if (missing.length === 0) return

    fetchingPrices.value = true
    const errors = new Map(priceErrors.value)
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

  /** Cours connu d'un actif à une date, à la minute près. */
  function priceAt(asset: string, date: Date): Price | undefined {
    return prices.value.get(priceKey(asset, date))
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
      (asset, date) => priceAt(asset, date)?.priceEur,
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

  /** Qualité des données : manques et points à vérifier, pour le diagnostic. */
  const quality = computed(() =>
    assessQuality({
      transactions: transactions.value,
      missingHistory: replay.value.missingHistory,
      missingPrices: neededPrices.value.filter(
        (request) => !prices.value.has(request.key) && priceErrors.value.has(request.key),
      ).length,
      unsupported: files.value.reduce(
        (sum, file) => sum + ('error' in file ? 0 : file.unsupported.length),
        0,
      ),
      anomalies: files.value.reduce(
        (sum, file) => sum + ('error' in file ? 0 : file.anomalies.length),
        0,
      ),
    }),
  )

  function summary(year: number) {
    const state = computation.value
    return state.status === 'ready' ? summarizeYear(state.disposals, year) : undefined
  }

  return {
    files,
    pending,
    transactions,
    prices,
    priceErrors,
    fetchingPrices,
    replay,
    neededPrices,
    computation,
    years,
    quality,
    prepareImport,
    confirmImport,
    cancelImport,
    toggleKeep,
    importFiles,
    loadExample,
    fetchPrices,
    fetchPricesFor,
    priceAt,
    setManualPrice,
    summary,
    reset,
  }
})
