<script setup lang="ts">
const store = usePortfolioStore()
useHead({ title: 'Fiscalité' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Fiscalité"
      description="Les montants à déclarer, année par année : case 3AN, formulaire 2086 rempli et dossier justificatif."
    />
    <EmptyState
      v-if="store.transactions.length === 0"
      title="Aucune vente à déclarer pour l’instant"
      text="Importez vos historiques : chaque vente est calculée selon la méthode du formulaire 2086."
    />
    <template v-else>
      <TaxResult />
      <PricesPanel />
    </template>
  </div>
</template>
