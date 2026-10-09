<script setup lang="ts">
import { FORM_2086, hasForm2086 } from '#shared/cerfa/form2086'
import { EXEMPTION_THRESHOLD, taxYear } from '#shared/tax/form2086'
import { FIRST_YEAR, flatRate, flatTax, taxRules } from '#shared/tax/rules'

const store = usePortfolioStore()

/** Par défaut : la dernière année où il y a eu des cessions, sinon la plus récente. */
const defaultYear = computed(() => {
  const state = store.computation
  const withDisposals = state.status === 'ready' ? state.disposals.map((d) => taxYear(d.date)) : []
  return withDisposals.length > 0 ? Math.max(...withDisposals) : store.years[0]
})
const chosenYear = ref<number>()
const year = computed(() => chosenYear.value ?? defaultYear.value)

const summary = computed(() => (year.value === undefined ? undefined : store.summary(year.value)))
const isLoss = computed(() => (summary.value?.box3BN ?? 0) > 0)
const rules = computed(() => (year.value === undefined ? undefined : taxRules(year.value)))
const estimatedTax = computed(() => (summary.value ? flatTax(summary.value) : undefined))

/** Un historique antérieur à 2019 relève en partie d'un autre régime : à signaler. */
const startsBefore2019 = computed(() =>
  store.transactions.some((transaction) => taxYear(transaction.date) < FIRST_YEAR),
)

const downloading = ref<'form' | 'dossier' | ReportKind>()

const REPORTS: { kind: ReportKind; label: string }[] = [
  { kind: 'classeur', label: 'Classeur Excel' },
  { kind: 'cessions', label: 'Cessions (CSV)' },
  { kind: 'points', label: 'Points à vérifier (CSV)' },
]
const downloadError = ref('')

const FAILURES: Record<'form' | 'dossier' | ReportKind, string> = {
  form: 'Le formulaire n’a pas pu être préparé.',
  dossier: 'Le dossier n’a pas pu être préparé.',
  classeur: 'Le classeur n’a pas pu être préparé.',
  cessions: 'La liste des cessions n’a pas pu être préparée.',
  points: 'La liste des points à vérifier n’a pas pu être préparée.',
}

async function download(kind: 'form' | 'dossier' | ReportKind) {
  if (!summary.value) return
  downloading.value = kind
  downloadError.value = ''
  try {
    if (kind === 'form') await downloadForm2086(summary.value)
    else if (kind === 'dossier') await downloadDossier(summary.value.year)
    else await downloadReport(kind, summary.value.year)
  } catch {
    downloadError.value = `${FAILURES[kind]} Réessayez dans un instant.`
  } finally {
    downloading.value = undefined
  }
}
</script>

<template>
  <div class="space-y-8">
    <template v-if="store.computation.status === 'missing-prices'">
      <p class="flex items-center gap-2 text-muted" role="status">
        <span v-if="store.fetchingPrices" class="spinner" aria-hidden="true"></span>
        {{
          store.fetchingPrices
            ? 'Récupération des cours…'
            : 'Il manque des cours pour terminer le calcul : complétez-les ci-dessus.'
        }}
      </p>
      <!-- Squelette du résultat pendant la récupération des cours. -->
      <div
        v-if="store.fetchingPrices"
        class="glass grid gap-8 rounded-section p-6 sm:p-10 md:grid-cols-[auto_1fr] md:gap-12"
        aria-hidden="true"
      >
        <div class="space-y-3">
          <div class="skeleton h-4 w-40"></div>
          <div class="skeleton h-5 w-56"></div>
          <div class="skeleton h-16 w-72 max-w-full rounded-control"></div>
        </div>
        <div class="space-y-4 self-center">
          <div class="skeleton h-5 w-full"></div>
          <div class="skeleton h-5 w-5/6"></div>
          <div class="skeleton h-5 w-2/3"></div>
        </div>
      </div>
    </template>

    <p v-else-if="store.computation.status === 'error'" class="text-loss" role="alert">
      {{ store.computation.message }}
    </p>

    <template v-else-if="summary && year !== undefined">
      <fieldset v-if="store.years.length > 1">
        <legend class="text-sm text-muted">Année des ventes</legend>
        <div class="segmented mt-2">
          <label v-for="option in store.years" :key="option">
            <input v-model="chosenYear" type="radio" name="year" :value="option" class="sr-only" />
            {{ option }}
          </label>
        </div>
      </fieldset>

      <div
        v-if="startsBefore2019"
        class="flex gap-4 rounded-card bg-warning-tint px-5 py-5 text-sm sm:px-6"
        role="note"
      >
        <AppIcon name="alert" class="mt-0.5 text-warning" />
        <div>
          <p class="font-semibold text-warning">Historique antérieur à {{ FIRST_YEAR }}</p>
          <p class="mt-1 max-w-prose">
            Le calcul du formulaire 2086 s'applique aux cessions faites depuis le 1er janvier
            {{ FIRST_YEAR }}. Le prix total d'acquisition des cryptos achetées avant obéit à des
            règles particulières (BOFiP BOI-RPPM-PVBMC-30-20, §130) : vérifiez la ligne 220 avec un
            conseil fiscal.
          </p>
        </div>
      </div>

      <div v-if="year < FIRST_YEAR" class="glass rounded-card p-6 sm:p-8">
        <p class="headline text-xl">Revenus {{ year }} : autre régime</p>
        <p class="mt-2 max-w-prose text-muted">
          Avant {{ FIRST_YEAR }}, les cessions de cryptos relevaient d'un autre régime d'imposition,
          sans formulaire 2086 : elles ne sont pas calculées ici.
        </p>
      </div>

      <div v-else-if="summary.disposals.length === 0" class="glass rounded-card p-6 sm:p-8">
        <p class="headline text-xl">Rien à déclarer pour {{ year }}</p>
        <p class="mt-2 max-w-prose text-muted">
          Vous n'avez rien vendu contre des euros ni payé avec vos cryptos cette année-là : pas de
          plus-value, et pas de formulaire 2086 à remplir pour {{ year }}. Les achats, les échanges
          entre cryptos et le staking ne sont pas des ventes imposables.
        </p>
      </div>

      <template v-else>
        <div
          v-if="store.quality.level === 'incomplet'"
          class="flex gap-4 rounded-card bg-warning-tint px-5 py-5 text-sm sm:px-6"
          role="alert"
        >
          <AppIcon name="alert" class="mt-0.5 text-loss" />
          <div>
            <p class="font-semibold text-loss">Résultat provisoire</p>
            <p class="mt-1 max-w-prose">
              Il manque des données dans votre historique : les montants ci-dessous ne sont pas
              encore ceux à déclarer. Le diagnostic, plus haut, indique quoi compléter.
            </p>
          </div>
        </div>

        <div
          class="glass-strong grid gap-8 rounded-section p-6 sm:p-10 md:grid-cols-[auto_1fr] md:items-center md:gap-14"
        >
          <div>
            <p class="text-sm text-muted">Déclaration 2042 C, revenus {{ year }}</p>
            <p class="mt-1 mb-5 font-semibold">
              {{
                isLoss ? 'Moins-value sur actifs numériques' : 'Plus-value sur actifs numériques'
              }}
            </p>
            <CombBox
              :code="isLoss ? '3BN' : '3AN'"
              :value="isLoss ? summary.box3BN : summary.box3AN"
            />
            <p v-if="summary.exempt" class="mt-4 flex items-center gap-2 text-sm text-gain">
              <AppIcon name="check" class="size-4" />
              Vos ventes ne dépassent pas {{ EXEMPTION_THRESHOLD }} € : elles sont exonérées.
            </p>
          </div>
          <dl class="divide-y divide-separator text-sm">
            <div class="flex items-baseline justify-between gap-4 py-3.5">
              <dt>
                <span class="font-semibold">Ligne 224</span>
                <span class="text-muted"> du 2086, plus ou moins-value nette</span>
              </dt>
              <dd class="numeric text-base font-semibold whitespace-nowrap">
                {{ formatSignedEuros(summary.netGain) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-4 py-3.5">
              <dt>
                <span class="font-semibold">Ligne 51</span>
                <span class="text-muted"> du 2086, total des ventes</span>
              </dt>
              <dd class="numeric text-base font-semibold whitespace-nowrap">
                {{ formatEuros(summary.totalPrice) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-4 py-3.5">
              <dt>
                <span class="font-semibold">Impôt estimé</span>
                <span class="text-muted">
                  au prélèvement forfaitaire<template v-if="rules">
                    de {{ formatPercent(flatRate(rules)) }}</template
                  ></span
                >
              </dt>
              <dd class="numeric text-base font-semibold whitespace-nowrap">
                {{ estimatedTax ? formatEuros(estimatedTax) : 'taux pas encore connus' }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-4 py-3.5">
              <dt class="text-muted">Ventes imposables dans l'année</dt>
              <dd class="numeric text-base font-semibold">{{ summary.disposals.length }}</dd>
            </div>
          </dl>
        </div>

        <RegimeComparison v-if="summary.box3AN > 0" :gain="summary.netGain" :year="year" />

        <div>
          <h2 class="headline text-2xl">Le formulaire 2086, cession par cession</h2>
          <p v-if="!hasForm2086(year)" class="mt-3 max-w-prose text-sm text-muted">
            {{
              year > FORM_2086.year
                ? `L'administration n'a pas encore publié le formulaire 2086 des revenus ${year} : recopiez les montants ci-dessous quand il sera disponible.`
                : `Le formulaire rempli n'est proposé que pour les revenus ${FORM_2086.year} : recopiez les montants ci-dessous.`
            }}
          </p>
          <div class="mt-5 grid gap-4 lg:grid-cols-2">
            <div
              v-if="hasForm2086(year)"
              class="glass flex flex-col items-start gap-5 rounded-card p-5 sm:p-6"
            >
              <div class="flex gap-4">
                <span
                  class="flex size-12 shrink-0 items-center justify-center rounded-control bg-accent-tint text-link"
                >
                  <AppIcon name="file" class="size-6" />
                </span>
                <p class="text-sm text-muted">
                  <span class="block font-semibold text-label"
                    >Le formulaire officiel, déjà rempli.</span
                  >
                  Toutes les cases calculées sont complétées, en euros entiers. Il reste à ajouter
                  vos nom et adresse, à vérifier, puis à le joindre à votre déclaration.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-primary mt-auto"
                :disabled="downloading === 'form'"
                @click="download('form')"
              >
                <span v-if="downloading === 'form'" class="spinner" aria-hidden="true"></span>
                <AppIcon v-else name="download" />
                {{
                  downloading === 'form'
                    ? 'Préparation du formulaire…'
                    : 'Télécharger le 2086 rempli'
                }}
              </button>
            </div>
            <div
              id="dossier"
              class="glass flex scroll-mt-28 flex-col items-start gap-5 rounded-card p-5 sm:p-6"
            >
              <div class="flex gap-4">
                <span
                  class="flex size-12 shrink-0 items-center justify-center rounded-control bg-accent-tint text-link"
                >
                  <AppIcon name="folder" class="size-6" />
                </span>
                <p class="text-sm text-muted">
                  <span class="block font-semibold text-label"
                    >Le dossier justificatif, à conserver.</span
                  >
                  Le détail de chaque cession, les cours retenus et leurs sources, et l'historique
                  de vos opérations : de quoi refaire le calcul en cas de contrôle.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-secondary mt-auto"
                :disabled="downloading === 'dossier'"
                @click="download('dossier')"
              >
                <span v-if="downloading === 'dossier'" class="spinner" aria-hidden="true"></span>
                <AppIcon v-else name="download" />
                {{
                  downloading === 'dossier'
                    ? 'Préparation du dossier…'
                    : 'Télécharger le dossier justificatif'
                }}
              </button>
            </div>
          </div>
          <div
            class="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm"
            role="group"
            aria-label="Rapports pour un comptable ou un tableur"
          >
            <span class="mr-2 text-muted">Pour un comptable ou un tableur :</span>
            <button
              v-for="report in REPORTS"
              :key="report.kind"
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="downloading === report.kind"
              @click="download(report.kind)"
            >
              <span v-if="downloading === report.kind" class="spinner" aria-hidden="true"></span>
              <AppIcon v-else name="download" />
              {{ report.label }}
            </button>
          </div>
          <p v-if="downloadError" class="mt-3 text-sm text-loss" role="alert">
            {{ downloadError }}
          </p>
          <p class="mt-6 max-w-prose text-sm text-muted">
            Le détail ci-dessous est calculé sans arrondi intermédiaire.
          </p>
          <Form2086Table
            class="solid-card mt-4 rounded-card p-3 sm:p-5"
            :disposals="summary.disposals"
          />
        </div>
      </template>

      <NextSteps v-if="year >= FIRST_YEAR" :summary="summary" />
    </template>
  </div>
</template>
