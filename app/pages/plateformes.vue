<script setup lang="ts">
useHead({ title: 'Plateformes' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Plateformes"
      description="Importez l’historique complet de chaque plateforme, depuis l’ouverture du compte. Vos fichiers sont lus dans ce navigateur et ne sont envoyés nulle part."
    />
    <ImportPanel />
  </div>
</template>
