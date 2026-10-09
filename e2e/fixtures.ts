import AxeBuilder from '@axe-core/playwright'
import { test as base, expect, type Page } from '@playwright/test'

/**
 * Cours fixes, pour des résultats reproductibles. Les valeurs attendues des tests ont été
 * calculées à part, sans le moteur de l'application (voir e2e/README.md).
 */
export const PRICES: Record<string, string> = { BTC: '100000', SOL: '150', ETH: '3000' }

export const test = base.extend<{ mockPrices: undefined; pageErrors: undefined }>({
  /**
   * Échoue sur toute erreur non rattrapée de la page et sur tout écart d'hydratation : la page
   * rendue par le serveur doit être celle que le navigateur reprend.
   */
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error' && /hydrat/i.test(message.text())) {
          errors.push(message.text())
        }
      })
      await use(undefined)
      expect(errors).toEqual([])
    },
    { auto: true },
  ],
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

/**
 * Vérifie les règles WCAG automatisables sur l'état final de la page : sans animation, sinon axe
 * mesure le contraste d'un texte encore en train d'apparaître.
 */
export async function accessibilityViolations(page: Page) {
  // Les animations sans fin (indicateur de chargement) ne se terminent jamais : on les ignore.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    ),
  )
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  return results.violations
}

export { expect }
