<script setup lang="ts">
import { startOfMinute } from '#shared/prices'
import { simulateSale, simulateSimpleSale, type SaleSimulation } from '#shared/simulation/sale'
import { Dec } from '#shared/tax/decimal'
import { EXEMPTION_THRESHOLD } from '#shared/tax/form2086'

const store = usePortfolioStore()

const holdings = computed(() => [...store.replay.holdings].sort(([a], [b]) => a.localeCompare(b)))
const fromHistory = computed(() => holdings.value.length > 0)

/** Nombre saisi à la française ou à l'anglaise ; vide ou invalide : rien. */
function parse(text: string): Dec | undefined {
  const cleaned = text.replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.')
  if (cleaned === '') return undefined
  try {
    const value = new Dec(cleaned)
    return value.isNegative() ? undefined : value
  } catch {
    return undefined
  }
}

// Avec l'historique importé : une crypto détenue, une quantité, les cours du moment.
const asset = ref('')
const quantity = ref('')
const unitPrice = ref('')
const fee = ref('')
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
  unitPrice.value = marketPriceInput()
})

function sellAll() {
  if (held.value) quantity.value = held.value.toString().replace('.', ',')
}

// Sans historique : trois montants suffisent.
const invested = ref('')
const portfolioValue = ref('')
const saleAmount = ref('')

type Outcome = { simulation: SaleSimulation } | { hint: string } | { error: string }

const outcome = computed<Outcome>(() => {
  const fees = parse(fee.value) ?? new Dec(0)

  if (fromHistory.value) {
    const amount = parse(quantity.value)
    const price = parse(unitPrice.value)
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

  const cost = parse(invested.value)
  const value = parse(portfolioValue.value)
  const sale = parse(saleAmount.value)
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
  <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
    <form class="space-y-5" @submit.prevent>
      <template v-if="fromHistory">
        <p class="max-w-prose text-sm text-ink-soft">
          Le calcul part de vos fichiers importés : ce qu'il reste de vos prix d'achat, et vos
          ventes déjà faites cette année.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-sm font-semibold">Crypto à vendre</span>
            <select
              v-model="asset"
              class="mt-1 block w-full rounded-[4px] border-[1.5px] border-ink bg-paper px-3 py-2"
            >
              <option v-for="[symbol, amount] in holdings" :key="symbol" :value="symbol">
                {{ symbol }} ({{ formatQuantity(amount) }} détenus)
              </option>
            </select>
          </label>
          <label class="block">
            <span class="flex items-baseline justify-between text-sm font-semibold">
              Quantité
              <button
                type="button"
                class="text-xs font-normal text-ink-soft underline underline-offset-4 hover:text-ink"
                @click="sellAll"
              >
                Tout vendre
              </button>
            </span>
            <input
              v-model="quantity"
              inputmode="decimal"
              placeholder="0,5"
              class="numeric mt-1 block w-full rounded-[4px] border-[1.5px] border-ink bg-paper px-3 py-2"
            />
          </label>
          <label class="block">
            <span class="text-sm font-semibold">Cours de vente, en euros</span>
            <input
              v-model="unitPrice"
              inputmode="decimal"
              class="numeric mt-1 block w-full rounded-[4px] border-[1.5px] border-ink bg-paper px-3 py-2"
            />
            <span class="mt-1 block text-xs text-ink-soft">
              {{
                marketPrice
                  ? `Cours d'il y a 2 minutes, ${marketPrice.source}.`
                  : store.fetchingPrices
                    ? 'Récupération du cours…'
                    : 'Cours du moment introuvable : saisissez-le.'
              }}
              <button
                type="button"
                class="underline underline-offset-4 hover:text-ink"
                @click="refreshPrices"
              >
                Actualiser
              </button>
            </span>
          </label>
          <label class="block">
            <span class="text-sm font-semibold">Frais de vente, en euros</span>
            <input
              v-model="fee"
              inputmode="decimal"
              placeholder="0"
              class="numeric mt-1 block w-full rounded-[4px] border-[1.5px] border-ink bg-paper px-3 py-2"
            />
          </label>
        </div>
      </template>

      <template v-else>
        <p class="max-w-prose text-sm text-ink-soft">
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
              class="numeric mt-1 block w-full rounded-[4px] border-[1.5px] border-ink bg-paper px-3 py-2"
            />
            <span class="mt-1 block text-xs text-ink-soft">
              Si vous avez déjà vendu, reprenez la ligne 223 de votre dernier formulaire 2086.
            </span>
          </label>
          <label class="block">
            <span class="text-sm font-semibold">Valeur actuelle de toutes vos cryptos</span>
            <input
              v-model="portfolioValue"
              inputmode="decimal"
              placeholder="8 000"
              class="numeric mt-1 block w-full rounded-[4px] border-[1.5px] border-ink bg-paper px-3 py-2"
            />
          </label>
          <label class="block">
            <span class="text-sm font-semibold">Montant à vendre</span>
            <input
              v-model="saleAmount"
              inputmode="decimal"
              placeholder="2 000"
              class="numeric mt-1 block w-full rounded-[4px] border-[1.5px] border-ink bg-paper px-3 py-2"
            />
          </label>
          <label class="block">
            <span class="text-sm font-semibold">Frais de vente</span>
            <input
              v-model="fee"
              inputmode="decimal"
              placeholder="0"
              class="numeric mt-1 block w-full rounded-[4px] border-[1.5px] border-ink bg-paper px-3 py-2"
            />
          </label>
        </div>
      </template>
    </form>

    <div class="rounded-md bg-field p-6 sm:p-8" aria-live="polite">
      <p v-if="'hint' in outcome" class="text-ink-soft">{{ outcome.hint }}</p>
      <p v-else-if="'error' in outcome" class="text-loss">{{ outcome.error }}</p>
      <template v-else>
        <dl class="space-y-4">
          <div>
            <dt class="text-sm text-ink-soft">Plus ou moins-value de cette vente</dt>
            <dd
              class="numeric display text-3xl"
              :class="outcome.simulation.disposal.gain.lt(0) ? 'text-loss' : 'text-gain'"
            >
              {{ formatSignedEuros(outcome.simulation.disposal.gain) }}
            </dd>
          </div>
          <div class="grid grid-cols-2 gap-4 border-t border-rule pt-4">
            <div>
              <dt class="text-sm text-ink-soft">Impôt supplémentaire</dt>
              <dd class="numeric text-xl font-semibold">
                {{ formatEuros(outcome.simulation.extraTax) }}
              </dd>
            </div>
            <div>
              <dt class="text-sm text-ink-soft">Il vous resterait</dt>
              <dd class="numeric text-xl font-semibold">
                {{ formatEuros(outcome.simulation.netProceeds) }}
              </dd>
            </div>
          </div>
        </dl>
        <p
          v-if="crossesThreshold"
          class="mt-4 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning"
        >
          Cette vente ferait dépasser {{ EXEMPTION_THRESHOLD }} € de ventes dans l'année : vos
          ventes précédentes, jusque-là exonérées, deviendraient imposables elles aussi.
        </p>
        <p class="mt-4 text-sm text-ink-soft">
          Sur l'année {{ outcome.simulation.yearAfter.year }}, vos ventes totaliseraient
          <span class="numeric font-semibold text-ink">{{
            formatEuros(outcome.simulation.yearAfter.totalPrice)
          }}</span
          >, pour une plus ou moins-value nette de
          <span class="numeric font-semibold text-ink">{{
            formatSignedEuros(outcome.simulation.yearAfter.netGain)
          }}</span
          >.
        </p>
      </template>
      <p class="mt-6 border-t border-rule pt-4 text-xs text-ink-soft">
        Estimation au prélèvement forfaitaire de 31,4 % (12,8 % d'impôt et 18,6 % de prélèvements
        sociaux), sans l'option pour le barème progressif. Simulation indicative : ce n'est ni un
        conseil fiscal ni un conseil d'investissement.
      </p>
    </div>
  </div>
</template>
