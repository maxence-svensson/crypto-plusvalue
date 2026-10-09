<script setup lang="ts">
import { IMPORTERS, PLATFORM_NAMES } from '#shared/importers/detect'
import { TRANSACTION_LABELS, type Transaction } from '#shared/portfolio/transaction'

/**
 * Aperçu d'un import avant confirmation : période, opérations à ajouter, déjà présentes,
 * doublons probables à trancher, lignes ignorées ou écartées. Rien n'entre dans le calcul avant
 * « Importer ».
 */
const store = usePortfolioStore()
const confirming = ref(false)

const verified = (platform: string) =>
  IMPORTERS.find((importer) => importer.platform === platform)?.verified ?? false

function describe(transaction: Transaction): string {
  const parts = [formatDateTime(transaction.date), TRANSACTION_LABELS[transaction.type]]
  if ('sent' in transaction) {
    parts.push(`−${formatQuantity(transaction.sent.quantity)} ${transaction.sent.asset}`)
  }
  if ('received' in transaction) {
    parts.push(`+${formatQuantity(transaction.received.quantity)} ${transaction.received.asset}`)
  }
  if ('amountEur' in transaction) parts.push(formatEuros(transaction.amountEur))
  return parts.join(', ')
}

const source = (transaction: Transaction) =>
  transaction.source === 'manual' ? 'saisie' : PLATFORM_NAMES[transaction.source]

async function confirm(index?: number) {
  confirming.value = true
  await store.confirmImport(index)
  confirming.value = false
}
</script>

<template>
  <section v-if="store.pending.length > 0" aria-labelledby="apercu-import" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="apercu-import" class="text-lg font-semibold tracking-tight">
        Vérifiez avant d’importer
      </h2>
      <button
        v-if="store.pending.length > 1"
        type="button"
        class="btn btn-primary"
        :disabled="confirming"
        @click="confirm()"
      >
        Tout importer
      </button>
    </div>

    <article
      v-for="(item, index) in store.pending"
      :key="`${item.name}-${index}`"
      class="glass-strong space-y-4 rounded-card p-5 sm:p-6"
      :aria-label="`Aperçu de ${item.name}`"
    >
      <div class="flex gap-4">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-chip bg-accent-tint text-link"
        >
          <AppIcon name="file" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold break-all">{{ item.name }}</p>
          <p class="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            {{ PLATFORM_NAMES[item.platform] }}
            <span
              v-if="!verified(item.platform)"
              class="rounded-full bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning"
              >expérimental</span
            >
          </p>
          <p v-if="item.period" class="text-sm text-muted">
            Opérations du {{ formatDay(item.period.from) }} au {{ formatDay(item.period.to) }}
          </p>
        </div>
      </div>

      <ul class="space-y-1 text-sm">
        <li class="font-semibold">
          {{
            plural(
              item.duplicates.fresh.length,
              'opération crypto à importer',
              'opérations crypto à importer',
            )
          }}
        </li>
        <li v-if="item.duplicates.known.length > 0" class="text-muted">
          {{
            plural(
              item.duplicates.known.length,
              'déjà importée, ignorée',
              'déjà importées, ignorées',
            )
          }}
        </li>
        <li v-if="item.result.skipped > 0" class="text-muted">
          {{ plural(item.result.skipped, 'ligne ignorée', 'lignes ignorées') }} : espèces, titres,
          mouvements internes.
        </li>
        <li v-if="item.result.unsupported.length > 0" class="text-warning">
          {{ plural(item.result.unsupported.length, 'ligne à vérifier', 'lignes à vérifier') }} :
          type d’opération pas encore pris en charge.
        </li>
        <li v-if="item.result.anomalies.length > 0" class="text-warning">
          {{
            plural(
              item.result.anomalies.length,
              'ligne illisible écartée',
              'lignes illisibles écartées',
            )
          }}.
        </li>
      </ul>

      <fieldset
        v-if="item.duplicates.possible.length > 0"
        class="rounded-control bg-warning-tint px-4 py-3 text-sm"
      >
        <legend class="sr-only">Doublons probables</legend>
        <p class="font-semibold text-warning">
          {{ plural(item.duplicates.possible.length, 'doublon probable', 'doublons probables') }}
        </p>
        <p class="mt-1">
          Même opération, même moment, mais un autre identifiant : sans doute déjà importée par un
          autre fichier. Cochez celles qui sont réellement différentes.
        </p>
        <ul class="mt-3 space-y-2">
          <li
            v-for="{ incoming, existing } in item.duplicates.possible"
            :key="incoming.id"
            class="flex gap-3"
          >
            <input
              :id="`garder-${incoming.id}`"
              type="checkbox"
              class="check mt-0.5 size-5"
              :checked="item.keep.includes(incoming.id)"
              @change="store.toggleKeep(index, incoming.id)"
            />
            <label :for="`garder-${incoming.id}`" class="cursor-pointer">
              <span class="numeric block">{{ describe(incoming) }}</span>
              <span class="block text-muted">
                Déjà là : {{ source(existing) }}, {{ formatDateTime(existing.date) }}. Importer
                quand même.
              </span>
            </label>
          </li>
        </ul>
      </fieldset>

      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="confirming"
          @click="confirm(index)"
        >
          Importer
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="confirming"
          @click="store.cancelImport(index)"
        >
          Annuler
        </button>
      </div>
    </article>
  </section>
</template>
