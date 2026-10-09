import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Le moteur de calcul (`shared/`) est du TypeScript pur : pas besoin de l'environnement Nuxt.
export default defineConfig({
  resolve: {
    alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'app/utils/**/*.test.ts'],
  },
})
