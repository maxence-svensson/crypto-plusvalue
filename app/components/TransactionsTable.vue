<script setup lang="ts">
import { SOURCE_NAMES, eurosOf, type SortDirection, type SortKey } from '#shared/portfolio/listing'
import { PROBLEMS, type ProblemId } from '#shared/portfolio/problems'
import { TRANSACTION_LABELS, type Transaction } from '#shared/portfolio/transaction'

/**
 * Une page de la liste des opérations : tri par colonne, sélection, points à vérifier. Le détail
 * de chaque opération s'ouvre depuis sa ligne.
 */
const props = defineProps<{
  transactions: Transaction[]
  problems: ReadonlyMap<string, readonly ProblemId[]>
  /** Opérations ajoutées ou modifiées à la main. */
  corrected: ReadonlySet<string>
}>()
const selected = defineModel<Set<string>>('selected', { required: true })
const sort = defineModel<{ key: SortKey; direction: SortDirection }>('sort', { required: true })
const emit = defineEmits<{ details: [transaction: Transaction] }>()

/** Colonnes triables ; sur mobile, date et montant se replient dans les colonnes voisines. */
const COLUMNS: { key: SortKey; label: string; wide?: boolean; align?: 'right' }[] = [
  { key: 'date', label: 'Date', wide: true },
  { key: 'type', label: 'Opération' },
  { key: 'asset', label: 'Mouvement' },
  { key: 'amount', label: 'Montant', wide: true, align: 'right' },
]

/** Tri sur mobile, où les en-têtes de date et de montant sont masqués. */
const MOBILE_SORTS: { value: string; label: string }[] = [
  { value: 'date:desc', label: 'Plus récentes' },
  { value: 'date:asc', label: 'Plus anciennes' },
  { value: 'amount:desc', label: 'Montant décroissant' },
  { value: 'amount:asc', label: 'Montant croissant' },
  { value: 'type:asc', label: 'Type d’opération' },
  { value: 'asset:asc', label: 'Crypto' },
]

const problemTitles = (id: string) =>
  (props.problems.get(id) ?? []).map((problem) => PROBLEMS[problem].title).join(', ')

function sortFrom(value: string) {
  const [key, direction] = value.split(':') as [SortKey, SortDirection]
  sort.value = { key, direction }
}

function sortBy(key: SortKey) {
  sort.value =
    sort.value.key === key
      ? { key, direction: sort.value.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'date' || key === 'amount' ? 'desc' : 'asc' }
}

const ariaSort = (key: SortKey) =>
  sort.value.key === key ? (sort.value.direction === 'asc' ? 'ascending' : 'descending') : 'none'

const allSelected = computed(
  () =>
    props.transactions.length > 0 &&
    props.transactions.every((transaction) => selected.value.has(transaction.id)),
)
const someSelected = computed(
  () => !allSelected.value && props.transactions.some(({ id }) => selected.value.has(id)),
)

function toggleAll() {
  const next = new Set(selected.value)
  for (const { id } of props.transactions) {
    if (allSelected.value) next.delete(id)
    else next.add(id)
  }
  selected.value = next
}

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}
</script>

<template>
  <div
    class="solid-card overflow-x-auto rounded-card"
    tabindex="0"
    role="region"
    aria-label="Liste des opérations"
  >
    <div
      class="flex items-center justify-between gap-3 border-b border-separator px-4 py-3 md:hidden"
    >
      <label for="tri-mobile" class="text-sm text-muted">Trier par</label>
      <select
        id="tri-mobile"
        class="input min-h-10 w-auto text-sm"
        :value="`${sort.key}:${sort.direction}`"
        @change="sortFrom(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="option in MOBILE_SORTS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>
    <table class="w-full text-left text-sm md:min-w-[52rem]">
      <caption class="sr-only">
        Opérations crypto ; les en-têtes de colonne trient la liste.
      </caption>
      <thead class="text-muted">
        <tr class="border-b border-separator">
          <th scope="col" class="w-12 py-3 pr-2 pl-4 md:pl-5">
            <input
              type="checkbox"
              class="check"
              aria-label="Sélectionner les opérations de cette page"
              :checked="allSelected"
              :indeterminate="someSelected"
              @change="toggleAll"
            />
          </th>
          <th
            v-for="column in COLUMNS"
            :key="column.key"
            scope="col"
            :aria-sort="ariaSort(column.key)"
            class="py-2 pr-4 font-medium"
            :class="[
              column.align === 'right' ? 'text-right' : '',
              column.wide ? 'hidden md:table-cell' : '',
            ]"
          >
            <button
              type="button"
              class="-mx-2 inline-flex min-h-9 items-center gap-1 rounded-chip px-2 hover:text-label"
              :class="sort.key === column.key ? 'font-semibold text-label' : ''"
              @click="sortBy(column.key)"
            >
              {{ column.label }}
              <AppIcon
                v-if="sort.key === column.key"
                name="chevron"
                class="size-4 transition-transform"
                :class="sort.direction === 'asc' ? 'rotate-180' : ''"
              />
            </button>
          </th>
          <th scope="col" class="hidden py-3 pr-4 font-medium md:table-cell">À vérifier</th>
          <th scope="col" class="py-3 pr-3 md:pr-5"><span class="sr-only">Détails</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="transaction in transactions"
          :key="transaction.id"
          class="border-t border-separator first:border-t-0"
          :class="selected.has(transaction.id) ? 'bg-accent-tint' : ''"
        >
          <td class="py-2.5 pr-2 pl-4 md:pl-5">
            <input
              type="checkbox"
              class="check"
              :aria-label="`Sélectionner l’opération du ${formatDateTime(transaction.date)}`"
              :checked="selected.has(transaction.id)"
              @change="toggle(transaction.id)"
            />
          </td>
          <td class="numeric hidden py-2.5 pr-4 whitespace-nowrap md:table-cell">
            {{ formatDateTime(transaction.date) }}
          </td>
          <td class="py-2.5 pr-4 md:whitespace-nowrap">
            <span class="font-medium">{{ TRANSACTION_LABELS[transaction.type] }}</span>
            <span class="numeric block text-xs text-muted md:hidden">
              {{ formatDateTime(transaction.date) }}
            </span>
            <span class="block text-xs text-muted">
              {{ SOURCE_NAMES[transaction.source]
              }}{{
                corrected.has(transaction.id) && transaction.source !== 'manual' ? ', corrigée' : ''
              }}
            </span>
            <span
              v-if="problems.get(transaction.id)?.length"
              class="mt-1 block text-xs font-semibold text-warning md:hidden"
            >
              {{ problemTitles(transaction.id) }}
            </span>
          </td>
          <td class="numeric py-2.5 pr-2 md:pr-4 md:whitespace-nowrap">
            {{ formatMovements(transaction) }}
            <span v-if="eurosOf(transaction)" class="block text-xs text-muted md:hidden">
              {{ formatEuros(eurosOf(transaction)!) }}
            </span>
          </td>
          <td class="numeric hidden py-2.5 pr-4 text-right whitespace-nowrap md:table-cell">
            {{ eurosOf(transaction) ? formatEuros(eurosOf(transaction)!) : '' }}
          </td>
          <td class="hidden py-2.5 pr-4 md:table-cell">
            <span
              v-for="problem in problems.get(transaction.id) ?? []"
              :key="problem"
              class="mr-1 inline-flex items-center gap-1 rounded-full bg-warning-tint px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
              :class="PROBLEMS[problem].blocking ? 'text-loss' : 'text-warning'"
            >
              {{ PROBLEMS[problem].title }}
            </span>
          </td>
          <td class="py-1.5 pr-3 text-right md:pr-5">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :aria-label="`Détails de l’opération du ${formatDateTime(transaction.date)}`"
              @click="emit('details', transaction)"
            >
              <span class="hidden md:inline">Détails</span>
              <AppIcon name="chevron-right" class="md:hidden" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
