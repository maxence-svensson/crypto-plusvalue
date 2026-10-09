<script setup lang="ts">
/**
 * Barre d'onglets en verre, en bas de l'écran sur téléphone et petite tablette, comme sur iOS.
 * « Plus » ouvre les autres sections.
 */
const route = useRoute()
const tabs = NAVIGATION.filter((item) => item.tab)
const others = NAVIGATION.filter((item) => !item.tab)

const bar = ref<HTMLElement>()
const moreButton = ref<HTMLButtonElement>()
const open = ref(false)
const moreActive = computed(() => others.some((item) => item.to === route.path))

function onPointerDown(event: PointerEvent) {
  if (open.value && !bar.value?.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') {
    open.value = false
    moreButton.value?.focus()
  }
}

watch(
  () => route.path,
  () => (open.value = false),
)

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="bar"
    class="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden"
  >
    <Transition name="popover">
      <ul
        v-if="open"
        id="menu-plus"
        class="glass-floating absolute right-0 bottom-full mb-2 w-64 origin-bottom-right rounded-[24px] p-2"
      >
        <li v-for="item in others" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex min-h-12 items-center gap-3 rounded-control px-4 font-medium transition-colors duration-200"
            :class="route.path === item.to ? 'bg-accent-tint text-link' : 'hover:bg-field'"
          >
            <AppIcon :name="item.icon" />
            {{ item.label }}
          </NuxtLink>
        </li>
        <li v-for="link in EXTERNAL_LINKS" :key="link.href">
          <a
            :href="link.href"
            class="flex min-h-12 items-center gap-3 rounded-control px-4 text-muted transition-colors duration-200 hover:bg-field"
          >
            <AppIcon name="external" />
            {{ link.label }}
          </a>
        </li>
      </ul>
    </Transition>

    <nav aria-label="Navigation principale" class="glass-floating rounded-[24px] px-1.5 py-1.5">
      <ul class="grid grid-cols-5">
        <li v-for="item in tabs" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-control text-[11px] font-medium transition-colors duration-200"
            :class="route.path === item.to ? 'text-link' : 'text-muted'"
          >
            <AppIcon :name="item.icon" class="size-6" />
            {{ item.short ?? item.label }}
          </NuxtLink>
        </li>
        <li>
          <button
            ref="moreButton"
            type="button"
            class="flex min-h-13 w-full flex-col items-center justify-center gap-0.5 rounded-control text-[11px] font-medium transition-colors duration-200"
            :class="moreActive || open ? 'text-link' : 'text-muted'"
            :aria-expanded="open"
            aria-controls="menu-plus"
            @click="open = !open"
          >
            <AppIcon name="more" class="size-6" />
            Plus
          </button>
        </li>
      </ul>
    </nav>
  </div>
</template>
