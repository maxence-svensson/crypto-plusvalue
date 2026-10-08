<script setup lang="ts">
import { EXEMPTION_THRESHOLD, taxYear } from '#shared/tax/form2086'

const store = usePortfolioStore()

/** Par défaut : la dernière année où il y a eu des cessions, sinon la plus récente. */
const defaultYear = computed(() => {
  const state = store.computation
  const withDisposals = state.status === 'ready' ? state.disposals.map((d) => taxYear(d.date)) : []
  return withDisposals.length > 0 ? Math.max(...withDisposals) : store.years[0]
})
const chosenYear = ref<number>()
const year = computed(() => chosenYear.value ?? defaultYear.value)

const summary = computed(() => (year.value === undefined ? undefined : store.summary(year.value)))
</script>

<template>
  <div class="space-y-6">
    <p v-if="store.computation.status === 'missing-prices'" class="text-muted" role="status">
      {{
        store.fetchingPrices
          ? 'Récupération des cours…'
          : 'Il manque des cours pour terminer le calcul : complétez-les ci-dessus.'
      }}
    </p>

    <p v-else-if="store.computation.status === 'error'" class="text-loss" role="alert">
      {{ store.computation.message }}
    </p>

    <template v-else-if="summary && year !== undefined">
      <fieldset v-if="store.years.length > 1">
        <legend class="text-sm text-muted">Année des cessions</legend>
        <div class="mt-2 flex flex-wrap gap-2">
          <label
            v-for="option in store.years"
            :key="option"
            class="cursor-pointer rounded-md border px-3 py-1.5 text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
            :class="
              option === year
                ? 'border-accent bg-accent text-white'
                : 'border-line bg-surface hover:border-accent'
            "
          >
            <input v-model="chosenYear" type="radio" name="year" :value="option" class="sr-only" />
            {{ option }}
          </label>
        </div>
      </fieldset>

      <div
        v-if="summary.disposals.length === 0"
        class="rounded-lg border border-line bg-surface p-5"
      >
        <p class="font-medium">Aucune cession imposable en {{ year }}</p>
        <p class="mt-1 text-sm text-muted">
          Vous n'avez rien vendu contre des euros ni payé avec vos cryptos cette année-là : pas de
          plus-value à déclarer, le formulaire 2086 n'est pas à remplir pour {{ year }}. Les achats,
          les échanges entre cryptos et le staking ne sont pas des cessions.
        </p>
      </div>

      <template v-else>
        <dl class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-line bg-surface p-4">
            <dt class="text-sm text-muted">
              {{ summary.box3BN > 0 ? 'Moins-value, case 3BN' : 'Plus-value imposable, case 3AN' }}
            </dt>
            <dd
              class="numeric mt-1 text-2xl font-medium"
              :class="summary.box3BN > 0 ? 'text-loss' : summary.box3AN > 0 ? 'text-gain' : ''"
            >
              {{ formatWholeEuros(summary.box3BN > 0 ? summary.box3BN : summary.box3AN) }}
            </dd>
            <dd class="mt-1 text-xs text-muted">Déclaration 2042 C, arrondi à l'euro</dd>
          </div>
          <div class="rounded-lg border border-line bg-surface p-4">
            <dt class="text-sm text-muted">Plus ou moins-value nette, ligne 224</dt>
            <dd class="numeric mt-1 text-2xl font-medium">
              {{ formatSignedEuros(summary.netGain) }}
            </dd>
            <dd class="mt-1 text-xs text-muted">
              {{ summary.disposals.length }}
              {{ summary.disposals.length > 1 ? 'cessions' : 'cession' }}
            </dd>
          </div>
          <div class="rounded-lg border border-line bg-surface p-4">
            <dt class="text-sm text-muted">Total des cessions, ligne 51</dt>
            <dd class="numeric mt-1 text-2xl font-medium">{{ formatEuros(summary.totalPrice) }}</dd>
            <dd class="mt-1 text-xs text-muted">
              {{
                summary.exempt
                  ? `Exonéré : pas plus de ${EXEMPTION_THRESHOLD} € dans l'année`
                  : `Imposable : plus de ${EXEMPTION_THRESHOLD} € dans l'année`
              }}
            </dd>
          </div>
        </dl>

        <div>
          <h3 class="text-base font-semibold">Formulaire 2086, colonne par colonne</h3>
          <p class="mt-1 text-sm text-muted">
            Recopiez chaque colonne dans le formulaire 2086, à joindre à votre déclaration de
            revenus. Montants en euros, calculés sans arrondi intermédiaire.
          </p>
          <Form2086Table class="mt-3" :disposals="summary.disposals" />
        </div>
      </template>

      <aside class="rounded-lg border border-line bg-accent-soft p-4 text-sm">
        <p class="font-medium">À ne pas oublier : le formulaire 3916-bis</p>
        <p class="mt-1 text-muted">
          Chaque compte crypto ouvert auprès d'une plateforme étrangère (Coinbase, Trade Republic,
          Binance…) se déclare chaque année, même sans vente. L'oubli coûte 750 € par compte.
        </p>
      </aside>
    </template>
  </div>
</template>
