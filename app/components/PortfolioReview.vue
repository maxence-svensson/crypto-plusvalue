<script setup lang="ts">
import type { Transaction } from '#shared/portfolio/transaction'

const store = usePortfolioStore()

const byId = computed(
  () => new Map(store.transactions.map((transaction) => [transaction.id, transaction])),
)

const missingHistory = computed(() =>
  store.replay.missingHistory.map((item) => ({
    ...item,
    transaction: byId.value.get(item.transactionId),
  })),
)

const holdings = computed(() => [...store.replay.holdings].sort(([a], [b]) => a.localeCompare(b)))

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
  return parts.join(' → ')
}

function euros(transaction: Transaction): string {
  if ('amountEur' in transaction) return formatEuros(transaction.amountEur)
  if (transaction.type === 'reward' && transaction.valueEur)
    return formatEuros(transaction.valueEur)
  return ''
}
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="missingHistory.length > 0"
      class="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"
      role="alert"
    >
      <p class="font-medium">Historique incomplet</p>
      <p class="mt-1">
        Ces ventes portent sur plus de cryptos que vos fichiers n'en contiennent. Il manque des
        achats, sans doute faits sur une autre plateforme ou un portefeuille personnel : importez
        aussi leurs historiques, sinon le calcul sera faux.
      </p>
      <ul class="mt-2 list-disc space-y-1 pl-5">
        <li v-for="item in missingHistory" :key="item.transactionId + item.asset">
          {{ item.transaction ? formatDay(item.transaction.date) : '' }} : il manque
          <span class="numeric">{{ formatQuantity(item.shortfall) }}</span> {{ item.asset }}
        </li>
      </ul>
    </div>

    <div>
      <h3 class="text-base font-semibold">Votre portefeuille aujourd'hui</h3>
      <p v-if="holdings.length === 0" class="mt-2 text-sm text-muted">Aucune crypto détenue.</p>
      <ul v-else class="mt-3 flex flex-wrap gap-2">
        <li
          v-for="[asset, quantity] in holdings"
          :key="asset"
          class="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <span class="font-medium">{{ asset }}</span>
          <span class="numeric ml-2 text-muted">{{ formatQuantity(quantity) }}</span>
        </li>
      </ul>
    </div>

    <details class="group rounded-lg border border-line bg-surface">
      <summary class="cursor-pointer px-4 py-3 text-sm font-medium">
        Voir les {{ store.transactions.length }} opérations importées
      </summary>
      <div class="max-h-[28rem] overflow-auto border-t border-line">
        <table class="w-full text-left text-sm">
          <caption class="sr-only">
            Opérations crypto importées, de la plus récente à la plus ancienne
          </caption>
          <thead class="sticky top-0 bg-surface text-muted">
            <tr>
              <th scope="col" class="px-4 py-2 font-medium">Date</th>
              <th scope="col" class="px-4 py-2 font-medium">Opération</th>
              <th scope="col" class="px-4 py-2 font-medium">Mouvement</th>
              <th scope="col" class="px-4 py-2 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="transaction in sorted" :key="transaction.id" class="border-t border-line">
              <td class="numeric px-4 py-2 whitespace-nowrap">
                {{ formatDateTime(transaction.date) }}
              </td>
              <td class="px-4 py-2 whitespace-nowrap">
                {{ TRANSACTION_LABELS[transaction.type] }}
              </td>
              <td class="numeric px-4 py-2 whitespace-nowrap">{{ movements(transaction) }}</td>
              <td class="numeric px-4 py-2 text-right whitespace-nowrap">
                {{ euros(transaction) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>
