<script setup lang="ts">
import {
  flows,
  foldTail,
  gainsByYear,
  purchasesByAsset,
  volumeBySource,
} from '#shared/portfolio/activity'
import { SOURCE_NAMES } from '#shared/portfolio/listing'
import type { Source } from '#shared/portfolio/transaction'

/**
 * Graphiques du tableau de bord. La plus ou moins-value par année couvre tout l'historique ; le
 * choix de la période, juste au-dessous, s'applique à tout ce qui suit : achats et ventes,
 * répartition par crypto et par plateforme.
 */
const store = usePortfolioStore()

const gains = computed(() => {
  const state = store.computation
  return state.status === 'ready' ? gainsByYear(state.disposals, store.years) : undefined
})

function gainNote(index: number): string {
  const item = gains.value?.[index]
  if (!item || item.count === 0) return 'Aucune vente imposable'
  const sales = plural(item.count, 'vente imposable', 'ventes imposables')
  return item.exempt ? `${sales}, exonérée (cessions de 305 € au plus)` : sales
}

/** Période : une année (par mois) ou tout l'historique (par année). */
const period = ref<string>('')
watch(
  () => store.years,
  (years) => {
    if (!period.value || (period.value !== 'toutes' && !years.includes(Number(period.value)))) {
      period.value = years[0] === undefined ? 'toutes' : String(years[0])
    }
  },
  { immediate: true },
)
const year = computed(() => (period.value === 'toutes' ? undefined : Number(period.value)))
const periodLabel = computed(() =>
  year.value === undefined ? 'depuis le début' : `en ${year.value}`,
)

const flowData = computed(() => flows(store.transactions, year.value))
const hasFlows = computed(() =>
  flowData.value.some(({ bought, sold }) => bought.gt(0) || sold.gt(0)),
)

const byAsset = computed(() =>
  foldTail(purchasesByAsset(store.transactions, year.value), 6).map(({ key, value }) => ({
    key,
    label: key,
    value: value.toNumber(),
  })),
)
const bySource = computed(() =>
  volumeBySource(store.transactions, year.value).map(({ key, value }) => ({
    key,
    label: SOURCE_NAMES[key as Source] ?? key,
    value: value.toNumber(),
  })),
)

const signed = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(value)
const whole = (value: number) => formatWholeEuros(value)
</script>

<template>
  <section aria-labelledby="graphiques" class="space-y-4">
    <h2 id="graphiques" class="sr-only">Graphiques</h2>

    <!-- Une seule année : le chiffre du tableau de bord suffit, une colonne seule n'apprend rien. -->
    <ChartCard
      v-if="store.years.length > 1"
      title="Plus ou moins-value nette par année"
      description="Ce qu’il faut déclarer (ou non) chaque année : en bleu une plus-value, en rouge une moins-value."
      :table="gains !== undefined"
    >
      <ColumnChart
        v-if="gains"
        label="Plus ou moins-value par année, flèches pour parcourir"
        :categories="gains.map(({ year: each }) => String(each))"
        :series="[
          {
            key: 'gain',
            label: 'Plus ou moins-value nette',
            color: 'var(--series-1)',
            negativeColor: 'var(--series-negative)',
            values: gains.map(({ gain }) => Math.round(gain.toNumber())),
          },
        ]"
        :format="signed"
        :note="gainNote"
        label-all
        :height="220"
      />
      <p v-else class="text-sm text-muted">
        <template v-if="store.computation.status === 'missing-prices'">
          Le calcul attend des cours : ceux qui manquent se saisissent sur la page
          <NuxtLink to="/fiscalite" class="text-link hover:underline">Fiscalité</NuxtLink>.
        </template>
        <template v-else>Calcul impossible pour l’instant.</template>
      </p>
      <template #table>
        <table v-if="gains" class="w-full text-left text-sm">
          <thead class="text-muted">
            <tr class="border-b border-separator">
              <th scope="col" class="py-2 pr-4 font-medium">Année</th>
              <th scope="col" class="py-2 pr-4 text-right font-medium">Plus ou moins-value</th>
              <th scope="col" class="py-2 font-medium">Ventes imposables</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in gains" :key="item.year" class="border-t border-separator">
              <th scope="row" class="py-2 pr-4 font-medium">{{ item.year }}</th>
              <td class="numeric py-2 pr-4 text-right">{{ formatSignedEuros(item.gain) }}</td>
              <td class="py-2">{{ gainNote(index) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </ChartCard>

    <div class="flex flex-wrap items-center justify-between gap-3 pt-4">
      <h2 class="text-lg font-semibold tracking-tight">Activité {{ periodLabel }}</h2>
      <fieldset v-if="store.years.length > 1">
        <legend class="sr-only">Période</legend>
        <div class="segmented">
          <label v-for="each in store.years" :key="each">
            <input
              v-model="period"
              type="radio"
              name="periode"
              class="sr-only"
              :value="String(each)"
            />
            {{ each }}
          </label>
          <label v-if="store.years.length > 1">
            <input v-model="period" type="radio" name="periode" class="sr-only" value="toutes" />
            Toutes
          </label>
        </div>
      </fieldset>
    </div>

    <ChartCard
      title="Achats et ventes"
      :description="`Montants en euros, hors frais, ${year === undefined ? 'par année' : 'par mois'}. Les paiements en crypto comptent comme des ventes.`"
      :table="hasFlows"
    >
      <template v-if="hasFlows" #legend>
        <span class="flex items-center gap-2">
          <span class="size-2.5 rounded-[3px] bg-series-1"></span>
          Achats
        </span>
        <span class="flex items-center gap-2">
          <span class="size-2.5 rounded-[3px] bg-series-2"></span>
          Ventes
        </span>
      </template>
      <ColumnChart
        v-if="hasFlows"
        :label="`Achats et ventes ${year === undefined ? 'par année' : 'par mois'}, flèches pour parcourir`"
        :categories="flowData.map(({ label }) => label)"
        :series="[
          {
            key: 'achats',
            label: 'Achats',
            color: 'var(--series-1)',
            values: flowData.map(({ bought }) => Math.round(bought.toNumber())),
          },
          {
            key: 'ventes',
            label: 'Ventes',
            color: 'var(--series-2)',
            values: flowData.map(({ sold }) => Math.round(sold.toNumber())),
          },
        ]"
        :format="whole"
      />
      <p v-else class="text-sm text-muted">Aucun achat ni aucune vente {{ periodLabel }}.</p>
      <template #table>
        <table class="w-full text-left text-sm">
          <thead class="text-muted">
            <tr class="border-b border-separator">
              <th scope="col" class="py-2 pr-4 font-medium">
                {{ year === undefined ? 'Année' : 'Mois' }}
              </th>
              <th scope="col" class="py-2 pr-4 text-right font-medium">Achats</th>
              <th scope="col" class="py-2 text-right font-medium">Ventes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in flowData" :key="item.key" class="border-t border-separator">
              <th scope="row" class="py-2 pr-4 font-medium">{{ item.label }}</th>
              <td class="numeric py-2 pr-4 text-right">{{ formatEuros(item.bought) }}</td>
              <td class="numeric py-2 text-right">{{ formatEuros(item.sold) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </ChartCard>

    <div class="grid gap-4 md:grid-cols-2">
      <ChartCard
        title="Achats par crypto"
        description="Montants achetés en euros, hors frais. Ce n’est pas la valeur actuelle."
      >
        <ShareBars v-if="byAsset.length > 0" :shares="byAsset" color="var(--series-1)" />
        <p v-else class="text-sm text-muted">Aucun achat {{ periodLabel }}.</p>
      </ChartCard>
      <ChartCard
        title="Volume par plateforme"
        description="Achats, ventes et paiements en euros, hors frais."
      >
        <ShareBars v-if="bySource.length > 1" :shares="bySource" color="var(--series-1)" />
        <p v-else-if="bySource[0]" class="text-sm">
          Toutes les opérations {{ periodLabel }} viennent de {{ bySource[0].label }} :
          <span class="numeric font-semibold">{{ formatEuros(bySource[0].value) }}</span
          >.
        </p>
        <p v-else class="text-sm text-muted">Aucune opération en euros {{ periodLabel }}.</p>
      </ChartCard>
    </div>
  </section>
</template>
