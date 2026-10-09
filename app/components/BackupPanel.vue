<script setup lang="ts">
import { MIN_PASSWORD_LENGTH, backupDate } from '#shared/persistence/backup'

/**
 * Sauvegarde chiffrée : télécharger toutes ses données dans un fichier protégé par un mot de
 * passe, et les restaurer, ici ou sur un autre appareil. Le chiffrement se fait dans le
 * navigateur ; ni le fichier ni le mot de passe ne sont envoyés.
 */
const store = usePortfolioStore()

const exportPassword = ref('')
const exportConfirm = ref('')
const exporting = ref(false)
const exportMessage = ref('')
const exportError = ref('')

const exportProblem = computed(() => {
  if (exportPassword.value.length < MIN_PASSWORD_LENGTH) {
    return `${MIN_PASSWORD_LENGTH} caractères au moins.`
  }
  if (exportConfirm.value !== exportPassword.value) return 'Les deux mots de passe diffèrent.'
  return ''
})

async function download() {
  exportError.value = ''
  exportMessage.value = ''
  if (exportProblem.value) {
    exportError.value = exportProblem.value
    return
  }
  exporting.value = true
  try {
    const text = await store.exportBackup(exportPassword.value)
    const name = `cryptoplusvalue-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    saveFile(new TextEncoder().encode(text), name, 'application/json')
    exportMessage.value = `Sauvegarde téléchargée : ${name}. Gardez le mot de passe à part.`
    exportPassword.value = ''
    exportConfirm.value = ''
  } catch (error) {
    exportError.value = (error as Error).message
  } finally {
    exporting.value = false
  }
}

const backupText = ref('')
const backupName = ref('')
const backupCreated = ref<Date>()
const restorePassword = ref('')
const restoring = ref(false)
const restoreMessage = ref('')
const restoreError = ref('')
const confirmRestore = ref<{ open: () => void }>()

async function choose(event: Event) {
  restoreError.value = ''
  restoreMessage.value = ''
  backupCreated.value = undefined
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  backupName.value = file.name
  if (file.size > 60 * 1024 * 1024) {
    backupText.value = ''
    restoreError.value = 'Fichier trop volumineux pour une sauvegarde.'
    return
  }
  backupText.value = await file.text()
  try {
    backupCreated.value = backupDate(backupText.value)
  } catch (error) {
    restoreError.value = (error as Error).message
    backupText.value = ''
  }
}

function askRestore() {
  restoreError.value = ''
  if (!backupText.value) {
    restoreError.value = 'Choisissez d’abord un fichier de sauvegarde.'
    return
  }
  // Rien à perdre : pas besoin de confirmer.
  if (store.transactions.length === 0 || store.demo) void restore()
  else confirmRestore.value?.open()
}

async function restore() {
  restoring.value = true
  restoreError.value = ''
  try {
    await store.restoreBackup(backupText.value, restorePassword.value)
    restoreMessage.value = `Sauvegarde restaurée : ${plural(store.transactions.length, 'opération', 'opérations')}.`
    restorePassword.value = ''
  } catch (error) {
    restoreError.value = (error as Error).message
  } finally {
    restoring.value = false
  }
}
</script>

<template>
  <section aria-labelledby="sauvegarde" class="glass space-y-6 rounded-card p-5 sm:p-6">
    <div>
      <h2 id="sauvegarde" class="text-lg font-semibold tracking-tight">Sauvegarde chiffrée</h2>
      <p class="mt-1 max-w-prose text-sm text-muted">
        Toutes vos données dans un fichier protégé par un mot de passe : pour les garder hors du
        navigateur, ou les retrouver sur un autre appareil. Le chiffrement (AES-256) se fait ici ;
        ni le fichier ni le mot de passe ne sont envoyés. Sans le mot de passe, personne ne peut
        ouvrir la sauvegarde, pas même nous.
      </p>
    </div>

    <form class="space-y-4" novalidate @submit.prevent="download">
      <h3 class="font-semibold">Télécharger une sauvegarde</h3>
      <p v-if="store.demo" class="text-sm text-muted">
        Mode démonstration : les données fictives ne se sauvegardent pas.
      </p>
      <p v-else-if="store.transactions.length === 0" class="text-sm text-muted">
        Rien à sauvegarder pour l’instant.
      </p>
      <template v-else>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="text-sm">
            <label for="sauvegarde-mdp" class="mb-1.5 block font-medium">Mot de passe</label>
            <input
              id="sauvegarde-mdp"
              v-model="exportPassword"
              type="password"
              class="input"
              autocomplete="new-password"
              aria-describedby="sauvegarde-aide"
            />
          </div>
          <div class="text-sm">
            <label for="sauvegarde-confirmation" class="mb-1.5 block font-medium">
              Confirmer le mot de passe
            </label>
            <input
              id="sauvegarde-confirmation"
              v-model="exportConfirm"
              type="password"
              class="input"
              autocomplete="new-password"
            />
          </div>
        </div>
        <p id="sauvegarde-aide" class="text-sm text-muted">
          {{ MIN_PASSWORD_LENGTH }} caractères au moins ; une phrase de plusieurs mots convient
          bien. Il ne peut pas être retrouvé : notez-le à part.
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="btn btn-primary" :disabled="exporting">
            <span v-if="exporting" class="spinner" aria-hidden="true"></span>
            <AppIcon v-else name="download" />
            {{ exporting ? 'Chiffrement…' : 'Télécharger la sauvegarde' }}
          </button>
        </div>
        <p v-if="exportError" class="text-sm text-loss" role="alert">{{ exportError }}</p>
        <p v-if="exportMessage" class="text-sm text-gain" role="status">{{ exportMessage }}</p>
      </template>
    </form>

    <form class="space-y-4 border-t border-separator pt-6" novalidate @submit.prevent="askRestore">
      <h3 class="font-semibold">Restaurer une sauvegarde</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="text-sm">
          <label for="restauration-fichier" class="mb-1.5 block font-medium">Fichier</label>
          <input
            id="restauration-fichier"
            type="file"
            accept=".json,application/json"
            class="input py-3 text-sm file:mr-3 file:rounded-chip file:border-0 file:bg-accent-tint file:px-3 file:py-1 file:font-semibold file:text-link"
            @change="choose"
          />
        </div>
        <div class="text-sm">
          <label for="restauration-mdp" class="mb-1.5 block font-medium">Mot de passe</label>
          <input
            id="restauration-mdp"
            v-model="restorePassword"
            type="password"
            class="input"
            autocomplete="current-password"
          />
        </div>
      </div>
      <p v-if="backupCreated" class="text-sm text-muted">
        {{ backupName }} : sauvegarde du {{ formatDateTime(backupCreated) }}. Elle remplacera les
        données actuelles de ce navigateur.
      </p>
      <button type="submit" class="btn btn-secondary" :disabled="restoring">
        <span v-if="restoring" class="spinner" aria-hidden="true"></span>
        <AppIcon v-else name="upload" />
        {{ restoring ? 'Déchiffrement…' : 'Restaurer' }}
      </button>
      <p v-if="restoreError" class="text-sm text-loss" role="alert">{{ restoreError }}</p>
      <p v-if="restoreMessage" class="text-sm text-gain" role="status">{{ restoreMessage }}</p>
    </form>

    <ConfirmDialog
      ref="confirmRestore"
      title="Remplacer vos données ?"
      text="Les opérations, cours, fichiers et corrections de ce navigateur seront remplacés par ceux de la sauvegarde. Pensez à télécharger d’abord une sauvegarde de l’état actuel si vous en avez besoin."
      confirm="Remplacer"
      @confirm="restore"
    />
  </section>
</template>
