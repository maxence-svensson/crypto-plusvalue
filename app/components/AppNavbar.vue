<script setup lang="ts">
/**
 * Barre de navigation en verre, qui flotte au-dessus du contenu. Elle se densifie dès que la page
 * défile ; sur téléphone, les liens passent dans un menu déroulant.
 */
const LINKS = [
  { label: 'Importer', href: '#calcul' },
  { label: 'Simuler une vente', href: '#simulation' },
  { label: 'Méthode et sources', href: docUrl('regles-fiscales') },
  { label: 'Code source', href: REPOSITORY },
]

const header = ref<HTMLElement>()
const menuButton = ref<HTMLButtonElement>()
const scrolled = ref(false)
const open = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 8
}

function onPointerDown(event: PointerEvent) {
  if (open.value && !header.value?.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') {
    open.value = false
    menuButton.value?.focus()
  }
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <header
    ref="header"
    class="sticky top-0 z-40 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5"
  >
    <nav
      aria-label="Navigation principale"
      class="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 rounded-[22px] pr-2 pl-4 transition-[background,box-shadow,backdrop-filter] duration-300 ease-ios sm:pl-5"
      :class="scrolled || open ? 'glass-floating' : 'glass'"
    >
      <a href="#haut" class="flex items-center gap-2.5 rounded-chip font-semibold tracking-tight">
        <span
          class="flex size-7 items-center justify-center rounded-[9px] bg-linear-to-br from-[#0a84ff] to-[#5856d6] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
          aria-hidden="true"
        >
          <AppIcon name="trend" class="size-4" />
        </span>
        CryptoPlusValue
      </a>

      <ul class="hidden items-center gap-1 text-sm md:flex">
        <li v-for="link in LINKS" :key="link.href">
          <a
            :href="link.href"
            class="flex min-h-9 items-center rounded-chip px-3 text-muted transition-colors duration-200 hover:bg-field hover:text-label"
          >
            {{ link.label }}
          </a>
        </li>
      </ul>

      <button
        ref="menuButton"
        type="button"
        class="btn btn-ghost size-11 p-0 text-label md:hidden"
        :aria-expanded="open"
        aria-controls="menu-principal"
        :aria-label="open ? 'Fermer le menu' : 'Ouvrir le menu'"
        @click="open = !open"
      >
        <AppIcon :name="open ? 'close' : 'menu'" />
      </button>
    </nav>

    <Transition name="popover">
      <ul
        v-if="open"
        id="menu-principal"
        class="glass-floating absolute top-full right-3 mt-2 w-64 origin-top-right rounded-[24px] p-2 md:hidden"
      >
        <li v-for="link in LINKS" :key="link.href">
          <a
            :href="link.href"
            class="flex min-h-12 items-center rounded-control px-4 font-medium transition-colors duration-200 hover:bg-field"
            @click="open = false"
          >
            {{ link.label }}
          </a>
        </li>
      </ul>
    </Transition>
  </header>
</template>
