<script setup lang="ts">
import { IMPORTERS, PLATFORM_NAMES } from '#shared/importers/detect'

const store = usePortfolioStore()
const dragging = ref(false)
const busy = ref(false)

async function add(files: FileList | null | undefined) {
  if (!files || files.length === 0) return
  busy.value = true
  await store.prepareImport(
    Array.from(files, (file) => ({
      name: file.name,
      size: file.size,
      bytes: () => file.arrayBuffer(),
    })),
  )
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
      class="glass lift block cursor-pointer rounded-card p-2 transition-[transform,scale,box-shadow] duration-300 ease-ios focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
      :class="dragging ? 'scale-[1.01]' : ''"
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
      <span
        class="flex flex-col items-center gap-1 rounded-[22px] border-[1.5px] border-dashed px-6 py-10 text-center transition-colors duration-300 ease-ios sm:py-12"
        :class="dragging ? 'border-accent bg-accent-tint' : 'border-separator'"
      >
        <span
          class="mb-3 flex size-14 items-center justify-center rounded-[18px] bg-accent-tint text-link"
        >
          <AppIcon name="upload" class="size-7" />
        </span>
        <span class="headline text-xl">Déposez vos fichiers CSV ici</span>
        <span class="text-muted">
          ou <span class="font-semibold text-link">parcourez vos fichiers</span>
        </span>
        <span
          class="mt-6 grid w-full max-w-4xl gap-2 text-left text-sm sm:grid-cols-2 lg:grid-cols-3"
        >
          <span
            v-for="importer in IMPORTERS"
            :key="importer.platform"
            class="rounded-control bg-field px-4 py-3 text-muted"
          >
            <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong class="font-semibold text-label">{{ importer.name }}</strong>
              <span
                v-if="!importer.verified"
                class="rounded-full bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning"
                >expérimental</span
              >
            </span>
            <span class="mt-1 block">{{ importer.howTo }}</span>
          </span>
        </span>
      </span>
    </label>

    <p class="text-sm text-muted">
      Importez l'historique complet, depuis l'ouverture de chaque compte, et un fichier par
      plateforme. « Expérimental » : format lu d'après la documentation de la plateforme, pas encore
      vérifié sur un vrai export ; contrôlez le résultat. Pas de fichier sous la main ?
      <button
        type="button"
        class="btn btn-ghost min-h-8 px-1.5 text-sm"
        :disabled="busy"
        @click="loadExample"
      >
        Essayer avec un exemple fictif
      </button>
    </p>

    <ImportPreview />

    <ul
      v-if="store.files.length > 0"
      class="solid-card divide-y divide-separator overflow-hidden rounded-card"
      aria-live="polite"
    >
      <li v-for="(file, index) in store.files" :key="index" class="flex gap-4 px-5 py-4 text-sm">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-chip"
          :class="'error' in file ? 'bg-warning-tint text-warning' : 'bg-accent-tint text-link'"
        >
          <AppIcon :name="'error' in file ? 'alert' : 'file'" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold break-all">{{ file.name }}</p>
          <p v-if="'error' in file" class="mt-1 text-loss">{{ file.error }}</p>
          <template v-else>
            <p class="mt-1 text-muted">
              {{ PLATFORM_NAMES[file.platform] }} : {{ file.transactions }}
              {{ file.transactions > 1 ? 'opérations crypto lues' : 'opération crypto lue' }},
              {{ file.skipped }}
              {{ file.skipped > 1 ? 'lignes ignorées' : 'ligne ignorée' }} (espèces, actions,
              fonds)<template v-if="file.duplicates > 0"
                >, {{ file.duplicates }}
                {{
                  file.duplicates > 1 ? 'déjà présentes ou en double' : 'déjà présente ou en double'
                }}</template
              >.
            </p>
            <details
              v-if="file.anomalies.length > 0"
              class="mt-3 rounded-control bg-warning-tint px-4 py-3 text-warning"
            >
              <summary class="cursor-pointer font-semibold">
                {{ file.anomalies.length }}
                {{ file.anomalies.length > 1 ? 'lignes écartées' : 'ligne écartée' }} : illisibles,
                elles ne sont pas dans le calcul
              </summary>
              <ul class="mt-2 space-y-1">
                <li v-for="item in file.anomalies" :key="item.line">
                  Ligne {{ item.line }} : {{ item.message }}
                </li>
              </ul>
            </details>
            <details
              v-if="file.unsupported.length > 0"
              class="mt-3 rounded-control bg-warning-tint px-4 py-3 text-warning"
            >
              <summary class="cursor-pointer font-semibold">
                {{ file.unsupported.length }}
                {{ file.unsupported.length > 1 ? 'lignes' : 'ligne' }} à vérifier : leur type n'est
                pas encore pris en charge
              </summary>
              <ul class="mt-2 space-y-1">
                <li v-for="item in file.unsupported" :key="item.line">
                  Ligne {{ item.line }} : {{ item.label }}
                </li>
              </ul>
            </details>
          </template>
        </div>
      </li>
    </ul>

    <p
      v-if="store.files.length > 0 && store.savedAt && !store.demo"
      class="flex items-center gap-2 text-sm text-muted"
      role="status"
    >
      <AppIcon name="check" class="text-gain" />
      Enregistré dans ce navigateur le {{ formatDateTime(store.savedAt) }}.
    </p>

    <p v-if="busy" class="flex items-center gap-2 text-sm text-muted" role="status">
      <span class="spinner" aria-hidden="true"></span>
      Lecture en cours…
    </p>
  </div>
</template>
