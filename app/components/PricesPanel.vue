<script setup lang="ts">
const store = usePortfolioStore()

const drafts = reactive<Record<string, string>>({})
const draftErrors = reactive<Record<string, string>>({})

const rows = computed(() =>
  store.neededPrices.map((request) => ({
    ...request,
    price: store.prices.get(request.key),
    error: store.priceErrors.get(request.key),
  })),
)

const found = computed(() => rows.value.filter((row) => row.price).length)
const hasErrors = computed(() => rows.value.some((row) => row.error))

function save(key: string) {
  try {
    store.setManualPrice(key, drafts[key] ?? '')
    draftErrors[key] = ''
  } catch {
    draftErrors[key] = 'Entrez un cours positif, par exemple 1234,56.'
  }
}
</script>

<template>
  <details
    v-if="rows.length > 0"
    class="rounded-lg border border-line bg-surface"
    :open="hasErrors || undefined"
  >
    <summary class="cursor-pointer px-4 py-3 text-sm font-medium">
      Cours utilisés pour la valeur du portefeuille :
      <span role="status">
        {{ store.fetchingPrices ? 'récupération…' : `${found} sur ${rows.length}` }}
      </span>
    </summary>
    <div class="border-t border-line px-4 py-3 text-sm">
      <p class="text-muted">
        À chaque vente, le formulaire 2086 demande la valeur de toutes vos cryptos à cet instant :
        voici les cours retenus, à la minute près. Seuls le symbole et la minute sont envoyés au
        serveur, jamais vos montants.
      </p>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full text-left">
          <caption class="sr-only">
            Cours historiques en euros utilisés pour le calcul
          </caption>
          <thead class="text-muted">
            <tr>
              <th scope="col" class="py-2 pr-4 font-medium">Actif</th>
              <th scope="col" class="py-2 pr-4 font-medium">Minute</th>
              <th scope="col" class="py-2 pr-4 text-right font-medium">Cours</th>
              <th scope="col" class="py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key" class="border-t border-line align-top">
              <td class="py-2 pr-4 font-medium">{{ row.asset }}</td>
              <td class="numeric py-2 pr-4 whitespace-nowrap">{{ formatDateTime(row.minute) }}</td>
              <td class="numeric py-2 pr-4 text-right whitespace-nowrap">
                {{ row.price ? formatEuros(row.price.priceEur) : '—' }}
              </td>
              <td class="py-2">
                <span v-if="row.price" class="text-muted">{{ row.price.source }}</span>
                <form
                  v-else-if="row.error"
                  class="flex flex-wrap items-center gap-2"
                  @submit.prevent="save(row.key)"
                >
                  <label :for="`price-${row.key}`" class="text-warning">{{ row.error }}</label>
                  <input
                    :id="`price-${row.key}`"
                    v-model="drafts[row.key]"
                    inputmode="decimal"
                    class="numeric w-28 rounded-md border border-line px-2 py-1"
                    placeholder="Cours en €"
                  />
                  <button
                    type="submit"
                    class="rounded-md bg-accent px-3 py-1 font-medium text-white hover:bg-accent-strong"
                  >
                    Valider
                  </button>
                  <span v-if="draftErrors[row.key]" class="w-full text-loss">{{
                    draftErrors[row.key]
                  }}</span>
                </form>
                <span v-else class="text-muted">En attente…</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </details>
</template>
