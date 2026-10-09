<script setup lang="ts">
/**
 * Journal des corrections faites à la main, de la plus récente à la plus ancienne. Il garde la
 * trace de ce qui diffère des exports et permet de revenir en arrière.
 */
const store = usePortfolioStore()
const entries = computed(() => [...store.corrections].reverse())
</script>

<template>
  <details v-if="entries.length > 0" class="disclosure solid-card overflow-hidden rounded-card">
    <summary>Journal des corrections ({{ entries.length }})</summary>
    <div class="space-y-4 border-t border-separator px-5 py-4 sm:px-6">
      <p class="max-w-prose text-sm text-muted">
        Ce que vous avez ajouté, modifié ou supprimé par rapport à vos exports. Les annulations se
        font de la plus récente à la plus ancienne.
      </p>
      <ol class="space-y-2 text-sm">
        <li
          v-for="(correction, index) in entries"
          :key="correction.at.getTime() + correction.kind + index"
          class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
        >
          <span>{{ describeCorrection(correction) }}</span>
          <span class="numeric text-muted">{{ formatDateTime(correction.at) }}</span>
        </li>
      </ol>
      <button type="button" class="btn btn-secondary btn-sm" @click="store.undoCorrection()">
        <AppIcon name="undo" />
        Annuler la dernière correction
      </button>
    </div>
  </details>
</template>
