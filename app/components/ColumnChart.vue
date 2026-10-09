<script setup lang="ts">
/**
 * Colonnes verticales, une ou plusieurs séries, valeurs négatives comprises (sous la ligne de
 * base). Dessin en SVG à la taille réelle du conteneur. Par-dessus, une seule zone couvre tout
 * le graphique : elle suit le pointeur ou le doigt jusqu'à la colonne la plus proche, et se
 * parcourt au clavier avec les flèches (rôle `slider`, dont la valeur annoncée donne toutes les
 * valeurs de la catégorie). Une zone par colonne serait trop étroite sur téléphone (24 px au
 * moins, WCAG 2.2). La vue tableau, à côté, reste l'équivalent complet.
 */
export type ColumnSeries = {
  key: string
  label: string
  /** Couleur CSS des colonnes, `var(--series-1)` par exemple. */
  color: string
  /** Couleur des valeurs négatives, si elle diffère. */
  negativeColor?: string
  values: number[]
}

const props = withDefaults(
  defineProps<{
    /** Nom de la zone interactive, « Achats et ventes par mois » par exemple. */
    label: string
    categories: string[]
    series: ColumnSeries[]
    format: (value: number) => string
    /** Ligne de plus dans l'infobulle et le nom accessible de la catégorie. */
    note?: (index: number) => string
    /** Valeur écrite au bout de chaque colonne (peu de colonnes) ; sinon seulement les extrêmes. */
    labelAll?: boolean
    height?: number
  }>(),
  { note: undefined, labelAll: false, height: 260 },
)

const container = ref<HTMLElement>()
const width = ref(640)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (!container.value) return
  width.value = container.value.clientWidth || width.value
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(240, Math.round(entry.contentRect.width))
  })
  observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

const MARGIN = { top: 22, right: 4, bottom: 30, left: 56 }
const BAR_MAX = 24
const GAP = 2

const values = computed(() => props.series.flatMap((series) => series.values))
const ticks = computed(() => niceTicks(Math.min(...values.value), Math.max(...values.value)))
const plot = computed(() => ({
  width: width.value - MARGIN.left - MARGIN.right,
  height: props.height - MARGIN.top - MARGIN.bottom,
}))
const y = (value: number) => {
  const low = ticks.value[0] ?? 0
  const high = ticks.value.at(-1) ?? 1
  const span = high - low || 1
  return MARGIN.top + plot.value.height * (1 - (value - low) / span)
}
const band = computed(() => plot.value.width / Math.max(1, props.categories.length))
const barWidth = computed(() => {
  const count = props.series.length
  return Math.max(2, Math.min(BAR_MAX, (band.value * 0.7 - GAP * (count - 1)) / count))
})
/** Une étiquette d'axe sur deux quand les colonnes sont trop serrées. */
const labelEvery = computed(() => (band.value < 34 ? 2 : 1))

/** Colonne arrondie (4 px) au bout de la donnée, carrée sur la ligne de base. */
function columnPath(x: number, value: number): string {
  const base = y(0)
  const end = y(value)
  const w = barWidth.value
  const h = Math.abs(base - end)
  if (h < 0.5) return ''
  const r = Math.min(4, w / 2, h)
  if (value >= 0) {
    return `M${x},${base}V${end + r}Q${x},${end} ${x + r},${end}H${x + w - r}Q${x + w},${end} ${x + w},${end + r}V${base}Z`
  }
  return `M${x},${base}V${end - r}Q${x},${end} ${x + r},${end}H${x + w - r}Q${x + w},${end} ${x + w},${end - r}V${base}Z`
}

const bars = computed(() =>
  props.categories.flatMap((_, index) => {
    const groupWidth = barWidth.value * props.series.length + GAP * (props.series.length - 1)
    const start = MARGIN.left + band.value * index + (band.value - groupWidth) / 2
    return props.series.map((series, position) => {
      const value = series.values[index] ?? 0
      const x = start + position * (barWidth.value + GAP)
      return {
        key: `${series.key}-${index}`,
        index,
        series,
        value,
        x,
        path: columnPath(x, value),
        color: value < 0 && series.negativeColor ? series.negativeColor : series.color,
      }
    })
  }),
)

/** Valeurs écrites : toutes, ou le maximum de chaque série (étiquetage sélectif). */
const labels = computed(() =>
  bars.value.filter((bar) => {
    if (bar.value === 0 || !bar.path) return false
    if (props.labelAll) return true
    const extreme = Math.max(...bar.series.values.map(Math.abs))
    return (
      Math.abs(bar.value) === extreme &&
      bar.series.values.findIndex((v) => Math.abs(v) === extreme) === bar.index
    )
  }),
)

const active = ref<number>()
const overlay = ref<HTMLElement>()

/** La colonne sous le pointeur : la plus proche, sans viser le trait. */
function pointAt(event: PointerEvent) {
  const box = overlay.value?.getBoundingClientRect()
  if (!box) return
  const index = Math.floor((event.clientX - box.left) / band.value)
  active.value = Math.min(Math.max(index, 0), props.categories.length - 1)
}

function leave() {
  if (document.activeElement !== overlay.value) active.value = undefined
}

function onKey(event: KeyboardEvent) {
  const last = props.categories.length - 1
  const current = active.value ?? 0
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowUp'
      ? Math.min(current + 1, last)
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? Math.max(current - 1, 0)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : undefined
  if (next === undefined) return
  event.preventDefault()
  active.value = next
}

function readout(index: number): string {
  const parts = props.series.map(
    (series) => `${series.label} : ${props.format(series.values[index] ?? 0)}`,
  )
  const note = props.note?.(index)
  return [props.categories[index], ...parts, ...(note ? [note] : [])].join(', ')
}

const tooltipLeft = computed(() => {
  if (active.value === undefined) return 0
  const center = MARGIN.left + band.value * (active.value + 0.5)
  return Math.min(Math.max(center, 96), width.value - 96)
})
</script>

<template>
  <div ref="container" class="relative select-none">
    <svg :width="width" :height="height" class="block overflow-visible" aria-hidden="true">
      <rect
        v-if="active !== undefined"
        :x="MARGIN.left + band * active"
        :y="MARGIN.top"
        :width="band"
        :height="plot.height"
        rx="6"
        class="fill-field"
      />
      <g v-for="tick in ticks" :key="tick">
        <line
          :x1="MARGIN.left"
          :x2="width - MARGIN.right"
          :y1="y(tick)"
          :y2="y(tick)"
          :stroke="tick === 0 ? 'var(--text-secondary)' : 'var(--separator)'"
          :stroke-opacity="tick === 0 ? 0.5 : 1"
          shape-rendering="crispEdges"
        />
        <text
          :x="MARGIN.left - 8"
          :y="y(tick)"
          text-anchor="end"
          dominant-baseline="middle"
          class="numeric fill-muted text-[11px]"
        >
          {{ formatCompactEuros(tick) }}
        </text>
      </g>
      <path v-for="bar in bars" :key="bar.key" :d="bar.path" :fill="bar.color" />
      <text
        v-for="bar in labels"
        :key="`valeur-${bar.key}`"
        :x="bar.x + barWidth / 2"
        :y="bar.value >= 0 ? y(bar.value) - 6 : y(bar.value) + 14"
        text-anchor="middle"
        class="numeric fill-label text-[11px] font-semibold"
      >
        {{ format(bar.value) }}
      </text>
      <text
        v-for="(category, index) in categories"
        v-show="index % labelEvery === 0"
        :key="category"
        :x="MARGIN.left + band * (index + 0.5)"
        :y="height - 8"
        text-anchor="middle"
        class="fill-muted text-[11px]"
      >
        {{ category }}
      </text>
    </svg>

    <div
      ref="overlay"
      class="absolute touch-pan-y rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      :style="{
        left: `${MARGIN.left}px`,
        top: `${MARGIN.top}px`,
        width: `${plot.width}px`,
        height: `${plot.height}px`,
      }"
      role="slider"
      tabindex="0"
      :aria-label="label"
      aria-valuemin="0"
      :aria-valuemax="categories.length - 1"
      :aria-valuenow="active ?? 0"
      :aria-valuetext="readout(active ?? 0)"
      @pointermove="pointAt"
      @pointerdown="pointAt"
      @pointerleave="leave"
      @focus="active ??= 0"
      @blur="active = undefined"
      @keydown="onKey"
    ></div>

    <div
      v-if="active !== undefined"
      class="glass-floating pointer-events-none absolute top-0 z-10 min-w-40 -translate-x-1/2 -translate-y-full rounded-control px-3 py-2 text-sm"
      :style="{ left: `${tooltipLeft}px` }"
      aria-hidden="true"
    >
      <p class="font-semibold">{{ categories[active] }}</p>
      <p v-for="item in series" :key="item.key" class="mt-1 flex items-center gap-2">
        <span
          class="h-0.5 w-3 shrink-0 rounded-full"
          :style="{
            background:
              (item.values[active] ?? 0) < 0 && item.negativeColor
                ? item.negativeColor
                : item.color,
          }"
        ></span>
        <span class="numeric font-semibold">{{ format(item.values[active] ?? 0) }}</span>
        <span class="text-muted">{{ item.label }}</span>
      </p>
      <p v-if="note" class="mt-1 text-muted">{{ note(active) }}</p>
    </div>
  </div>
</template>
