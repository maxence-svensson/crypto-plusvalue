<script setup lang="ts">
/** Ventes et envois qui portent sur plus de cryptos que l'historique n'en contient. */
const store = usePortfolioStore()

const byId = computed(
  () => new Map(store.transactions.map((transaction) => [transaction.id, transaction])),
)

const missingHistory = computed(() =>
  store.replay.missingHistory.map((item) => ({
    ...item,
    transaction: byId.value.get(item.transactionId),
  })),
)
</script>

<template>
  <div
    v-if="missingHistory.length > 0"
    class="flex gap-4 rounded-card bg-warning-tint px-5 py-5 text-sm sm:px-6"
    role="alert"
  >
    <AppIcon name="alert" class="mt-0.5 text-warning" />
    <div>
      <p class="font-semibold text-warning">Historique incomplet</p>
      <p class="mt-1">
        Ces ventes portent sur plus de cryptos que vos fichiers n'en contiennent. Il manque des
        achats, sans doute faits sur une autre plateforme ou un portefeuille personnel : importez
        aussi leurs historiques, sinon le calcul sera faux.
      </p>
      <ul class="mt-2 list-disc space-y-1 pl-5">
        <li v-for="item in missingHistory" :key="item.transactionId + item.asset">
          {{ item.transaction ? formatDay(item.transaction.date) : '' }} : il manque
          <span class="numeric font-semibold">{{ formatQuantity(item.shortfall) }}</span>
          {{ item.asset }}
        </li>
      </ul>
    </div>
  </div>
</template>
