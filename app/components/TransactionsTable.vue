<script setup lang="ts">
import { TRANSACTION_LABELS, type Transaction } from '#shared/portfolio/transaction'

/** Toutes les opérations importées, de la plus récente à la plus ancienne. */
const store = usePortfolioStore()

const sorted = computed(() =>
  [...store.transactions].sort((a, b) => b.date.getTime() - a.date.getTime()),
)

/** Ce qui entre (+) et ce qui sort (−) du portefeuille. */
function movements(transaction: Transaction): string {
  const parts: string[] = []
  if ('sent' in transaction) {
    parts.push(`−${formatQuantity(transaction.sent.quantity)} ${transaction.sent.asset}`)
  }
  if ('received' in transaction) {
    parts.push(`+${formatQuantity(transaction.received.quantity)} ${transaction.received.asset}`)
  }
  return parts.join(' contre ')
}

function euros(transaction: Transaction): string {
  if ('amountEur' in transaction) return formatEuros(transaction.amountEur)
  if (transaction.type === 'reward' && transaction.valueEur)
    return formatEuros(transaction.valueEur)
  return ''
}
</script>

<template>
  <details class="disclosure solid-card overflow-hidden rounded-card">
    <summary>Les {{ store.transactions.length }} opérations importées</summary>
    <div
      class="max-h-[28rem] overflow-auto border-t border-separator px-5 pb-3 sm:px-6"
      tabindex="0"
      role="region"
      aria-label="Opérations importées"
    >
      <table class="w-full text-left text-sm">
        <caption class="sr-only">
          Opérations crypto importées, de la plus récente à la plus ancienne
        </caption>
        <thead class="sticky top-0 bg-elevated text-muted">
          <tr>
            <th scope="col" class="py-3 pr-4 font-medium">Date</th>
            <th scope="col" class="py-3 pr-4 font-medium">Opération</th>
            <th scope="col" class="py-3 pr-4 font-medium">Mouvement</th>
            <th scope="col" class="py-3 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="transaction in sorted" :key="transaction.id" class="border-t border-separator">
            <td class="numeric py-2.5 pr-4 whitespace-nowrap">
              {{ formatDateTime(transaction.date) }}
            </td>
            <td class="py-2.5 pr-4 whitespace-nowrap">
              {{ TRANSACTION_LABELS[transaction.type] }}
            </td>
            <td class="numeric py-2.5 pr-4 whitespace-nowrap">{{ movements(transaction) }}</td>
            <td class="numeric py-2.5 text-right whitespace-nowrap">{{ euros(transaction) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>
