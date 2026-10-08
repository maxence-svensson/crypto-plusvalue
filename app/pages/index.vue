<script setup lang="ts">
const store = usePortfolioStore()
const hasData = computed(() => store.transactions.length > 0)
const loadingExample = ref(false)

const REPOSITORY = 'https://github.com/maxence-svensson/crypto-plusvalue'

function chooseFiles() {
  document.getElementById('fichier-import')?.click()
}

async function showExample() {
  loadingExample.value = true
  await store.loadExample()
  loadingExample.value = false
  await nextTick()
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document
    .getElementById('etape-resultat')
    ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}
</script>

<template>
  <div class="min-h-screen">
    <a
      href="#contenu"
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-[4px] focus:bg-highlight focus:px-3 focus:py-2"
    >
      Aller au contenu
    </a>

    <header class="mx-auto flex max-w-6xl items-baseline justify-between gap-4 px-5 py-5 sm:px-8">
      <p class="display text-lg">CryptoPlusValue</p>
      <nav class="flex gap-5 text-sm text-ink-soft" aria-label="Liens du projet">
        <a
          :href="`${REPOSITORY}/blob/main/docs/regles-fiscales.md`"
          class="hidden whitespace-nowrap hover:text-ink hover:underline sm:inline"
        >
          Méthode et sources
        </a>
        <a :href="REPOSITORY" class="whitespace-nowrap hover:text-ink hover:underline"
          >Code source</a
        >
      </nav>
    </header>

    <main id="contenu">
      <section
        class="mx-auto grid max-w-6xl gap-12 px-5 pt-10 pb-16 sm:px-8 sm:pt-16 lg:grid-cols-[1.35fr_1fr] lg:items-center lg:gap-16"
      >
        <div>
          <h1 class="display text-4xl leading-[1.02] text-balance sm:text-5xl lg:text-[3.5rem]">
            Vos plus-values crypto, prêtes à recopier sur le 2086.
          </h1>
          <p class="mt-6 max-w-xl text-lg text-ink-soft">
            Déposez votre export Trade Republic ou Coinbase. Le calcul suit la méthode officielle,
            et votre fichier ne quitte pas votre navigateur.
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              type="button"
              class="rounded-[4px] bg-ink px-5 py-3 font-semibold text-paper hover:bg-ink/90"
              @click="chooseFiles"
            >
              Importer mon export
            </button>
            <button
              type="button"
              class="font-semibold underline underline-offset-4 disabled:opacity-60"
              :disabled="loadingExample"
              @click="showExample"
            >
              Voir un exemple
            </button>
          </div>
          <p class="mt-6 text-sm text-ink-soft">Gratuit, sans compte, code source ouvert.</p>
        </div>

        <div class="rounded-md bg-field p-6 sm:p-8">
          <p class="text-sm text-ink-soft">Exemple fictif, revenus 2025</p>
          <p class="mt-1 mb-5 font-semibold">Plus-values sur actifs numériques</p>
          <CombBox code="3AN" :value="331" />
          <dl
            class="numeric mt-6 grid grid-cols-[1fr_auto] gap-y-2 border-t border-rule pt-4 text-sm"
          >
            <dt class="text-ink-soft">Vente d'ETH, 14 août</dt>
            <dd class="font-semibold text-gain">+336,87 €</dd>
            <dt class="text-ink-soft">Vente de BTC, 20 novembre</dt>
            <dd class="font-semibold text-loss">−5,52 €</dd>
          </dl>
        </div>
      </section>

      <div class="border-t-[1.5px] border-ink">
        <div class="mx-auto max-w-6xl space-y-16 px-5 py-14 sm:px-8">
          <section aria-labelledby="etape-import" class="space-y-6">
            <h2 id="etape-import" class="display flex items-center gap-3 text-xl sm:text-2xl">
              <span
                class="numeric inline-flex size-8 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-ink text-base"
                >1</span
              >
              Importez vos historiques
            </h2>
            <ImportPanel />
          </section>

          <template v-if="hasData">
            <section aria-labelledby="etape-verification" class="space-y-6">
              <h2
                id="etape-verification"
                class="display flex items-center gap-3 text-xl sm:text-2xl"
              >
                <span
                  class="numeric inline-flex size-8 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-ink text-base"
                  >2</span
                >
                Vérifiez votre portefeuille
              </h2>
              <PortfolioReview />
              <PricesPanel />
            </section>

            <section aria-labelledby="etape-resultat" class="scroll-mt-6 space-y-6">
              <h2 id="etape-resultat" class="display flex items-center gap-3 text-xl sm:text-2xl">
                <span
                  class="numeric inline-flex size-8 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-ink text-base"
                  >3</span
                >
                Recopiez votre déclaration
              </h2>
              <TaxResult />
            </section>

            <p>
              <button
                type="button"
                class="text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
                @click="store.reset()"
              >
                Effacer les données et recommencer
              </button>
            </p>
          </template>
        </div>
      </div>
    </main>

    <footer class="bg-field">
      <div class="mx-auto max-w-6xl space-y-3 px-5 py-10 text-sm text-ink-soft sm:px-8">
        <p class="max-w-prose">
          CryptoPlusValue est un outil indépendant, sans lien avec l'administration fiscale. Ses
          résultats sont indicatifs et ne remplacent pas un conseil fiscal : vérifiez-les avant de
          déclarer.
        </p>
        <p class="flex flex-wrap gap-x-5 gap-y-1">
          <a
            :href="`${REPOSITORY}/blob/main/docs/regles-fiscales.md`"
            class="underline underline-offset-4 hover:text-ink"
          >
            Règles appliquées et sources
          </a>
          <a
            :href="`${REPOSITORY}/blob/main/docs/imports.md`"
            class="underline underline-offset-4 hover:text-ink"
          >
            Formats d'import
          </a>
          <a
            :href="`${REPOSITORY}/blob/main/docs/prix.md`"
            class="underline underline-offset-4 hover:text-ink"
          >
            Cours historiques
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>
