<script setup lang="ts">
useHead({ title: 'Simulateur' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Et si je vendais aujourd’hui ?"
      description="Estimez la plus-value et l’impôt d’une vente aux cours du moment, avant de la faire."
    />
    <SaleSimulator />
  </div>
</template>
