import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@pinia/nuxt'],
  // Archivo variable (graisse et largeur), hébergée par le site : aucune requête vers Google.
  css: ['@fontsource-variable/archivo/wdth.css', '~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'CryptoPlusValue : vos plus-values crypto pour le formulaire 2086',
      meta: [
        {
          name: 'description',
          content:
            'Importez vos transactions crypto et obtenez les montants à reporter sur le formulaire 2086. Vos transactions restent dans votre navigateur.',
        },
      ],
    },
  },
})
