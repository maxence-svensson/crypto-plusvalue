<script setup lang="ts">
/** En-tête des petits écrans : la marque, et le rappel du mode démonstration. */
const store = usePortfolioStore()
const scrolled = ref(false)

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
  <header class="sticky top-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
    <div
      class="flex h-14 items-center justify-between gap-3 rounded-[22px] px-4 transition-[background,box-shadow,backdrop-filter] duration-300 ease-ios"
      :class="scrolled ? 'glass-floating' : 'glass'"
    >
      <NuxtLink to="/" class="flex items-center gap-2.5 font-semibold tracking-tight">
        <span
          class="flex size-7 items-center justify-center rounded-[9px] bg-linear-to-br from-[#0a84ff] to-[#5856d6] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
          aria-hidden="true"
        >
          <AppIcon name="trend" class="size-4" />
        </span>
        CryptoPlusValue
      </NuxtLink>
      <span
        v-if="store.demo"
        class="rounded-full bg-warning-tint px-2.5 py-1 text-xs font-semibold text-warning"
        >Démonstration</span
      >
    </div>
  </header>
</template>
