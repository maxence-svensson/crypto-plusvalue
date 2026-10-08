<script setup lang="ts">
const store = usePortfolioStore()
const hasData = computed(() => store.transactions.length > 0)

const REPOSITORY = 'https://github.com/maxence-svensson/crypto-plusvalue'
</script>

<template>
  <div class="min-h-screen">
    <a
      href="#contenu"
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
    >
      Aller au contenu
    </a>

    <header class="border-b border-line bg-surface">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <p class="font-semibold tracking-tight">Crypto<span class="text-accent">PlusValue</span></p>
        <a
          :href="REPOSITORY"
          class="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Code source
        </a>
      </div>
    </header>

    <main id="contenu" class="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:py-14">
      <section class="max-w-3xl">
        <h1 class="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Vos plus-values crypto, ligne par ligne sur le formulaire 2086
        </h1>
        <p class="mt-4 text-lg text-muted">
          Importez l'historique de Trade Republic ou de Coinbase. CryptoPlusValue reconstitue votre
          portefeuille, retrouve le cours de chaque crypto au moment de chaque vente et calcule les
          montants à déclarer, avec la méthode de l'administration fiscale.
        </p>
        <ul class="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <li class="rounded-lg border border-line bg-surface p-3">
            <span class="font-medium">Vos fichiers restent ici.</span>
            <span class="text-muted"> Tout est calculé dans votre navigateur.</span>
          </li>
          <li class="rounded-lg border border-line bg-surface p-3">
            <span class="font-medium">La méthode officielle.</span>
            <span class="text-muted"> Testée sur les exemples chiffrés du BOFiP.</span>
          </li>
          <li class="rounded-lg border border-line bg-surface p-3">
            <span class="font-medium">Gratuit et ouvert.</span>
            <span class="text-muted"> Le code et les sources sont publics.</span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="etape-import" class="space-y-4">
        <h2 id="etape-import" class="text-xl font-semibold">
          <span class="numeric mr-2 text-accent">1</span>Importez vos historiques
        </h2>
        <ImportPanel />
      </section>

      <template v-if="hasData">
        <section aria-labelledby="etape-verification" class="space-y-4">
          <h2 id="etape-verification" class="text-xl font-semibold">
            <span class="numeric mr-2 text-accent">2</span>Vérifiez votre portefeuille
          </h2>
          <PortfolioReview />
          <PricesPanel />
        </section>

        <section aria-labelledby="etape-resultat" class="space-y-4">
          <h2 id="etape-resultat" class="text-xl font-semibold">
            <span class="numeric mr-2 text-accent">3</span>Votre déclaration
          </h2>
          <TaxResult />
        </section>

        <p>
          <button
            type="button"
            class="text-sm text-muted underline underline-offset-2 hover:text-ink"
            @click="store.reset()"
          >
            Effacer les données et recommencer
          </button>
        </p>
      </template>
    </main>

    <footer class="border-t border-line">
      <div class="mx-auto max-w-5xl space-y-2 px-4 py-8 text-sm text-muted">
        <p>
          CryptoPlusValue est un outil indépendant, sans lien avec l'administration fiscale. Ses
          résultats sont indicatifs et ne remplacent pas un conseil fiscal : vérifiez-les avant de
          déclarer.
        </p>
        <p>
          <a
            :href="`${REPOSITORY}/blob/main/docs/regles-fiscales.md`"
            class="underline underline-offset-2 hover:text-ink"
          >
            Règles appliquées et sources
          </a>
          ·
          <a
            :href="`${REPOSITORY}/blob/main/docs/imports.md`"
            class="underline underline-offset-2 hover:text-ink"
          >
            Formats d'import
          </a>
          ·
          <a
            :href="`${REPOSITORY}/blob/main/docs/prix.md`"
            class="underline underline-offset-2 hover:text-ink"
          >
            Cours historiques
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>
