<script setup lang="ts">
import { startOfMinute } from '#shared/prices'
import { simulateSale, simulateSimpleSale, type SaleSimulation } from '#shared/simulation/sale'
import { Dec } from '#shared/tax/decimal'
import { EXEMPTION_THRESHOLD, taxYear } from '#shared/tax/form2086'
import { flatRate, taxRules } from '#shared/tax/rules'

const store = usePortfolioStore()

/** Taux de l'année en cours : ceux qui s'appliqueraient à une vente faite maintenant. */
const rulesNow = taxRules(taxYear(new Date()))

const holdings = computed(() => [...store.replay.holdings].sort(([a], [b]) => a.localeCompare(b)))
const fromHistory = computed(() => holdings.value.length > 0)

// Avec l'historique importé : une crypto détenue, une quantité, les cours du moment.
const asset = ref('')
const quantity = ref('')
const unitPrice = ref('')
const fee = ref('')
/** Part de la crypto détenue à vendre, réglée au curseur ; synchronisée avec la quantité saisie. */
const percent = ref(0)
/** Dernière minute dont la bougie est close : le serveur de cours refuse la minute en cours. */
const minute = ref<Date>()

const held = computed(() => holdings.value.find(([symbol]) => symbol === asset.value)?.[1])
const marketPrice = computed(() =>
  minute.value && asset.value ? store.priceAt(asset.value, minute.value) : undefined,
)

/** Cours du marché, prérempli dans le champ : 74184,41. */
function marketPriceInput(): string {
  return marketPrice.value?.priceEur.toDecimalPlaces(2).toString().replace('.', ',') ?? ''
}

async function refreshPrices() {
  const current = startOfMinute(new Date(Date.now() - 2 * 60_000))
  minute.value = current
  await store.fetchPricesFor(holdings.value.map(([symbol]) => ({ asset: symbol, minute: current })))
  unitPrice.value = marketPriceInput()
}

watch(
  holdings,
  (list) => {
    if (list.length > 0 && !list.some(([symbol]) => symbol === asset.value)) {
      asset.value = list[0]?.[0] ?? ''
      refreshPrices()
    }
  },
  { immediate: true },
)

watch(asset, () => {
  quantity.value = ''
  percent.value = 0
  unitPrice.value = marketPriceInput()
})

function onSlide(event: Event) {
  percent.value = Number((event.target as HTMLInputElement).value)
  if (!held.value) return
  // À 100 %, la quantité exacte détenue, sans reste dû aux arrondis.
  const amount =
    percent.value >= 100
      ? held.value
      : held.value.times(percent.value).div(100).toDecimalPlaces(8, Dec.ROUND_DOWN)
  quantity.value = amount.isZero() ? '' : amount.toFixed().replace('.', ',')
}

function onQuantityInput() {
  const amount = parseAmount(quantity.value)
  percent.value =
    amount && held.value?.gt(0)
      ? Math.min(100, amount.div(held.value).times(100).toDecimalPlaces(0).toNumber())
      : 0
}

/** Ce que rapporterait la vente, avant frais et impôt. */
const estimatedValue = computed(() => {
  const amount = parseAmount(quantity.value)
  const price = parseAmount(unitPrice.value)
  return amount && price ? amount.times(price) : undefined
})

// Sans historique : trois montants suffisent.
const invested = ref('')
const portfolioValue = ref('')
const saleAmount = ref('')

type Outcome = { simulation: SaleSimulation } | { hint: string } | { error: string }

const outcome = computed<Outcome>(() => {
  const fees = parseAmount(fee.value) ?? new Dec(0)

  if (fromHistory.value) {
    const amount = parseAmount(quantity.value)
    const price = parseAmount(unitPrice.value)
    if (!amount || amount.isZero()) return { hint: 'Indiquez la quantité à vendre.' }
    if (held.value && amount.gt(held.value)) {
      return { error: `Vous ne détenez que ${formatQuantity(held.value)} ${asset.value}.` }
    }
    if (!price || price.isZero()) return { hint: 'Indiquez le cours de vente.' }
    if (!minute.value) return { hint: 'Récupération des cours…' }

    const result = simulateSale(
      store.transactions,
      {
        asset: asset.value,
        quantity: amount,
        unitPriceEur: price,
        feeEur: fees,
        date: minute.value,
      },
      (symbol, date) => store.priceAt(symbol, date)?.priceEur,
    )
    if (!result.ok) {
      const missing = [...new Set(result.missingPrices.map((item) => item.asset))].join(', ')
      return {
        error: store.fetchingPrices
          ? 'Récupération des cours…'
          : `Cours introuvable pour ${missing} : la valeur de votre portefeuille ne peut pas être estimée.`,
      }
    }
    return { simulation: result }
  }

  const cost = parseAmount(invested.value)
  const value = parseAmount(portfolioValue.value)
  const sale = parseAmount(saleAmount.value)
  if (!cost || !value || !sale) return { hint: 'Remplissez les trois montants.' }
  if (value.isZero()) return { error: 'La valeur de votre portefeuille doit être positive.' }
  if (sale.gt(value)) {
    return { error: 'Vous ne pouvez pas vendre plus que la valeur de votre portefeuille.' }
  }
  return {
    simulation: simulateSimpleSale({
      acquisitionCost: cost,
      portfolioValue: value,
      saleAmount: sale,
      feeEur: fees,
      date: new Date(),
    }),
  }
})

const crossesThreshold = computed(
  () =>
    'simulation' in outcome.value &&
    outcome.value.simulation.yearBefore.exempt &&
    !outcome.value.simulation.yearAfter.exempt &&
    outcome.value.simulation.yearBefore.disposals.length > 0,
)
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
    <form class="glass space-y-5 rounded-card p-6 sm:p-8" @submit.prevent>
      <template v-if="fromHistory">
        <p class="max-w-prose text-sm text-muted">
          Le calcul part de vos fichiers importés : ce qu'il reste de vos prix d'achat, et vos
          ventes déjà faites cette année.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-sm font-semibold">Crypto à vendre</span>
            <select v-model="asset" class="input mt-2">
              <option v-for="[symbol, amount] in holdings" :key="symbol" :value="symbol">
                {{ symbol }} ({{ formatQuantity(amount) }} détenus)
              </option>
            </select>
          </label>
          <label class="block">
            <span class="text-sm font-semibold">Quantité</span>
            <input
              v-model="quantity"
              inputmode="decimal"
              placeholder="0,5"
              class="input numeric mt-2"
              @input="onQuantityInput"
            />
          </label>
          <div class="sm:col-span-2">
            <div class="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
              <label for="part-a-vendre" class="font-semibold"
                >Part de vos {{ asset }} à vendre</label
              >
              <span class="numeric text-muted">
                <span class="font-semibold text-label">{{ percent }} %</span>
                <template v-if="estimatedValue">, soit {{ formatEuros(estimatedValue) }}</template>
              </span>
            </div>
            <input
              id="part-a-vendre"
              type="range"
              min="0"
              max="100"
              step="1"
              :value="percent"
              class="range mt-4 block w-full"
              :style="{ '--fill': `${percent}%` }"
              :aria-valuetext="`${percent} %${quantity ? `, soit ${quantity} ${asset}` : ''}`"
              @input="onSlide"
            />
            <div class="numeric mt-4 flex justify-between text-xs text-muted" aria-hidden="true">
              <span>0 %</span>
              <span>25 %</span>
              <span>50 %</span>
              <span>75 %</span>
              <span>100 %</span>
            </div>
          </div>
          <label class="block">
            <span class="text-sm font-semibold">Cours de vente, en euros</span>
            <input v-model="unitPrice" inputmode="decimal" class="input numeric mt-2" />
            <span class="mt-1.5 block text-xs text-muted">
              {{
                marketPrice
                  ? `Cours d'il y a 2 minutes, ${marketPrice.source}.`
                  : store.fetchingPrices
                    ? 'Récupération du cours…'
                    : 'Cours du moment introuvable : saisissez-le.'
              }}
              <button
                type="button"
                class="inline-flex items-center gap-1 font-medium text-link hover:underline"
                @click="refreshPrices"
              >
                <AppIcon name="refresh" class="size-3.5" />
                Actualiser
              </button>
            </span>
          </label>
          <label class="block">
            <span class="text-sm font-semibold">Frais de vente, en euros</span>
            <input v-model="fee" inputmode="decimal" placeholder="0" class="input numeric mt-2" />
          </label>
        </div>
      </template>

      <template v-else>
        <p class="max-w-prose text-sm text-muted">
          Sans fichier, trois montants suffisent. Importez votre historique plus haut pour un calcul
          automatique, crypto par crypto.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block sm:col-span-2">
            <span class="text-sm font-semibold"
              >Somme investie en euros, frais d'achat compris</span
            >
            <input
              v-model="invested"
              inputmode="decimal"
              placeholder="5 000"
              class="input numeric mt-2"
            />
            <span class="mt-1.5 block text-xs text-muted">
              Si vous avez déjà vendu, reprenez la ligne 223 de votre dernier formulaire 2086.
            </span>
          </label>
          <label class="block">
            <span class="text-sm font-semibold">Valeur actuelle de toutes vos cryptos</span>
            <input
              v-model="portfolioValue"
              inputmode="decimal"
              placeholder="8 000"
              class="input numeric mt-2"
            />
          </label>
          <label class="block">
            <span class="text-sm font-semibold">Montant à vendre</span>
            <input
              v-model="saleAmount"
              inputmode="decimal"
              placeholder="2 000"
              class="input numeric mt-2"
            />
          </label>
          <label class="block">
            <span class="text-sm font-semibold">Frais de vente</span>
            <input v-model="fee" inputmode="decimal" placeholder="0" class="input numeric mt-2" />
          </label>
        </div>
      </template>
    </form>

    <div
      class="glass-strong rounded-card p-6 sm:p-8 lg:sticky lg:top-24 lg:self-start"
      aria-live="polite"
    >
      <p v-if="'hint' in outcome" class="text-muted">{{ outcome.hint }}</p>
      <p v-else-if="'error' in outcome" class="text-loss">{{ outcome.error }}</p>
      <template v-else>
        <dl class="space-y-4">
          <div>
            <dt class="text-sm text-muted">Plus ou moins-value de cette vente</dt>
            <dd
              class="numeric headline mt-1 text-4xl sm:text-5xl"
              :class="outcome.simulation.disposal.gain.lt(0) ? 'text-loss' : 'text-gain'"
            >
              {{ formatSignedEuros(outcome.simulation.disposal.gain) }}
            </dd>
          </div>
          <div class="grid grid-cols-2 gap-4 border-t border-separator pt-5">
            <div>
              <dt class="text-sm text-muted">Impôt supplémentaire</dt>
              <dd class="numeric mt-0.5 text-xl font-semibold tracking-tight">
                {{ outcome.simulation.extraTax ? formatEuros(outcome.simulation.extraTax) : '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Il vous resterait</dt>
              <dd class="numeric mt-0.5 text-xl font-semibold tracking-tight">
                {{
                  outcome.simulation.netProceeds ? formatEuros(outcome.simulation.netProceeds) : '—'
                }}
              </dd>
            </div>
          </div>
        </dl>
        <p
          v-if="crossesThreshold"
          class="mt-5 flex gap-3 rounded-control bg-warning-tint px-4 py-3 text-sm text-warning"
        >
          <AppIcon name="alert" class="mt-0.5 size-4" />
          <span>
            Cette vente ferait dépasser {{ EXEMPTION_THRESHOLD }} € de ventes dans l'année : vos
            ventes précédentes, jusque-là exonérées, deviendraient imposables elles aussi.
          </span>
        </p>
        <p class="mt-4 text-sm text-muted">
          Sur l'année {{ outcome.simulation.yearAfter.year }}, vos ventes totaliseraient
          <span class="numeric font-semibold text-label">{{
            formatEuros(outcome.simulation.yearAfter.totalPrice)
          }}</span
          >, pour une plus ou moins-value nette de
          <span class="numeric font-semibold text-label">{{
            formatSignedEuros(outcome.simulation.yearAfter.netGain)
          }}</span
          >.
        </p>
      </template>
      <p class="mt-6 border-t border-separator pt-4 text-xs text-muted">
        <template v-if="rulesNow">
          Estimation au prélèvement forfaitaire des revenus {{ rulesNow.year }} :
          {{ formatPercent(flatRate(rulesNow)) }}, soit
          {{ formatPercent(rulesNow.flatIncomeTax) }} d'impôt et
          {{ formatPercent(rulesNow.socialContributions) }} de prélèvements sociaux, sans l'option
          pour le barème progressif.
        </template>
        <template v-else>
          Les taux de l'année en cours ne sont pas encore connus : l'impôt n'est pas estimé.
        </template>
        Simulation indicative : ce n'est ni un conseil fiscal ni un conseil d'investissement.
      </p>
    </div>
  </div>
</template>
