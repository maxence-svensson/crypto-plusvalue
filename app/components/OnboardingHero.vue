<script setup lang="ts">
/** Accueil d'un nouveau visiteur : ce que fait l'outil, et comment commencer. */
const store = usePortfolioStore()

/** L'exemple s'ouvre en haut de la page, sur le tableau de bord ou la section demandée. */
async function showExample() {
  await store.loadExample()
  window.scrollTo({ top: 0 })
}

function chooseFiles() {
  document.getElementById('fichier-import')?.click()
}

const STEPS = [
  {
    title: 'Importez vos historiques',
    text: 'L’export CSV de chaque plateforme. Un aperçu montre ce qui sera importé, doublons compris.',
  },
  {
    title: 'Vérifiez',
    text: 'Le diagnostic signale les achats manquants, les transferts sans contrepartie et les cours introuvables.',
  },
  {
    title: 'Déclarez',
    text: 'Le formulaire 2086 rempli, la case 3AN, le dossier justificatif et les étapes de la déclaration.',
  },
]
</script>

<template>
  <div>
    <section class="pt-6 pb-16 text-center sm:pt-12 lg:pt-16">
      <h1 class="enter text-hero mx-auto max-w-5xl text-balance">
        Vos plus-values crypto, prêtes à déclarer.
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
        <button type="button" class="btn btn-secondary" :disabled="store.demo" @click="showExample">
          Voir un exemple
        </button>
      </div>
      <p class="enter mt-6 text-sm text-muted" style="--delay: 220ms">
        Gratuit, sans compte, code source ouvert. Vous hésitez à vendre ?
        <NuxtLink to="/simulateur" class="font-semibold text-link hover:underline">
          Simulez l'impôt d'une vente
        </NuxtLink>
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

    <section aria-labelledby="comment" class="space-y-8 pb-8">
      <h2 id="comment" class="headline text-3xl sm:text-4xl">Comment ça marche</h2>
      <ol class="grid gap-4 md:grid-cols-3">
        <li
          v-for="(step, index) in STEPS"
          :key="step.title"
          class="solid-card flex gap-4 rounded-card p-5 sm:p-6"
        >
          <span
            class="numeric flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint font-semibold text-link"
            aria-hidden="true"
            >{{ index + 1 }}</span
          >
          <div>
            <p class="font-semibold">{{ step.title }}</p>
            <p class="mt-1 text-sm text-muted">{{ step.text }}</p>
          </div>
        </li>
      </ol>
      <ImportPanel />
    </section>
  </div>
</template>
