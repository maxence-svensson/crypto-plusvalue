import { test as base, expect } from '@playwright/test'

/**
 * Cours fixes, pour des résultats reproductibles. Les valeurs attendues des tests ont été
 * calculées à part, sans le moteur de l'application (voir e2e/README.md).
 */
export const PRICES: Record<string, string> = { BTC: '100000', SOL: '150', ETH: '3000' }

export const test = base.extend<{ mockPrices: undefined }>({
  mockPrices: [
    async ({ page }, use) => {
      await page.route('**/api/price?*', async (route) => {
        const url = new URL(route.request().url())
        const asset = url.searchParams.get('asset') ?? ''
        const price = PRICES[asset]
        if (!price) {
          await route.fulfill({
            status: 404,
            json: { message: `Aucun cours trouvé pour ${asset}` },
          })
          return
        }
        await route.fulfill({
          json: {
            asset,
            minute: url.searchParams.get('at'),
            priceEur: price,
            source: `Test ${asset}/EUR`,
          },
        })
      })
      await use(undefined)
    },
    { auto: true },
  ],
})

export { expect }
