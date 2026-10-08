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
  }>(),
  { cells: 5, size: 'lg' },
)

const digits = computed(() => {
  const text = String(Math.abs(Math.round(props.value)))
  return [...text.padStart(Math.max(props.cells, text.length), ' ')]
})

const SWEEP_END_MS = 1150
const STEP_MS = 110
</script>

<template>
  <div
    class="flex items-center gap-3"
    role="img"
    :aria-label="`Case ${code} : ${formatWholeEuros(value)}`"
  >
    <span
      class="display rounded-[3px] bg-ink px-2 py-1 text-paper"
      :class="size === 'lg' ? 'text-base' : 'text-sm'"
      aria-hidden="true"
    >
      {{ code }}
    </span>
    <!-- La clé rejoue l'animation quand le montant change. -->
    <div :key="value" class="highlighter flex px-1.5" aria-hidden="true">
      <span
        v-for="(digit, index) in digits"
        :key="index"
        class="numeric flex items-center justify-center border-y-[1.5px] border-r-[1.5px] border-ink font-semibold first:rounded-l-[4px] first:border-l-[1.5px] last:rounded-r-[4px]"
        :class="size === 'lg' ? 'h-14 w-10 text-3xl' : 'h-11 w-8 text-2xl'"
      >
        <span
          v-if="digit !== ' '"
          class="ink-in"
          :style="{ animation: `ink-in 160ms ${SWEEP_END_MS + index * STEP_MS}ms both` }"
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
