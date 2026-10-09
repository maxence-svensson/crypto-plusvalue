<script setup lang="ts">
import type { Dec } from '#shared/tax/decimal'
import type { DisposalResult } from '#shared/tax/form2086'

defineProps<{ disposals: DisposalResult[] }>()

/** Les lignes d'une colonne « Cession » du formulaire, dans l'ordre du formulaire. */
const LINES: { line: string; label: string; value: (disposal: DisposalResult) => Dec }[] = [
  { line: '212', label: 'Valeur globale du portefeuille', value: (d) => d.portfolioValue },
  { line: '213', label: 'Prix de cession', value: (d) => d.price },
  { line: '214', label: 'Frais de cession', value: (d) => d.fees },
  { line: '215', label: 'Prix de cession net des frais', value: (d) => d.priceNetOfFees },
  { line: '216', label: 'Soulte reçue ou versée', value: (d) => d.balancingPayment },
  { line: '217', label: 'Prix de cession net des soultes', value: (d) => d.priceNetOfBalancing },
  { line: '218', label: 'Prix de cession net des frais et soultes', value: (d) => d.netPrice },
  { line: '220', label: "Prix total d'acquisition", value: (d) => d.totalAcquisitionCost },
  { line: '221', label: 'Fractions de capital initial', value: (d) => d.initialCapitalFractions },
  {
    line: '222',
    label: "Soultes reçues lors d'échanges antérieurs",
    value: (d) => d.receivedBalancingPayments,
  },
  { line: '223', label: "Prix total d'acquisition net", value: (d) => d.netAcquisitionCost },
]
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full border-separate border-spacing-y-1 text-sm">
      <caption class="sr-only">
        Formulaire 2086 : une colonne par cession de l'année
      </caption>
      <thead>
        <tr class="text-muted">
          <th scope="col" class="sticky left-0 bg-elevated py-2 pr-4 text-left font-medium">
            Ligne
          </th>
          <th
            v-for="(disposal, index) in disposals"
            :key="disposal.id"
            scope="col"
            class="px-1 py-2 text-right font-semibold whitespace-nowrap text-label"
          >
            Cession {{ index + 1 }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" class="sticky left-0 bg-elevated py-1 pr-4 text-left font-normal">
            <span
              class="numeric mr-3 inline-block w-11 rounded-lg bg-field py-0.5 text-center text-xs font-semibold text-muted"
              >211</span
            >Date de la cession
          </th>
          <td v-for="disposal in disposals" :key="disposal.id" class="px-1">
            <span
              class="numeric block rounded-[10px] bg-field px-3 py-2 text-right whitespace-nowrap"
            >
              {{ formatDay(disposal.date) }}
            </span>
          </td>
        </tr>
        <tr v-for="row in LINES" :key="row.line">
          <th
            scope="row"
            class="sticky left-0 min-w-64 bg-elevated py-1 pr-4 text-left font-normal"
          >
            <span
              class="numeric mr-3 inline-block w-11 rounded-lg bg-field py-0.5 text-center text-xs font-semibold text-muted"
              >{{ row.line }}</span
            >{{ row.label }}
          </th>
          <td v-for="disposal in disposals" :key="disposal.id" class="px-1">
            <span
              class="numeric block rounded-[10px] bg-field px-3 py-2 text-right whitespace-nowrap"
            >
              {{ formatEuros(row.value(disposal)) }}
            </span>
          </td>
        </tr>
        <tr>
          <th scope="row" class="sticky left-0 bg-elevated pt-4 pr-4 text-left font-semibold">
            Plus ou moins-value de la cession
          </th>
          <td
            v-for="disposal in disposals"
            :key="disposal.id"
            class="numeric px-4 pt-4 text-right text-base font-semibold whitespace-nowrap"
            :class="disposal.gain.lt(0) ? 'text-loss' : 'text-gain'"
          >
            {{ formatSignedEuros(disposal.gain) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
