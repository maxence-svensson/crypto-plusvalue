<script setup lang="ts">
import {
  NO_FILTERS,
  SOURCE_NAMES,
  activeFilters,
  type ListFilters,
} from '#shared/portfolio/listing'
import { TRANSACTION_LABELS, type Source, type Transaction } from '#shared/portfolio/transaction'

/** Recherche et filtres de la liste des opérations ; chaque choix s'applique aussitôt. */
const filters = defineModel<ListFilters>({ required: true })
defineProps<{
  assets: string[]
  sources: Source[]
  years: number[]
  /** Opérations qui ont au moins un point à vérifier. */
  problems: number
  total: number
  shown: number
}>()

const TYPES = Object.entries(TRANSACTION_LABELS) as [Transaction['type'], string][]

function set<K extends keyof ListFilters>(key: K, value: ListFilters[K]) {
  filters.value = { ...filters.value, [key]: value }
}

const advanced = computed(
  () =>
    filters.value.from !== '' ||
    filters.value.to !== '' ||
    filters.value.minEur !== '' ||
    filters.value.maxEur !== '',
)
</script>

<template>
  <section aria-label="Recherche et filtres" class="glass space-y-4 rounded-card p-4 sm:p-5">
    <div class="relative">
      <label for="recherche" class="sr-only">Rechercher une opération</label>
      <AppIcon
        name="search"
        class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted"
      />
      <input
        id="recherche"
        type="search"
        class="input pl-11"
        placeholder="BTC, Kraken, vente, 03/03/2025…"
        autocomplete="off"
        :value="filters.query"
        @input="set('query', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="text-sm">
        <label for="filtre-type" class="mb-1.5 block text-muted">Type</label>
        <select
          id="filtre-type"
          class="input"
          :value="filters.type"
          @change="set('type', ($event.target as HTMLSelectElement).value as ListFilters['type'])"
        >
          <option value="">Tous</option>
          <option v-for="[value, label] in TYPES" :key="value" :value="value">{{ label }}</option>
        </select>
      </div>
      <div class="text-sm">
        <label for="filtre-plateforme" class="mb-1.5 block text-muted">Plateforme</label>
        <select
          id="filtre-plateforme"
          class="input"
          :value="filters.source"
          @change="
            set('source', ($event.target as HTMLSelectElement).value as ListFilters['source'])
          "
        >
          <option value="">Toutes</option>
          <option v-for="source in sources" :key="source" :value="source">
            {{ SOURCE_NAMES[source] }}
          </option>
        </select>
      </div>
      <div class="text-sm">
        <label for="filtre-crypto" class="mb-1.5 block text-muted">Crypto</label>
        <select
          id="filtre-crypto"
          class="input"
          :value="filters.asset"
          @change="set('asset', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">Toutes</option>
          <option v-for="asset in assets" :key="asset" :value="asset">{{ asset }}</option>
        </select>
      </div>
      <div class="text-sm">
        <label for="filtre-annee" class="mb-1.5 block text-muted">Année</label>
        <select
          id="filtre-annee"
          class="input"
          :value="filters.year"
          @change="set('year', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">Toutes</option>
          <option v-for="year in years" :key="year" :value="String(year)">{{ year }}</option>
        </select>
      </div>
    </div>

    <details class="disclosure -mx-1 rounded-control" :open="advanced">
      <summary class="!px-1 !py-1 text-sm">Période et montant</summary>
      <div class="grid grid-cols-2 gap-3 px-1 pt-3 lg:grid-cols-4">
        <div class="text-sm">
          <label for="filtre-du" class="mb-1.5 block text-muted">Du</label>
          <input
            id="filtre-du"
            type="date"
            class="input"
            :value="filters.from"
            @change="set('from', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="text-sm">
          <label for="filtre-au" class="mb-1.5 block text-muted">Au</label>
          <input
            id="filtre-au"
            type="date"
            class="input"
            :value="filters.to"
            @change="set('to', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="text-sm">
          <label for="filtre-min" class="mb-1.5 block text-muted">Montant minimum (€)</label>
          <input
            id="filtre-min"
            type="text"
            inputmode="decimal"
            class="input"
            :value="filters.minEur"
            @input="set('minEur', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="text-sm">
          <label for="filtre-max" class="mb-1.5 block text-muted">Montant maximum (€)</label>
          <input
            id="filtre-max"
            type="text"
            inputmode="decimal"
            class="input"
            :value="filters.maxEur"
            @input="set('maxEur', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </details>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-4">
      <label class="flex cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          class="check"
          :checked="filters.problemsOnly"
          @change="set('problemsOnly', ($event.target as HTMLInputElement).checked)"
        />
        Seulement les opérations à vérifier ({{ problems }})
      </label>
      <div class="flex items-center gap-3 text-sm">
        <p class="text-muted" role="status">
          <template v-if="shown === total">{{ plural(total, 'opération', 'opérations') }}</template>
          <template v-else>{{ plural(shown, 'opération', 'opérations') }} sur {{ total }}</template>
        </p>
        <button
          v-if="activeFilters(filters) > 0"
          type="button"
          class="btn btn-ghost btn-sm"
          @click="filters = { ...NO_FILTERS }"
        >
          Effacer les filtres
        </button>
      </div>
    </div>
  </section>
</template>
