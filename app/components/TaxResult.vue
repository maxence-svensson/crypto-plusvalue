<script setup lang="ts">
import { FORM_2086, hasForm2086 } from '#shared/cerfa/form2086'
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
const isLoss = computed(() => (summary.value?.box3BN ?? 0) > 0)

const downloading = ref(false)
const downloadError = ref('')

async function download() {
  if (!summary.value) return
  downloading.value = true
  downloadError.value = ''
  try {
    await downloadForm2086(summary.value)
  } catch {
    downloadError.value = 'Le formulaire n’a pas pu être préparé. Réessayez dans un instant.'
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <p v-if="store.computation.status === 'missing-prices'" class="text-ink-soft" role="status">
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
        <legend class="text-sm text-ink-soft">Année des ventes</legend>
        <div class="mt-2 inline-flex overflow-hidden rounded-[4px] border-[1.5px] border-ink">
          <label
            v-for="option in store.years"
            :key="option"
            class="numeric cursor-pointer border-ink px-4 py-1.5 text-sm font-semibold not-first:border-l-[1.5px] focus-within:outline-2 focus-within:-outline-offset-4 focus-within:outline-paper"
            :class="option === year ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-field'"
          >
            <input v-model="chosenYear" type="radio" name="year" :value="option" class="sr-only" />
            {{ option }}
          </label>
        </div>
      </fieldset>

      <div v-if="summary.disposals.length === 0" class="rounded-md bg-field px-6 py-5">
        <p class="display text-lg">Rien à déclarer pour {{ year }}</p>
        <p class="mt-2 max-w-prose text-ink-soft">
          Vous n'avez rien vendu contre des euros ni payé avec vos cryptos cette année-là : pas de
          plus-value, et pas de formulaire 2086 à remplir pour {{ year }}. Les achats, les échanges
          entre cryptos et le staking ne sont pas des ventes imposables.
        </p>
      </div>

      <template v-else>
        <div
          class="grid gap-6 rounded-md bg-field p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center md:gap-12"
        >
          <div>
            <p class="text-sm text-ink-soft">Déclaration 2042 C, revenus {{ year }}</p>
            <p class="mt-1 mb-4 font-semibold">
              {{
                isLoss ? 'Moins-value sur actifs numériques' : 'Plus-value sur actifs numériques'
              }}
            </p>
            <CombBox
              :code="isLoss ? '3BN' : '3AN'"
              :value="isLoss ? summary.box3BN : summary.box3AN"
            />
            <p v-if="summary.exempt" class="mt-3 text-sm text-ink-soft">
              Vos ventes ne dépassent pas {{ EXEMPTION_THRESHOLD }} € : elles sont exonérées.
            </p>
          </div>
          <dl class="divide-y divide-rule border-y border-rule text-sm">
            <div class="flex items-baseline justify-between gap-4 py-3">
              <dt>
                <span class="font-semibold">Ligne 224</span>
                <span class="text-ink-soft"> du 2086, plus ou moins-value nette</span>
              </dt>
              <dd class="numeric font-semibold whitespace-nowrap">
                {{ formatSignedEuros(summary.netGain) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-4 py-3">
              <dt>
                <span class="font-semibold">Ligne 51</span>
                <span class="text-ink-soft"> du 2086, total des ventes</span>
              </dt>
              <dd class="numeric font-semibold whitespace-nowrap">
                {{ formatEuros(summary.totalPrice) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-4 py-3">
              <dt class="text-ink-soft">Ventes imposables dans l'année</dt>
              <dd class="numeric font-semibold">{{ summary.disposals.length }}</dd>
            </div>
          </dl>
        </div>

        <RegimeComparison v-if="summary.box3AN > 0" :gain="summary.netGain" :year="year" />

        <div>
          <h3 class="display text-lg">Le formulaire 2086, cession par cession</h3>
          <div
            v-if="hasForm2086(year)"
            class="mt-3 flex flex-col gap-3 rounded-md border-[1.5px] border-ink p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="max-w-prose text-sm text-ink-soft">
              <span class="font-semibold text-ink">Le formulaire officiel, déjà rempli.</span>
              Toutes les cases calculées sont complétées, en euros entiers. Il reste à ajouter vos
              nom et adresse, à vérifier, puis à le joindre à votre déclaration.
            </p>
            <button
              type="button"
              class="shrink-0 rounded-[4px] bg-ink px-5 py-3 font-semibold text-paper hover:bg-ink/90 disabled:opacity-60"
              :disabled="downloading"
              @click="download"
            >
              {{ downloading ? 'Préparation du formulaire…' : 'Télécharger le 2086 rempli' }}
            </button>
          </div>
          <p v-else class="mt-2 max-w-prose text-sm text-ink-soft">
            {{
              year > FORM_2086.year
                ? `L'administration n'a pas encore publié le formulaire 2086 des revenus ${year} : recopiez les montants ci-dessous quand il sera disponible.`
                : `Le formulaire rempli n'est proposé que pour les revenus ${FORM_2086.year} : recopiez les montants ci-dessous.`
            }}
          </p>
          <p v-if="downloadError" class="mt-2 text-sm text-loss" role="alert">
            {{ downloadError }}
          </p>
          <p class="mt-4 max-w-prose text-sm text-ink-soft">
            Le détail ci-dessous est calculé sans arrondi intermédiaire.
          </p>
          <Form2086Table class="mt-4" :disposals="summary.disposals" />
        </div>
      </template>

      <aside class="border-t-[1.5px] border-ink pt-4 text-sm">
        <p class="font-semibold">Pensez aussi au formulaire 3916-bis</p>
        <p class="mt-1 max-w-prose text-ink-soft">
          Chaque compte crypto ouvert auprès d'une plateforme étrangère (Coinbase, Trade Republic,
          Binance…) se déclare chaque année, même sans vente. L'oubli coûte 750 € par compte.
        </p>
      </aside>
    </template>
  </div>
</template>
