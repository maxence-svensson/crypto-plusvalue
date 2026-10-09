<script setup lang="ts">
/** Titre de page : un h1 et, si besoin, une phrase d'explication. */
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header class="mb-8">
    <h1 class="headline text-4xl sm:text-5xl">{{ title }}</h1>
    <p v-if="description" class="mt-3 max-w-prose text-lg text-pretty text-muted">
      {{ description }}
    </p>
  </header>
</template>
