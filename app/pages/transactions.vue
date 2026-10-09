<script setup lang="ts">
const store = usePortfolioStore()
useHead({ title: 'Transactions' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Transactions"
      description="Toutes les opérations crypto importées, de la plus récente à la plus ancienne."
    />
    <EmptyState
      v-if="store.transactions.length === 0"
      title="Aucune opération pour l’instant"
      text="Importez l’export de vos plateformes pour retrouver ici chaque achat, vente, échange et transfert."
    />
    <template v-else>
      <MissingHistoryAlert />
      <TransactionsTable />
    </template>
  </div>
</template>
