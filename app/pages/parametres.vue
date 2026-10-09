<script setup lang="ts">
import type { Theme } from '~/composables/theme'

useHead({ title: 'Paramètres' })
const store = usePortfolioStore()
const { theme, load, apply } = useTheme()
onMounted(load)

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

const confirmClear = ref<{ open: () => void }>()
const cleared = ref(false)

async function clearAll() {
  await store.clearAll()
  apply('system')
  cleared.value = true
}
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Paramètres"
      description="Apparence, conservation de vos données dans ce navigateur, et ce qui transite par le réseau."
    />

    <section aria-labelledby="apparence" class="glass space-y-4 rounded-card p-5 sm:p-6">
      <h2 id="apparence" class="text-lg font-semibold tracking-tight">Apparence</h2>
      <fieldset>
        <legend class="text-sm text-muted">Thème de l’interface</legend>
        <div class="segmented mt-3">
          <label v-for="option in THEMES" :key="option.value">
            <input
              type="radio"
              name="theme"
              class="sr-only"
              :value="option.value"
              :checked="theme === option.value"
              @change="apply(option.value)"
            />
            {{ option.label }}
          </label>
        </div>
      </fieldset>
    </section>

    <section aria-labelledby="donnees" class="glass space-y-5 rounded-card p-5 sm:p-6">
      <h2 id="donnees" class="text-lg font-semibold tracking-tight">
        Vos données sur cet appareil
      </h2>
      <div class="flex items-start justify-between gap-6">
        <label for="conserver" class="cursor-pointer">
          <span class="block font-semibold">Conserver mes données dans ce navigateur</span>
          <span class="mt-1 block max-w-prose text-sm text-muted">
            Opérations, cours et fichiers importés sont enregistrés sur cet appareil (IndexedDB)
            pour les retrouver à la prochaine visite. Rien n’est envoyé ailleurs. Sur un ordinateur
            partagé, désactivez cette option.
          </span>
        </label>
        <input
          id="conserver"
          type="checkbox"
          role="switch"
          class="switch mt-1"
          :checked="store.keep"
          @change="store.setKeep(($event.target as HTMLInputElement).checked)"
        />
      </div>
      <p class="text-sm text-muted" role="status">
        <template v-if="store.demo"
          >Mode démonstration : les données fictives ne sont pas enregistrées.</template
        >
        <template v-else-if="!store.keep"
          >Rien n’est enregistré : tout disparaît en fermant la page.</template
        >
        <template v-else-if="store.savedAt">
          Enregistré le {{ formatDateTime(store.savedAt) }} :
          {{ store.transactions.length }} opérations, {{ store.files.length }}
          {{ store.files.length > 1 ? 'fichiers' : 'fichier' }}.
        </template>
        <template v-else>Rien d’enregistré pour l’instant.</template>
      </p>
      <p v-if="store.storageError" class="text-sm text-loss" role="alert">
        {{ store.storageError }}
      </p>
      <div class="flex flex-wrap items-center gap-3 border-t border-separator pt-5">
        <button type="button" class="btn btn-danger" @click="confirmClear?.open()">
          <AppIcon name="trash" />
          Tout effacer
        </button>
        <p v-if="cleared" class="text-sm text-gain" role="status">
          Tout a été effacé de ce navigateur.
        </p>
      </div>
      <ConfirmDialog
        ref="confirmClear"
        title="Tout effacer ?"
        text="Les opérations importées, les cours, les fichiers et vos préférences seront effacés de ce navigateur. Vos fichiers d’origine ne sont pas touchés : vous pourrez les réimporter."
        confirm="Tout effacer"
        @confirm="clearAll"
      />
    </section>

    <BackupPanel />

    <section aria-labelledby="confidentialite" class="glass space-y-3 rounded-card p-5 sm:p-6">
      <h2 id="confidentialite" class="text-lg font-semibold tracking-tight">
        Ce qui transite par le réseau
      </h2>
      <ul class="max-w-prose list-disc space-y-2 pl-5 text-sm text-muted">
        <li>
          Vos fichiers sont lus dans ce navigateur. Ils ne sont jamais envoyés, et les PDF sont
          produits sur place.
        </li>
        <li>
          Pour la valeur du portefeuille, le site demande des cours à son serveur : un symbole et
          une minute (« BTC, 14/08/2025 15:05 »), jamais une quantité ni un montant. Le serveur les
          obtient de Binance ou de Coinbase Exchange.
        </li>
        <li>
          Aucun outil de mesure d’audience, aucun cookie, aucun compte. Comme tout site, l’hébergeur
          (Vercel) journalise les requêtes reçues.
        </li>
      </ul>
      <a
        :href="REPOSITORY + '/blob/main/SECURITY.md'"
        class="inline-flex text-sm font-medium text-link hover:underline"
      >
        Sécurité et confidentialité, en détail
      </a>
    </section>
  </div>
</template>
