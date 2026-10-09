<script setup lang="ts">
import { correctedIds } from '#shared/portfolio/corrections'
import {
  NO_FILTERS,
  assetsOf,
  filterTransactions,
  sortTransactions,
  transactionsCsv,
  type ListFilters,
  type SortDirection,
  type SortKey,
} from '#shared/portfolio/listing'
import type { Source, Transaction } from '#shared/portfolio/transaction'
import { taxYear } from '#shared/tax/form2086'

useHead({ title: 'Transactions' })
const store = usePortfolioStore()
const route = useRoute()

/** `?a-verifier` : la liste s'ouvre sur les opérations qui ont un point à vérifier. */
const filters = ref<ListFilters>({ ...NO_FILTERS, problemsOnly: 'a-verifier' in route.query })
const sort = ref<{ key: SortKey; direction: SortDirection }>({ key: 'date', direction: 'desc' })
const selected = ref(new Set<string>())
const page = ref(1)
const PAGE_SIZE = 50

const assets = computed(() =>
  [...new Set(store.transactions.flatMap(assetsOf))].sort((a, b) => a.localeCompare(b)),
)
const sources = computed(
  () => [...new Set(store.transactions.map(({ source }) => source))] as Source[],
)
const years = computed(() =>
  [...new Set(store.transactions.map(({ date }) => taxYear(date)))].sort((a, b) => b - a),
)
const corrected = computed(() => correctedIds(store.corrections))

const filtered = computed(() =>
  sortTransactions(
    filterTransactions(store.transactions, filters.value, store.problems),
    sort.value.key,
    sort.value.direction,
  ),
)
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const visible = computed(() =>
  filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
)

// Nouveaux filtres : retour à la première page, et la sélection ne garde que ce qui reste visible.
watch([filters, sort], () => {
  page.value = 1
})
watch(filtered, (list) => {
  const ids = new Set(list.map(({ id }) => id))
  const kept = [...selected.value].filter((id) => ids.has(id))
  if (kept.length !== selected.value.size) selected.value = new Set(kept)
  if (page.value > pages.value) page.value = pages.value
})

const tableTop = ref<HTMLElement>()
function goTo(next: number) {
  page.value = next
  tableTop.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

const form = ref<{ open: (transaction?: Transaction) => void }>()
const details = ref<{ open: (transaction: Transaction) => void }>()
const confirmDelete = ref<{ open: () => void }>()
/** Ce que la fenêtre de confirmation s'apprête à supprimer. */
const toDelete = ref<string[]>([])

function askDelete(ids: string[]) {
  toDelete.value = ids
  confirmDelete.value?.open()
}

function deleteConfirmed() {
  store.deleteTransactions(toDelete.value)
  const next = new Set(selected.value)
  for (const id of toDelete.value) next.delete(id)
  selected.value = next
  toDelete.value = []
}

const lastCorrection = computed(() => store.corrections.at(-1))

function exportCsv() {
  const csv = transactionsCsv(filtered.value, store.problems)
  const day = new Date().toISOString().slice(0, 10)
  saveFile(new TextEncoder().encode(csv), `operations-crypto-${day}.csv`, 'text/csv;charset=utf-8')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Transactions"
      description="Toutes vos opérations crypto : cherchez, vérifiez, corrigez ce qui manque ou ce qui est faux."
    />

    <div class="flex flex-wrap gap-3">
      <button type="button" class="btn btn-primary" @click="form?.open()">
        <AppIcon name="plus" />
        Ajouter une opération
      </button>
      <button
        v-if="store.transactions.length > 0"
        type="button"
        class="btn btn-secondary"
        :disabled="filtered.length === 0"
        @click="exportCsv"
      >
        <AppIcon name="download" />
        Exporter la liste (CSV)
      </button>
    </div>

    <EmptyState
      v-if="store.transactions.length === 0"
      title="Aucune opération pour l’instant"
      text="Importez l’export de vos plateformes pour retrouver ici chaque achat, vente, échange et transfert. Vous pouvez aussi ajouter une opération à la main."
    />
    <template v-else>
      <MissingHistoryAlert />
      <TransactionFilters
        v-model="filters"
        :assets="assets"
        :sources="sources"
        :years="years"
        :problems="store.problems.size"
        :total="store.transactions.length"
        :shown="filtered.length"
      />

      <div
        v-if="lastCorrection"
        class="glass-subtle flex flex-wrap items-center justify-between gap-3 rounded-card px-5 py-3 text-sm"
        role="status"
      >
        <span>
          <span class="text-muted">Dernière correction :</span>
          {{ describeCorrection(lastCorrection) }}
        </span>
        <button type="button" class="btn btn-ghost btn-sm" @click="store.undoCorrection()">
          <AppIcon name="undo" />
          Annuler
        </button>
      </div>

      <div
        v-if="selected.size > 0"
        class="glass-strong sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-card px-5 py-3 text-sm lg:top-24"
      >
        <span class="font-semibold">
          {{ plural(selected.size, 'opération sélectionnée', 'opérations sélectionnées') }}
        </span>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="selected.size < filtered.length"
            type="button"
            class="btn btn-ghost btn-sm"
            @click="selected = new Set(filtered.map(({ id }) => id))"
          >
            Sélectionner les {{ filtered.length }}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" @click="selected = new Set()">
            Tout désélectionner
          </button>
          <button type="button" class="btn btn-danger btn-sm" @click="askDelete([...selected])">
            <AppIcon name="trash" />
            Supprimer
          </button>
        </div>
      </div>

      <div ref="tableTop" class="scroll-mt-24">
        <TransactionsTable
          v-if="filtered.length > 0"
          v-model:selected="selected"
          v-model:sort="sort"
          :transactions="visible"
          :problems="store.problems"
          :corrected="corrected"
          @details="details?.open($event)"
        />
        <div v-else class="glass rounded-card p-6 text-center">
          <p class="font-semibold">Aucune opération ne correspond.</p>
          <button type="button" class="btn btn-ghost mt-2" @click="filters = { ...NO_FILTERS }">
            Effacer les filtres
          </button>
        </div>
      </div>

      <nav
        v-if="pages > 1"
        aria-label="Pages de la liste"
        class="flex items-center justify-between gap-3"
      >
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="page === 1"
          @click="goTo(page - 1)"
        >
          <AppIcon name="chevron-left" />
          Précédente
        </button>
        <p class="numeric text-sm text-muted">Page {{ page }} sur {{ pages }}</p>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="page === pages"
          @click="goTo(page + 1)"
        >
          Suivante
          <AppIcon name="chevron-right" />
        </button>
      </nav>

      <CorrectionsJournal />
    </template>

    <TransactionForm ref="form" :assets="assets" />
    <TransactionDetails ref="details" @edit="form?.open($event)" @delete="askDelete([$event.id])" />
    <ConfirmDialog
      ref="confirmDelete"
      :title="
        toDelete.length > 1
          ? `Supprimer ${toDelete.length} opérations ?`
          : 'Supprimer l’opération ?'
      "
      :text="
        (toDelete.length > 1 ? 'Elles sortent' : 'Elle sort') +
        ' du calcul. Vos fichiers d’origine ne sont pas touchés, et le journal des corrections permet d’annuler.'
      "
      confirm="Supprimer"
      @confirm="deleteConfirmed"
    />
  </div>
</template>
