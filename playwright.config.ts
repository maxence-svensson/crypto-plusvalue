import { defineConfig, devices } from '@playwright/test'

/**
 * Tests de bout en bout sur le build de production (`npm run build` d'abord). En local, Microsoft
 * Edge installé sur la machine suffit ; la CI teste Chromium, Firefox et WebKit, sur ordinateur et
 * sur mobile. Les cours sont simulés (e2e/fixtures.ts) : les tests ne dépendent d'aucune API.
 */
const ci = Boolean(process.env.CI)
const edge = ci ? {} : { channel: 'msedge' }

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3005',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node .output/server/index.mjs',
    env: { PORT: '3005' },
    url: 'http://localhost:3005',
    reuseExistingServer: !ci,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...edge } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], ...edge } },
    ...(ci
      ? [
          { name: 'firefox', use: devices['Desktop Firefox'] },
          { name: 'webkit', use: devices['Desktop Safari'] },
          { name: 'mobile-webkit', use: devices['iPhone 15'] },
        ]
      : []),
  ],
})
