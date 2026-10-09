<script setup lang="ts">
const store = usePortfolioStore()
const hasData = computed(() => store.transactions.length > 0)
const loadingExample = ref(false)

function chooseFiles() {
  document.getElementById('fichier-import')?.click()
}

// https://crypto-plusvalue.vercel.app/?exemple ouvre directement le résultat de l'exemple.
const route = useRoute()
onMounted(() => {
  if ('exemple' in route.query) showExample()
})

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
  <div id="haut" class="relative min-h-screen overflow-x-clip">
    <div class="backdrop-glow pointer-events-none fixed inset-0 -z-10" aria-hidden="true"></div>

    <a
      href="#contenu"
      class="btn btn-primary sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
    >
      Aller au contenu
    </a>

    <AppNavbar />

    <main id="contenu">
      <section class="mx-auto max-w-[75rem] px-5 pt-16 pb-20 text-center sm:px-8 sm:pt-24 lg:pt-28">
        <h1 class="enter text-hero mx-auto max-w-5xl text-balance">
          Vos plus-values crypto, prêtes à recopier sur le 2086.
        </h1>
        <p
          class="enter mx-auto mt-8 max-w-2xl text-lg text-pretty text-muted sm:text-xl"
          style="--delay: 80ms"
        >
          Déposez les exports de vos plateformes : Trade Republic, Coinbase, Kraken, Crypto.com,
          Bitvavo. Le calcul suit la méthode officielle, et vos fichiers ne quittent pas votre
          navigateur.
        </p>
        <div class="enter mt-10 flex flex-wrap justify-center gap-3" style="--delay: 160ms">
          <button type="button" class="btn btn-primary" @click="chooseFiles">
            <AppIcon name="upload" />
            Importer mon export
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="loadingExample"
            @click="showExample"
          >
            <span v-if="loadingExample" class="spinner" aria-hidden="true"></span>
            Voir un exemple
          </button>
        </div>
        <p class="enter mt-6 text-sm text-muted" style="--delay: 220ms">
          Gratuit, sans compte, code source ouvert. Vous hésitez à vendre ?
          <a href="#simulation" class="font-semibold text-link hover:underline">
            Simulez l'impôt d'une vente
          </a>
        </p>

        <div class="enter relative mx-auto mt-16 max-w-md text-left" style="--delay: 320ms">
          <!-- Halo local : la carte de verre a quelque chose de coloré à flouter. -->
          <div
            class="absolute -inset-16 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(0_122_255/0.22),rgb(175_82_222/0.12)_55%,transparent)]"
            aria-hidden="true"
          ></div>
          <div class="glass-strong lift rounded-card p-6 sm:p-8">
            <p class="text-sm text-muted">Exemple fictif, revenus 2025</p>
            <p class="mt-1 mb-5 font-semibold">Plus-values sur actifs numériques</p>
            <CombBox code="3AN" :value="331" :delay="700" />
            <dl
              class="numeric mt-6 grid grid-cols-[1fr_auto] gap-y-2 border-t border-separator pt-4 text-sm"
            >
              <dt class="text-muted">Vente d'ETH, 14 août</dt>
              <dd class="font-semibold text-gain">+336,87 €</dd>
              <dt class="text-muted">Vente de BTC, 20 novembre</dt>
              <dd class="font-semibold text-loss">−5,52 €</dd>
            </dl>
          </div>
        </div>
      </section>

      <div class="mx-auto max-w-[75rem] space-y-24 px-5 pb-24 sm:px-8">
        <section id="calcul" aria-labelledby="etape-import" class="scroll-mt-24 space-y-8">
          <StepHeading id="etape-import" :step="1">Importez vos historiques</StepHeading>
          <ImportPanel />
        </section>

        <template v-if="hasData">
          <section v-reveal aria-labelledby="etape-verification" class="space-y-8">
            <StepHeading id="etape-verification" :step="2">Vérifiez votre portefeuille</StepHeading>
            <DataQualityPanel />
            <PortfolioReview />
            <PricesPanel />
          </section>

          <section v-reveal aria-labelledby="etape-resultat" class="scroll-mt-24 space-y-8">
            <StepHeading id="etape-resultat" :step="3">Recopiez votre déclaration</StepHeading>
            <TaxResult />
          </section>

          <p>
            <button type="button" class="btn btn-ghost text-loss" @click="store.reset()">
              <AppIcon name="trash" class="size-4" />
              Effacer les données et recommencer
            </button>
          </p>
        </template>
      </div>

      <section
        id="simulation"
        v-reveal
        aria-labelledby="titre-simulation"
        class="mx-auto max-w-[75rem] scroll-mt-24 px-5 pb-24 sm:px-8"
      >
        <div
          class="space-y-8 sm:rounded-section sm:border sm:border-separator sm:bg-surface-subtle sm:p-10 lg:p-12"
        >
          <div>
            <h2 id="titre-simulation" class="headline text-3xl sm:text-4xl">
              Et si je vendais aujourd'hui ?
            </h2>
            <p class="mt-3 max-w-prose text-lg text-muted">
              Estimez la plus-value et l'impôt d'une vente aux cours du moment, avant de la faire.
            </p>
          </div>
          <SaleSimulator />
        </div>
      </section>
    </main>

    <footer class="border-t border-separator">
      <div class="mx-auto max-w-[75rem] space-y-4 px-5 py-12 text-sm text-muted sm:px-8">
        <p class="max-w-prose">
          CryptoPlusValue est un outil indépendant, sans lien avec l'administration fiscale. Ses
          résultats sont indicatifs et ne remplacent pas un conseil fiscal : vérifiez-les avant de
          déclarer.
        </p>
        <p class="flex flex-wrap gap-x-6 gap-y-2">
          <a :href="docUrl('regles-fiscales')" class="hover:text-label hover:underline">
            Règles appliquées et sources
          </a>
          <a :href="docUrl('imports')" class="hover:text-label hover:underline">
            Formats d'import
          </a>
          <a :href="docUrl('prix')" class="hover:text-label hover:underline"> Cours historiques </a>
        </p>
      </div>
    </footer>
  </div>
</template>
