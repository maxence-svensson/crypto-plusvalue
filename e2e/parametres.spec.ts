import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

const EXAMPLE = 'public/exemples/trade-republic.csv'

async function importExample(page: Page, { saved = true } = {}) {
  await page.goto('/plateformes')
  await page.setInputFiles('#fichier-import', EXAMPLE)
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByText('14 opérations crypto lues')).toBeVisible()
  // Quitter la page avant la fin de l'écriture dans IndexedDB l'interromprait.
  if (saved) await expect(page.getByText(/Enregistré dans ce navigateur le/)).toBeVisible()
}

test('retrouve les données importées après un rechargement', async ({ page }) => {
  await importExample(page)
  await page.goto('/transactions')
  await expect(page.locator('tbody tr')).toHaveCount(14)
  await page.goto('/parametres')
  await expect(page.getByText(/Enregistré le .* : 14 opérations, 1 fichier/)).toBeVisible()
})

test('quitter la démonstration rend vos propres données', async ({ page }) => {
  await importExample(page)
  await page.goto('/?exemple')
  await expect(page.getByText('Mode démonstration.')).toBeVisible()
  await page.getByRole('button', { name: 'Quitter la démonstration' }).click()
  await expect(page.getByText('Mode démonstration.')).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
  await page.goto('/transactions')
  await expect(page.locator('tbody tr')).toHaveCount(14)
})

test('applique et retient le thème choisi', async ({ page }) => {
  await page.goto('/parametres')
  await page.locator('label').filter({ hasText: 'Sombre' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.locator('label').filter({ hasText: 'Système' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
})

test('efface tout après confirmation', async ({ page }) => {
  await importExample(page)
  await page.goto('/parametres')
  await page.getByRole('button', { name: 'Tout effacer' }).click()
  const dialog = page.getByRole('dialog', { name: 'Tout effacer ?' })
  await expect(dialog).toBeVisible()
  // Annuler ne touche à rien.
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByText(/14 opérations/)).toBeVisible()

  await page.getByRole('button', { name: 'Tout effacer' }).click()
  await dialog.getByRole('button', { name: 'Tout effacer' }).click()
  await expect(page.getByText('Tout a été effacé de ce navigateur.')).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Vos plus-values crypto, prêtes à recopier sur le 2086.',
  )
})

test('n’enregistre rien quand la conservation est coupée', async ({ page }) => {
  await page.goto('/parametres')
  await page.getByRole('switch', { name: /Conserver mes données/ }).uncheck()
  await importExample(page, { saved: false })
  await expect(page.getByText(/Enregistré dans ce navigateur/)).toBeHidden()
  await page.goto('/transactions')
  await expect(page.getByText('Aucune opération pour l’instant')).toBeVisible()
})
