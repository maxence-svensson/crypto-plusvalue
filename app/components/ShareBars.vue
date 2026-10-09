<script setup lang="ts">
/**
 * Barres horizontales d'une répartition, de la plus grande à la plus petite : chaque ligne écrit
 * son montant et sa part, la liste se lit donc sans le dessin.
 */
const props = defineProps<{
  shares: { key: string; label: string; value: number }[]
  /** Couleur CSS des barres : une seule série, une seule couleur. */
  color: string
}>()

const max = computed(() => Math.max(...props.shares.map(({ value }) => value), 0))
const total = computed(() => props.shares.reduce((sum, { value }) => sum + value, 0))
const percent = (value: number) =>
  `${Math.round((value / (total.value || 1)) * 100).toLocaleString('fr-FR')} %`
</script>

<template>
  <ul class="space-y-4 text-sm">
    <li v-for="share in shares" :key="share.key">
      <p class="flex items-baseline justify-between gap-3">
        <span class="truncate font-medium">{{ share.label }}</span>
        <span class="numeric whitespace-nowrap">
          {{ formatEuros(share.value) }}
          <span class="text-muted">({{ percent(share.value) }})</span>
        </span>
      </p>
      <span
        class="mt-1.5 block h-3 min-w-1 rounded-r-[4px]"
        :style="{ width: `${(share.value / (max || 1)) * 100}%`, background: color }"
      ></span>
    </li>
  </ul>
</template>
