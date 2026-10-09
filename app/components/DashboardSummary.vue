<script setup lang="ts">
import { taxYear } from '#shared/tax/form2086'
import { flatTax } from '#shared/tax/rules'

/** Vue d'ensemble : ce qui a été importé, la situation fiscale de l'année, ce qui reste à faire. */
const store = usePortfolioStore()

const platforms = computed(
  () => new Set(store.files.flatMap((file) => ('error' in file ? [] : [file.platform]))).size,
)
const holdings = computed(() =>
  [...store.replay.holdings].filter(([, quantity]) => quantity.gt(0)).map(([asset]) => asset),
)

/** Dernière année avec des ventes, sinon la plus récente. */
const year = computed(() => {
  const state = store.computation
  if (state.status !== 'ready') return store.years[0]
  const withSales = state.disposals.map((disposal) => taxYear(disposal.date))
  return withSales.length > 0 ? Math.max(...withSales) : store.years[0]
})
const summary = computed(() => (year.value === undefined ? undefined : store.summary(year.value)))
const tax = computed(() => (summary.value ? flatTax(summary.value) : undefined))
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Tableau de bord"
      description="Vos historiques importés, la situation fiscale de l’année et ce qu’il reste à vérifier."
    />

    <dl class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="solid-card rounded-card p-5">
        <dt class="text-sm text-muted">Opérations importées</dt>
        <dd class="numeric headline mt-1 text-3xl">{{ store.transactions.length }}</dd>
        <dd class="mt-1 text-sm text-muted">
          {{ platforms }} {{ platforms > 1 ? 'plateformes' : 'plateforme' }}
        </dd>
      </div>
      <div class="solid-card rounded-card p-5">
        <dt class="text-sm text-muted">Cryptos détenues</dt>
        <dd class="numeric headline mt-1 text-3xl">{{ holdings.length }}</dd>
        <dd class="mt-1 truncate text-sm text-muted">{{ holdings.join(', ') || 'aucune' }}</dd>
      </div>
      <div class="solid-card rounded-card p-5">
        <dt class="text-sm text-muted">Plus ou moins-value nette {{ year }}</dt>
        <dd
          class="numeric headline mt-1 text-3xl"
          :class="summary && summary.netGain.lt(0) ? 'text-loss' : ''"
        >
          {{ summary ? formatSignedEuros(summary.netGain) : '—' }}
        </dd>
        <dd class="mt-1 text-sm text-muted">
          {{ summary ? `${summary.disposals.length} ventes imposables` : 'cours en attente' }}
        </dd>
      </div>
      <div class="solid-card rounded-card p-5">
        <dt class="text-sm text-muted">Impôt estimé {{ year }}</dt>
        <dd class="numeric headline mt-1 text-3xl">{{ tax ? formatEuros(tax) : '—' }}</dd>
        <dd class="mt-1 text-sm text-muted">au prélèvement forfaitaire</dd>
      </div>
    </dl>

    <DataQualityPanel />

    <div class="grid gap-4 md:grid-cols-2">
      <NuxtLink to="/fiscalite" class="glass lift flex items-center gap-4 rounded-card p-5">
        <span
          class="flex size-12 shrink-0 items-center justify-center rounded-control bg-accent-tint text-link"
        >
          <AppIcon name="landmark" class="size-6" />
        </span>
        <span>
          <span class="block font-semibold">Préparer la déclaration</span>
          <span class="block text-sm text-muted"
            >Case 3AN, formulaire 2086, dossier justificatif</span
          >
        </span>
      </NuxtLink>
      <NuxtLink to="/simulateur" class="glass lift flex items-center gap-4 rounded-card p-5">
        <span
          class="flex size-12 shrink-0 items-center justify-center rounded-control bg-accent-tint text-link"
        >
          <AppIcon name="calculator" class="size-6" />
        </span>
        <span>
          <span class="block font-semibold">Simuler une vente</span>
          <span class="block text-sm text-muted">Plus-value et impôt avant de vendre</span>
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
