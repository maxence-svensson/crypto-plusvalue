<script setup lang="ts">
import { PLATFORM_NAMES } from '#shared/importers/detect'

const store = usePortfolioStore()
const dragging = ref(false)
const busy = ref(false)

async function add(files: FileList | null | undefined) {
  if (!files || files.length === 0) return
  busy.value = true
  await store.importFiles(Array.from(files))
  busy.value = false
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  add(input.files)
  // Permet de choisir à nouveau le même fichier.
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  add(event.dataTransfer?.files)
}

async function loadExample() {
  busy.value = true
  const text = await $fetch<string>('/exemples/trade-republic.csv', { responseType: 'text' })
  await store.importFiles([{ name: 'Exemple fictif (Trade Republic)', text: async () => text }])
  busy.value = false
}
</script>

<template>
  <div class="space-y-4">
    <label
      class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
      :class="
        dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent'
      "
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input type="file" accept=".csv,text/csv" multiple class="sr-only" @change="onChange" />
      <span class="text-base font-medium">Déposez vos fichiers CSV ici</span>
      <span class="text-muted">
        ou
        <span class="font-medium text-accent underline underline-offset-2"
          >parcourez vos fichiers</span
        >
      </span>
      <span class="mt-3 max-w-md text-sm text-muted">
        Trade Republic : Profil → Relevés → Export de transactions. Coinbase : Relevés → Générer un
        relevé → CSV. Importez l'historique complet, depuis l'ouverture de chaque compte.
      </span>
    </label>

    <p class="text-sm text-muted">
      Pas de fichier sous la main ?
      <button
        type="button"
        class="font-medium text-accent underline underline-offset-2 hover:text-accent-strong disabled:opacity-60"
        :disabled="busy"
        @click="loadExample"
      >
        Essayer avec un exemple fictif
      </button>
    </p>

    <ul v-if="store.files.length > 0" class="space-y-2" aria-live="polite">
      <li
        v-for="(file, index) in store.files"
        :key="index"
        class="rounded-lg border border-line bg-surface px-4 py-3 text-sm"
      >
        <p class="font-medium break-all">{{ file.name }}</p>
        <p v-if="'error' in file" class="mt-1 text-loss">{{ file.error }}</p>
        <template v-else>
          <p class="mt-1 text-muted">
            {{ PLATFORM_NAMES[file.platform] }} : {{ file.transactions }}
            {{ file.transactions > 1 ? 'opérations crypto lues' : 'opération crypto lue' }},
            {{ file.skipped }}
            {{ file.skipped > 1 ? 'lignes ignorées' : 'ligne ignorée' }} (espèces, actions, fonds).
          </p>
          <details
            v-if="file.unsupported.length > 0"
            class="mt-2 rounded-md bg-warning-soft px-3 py-2 text-warning"
          >
            <summary class="cursor-pointer font-medium">
              {{ file.unsupported.length }} {{ file.unsupported.length > 1 ? 'lignes' : 'ligne' }} à
              vérifier : leur type n'est pas encore pris en charge
            </summary>
            <ul class="mt-2 space-y-1">
              <li v-for="item in file.unsupported" :key="item.line">
                Ligne {{ item.line }} : {{ item.label }}
              </li>
            </ul>
          </details>
        </template>
      </li>
    </ul>

    <p v-if="busy" class="text-sm text-muted" role="status">Lecture en cours…</p>
  </div>
</template>
