<script setup lang="ts">
/**
 * Case de déclaration « en peigne » : un chiffre par cellule, comme sur le formulaire papier.
 * Le surligneur passe, puis les chiffres s'inscrivent un à un (sauf si le système demande de
 * réduire les animations). Les lecteurs d'écran lisent simplement « Case 3AN : 331 € ».
 */
const props = withDefaults(
  defineProps<{
    code: string
    /** Montant en euros entiers. */
    value: number
    cells?: number
    size?: 'md' | 'lg'
    /** Attente avant le surligneur, en millisecondes : laisse finir une entrée de page. */
    delay?: number
  }>(),
  { cells: 5, size: 'lg', delay: 0 },
)

const digits = computed(() => {
  const text = String(Math.abs(Math.round(props.value)))
  return [...text.padStart(Math.max(props.cells, text.length), ' ')]
})

const SWEEP_START_MS = 300
const SWEEP_END_MS = 1150
const STEP_MS = 110
</script>

<template>
  <div
    class="flex items-center gap-2 sm:gap-3"
    role="img"
    :aria-label="`Case ${code} : ${formatWholeEuros(value)}`"
  >
    <span
      class="rounded-chip bg-label px-2.5 py-1.5 font-bold tracking-tight text-canvas"
      :class="size === 'lg' ? 'text-base' : 'text-sm'"
      aria-hidden="true"
    >
      {{ code }}
    </span>
    <!-- La clé rejoue l'animation quand le montant change. -->
    <div
      :key="value"
      class="highlighter flex gap-1 rounded-[14px] p-1.5"
      :style="{ animationDelay: `${delay + SWEEP_START_MS}ms` }"
      aria-hidden="true"
    >
      <span
        v-for="(digit, index) in digits"
        :key="index"
        class="numeric flex items-center justify-center rounded-[10px] bg-elevated font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-separator"
        :class="size === 'lg' ? 'h-14 w-8 text-3xl sm:w-10' : 'h-11 w-8 text-2xl'"
      >
        <span
          v-if="digit !== ' '"
          class="ink-in"
          :style="{ animation: `ink-in 260ms ${delay + SWEEP_END_MS + index * STEP_MS}ms both` }"
        >
          {{ digit }}
        </span>
      </span>
    </div>
    <span class="font-semibold" :class="size === 'lg' ? 'text-xl' : 'text-lg'" aria-hidden="true"
      >€</span
    >
  </div>
</template>
