<script setup lang="ts">
// « Fiscalité | CryptoPlusValue » ; l'accueil garde son titre complet.
useHead({
  titleTemplate: (title) =>
    title && !title.startsWith('CryptoPlusValue') ? `${title} | CryptoPlusValue` : (title ?? null),
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
