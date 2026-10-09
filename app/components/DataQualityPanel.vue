<script setup lang="ts">
import type { QualityLevel, Severity } from '#shared/portfolio/quality'

/**
 * Diagnostic des données : niveau de complétude de l'historique et points à régler. C'est une
 * aide à la vérification, pas une garantie de conformité fiscale.
 */
const store = usePortfolioStore()

const LEVELS: Record<QualityLevel, { label: string; text: string; tone: string }> = {
  complet: {
    label: 'Complet',
    text: 'Rien ne manque dans ce que l’application sait vérifier.',
    tone: 'bg-success-tint text-gain',
  },
  'à vérifier': {
    label: 'À vérifier',
    text: 'Le calcul est possible, mais certains points peuvent le fausser.',
    tone: 'bg-warning-tint text-warning',
  },
  incomplet: {
    label: 'Incomplet',
    text: 'Il manque des données : le résultat est provisoire.',
    tone: 'bg-warning-tint text-loss',
  },
}

const ICONS: Record<Severity, 'alert' | 'info'> = {
  bloquant: 'alert',
  'à vérifier': 'alert',
  information: 'info',
}
const TONES: Record<Severity, string> = {
  bloquant: 'text-loss',
  'à vérifier': 'text-warning',
  information: 'text-link',
}
</script>

<template>
  <section aria-labelledby="diagnostic" class="glass space-y-4 rounded-card p-5 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="diagnostic" class="text-lg font-semibold tracking-tight">Diagnostic des données</h2>
      <span
        class="rounded-full px-3 py-1 text-sm font-semibold"
        :class="LEVELS[store.quality.level].tone"
      >
        {{ LEVELS[store.quality.level].label }}
      </span>
    </div>
    <p class="text-sm text-muted">
      {{ LEVELS[store.quality.level].text }} Ce niveau mesure la complétude de votre historique ; ce
      n’est pas une garantie de conformité fiscale.
    </p>
    <ul v-if="store.quality.issues.length > 0" class="space-y-3">
      <li v-for="issue in store.quality.issues" :key="issue.id" class="flex gap-3 text-sm">
        <AppIcon :name="ICONS[issue.severity]" class="mt-0.5" :class="TONES[issue.severity]" />
        <div>
          <p class="font-semibold">
            {{ issue.title }}
            <span class="font-normal text-muted">({{ issue.severity }})</span>
          </p>
          <p class="mt-0.5 max-w-prose text-muted">{{ issue.detail }}</p>
        </div>
      </li>
    </ul>
    <NuxtLink
      v-if="store.problems.size > 0"
      to="/transactions?a-verifier"
      class="inline-flex text-sm font-medium text-link hover:underline"
    >
      Voir les {{ plural(store.problems.size, 'opération concernée', 'opérations concernées') }}
    </NuxtLink>
  </section>
</template>
