import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@pinia/nuxt'],
  // Polices du système (San Francisco sur les appareils Apple) : rien à télécharger.
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  // En-têtes de sécurité sur toutes les réponses (pages, fichiers et API). La CSP se limite pour
  // l'instant à ce qui ne gêne pas les scripts intégrés de Nuxt ; voir SECURITY.md.
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy':
          "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      // viewport-fit=cover : la barre de navigation tient compte de l'encoche des iPhone.
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      title: 'CryptoPlusValue : vos plus-values crypto pour le formulaire 2086',
      meta: [
        { name: 'theme-color', content: '#f5f5f7', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#000000', media: '(prefers-color-scheme: dark)' },
        {
          name: 'description',
          content:
            'Importez vos transactions crypto et obtenez les montants à reporter sur le formulaire 2086. Vos transactions restent dans votre navigateur.',
        },
      ],
    },
  },
})
