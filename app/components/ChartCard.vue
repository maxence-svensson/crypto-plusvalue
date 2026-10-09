<script setup lang="ts">
/**
 * Carte d'un graphique : titre, phrase d'explication, légende, et bascule vers la vue tableau,
 * l'équivalent complet du graphique pour qui ne le voit pas ou veut les chiffres exacts.
 */
defineProps<{ title: string; description?: string; table?: boolean }>()
const showTable = ref(false)
const id = useId()
</script>

<template>
  <figure class="solid-card min-w-0 rounded-card p-5 sm:p-6" :aria-labelledby="id">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <figcaption class="min-w-0">
        <h3 :id="id" class="font-semibold tracking-tight">{{ title }}</h3>
        <p v-if="description" class="mt-1 max-w-prose text-sm text-muted">{{ description }}</p>
      </figcaption>
      <button
        v-if="table"
        type="button"
        class="btn btn-ghost btn-sm shrink-0"
        :aria-pressed="showTable"
        @click="showTable = !showTable"
      >
        {{ showTable ? 'Voir le graphique' : 'Voir le tableau' }}
      </button>
    </div>
    <div v-if="$slots.legend && !showTable" class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
      <slot name="legend" />
    </div>
    <div class="mt-5">
      <slot v-if="showTable" name="table" />
      <slot v-else />
    </div>
  </figure>
</template>
