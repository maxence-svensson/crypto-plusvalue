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
  await store.loadExample()
  busy.value = false
}
</script>

<template>
  <div class="space-y-5">
    <label
      class="flex cursor-pointer flex-col items-start gap-1 rounded-md border-[1.5px] border-dashed px-6 py-8 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink sm:px-8"
      :class="dragging ? 'border-ink bg-highlight' : 'border-ink-soft bg-field hover:border-ink'"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input
        id="fichier-import"
        type="file"
        accept=".csv,text/csv"
        multiple
        class="sr-only"
        @change="onChange"
      />
      <span class="display text-lg">Déposez vos fichiers CSV ici</span>
      <span class="text-ink-soft">
        ou
        <span class="font-semibold text-ink underline underline-offset-4"
          >parcourez vos fichiers</span
        >
      </span>
      <span class="mt-4 grid gap-1 text-sm text-ink-soft sm:grid-cols-2 sm:gap-6">
        <span
          ><strong class="font-semibold text-ink">Trade Republic</strong> : Profil, Relevés, Export
          de transactions.</span
        >
        <span
          ><strong class="font-semibold text-ink">Coinbase</strong> : Relevés, Générer un relevé,
          format CSV.</span
        >
      </span>
    </label>

    <p class="text-sm text-ink-soft">
      Importez l'historique complet, depuis l'ouverture de chaque compte. Pas de fichier sous la
      main ?
      <button
        type="button"
        class="font-semibold text-ink underline underline-offset-4 disabled:opacity-60"
        :disabled="busy"
        @click="loadExample"
      >
        Essayer avec un exemple fictif
      </button>
    </p>

    <ul
      v-if="store.files.length > 0"
      class="divide-y divide-rule border-y border-rule"
      aria-live="polite"
    >
      <li v-for="(file, index) in store.files" :key="index" class="py-3 text-sm">
        <p class="font-semibold break-all">{{ file.name }}</p>
        <p v-if="'error' in file" class="mt-1 text-loss">{{ file.error }}</p>
        <template v-else>
          <p class="mt-1 text-ink-soft">
            {{ PLATFORM_NAMES[file.platform] }} : {{ file.transactions }}
            {{ file.transactions > 1 ? 'opérations crypto lues' : 'opération crypto lue' }},
            {{ file.skipped }}
            {{ file.skipped > 1 ? 'lignes ignorées' : 'ligne ignorée' }} (espèces, actions, fonds).
          </p>
          <details
            v-if="file.unsupported.length > 0"
            class="mt-2 rounded-md bg-warning-soft px-3 py-2 text-warning"
          >
            <summary class="cursor-pointer font-semibold">
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

    <p v-if="busy" class="text-sm text-ink-soft" role="status">Lecture en cours…</p>
  </div>
</template>
