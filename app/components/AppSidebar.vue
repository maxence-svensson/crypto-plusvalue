<script setup lang="ts">
/** Barre latérale en verre, sur ordinateur et grande tablette. */
const store = usePortfolioStore()
const route = useRoute()
</script>

<template>
  <aside
    class="glass-floating fixed inset-y-3 left-3 z-40 hidden w-60 flex-col rounded-[28px] p-3 lg:flex"
  >
    <NuxtLink to="/" class="flex items-center gap-2.5 rounded-control px-3 py-3 font-semibold">
      <span
        class="flex size-8 items-center justify-center rounded-[10px] bg-linear-to-br from-[#0a84ff] to-[#5856d6] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
        aria-hidden="true"
      >
        <AppIcon name="trend" class="size-4" />
      </span>
      CryptoPlusValue
    </NuxtLink>

    <nav aria-label="Navigation principale" class="mt-4 flex-1">
      <ul class="space-y-1">
        <li v-for="item in NAVIGATION" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] transition-colors duration-200"
            :class="
              route.path === item.to
                ? 'bg-accent-tint font-semibold text-link'
                : 'text-label hover:bg-field'
            "
          >
            <AppIcon :name="item.icon" />
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <div class="space-y-3 px-3 pb-2 text-xs text-muted">
      <p
        v-if="store.demo"
        class="rounded-chip bg-warning-tint px-3 py-2 font-semibold text-warning"
      >
        Mode démonstration : données fictives
      </p>
      <p>Vos fichiers restent dans ce navigateur.</p>
      <p class="flex flex-col">
        <a
          v-for="link in EXTERNAL_LINKS"
          :key="link.href"
          :href="link.href"
          class="flex min-h-7 items-center hover:text-label hover:underline"
          >{{ link.label }}</a
        >
      </p>
    </div>
  </aside>
</template>
