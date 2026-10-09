<script setup lang="ts">
/** Titre d'une étape du calcul : importer, vérifier, recopier. */
defineProps<{ id: string; step: number }>()
</script>

<template>
  <h2 :id="id" class="headline flex scroll-mt-28 items-center gap-4 text-3xl sm:text-4xl">
    <span
      class="numeric inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-base font-semibold tracking-normal text-link"
      aria-hidden="true"
      >{{ step }}</span
    >
    <span
      ><span class="sr-only">Étape {{ step }} : </span><slot
    /></span>
  </h2>
</template>
