import { accessibilityViolations, expect, test } from './fixtures'

test('présente l’outil et propose d’importer ou d’essayer l’exemple', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Vos plus-values crypto, prêtes à recopier sur le 2086.',
  )
  await expect(page.getByRole('button', { name: 'Importer mon export' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Voir un exemple' })).toBeVisible()
})

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`ne défile pas horizontalement à ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/?exemple')
    await expect(page.getByRole('img', { name: /^Case 3AN/ }).last()).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test('le menu mobile s’ouvre, se ferme avec Échap et rend le focus', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'menu réservé aux petits écrans')
  await page.goto('/')
  const button = page.getByRole('button', { name: 'Ouvrir le menu' })
  await button.click()
  const menu = page.locator('#menu-principal')
  await expect(menu.getByRole('link')).toHaveText([
    'Importer',
    'Simuler une vente',
    'Méthode et sources',
    'Code source',
  ])
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(page.getByRole('button', { name: 'Ouvrir le menu' })).toBeFocused()
})

test('l’accueil respecte les règles d’accessibilité automatisables', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  expect(await accessibilityViolations(page)).toEqual([])
})
