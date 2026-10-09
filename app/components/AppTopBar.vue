<script setup lang="ts">
/**
 * Barre du haut, en verre, qui reste visible au défilement. Sur ordinateur, elle porte la
 * navigation : la marque, les sections, et les paramètres à droite. Sur téléphone, la marque
 * et le rappel du mode démonstration ; les sections sont dans la barre d'onglets du bas.
 */
const store = usePortfolioStore()
const route = useRoute()
const scrolled = ref(false)

const sections = NAVIGATION.filter((item) => item.to !== '/parametres')
const settings = NAVIGATION.find((item) => item.to === '/parametres')

function onScroll() {
  scrolled.value = window.scrollY > 8
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <header
    class="sticky top-0 z-30 mx-auto max-w-[72rem] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8 lg:pt-4"
  >
    <!-- Mêmes marges que le contenu : la barre s'aligne sur les cartes de la page. -->
    <div
      class="flex h-14 items-center gap-3 rounded-[22px] px-4 transition-[background,box-shadow,backdrop-filter] duration-300 ease-ios sm:px-3 lg:h-16 lg:gap-4"
      :class="scrolled ? 'glass-floating' : 'glass'"
    >
      <NuxtLink
        to="/"
        class="flex shrink-0 items-center gap-2.5 rounded-control font-semibold tracking-tight sm:px-1"
      >
        <span
          class="flex size-7 items-center justify-center rounded-[9px] bg-linear-to-br from-[#0a84ff] to-[#5856d6] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] lg:size-8 lg:rounded-[10px]"
          aria-hidden="true"
        >
          <AppIcon name="trend" class="size-4" />
        </span>
        CryptoPlusValue
      </NuxtLink>

      <nav aria-label="Navigation principale" class="hidden min-w-0 flex-1 lg:block">
        <ul class="flex items-center gap-1">
          <li v-for="item in sections" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="flex min-h-10 items-center rounded-full px-3 text-[15px] whitespace-nowrap transition-colors duration-200 xl:px-3.5"
              :class="
                route.path === item.to
                  ? 'bg-accent-tint font-semibold text-link'
                  : 'text-label hover:bg-field'
              "
            >
              {{ item.label }}
            </NuxtLink>
          </li>
          <li v-if="settings" class="ml-auto">
            <NuxtLink
              :to="settings.to"
              class="flex size-10 items-center justify-center rounded-full transition-colors duration-200"
              :class="
                route.path === settings.to
                  ? 'bg-accent-tint text-link'
                  : 'text-label hover:bg-field'
              "
              :title="settings.label"
            >
              <AppIcon :name="settings.icon" />
              <span class="sr-only">{{ settings.label }}</span>
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <span
        v-if="store.demo"
        class="ml-auto shrink-0 rounded-full bg-warning-tint px-2.5 py-1 text-xs font-semibold text-warning lg:hidden"
        >Démonstration</span
      >
    </div>
  </header>
</template>
