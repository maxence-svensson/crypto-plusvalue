<script setup lang="ts">
import { hasForm2086 } from '#shared/cerfa/form2086'
import { PLATFORM_NAMES } from '#shared/importers/detect'
import { declarationStatus } from '#shared/tax/calendar'
import { EXEMPTION_THRESHOLD, type YearSummary } from '#shared/tax/form2086'

/**
 * « Et maintenant ? » : ce qu'il reste à faire après le calcul, étape par étape, avec la date
 * limite de l'année. Les étapes cochées sont retenues dans ce navigateur seulement.
 */
const props = defineProps<{ summary: YearSummary }>()
const store = usePortfolioStore()

const year = computed(() => props.summary.year)
const status = computed(() => declarationStatus(year.value, new Date()))

const platforms = computed(() => [
  ...new Set(
    store.files.flatMap((file) => ('error' in file ? [] : [PLATFORM_NAMES[file.platform]])),
  ),
])

type Step = { id: string; title: string; text: string; link?: { href: string; label: string } }

const steps = computed<Step[]>(() => {
  const { disposals, exempt, box3AN, box3BN } = props.summary
  const list: Step[] = []

  if (disposals.length > 0) {
    list.push({
      id: '2086',
      title: 'Remplir l’annexe 2086',
      text: exempt
        ? `Vos ventes ne dépassent pas ${EXEMPTION_THRESHOLD} € : elles sont exonérées. Sur la 2086, indiquez seulement les dates et les prix de cession (lignes 211 et 213 à 218), et leur total en ligne 51.`
        : `En ligne, à l’étape 3 de votre déclaration, ouvrez « Déclarations annexes » et choisissez la 2086, puis recopiez chaque colonne « Cession » du tableau ci-dessus.${hasForm2086(year.value) ? ' Sur papier, joignez le formulaire rempli.' : ''}`,
    })
  }

  if (!exempt && (box3AN > 0 || box3BN > 0)) {
    const loss = box3BN > 0
    const box = loss ? '3BN' : '3AN'
    list.push({
      id: 'case',
      title: `Vérifier la case ${box}`,
      text:
        `En ligne, la case ${box} se remplit à partir de la 2086 : elle doit indiquer ` +
        `${formatWholeEuros(loss ? box3BN : box3AN)}. Sur papier, reportez ce montant sur la ` +
        `déclaration 2042 C.${loss ? ' Une moins-value ne se reporte pas sur les années suivantes.' : ''}`,
    })
  }

  if (!exempt && box3AN > 0) {
    list.push({
      id: '3cn',
      title: 'Choisir entre prélèvement forfaitaire et barème',
      text:
        'Si le barème vous coûte moins cher, cochez la case 3CN. L’option est définitive pour ' +
        'l’année et vaut pour toutes les plus-values crypto du foyer.',
      link: { href: '#regime', label: 'Comparer les deux régimes' },
    })
  }

  list.push({
    id: '3916',
    title: 'Déclarer vos comptes à l’étranger',
    text:
      'Chaque compte crypto ouvert auprès d’une plateforme établie à l’étranger se déclare chaque ' +
      'année, même sans vente : en ligne, à la fin de la déclaration ; sur papier, avec le ' +
      'formulaire 3916-3916 bis. ' +
      (platforms.value.length > 0 ? `D’après vos fichiers : ${platforms.value.join(', ')}. ` : '') +
      'L’oubli coûte 750 € par compte.',
  })

  if (disposals.length > 0) {
    list.push({
      id: 'dossier',
      title: 'Garder le dossier justificatif',
      text:
        'Il détaille chaque montant et permet de refaire le calcul en cas de contrôle : ' +
        'conservez-le avec votre déclaration.',
      link: { href: '#dossier', label: 'Télécharger le dossier' },
    })
  }
  return list
})

// Étapes cochées : une préférence de ce navigateur, sans incidence sur le calcul.
const done = ref(new Set<string>())
const storageKey = computed(() => `cryptoplusvalue:etapes:${year.value}`)

function load() {
  try {
    done.value = new Set(JSON.parse(localStorage.getItem(storageKey.value) ?? '[]'))
  } catch {
    done.value = new Set()
  }
}

function toggle(id: string) {
  const next = new Set(done.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  done.value = next
  try {
    localStorage.setItem(storageKey.value, JSON.stringify([...next]))
  } catch {
    // Stockage indisponible (navigation privée) : la case reste cochée jusqu'au rechargement.
  }
}

onMounted(load)
watch(storageKey, load)

const doneCount = computed(() => steps.value.filter((step) => done.value.has(step.id)).length)

const onlineDeadlines = computed(() =>
  status.value.kind === 'open'
    ? status.value.campaign.onlineDeadlines
        .map(({ departments, deadline }) => `le ${formatLongDay(deadline)} (${departments})`)
        .join(', ')
    : '',
)
</script>

<template>
  <section aria-labelledby="et-maintenant" class="space-y-5">
    <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h3 id="et-maintenant" class="headline text-2xl">Et maintenant ?</h3>
      <p class="text-sm text-muted" aria-live="polite">
        {{ doneCount }} {{ doneCount > 1 ? 'étapes faites' : 'étape faite' }} sur {{ steps.length }}
      </p>
    </div>

    <div class="glass flex gap-4 rounded-card p-5 text-sm sm:p-6">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-chip bg-accent-tint text-link"
      >
        <AppIcon name="calendar" />
      </span>
      <div class="space-y-2">
        <template v-if="status.kind === 'open'">
          <p class="font-semibold">Dates limites pour les revenus {{ year }}</p>
          <p class="text-muted">
            En ligne, {{ onlineDeadlines }}, selon le département de votre domicile au 1er janvier.
            Sur papier, le {{ formatLongDay(status.campaign.paperDeadline) }}.
          </p>
        </template>
        <template v-else-if="status.kind === 'correction'">
          <p class="font-semibold">
            Revenus {{ year }} : vous pouvez encore corriger jusqu’au
            {{ formatLongDay(status.campaign.correctionUntil) }}
          </p>
          <p class="text-muted">
            La date limite de déclaration est passée. Si vous avez déclaré en ligne sans ces
            montants, corrigez votre déclaration depuis votre espace Finances publiques ; sur
            papier, faites une réclamation. Pas encore déclaré ? Faites-le au plus vite : un dépôt
            tardif entraîne en principe une majoration de 10 %.
          </p>
        </template>
        <template v-else-if="status.kind === 'claim'">
          <p class="font-semibold">
            Revenus {{ year }} : réclamation possible jusqu’au {{ formatLongDay(status.until) }}
          </p>
          <p class="text-muted">
            La correction en ligne est fermée. Pour ajouter ces montants à votre déclaration, faites
            une réclamation depuis votre espace Finances publiques.
          </p>
        </template>
        <template v-else-if="status.kind === 'closed'">
          <p class="font-semibold">Revenus {{ year }} : délai de réclamation écoulé</p>
          <p class="text-muted">Il a pris fin le {{ formatLongDay(status.until) }}.</p>
        </template>
        <template v-else>
          <p class="font-semibold">
            Revenus {{ year }} : à déclarer au printemps {{ status.declarationYear }}
          </p>
          <p class="text-muted">Les dates limites seront publiées sur impots.gouv.fr.</p>
        </template>
        <a
          :href="'campaign' in status ? status.campaign.source : 'https://www.impots.gouv.fr'"
          class="inline-flex items-center gap-1 font-medium text-link hover:underline"
        >
          {{ 'campaign' in status ? 'Le calendrier officiel' : 'impots.gouv.fr' }}
          <AppIcon name="external" class="size-3.5" />
        </a>
      </div>
    </div>

    <ol class="solid-card divide-y divide-separator overflow-hidden rounded-card">
      <li v-for="step in steps" :key="step.id" class="flex gap-4 px-5 py-4 sm:px-6">
        <input
          :id="`etape-${step.id}`"
          type="checkbox"
          class="check mt-0.5"
          :checked="done.has(step.id)"
          @change="toggle(step.id)"
        />
        <div class="min-w-0 flex-1">
          <label
            :for="`etape-${step.id}`"
            class="cursor-pointer font-semibold transition-colors duration-200"
            :class="done.has(step.id) ? 'text-muted' : ''"
          >
            {{ step.title }}
          </label>
          <p class="mt-1 max-w-prose text-sm text-muted">{{ step.text }}</p>
          <a
            v-if="step.link"
            :href="step.link.href"
            class="mt-2 inline-flex text-sm font-medium text-link hover:underline"
          >
            {{ step.link.label }}
          </a>
        </div>
      </li>
    </ol>
  </section>
</template>
