<template>
  <footer class="border-t border-separator">
    <div
      class="mx-auto max-w-[72rem] space-y-4 px-5 pt-12 pb-36 text-sm text-muted sm:px-8 lg:pb-12"
    >
      <p class="max-w-prose">
        CryptoPlusValue est un outil indépendant, sans lien avec l'administration fiscale. Ses
        résultats sont indicatifs et ne remplacent pas un conseil fiscal : vérifiez-les avant de
        déclarer. Vos fichiers restent dans ce navigateur.
      </p>
      <p class="flex flex-wrap gap-x-6 gap-y-2">
        <a :href="docUrl('regles-fiscales')" class="hover:text-label hover:underline">
          Règles appliquées et sources
        </a>
        <a :href="docUrl('imports')" class="hover:text-label hover:underline">Formats d'import</a>
        <a :href="docUrl('prix')" class="hover:text-label hover:underline">Cours historiques</a>
        <a :href="REPOSITORY" class="hover:text-label hover:underline">Code source</a>
      </p>
    </div>
  </footer>
</template>
