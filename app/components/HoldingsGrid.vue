<script setup lang="ts">
/** Quantités détenues aujourd'hui, crypto par crypto. */
const store = usePortfolioStore()

const holdings = computed(() => [...store.replay.holdings].sort(([a], [b]) => a.localeCompare(b)))
</script>

<template>
  <div>
    <h2 class="text-lg font-semibold tracking-tight">Ce que vous détenez aujourd'hui</h2>
    <p v-if="holdings.length === 0" class="mt-2 text-sm text-muted">Aucune crypto détenue.</p>
    <dl v-else class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div
        v-for="[asset, quantity] in holdings"
        :key="asset"
        class="solid-card rounded-[22px] px-5 py-4"
      >
        <dt class="text-sm font-medium text-muted">{{ asset }}</dt>
        <dd class="numeric mt-1 text-lg font-semibold tracking-tight">
          {{ formatQuantity(quantity) }}
        </dd>
      </div>
    </dl>
  </div>
</template>
