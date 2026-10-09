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
    class="disclosure solid-card overflow-hidden rounded-card"
    :open="hasErrors || undefined"
  >
    <summary>
      <span>
        Les cours retenus pour chaque vente :
        <span role="status" class="inline-flex items-center gap-2 font-normal text-muted">
          <span v-if="store.fetchingPrices" class="spinner size-3.5" aria-hidden="true"></span>
          {{ store.fetchingPrices ? 'récupération…' : `${found} sur ${rows.length}` }}
        </span>
      </span>
    </summary>
    <div class="border-t border-separator px-5 pt-4 pb-5 text-sm sm:px-6">
      <p class="max-w-prose text-muted">
        À chaque vente, le formulaire 2086 demande la valeur de toutes vos cryptos à cet instant.
        Voici les cours retenus, à la minute près. Seuls le symbole et la minute sont envoyés au
        serveur, jamais vos montants.
      </p>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full text-left">
          <caption class="sr-only">
            Cours historiques en euros utilisés pour le calcul
          </caption>
          <thead class="text-muted">
            <tr>
              <th scope="col" class="py-3 pr-4 font-medium">Crypto</th>
              <th scope="col" class="py-3 pr-4 font-medium">Minute</th>
              <th scope="col" class="py-3 pr-4 text-right font-medium">Cours</th>
              <th scope="col" class="py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key" class="border-t border-separator align-top">
              <td class="py-2.5 pr-4 font-semibold">{{ row.asset }}</td>
              <td class="numeric py-2.5 pr-4 whitespace-nowrap">
                {{ formatDateTime(row.minute) }}
              </td>
              <td class="numeric py-2.5 pr-4 text-right whitespace-nowrap">
                {{ row.price ? formatEuros(row.price.priceEur) : '—' }}
              </td>
              <td class="py-2.5">
                <span v-if="row.price" class="text-muted">{{ row.price.source }}</span>
                <form
                  v-else-if="row.error"
                  class="flex flex-wrap items-center gap-2"
                  @submit.prevent="save(row.key)"
                >
                  <label :for="`price-${row.key}`" class="w-full text-warning">{{
                    row.error
                  }}</label>
                  <input
                    :id="`price-${row.key}`"
                    v-model="drafts[row.key]"
                    inputmode="decimal"
                    class="input numeric min-h-10 w-32 rounded-chip px-3 text-sm"
                    placeholder="1234,56"
                  />
                  <button type="submit" class="btn btn-primary btn-sm">Valider le cours</button>
                  <span v-if="draftErrors[row.key]" class="w-full text-loss">{{
                    draftErrors[row.key]
                  }}</span>
                </form>
                <span v-else class="inline-flex items-center gap-2 text-muted">
                  <span class="spinner size-3.5" aria-hidden="true"></span>
                  En attente…
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </details>
</template>
