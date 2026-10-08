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
  <div class="space-y-6">
    <div
      v-if="missingHistory.length > 0"
      class="rounded-md bg-warning-soft px-5 py-4 text-sm text-warning"
      role="alert"
    >
      <p class="font-semibold">Historique incomplet</p>
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
      <h3 class="font-semibold">Ce que vous détenez aujourd'hui</h3>
      <p v-if="holdings.length === 0" class="mt-2 text-sm text-ink-soft">Aucune crypto détenue.</p>
      <dl
        v-else
        class="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-rule sm:grid-cols-4"
      >
        <div v-for="[asset, quantity] in holdings" :key="asset" class="bg-field px-4 py-3">
          <dt class="text-sm text-ink-soft">{{ asset }}</dt>
          <dd class="numeric mt-0.5 font-semibold">{{ formatQuantity(quantity) }}</dd>
        </div>
      </dl>
    </div>

    <details class="border-y border-rule">
      <summary class="cursor-pointer py-3 font-semibold">
        Les {{ store.transactions.length }} opérations importées
      </summary>
      <div class="max-h-[28rem] overflow-auto pb-3">
        <table class="w-full text-left text-sm">
          <caption class="sr-only">
            Opérations crypto importées, de la plus récente à la plus ancienne
          </caption>
          <thead class="sticky top-0 bg-paper text-ink-soft">
            <tr>
              <th scope="col" class="py-2 pr-4 font-normal">Date</th>
              <th scope="col" class="py-2 pr-4 font-normal">Opération</th>
              <th scope="col" class="py-2 pr-4 font-normal">Mouvement</th>
              <th scope="col" class="py-2 text-right font-normal">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="transaction in sorted" :key="transaction.id" class="border-t border-rule">
              <td class="numeric py-2 pr-4 whitespace-nowrap">
                {{ formatDateTime(transaction.date) }}
              </td>
              <td class="py-2 pr-4 whitespace-nowrap">
                {{ TRANSACTION_LABELS[transaction.type] }}
              </td>
              <td class="numeric py-2 pr-4 whitespace-nowrap">{{ movements(transaction) }}</td>
              <td class="numeric py-2 text-right whitespace-nowrap">{{ euros(transaction) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>
