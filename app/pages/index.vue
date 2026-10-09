<script setup lang="ts">
const store = usePortfolioStore()
const hasData = computed(() => store.transactions.length > 0)
</script>

<template>
  <DashboardSummary v-if="hasData" />
  <OnboardingHero v-else />
</template>
