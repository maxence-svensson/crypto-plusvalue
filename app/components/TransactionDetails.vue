<script setup lang="ts">
import { SOURCE_NAMES, eurosOf } from '#shared/portfolio/listing'
import { PROBLEMS } from '#shared/portfolio/problems'
import { TRANSACTION_LABELS, type Transaction } from '#shared/portfolio/transaction'
import { parisTimestamp } from '#shared/time'

/**
 * Fiche d'une opération : tout ce que l'export en dit, ce qui est à vérifier, et les corrections
 * déjà faites. De là, on la modifie ou on la supprime.
 */
const emit = defineEmits<{ edit: [transaction: Transaction]; delete: [transaction: Transaction] }>()
const store = usePortfolioStore()

const dialog = ref<HTMLDialogElement>()
const transaction = shallowRef<Transaction>()

const problems = computed(() =>
  transaction.value ? (store.problems.get(transaction.value.id) ?? []) : [],
)

/** Corrections qui concernent cette opération, de la plus récente à la plus ancienne. */
const history = computed(() => {
  const id = transaction.value?.id
  if (!id) return []
  return store.corrections
    .filter((correction) =>
      correction.kind === 'add'
        ? correction.transaction.id === id
        : correction.kind === 'edit'
          ? correction.after.id === id
          : false,
    )
    .reverse()
})

const rows = computed(() => {
  const item = transaction.value
  if (!item) return []
  const list: { label: string; value: string; numeric?: boolean }[] = [
    { label: 'Type', value: TRANSACTION_LABELS[item.type] },
    { label: 'Source', value: SOURCE_NAMES[item.source] },
    { label: 'Date (Paris)', value: parisTimestamp(item.date), numeric: true },
    { label: 'Instant enregistré (UTC)', value: item.date.toISOString(), numeric: true },
    { label: 'Horloge de l’export', value: SOURCE_CLOCKS[item.source] },
  ]
  if ('sent' in item) {
    list.push({
      label: 'Envoyé',
      value: `${formatQuantity(item.sent.quantity)} ${item.sent.asset}`,
      numeric: true,
    })
  }
  if ('received' in item) {
    list.push({
      label: 'Reçu',
      value: `${formatQuantity(item.received.quantity)} ${item.received.asset}`,
      numeric: true,
    })
  }
  const euros = eurosOf(item)
  if (euros) {
    list.push({
      label: item.type === 'reward' ? 'Valeur à la réception' : 'Montant',
      value: formatEuros(euros),
      numeric: true,
    })
  }
  if ('feeEur' in item)
    list.push({ label: 'Frais', value: formatEuros(item.feeEur), numeric: true })
  if (item.type === 'transfer-out' && item.fee) {
    list.push({
      label: 'Frais de réseau',
      value: `${formatQuantity(item.fee.quantity)} ${item.fee.asset}`,
      numeric: true,
    })
  }
  list.push({ label: 'Libellé d’origine', value: item.label })
  list.push({ label: 'Identifiant', value: item.id })
  return list
})

async function open(item: Transaction) {
  transaction.value = item
  // Contenu rendu avant l'ouverture : le focus va au bouton Fermer.
  await nextTick()
  dialog.value?.showModal()
}

function act(action: 'edit' | 'delete') {
  const item = transaction.value
  dialog.value?.close()
  if (!item) return
  if (action === 'edit') emit('edit', item)
  else emit('delete', item)
}

defineExpose({ open })
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto"
    aria-label="Détails de l’opération"
  >
    <div v-if="transaction" class="space-y-5">
      <div>
        <h2 class="headline text-2xl">{{ describeTransaction(transaction) }}</h2>
        <p class="mt-1 text-muted">{{ formatDateTime(transaction.date) }}</p>
      </div>

      <dl class="divide-y divide-separator rounded-control bg-field text-sm">
        <div
          v-for="row in rows"
          :key="row.label"
          class="grid gap-1 px-4 py-2.5 sm:grid-cols-[11rem_1fr]"
        >
          <dt class="text-muted">{{ row.label }}</dt>
          <dd class="wrap-anywhere" :class="row.numeric ? 'numeric' : ''">{{ row.value }}</dd>
        </div>
      </dl>

      <div v-if="problems.length > 0" class="space-y-3">
        <h3 class="font-semibold">À vérifier</h3>
        <div
          v-for="problem in problems"
          :key="problem"
          class="flex gap-3 rounded-control bg-warning-tint px-4 py-3 text-sm"
        >
          <AppIcon
            name="alert"
            class="mt-0.5"
            :class="PROBLEMS[problem].blocking ? 'text-loss' : 'text-warning'"
          />
          <div>
            <p class="font-semibold">{{ PROBLEMS[problem].title }}</p>
            <p class="mt-0.5">{{ PROBLEMS[problem].detail }}</p>
          </div>
        </div>
      </div>

      <div v-if="history.length > 0" class="space-y-2">
        <h3 class="font-semibold">Corrections</h3>
        <ul class="space-y-1 text-sm text-muted">
          <li v-for="correction in history" :key="correction.at.getTime()">
            {{ correction.kind === 'add' ? 'Ajoutée' : 'Modifiée' }} le
            {{ formatDateTime(correction.at) }}
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap justify-end gap-3 border-t border-separator pt-5">
        <button type="button" class="btn btn-danger" @click="act('delete')">
          <AppIcon name="trash" />
          Supprimer
        </button>
        <button type="button" class="btn btn-secondary" @click="act('edit')">
          <AppIcon name="pencil" />
          Modifier
        </button>
        <button type="button" class="btn btn-primary" autofocus @click="dialog?.close()">
          Fermer
        </button>
      </div>
    </div>
  </dialog>
</template>
