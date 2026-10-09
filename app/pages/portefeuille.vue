<script setup lang="ts">
const store = usePortfolioStore()
useHead({ title: 'Portefeuille' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Portefeuille"
      description="Les cryptos que vous détenez d’après vos historiques, toutes plateformes confondues."
    />
    <EmptyState
      v-if="store.transactions.length === 0"
      title="Rien à afficher pour l’instant"
      text="Importez vos historiques : le portefeuille est reconstitué opération par opération."
    />
    <HoldingsGrid v-else />
  </div>
</template>
