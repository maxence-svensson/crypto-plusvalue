<script setup lang="ts">
/** Icône décorative : le texte voisin porte le sens (tracés dans app/utils/icons.ts). */
defineProps<{ name: IconName }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="size-5 shrink-0"
    aria-hidden="true"
  >
    <path v-for="path in ICONS[name]" :key="path" :d="path" />
  </svg>
</template>
