<script setup lang="ts">
/**
 * Mise en page de toutes les pages : barre de navigation en haut sur ordinateur, barre
 * d'onglets en bas sur téléphone. `?exemple` ouvre n'importe quelle page en mode démonstration ; sinon, les données
 * enregistrées dans ce navigateur sont relues, une fois la page affichée (avant, elles
 * différeraient de la page rendue par le serveur).
 */
const store = usePortfolioStore()
const route = useRoute()

onMounted(() => {
  if ('exemple' in route.query) {
    if (!store.demo) store.loadExample()
  } else {
    store.restore()
  }
})
</script>

<template>
  <div id="haut" class="relative min-h-screen overflow-x-clip">
    <div class="backdrop-glow pointer-events-none fixed inset-0 -z-10" aria-hidden="true"></div>

    <a
      href="#contenu"
      class="btn btn-primary sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
    >
      Aller au contenu
    </a>

    <AppTopBar />

    <main id="contenu" class="mx-auto max-w-[72rem] px-5 pt-6 pb-36 sm:px-8 lg:pt-10 lg:pb-16">
      <DemoBanner />
      <slot />
    </main>
    <AppFooter />

    <AppTabBar />
  </div>
</template>
