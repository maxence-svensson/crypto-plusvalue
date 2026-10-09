<script setup lang="ts">
/** Page qui a besoin de données : une invitation à importer, ou à essayer l'exemple. */
defineProps<{ title: string; text: string }>()
const store = usePortfolioStore()

/** L'exemple s'ouvre en haut de la page, sur le tableau de bord ou la section demandée. */
async function showExample() {
  await store.loadExample()
  window.scrollTo({ top: 0 })
}
</script>

<template>
  <div class="glass flex flex-col items-start gap-4 rounded-card p-6 sm:p-8">
    <span class="flex size-12 items-center justify-center rounded-control bg-accent-tint text-link">
      <AppIcon name="upload" class="size-6" />
    </span>
    <div>
      <p class="headline text-xl">{{ title }}</p>
      <p class="mt-2 max-w-prose text-muted">{{ text }}</p>
    </div>
    <div class="flex flex-wrap gap-3">
      <NuxtLink to="/plateformes" class="btn btn-primary">
        <AppIcon name="upload" />
        Importer mes historiques
      </NuxtLink>
      <button type="button" class="btn btn-secondary" @click="showExample">Voir un exemple</button>
    </div>
  </div>
</template>
