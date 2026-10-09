<script setup lang="ts">
/**
 * Demande de confirmation avant une action irréversible. Fenêtre native (<dialog>) : le focus y
 * reste, Échap ferme, et le focus revient au bouton qui l'a ouverte.
 */
defineProps<{ title: string; text: string; confirm: string }>()
const emit = defineEmits<{ confirm: [] }>()
const dialog = ref<HTMLDialogElement>()

function onClose() {
  if (dialog.value?.returnValue === 'confirm') emit('confirm')
}

defineExpose({
  open() {
    if (!dialog.value) return
    dialog.value.returnValue = ''
    dialog.value.showModal()
  },
})
</script>

<template>
  <dialog ref="dialog" class="dialog" :aria-label="title" @close="onClose">
    <form method="dialog" class="space-y-4">
      <h2 class="headline text-2xl">{{ title }}</h2>
      <p class="text-muted">{{ text }}</p>
      <div class="flex flex-wrap justify-end gap-3 pt-2">
        <button value="cancel" class="btn btn-secondary" autofocus>Annuler</button>
        <button value="confirm" class="btn btn-danger">{{ confirm }}</button>
      </div>
    </form>
  </dialog>
</template>
