<script setup lang="ts">
import {
  FORM_FIELDS,
  buildManualTransaction,
  emptyForm,
  formOf,
  type ManualErrors,
  type ManualForm,
  type ManualTarget,
  type TransactionType,
} from '#shared/portfolio/manual'
import { TRANSACTION_LABELS, type Transaction } from '#shared/portfolio/transaction'

/**
 * Ajout ou modification d'une opération, dans une fenêtre. Les champs suivent le type choisi ;
 * rien n'est enregistré tant qu'un champ est faux, et chaque erreur dit quoi corriger.
 */
defineProps<{ assets: string[] }>()
const emit = defineEmits<{ saved: [transaction: Transaction] }>()
const store = usePortfolioStore()

const dialog = ref<HTMLDialogElement>()
const form = ref<ManualForm>(emptyForm())
const target = ref<ManualTarget>({ id: '', source: 'manual' })
const errors = ref<ManualErrors>({})
const editing = computed(() => target.value.original !== undefined)

const TYPES = Object.entries(TRANSACTION_LABELS) as [TransactionType, string][]

const TYPE_HINTS: Record<TransactionType, string> = {
  buy: 'Crypto achetée avec des euros : le montant payé entre dans le prix total d’acquisition.',
  sell: 'Crypto vendue contre des euros : une cession imposable.',
  payment:
    'Bien ou service payé en crypto : une cession imposable, à la valeur de ce qui est obtenu.',
  swap: 'Crypto échangée contre une autre, stablecoins compris : pas d’imposition à ce moment-là.',
  reward: 'Staking, airdrop, bonus : la crypto entre dans le portefeuille sans prix d’acquisition.',
  'transfer-in': 'Crypto reçue depuis un autre de vos portefeuilles : sans effet sur le calcul.',
  'transfer-out':
    'Crypto envoyée vers un autre de vos portefeuilles : seuls les frais de réseau sortent du portefeuille.',
}

const MAIN_LABELS: Record<TransactionType, [string, string]> = {
  buy: ['Crypto achetée', 'Quantité reçue'],
  sell: ['Crypto vendue', 'Quantité vendue'],
  payment: ['Crypto utilisée', 'Quantité dépensée'],
  swap: ['Crypto cédée', 'Quantité cédée'],
  reward: ['Crypto reçue', 'Quantité reçue'],
  'transfer-in': ['Crypto reçue', 'Quantité reçue'],
  'transfer-out': ['Crypto envoyée', 'Quantité envoyée, hors frais'],
}

const AMOUNT_LABELS: Partial<Record<TransactionType, string>> = {
  buy: 'Montant payé, hors frais (€)',
  sell: 'Montant obtenu, avant frais (€)',
  payment: 'Valeur du bien ou du service (€)',
  reward: 'Valeur à la réception (€), facultative',
}

type Field = 'asset' | 'quantity' | 'toAsset' | 'toQuantity' | 'amountEur' | 'feeEur' | 'networkFee'

const fields = computed(() => {
  const type = form.value.type
  const [assetLabel, quantityLabel] = MAIN_LABELS[type]
  const labels: Record<Field, string> = {
    asset: assetLabel,
    quantity: quantityLabel,
    toAsset: 'Crypto reçue',
    toQuantity: 'Quantité reçue',
    amountEur: AMOUNT_LABELS[type] ?? '',
    feeEur: 'Frais (€), facultatifs',
    networkFee: 'Frais de réseau, dans la même crypto, facultatifs',
  }
  const order: Field[] = [
    'asset',
    'quantity',
    'toAsset',
    'toQuantity',
    'amountEur',
    'feeEur',
    'networkFee',
  ]
  return order
    .filter((field) => FORM_FIELDS[type].includes(field))
    .map((field) => ({
      field,
      label: labels[field],
      symbol: field === 'asset' || field === 'toAsset',
    }))
})

const errorCount = computed(() => Object.keys(errors.value).length)

function open(transaction?: Transaction) {
  errors.value = {}
  if (transaction) {
    form.value = formOf(transaction)
    target.value = { id: transaction.id, source: transaction.source, original: transaction }
  } else {
    form.value = emptyForm()
    target.value = { id: `manual:${crypto.randomUUID()}`, source: 'manual' }
  }
  dialog.value?.showModal()
}

function submit() {
  const result = buildManualTransaction(form.value, target.value)
  if (!result.ok) {
    errors.value = result.errors
    return
  }
  const original = target.value.original
  if (original) store.editTransaction(original, result.transaction)
  else store.addTransaction(result.transaction)
  dialog.value?.close()
  emit('saved', result.transaction)
}

defineExpose({ open })
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto"
    :aria-label="editing ? 'Modifier l’opération' : 'Ajouter une opération'"
  >
    <form novalidate class="space-y-5" @submit.prevent="submit">
      <div>
        <h2 class="headline text-2xl">
          {{ editing ? 'Modifier l’opération' : 'Ajouter une opération' }}
        </h2>
        <p class="mt-2 text-sm text-muted">
          <template v-if="editing">
            La version d’origine reste dans le journal des corrections : vous pourrez revenir en
            arrière.
          </template>
          <template v-else>
            Pour une opération absente de vos exports : un achat sur une plateforme non prise en
            charge, un paiement, un don reçu…
          </template>
        </p>
      </div>

      <div class="text-sm">
        <label for="saisie-type" class="mb-1.5 block font-medium">Type d’opération</label>
        <select id="saisie-type" v-model="form.type" class="input" aria-describedby="aide-type">
          <option v-for="[value, label] in TYPES" :key="value" :value="value">{{ label }}</option>
        </select>
        <p id="aide-type" class="mt-1.5 text-muted">{{ TYPE_HINTS[form.type] }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label for="saisie-date" class="mb-1.5 block font-medium">Date</label>
          <input
            id="saisie-date"
            v-model="form.date"
            type="date"
            class="input"
            required
            :aria-invalid="errors.date ? 'true' : undefined"
            :aria-describedby="errors.date ? 'erreur-date' : undefined"
          />
        </div>
        <div>
          <label for="saisie-heure" class="mb-1.5 block font-medium">Heure (Paris)</label>
          <input id="saisie-heure" v-model="form.time" type="time" class="input" required />
        </div>
        <p v-if="errors.date" id="erreur-date" class="col-span-2 -mt-1 text-loss">
          {{ errors.date }}
        </p>
      </div>

      <div class="grid gap-3 text-sm sm:grid-cols-2">
        <div v-for="item in fields" :key="item.field">
          <label :for="`saisie-${item.field}`" class="mb-1.5 block font-medium">
            {{ item.label }}
          </label>
          <input
            :id="`saisie-${item.field}`"
            v-model="form[item.field]"
            type="text"
            class="input"
            :class="item.symbol ? 'uppercase placeholder:normal-case' : 'numeric'"
            :inputmode="item.symbol ? 'text' : 'decimal'"
            :autocapitalize="item.symbol ? 'characters' : 'off'"
            autocomplete="off"
            spellcheck="false"
            :list="item.symbol ? 'cryptos-connues' : undefined"
            :placeholder="item.symbol ? 'BTC' : '0,00'"
            :aria-invalid="errors[item.field] ? 'true' : undefined"
            :aria-describedby="errors[item.field] ? `erreur-${item.field}` : undefined"
          />
          <p v-if="errors[item.field]" :id="`erreur-${item.field}`" class="mt-1.5 text-loss">
            {{ errors[item.field] }}
          </p>
        </div>
      </div>
      <datalist id="cryptos-connues">
        <option v-for="asset in assets" :key="asset" :value="asset" />
      </datalist>

      <div class="text-sm">
        <label for="saisie-libelle" class="mb-1.5 block font-medium">Libellé, facultatif</label>
        <input
          id="saisie-libelle"
          v-model="form.label"
          type="text"
          class="input"
          maxlength="200"
          placeholder="Achat sur Ledger Live, cadeau…"
        />
      </div>

      <p v-if="errorCount > 0" class="text-sm font-semibold text-loss" role="alert">
        {{ plural(errorCount, 'champ à corriger', 'champs à corriger') }} avant d’enregistrer.
      </p>

      <div class="flex flex-wrap justify-end gap-3 pt-1">
        <button type="button" class="btn btn-secondary" @click="dialog?.close()">Annuler</button>
        <button type="submit" class="btn btn-primary">
          {{ editing ? 'Enregistrer les modifications' : 'Ajouter l’opération' }}
        </button>
      </div>
    </form>
  </dialog>
</template>
