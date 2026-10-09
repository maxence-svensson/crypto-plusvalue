<script setup lang="ts">
import { Dec } from '#shared/tax/decimal'
import { compareRegimes, MARGINAL_RATES, type RegimeCost } from '#shared/tax/regime'

const props = defineProps<{
  /** Plus-value nette imposable de l'année (ligne 224), positive. */
  gain: Dec
  year: number
}>()

const UNKNOWN = 'inconnue'
const PARTS = ['1', '1,5', '2', '2,5', '3', '3,5', '4', '4,5', '5']

const choice = ref('')
const income = ref('')
const parts = ref('1')

const comparison = computed(() => {
  if (choice.value === '') return undefined
  if (choice.value !== UNKNOWN) return compareRegimes(props.gain, { rate: new Dec(choice.value) })
  const taxableIncome = parseAmount(income.value)
  if (!taxableIncome) return undefined
  return compareRegimes(props.gain, {
    taxableIncome,
    parts: new Dec(parts.value.replace(',', '.')),
  })
})

const percent = (rate: Dec) => `${rate.times(100).toNumber().toLocaleString('fr-FR')} %`

const columns = computed(() => {
  if (!comparison.value) return []
  const { flat, progressive, better } = comparison.value
  const column = (key: 'flat' | 'progressive', title: string, cost: RegimeCost, rate: string) => ({
    key,
    title,
    rate,
    cost,
    best: better === key,
  })
  return [
    column('flat', 'Prélèvement forfaitaire', flat, 'impôt à 12,8 %'),
    column(
      'progressive',
      'Barème progressif',
      progressive,
      `tranche à ${percent(comparison.value.marginalRate)}`,
    ),
  ]
})
</script>

<template>
  <div class="glass space-y-6 rounded-card p-6 sm:p-8">
    <div>
      <h3 class="headline text-2xl">Prélèvement forfaitaire ou barème ?</h3>
      <p class="mt-2 max-w-prose text-muted">
        Par défaut, vos plus-values crypto sont taxées à 31,4 % : 12,8 % d'impôt et 18,6 % de
        prélèvements sociaux. En cochant la case 3CN, vous pouvez choisir le barème progressif : la
        plus-value s'ajoute alors à vos autres revenus.
      </p>
    </div>

    <fieldset>
      <legend class="text-sm font-semibold">Votre tranche marginale d'imposition</legend>
      <div class="segmented mt-3">
        <label
          v-for="option in [...MARGINAL_RATES.map((rate) => rate.toString()), UNKNOWN]"
          :key="option"
        >
          <input v-model="choice" type="radio" name="tranche" :value="option" class="sr-only" />
          {{ option === UNKNOWN ? 'Je ne sais pas' : percent(new Dec(option)) }}
        </label>
      </div>
    </fieldset>

    <Transition name="popover">
      <div v-if="choice === UNKNOWN" class="grid max-w-xl gap-4 sm:grid-cols-[1fr_auto]">
        <label class="block">
          <span class="text-sm font-semibold"
            >Revenu imposable du foyer en {{ year }}, hors crypto</span
          >
          <input
            v-model="income"
            inputmode="decimal"
            placeholder="35 000"
            class="input numeric mt-2"
          />
          <span class="mt-1.5 block text-xs text-muted">
            La ligne « revenu imposable » de votre dernier avis d'impôt donne un ordre d'idée.
          </span>
        </label>
        <label class="block">
          <span class="text-sm font-semibold">Nombre de parts</span>
          <select v-model="parts" class="input numeric mt-2 sm:w-32">
            <option v-for="option in PARTS" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
      </div>
    </Transition>

    <template v-if="comparison">
      <div class="grid gap-4 sm:grid-cols-2">
        <div
          v-for="column in columns"
          :key="column.key"
          class="solid-card rounded-[22px] p-5 transition-shadow duration-300 ease-ios"
          :class="column.best ? 'ring-2 ring-accent' : ''"
        >
          <p class="flex items-center justify-between gap-3">
            <span class="font-semibold">{{ column.title }}</span>
            <span
              v-if="column.best"
              class="shrink-0 rounded-full bg-success-tint px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-gain"
              >Le moins cher</span
            >
          </p>
          <p class="text-sm text-muted">{{ column.rate }}</p>
          <dl class="numeric mt-4 space-y-1.5 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Impôt sur le revenu</dt>
              <dd>{{ formatEuros(column.cost.incomeTax) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Prélèvements sociaux</dt>
              <dd>{{ formatEuros(column.cost.socialContributions) }}</dd>
            </div>
            <div
              class="flex justify-between gap-4 border-t border-separator pt-2.5 text-base font-semibold"
            >
              <dt>Total</dt>
              <dd>{{ formatEuros(column.cost.total) }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p class="text-base" role="status">
        <template v-if="comparison.better === 'progressive'">
          <span class="font-semibold">
            Cochez la case <span class="highlighter rounded-md px-1.5">3CN</span> de la déclaration
            2042 C
          </span>
          : le barème vous fait économiser {{ formatEuros(comparison.difference) }}.
        </template>
        <template v-else-if="comparison.better === 'flat'">
          <span class="font-semibold">Ne cochez pas la case 3CN</span> : le prélèvement forfaitaire
          vous coûte {{ formatEuros(comparison.difference) }} de moins.
        </template>
        <template v-else>
          Les deux régimes reviennent au même : inutile de cocher la case 3CN.
        </template>
      </p>

      <ul class="max-w-prose list-disc space-y-1 pl-5 text-xs text-muted">
        <li>
          Au barème, 6,8 % de CSG sont déductibles des revenus de l'année suivante : environ
          {{ formatEuros(comparison.progressive.deductibleCsgSaving) }} d'impôt en moins, à tranche
          égale. Ce gain n'est pas compté dans les totaux ci-dessus.
        </li>
        <li>
          L'option vaut pour toutes les plus-values crypto du foyer de l'année, et ne change rien à
          vos autres placements (case 2OP).
        </li>
        <li>
          Calcul sans décote, plafonnement du quotient familial ni réductions d'impôt, avec le
          barème des revenus 2025<template v-if="year !== 2025">
            (celui des revenus {{ year }} n'est pas encore connu)</template
          >.
        </li>
      </ul>
    </template>
  </div>
</template>
