<script setup lang="ts">
/** Rappel permanent du mode démonstration : les données affichées sont fictives. */
const store = usePortfolioStore()
</script>

<template>
  <div
    v-if="store.demo"
    class="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-card bg-warning-tint px-5 py-4 text-sm"
    role="status"
  >
    <p>
      <span class="font-semibold text-warning">Mode démonstration.</span>
      Ces données sont fictives : un plan d'épargne Trade Republic de 2025.
    </p>
    <button type="button" class="btn btn-secondary btn-sm" @click="store.exitDemo()">
      Quitter la démonstration
    </button>
  </div>
</template>
