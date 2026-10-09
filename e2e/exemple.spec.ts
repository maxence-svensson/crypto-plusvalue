import AxeBuilder from '@axe-core/playwright'
import type { Download } from '@playwright/test'

import { expect, test } from './fixtures'

/** Valeurs calculées à part (e2e/README.md), avec les cours simulés. */
const BOX_3AN = 'Case 3AN : 362 €'

async function pdfOf(download: Download) {
  const path = await download.path()
  const { readFile } = await import('node:fs/promises')
  return readFile(path)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?exemple')
  await expect(page.getByRole('img', { name: BOX_3AN }).last()).toBeVisible()
})

test('calcule les montants à déclarer de l’exemple', async ({ page }) => {
  const result = page.locator('section[aria-labelledby="etape-resultat"]')
  await expect(result.getByText('+361,88 €').first()).toBeVisible()
  await expect(result.getByText('1 799,20 €').first()).toBeVisible()
  await expect(result.getByText('+315,46 €')).toBeVisible()
  await expect(result.getByText('+46,43 €')).toBeVisible()
})

test('compare prélèvement forfaitaire et barème', async ({ page }) => {
  const regime = page.locator('#regime')
  await regime.getByText('11 %', { exact: true }).click()
  await expect(regime.getByText('113,63 €')).toBeVisible()
  await expect(regime.getByText('107,12 €')).toBeVisible()
  await expect(regime.getByRole('status')).toContainText('Cochez la case 3CN')
  await expect(regime.getByRole('status')).toContainText('6,51 €')
})

test('télécharge le 2086 rempli et le dossier justificatif', async ({ page }) => {
  const [form] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Télécharger le 2086 rempli' }).click(),
  ])
  expect(form.suggestedFilename()).toBe('formulaire-2086-revenus-2025.pdf')
  const formBytes = await pdfOf(form)
  expect(formBytes.subarray(0, 5).toString()).toBe('%PDF-')
  expect(formBytes.length).toBeGreaterThan(100_000)

  const [dossier] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Télécharger le dossier justificatif' }).click(),
  ])
  expect(dossier.suggestedFilename()).toBe('dossier-justificatif-crypto-revenus-2025.pdf')
  expect((await pdfOf(dossier)).subarray(0, 5).toString()).toBe('%PDF-')
})

test('retient les étapes cochées après un rechargement', async ({ page }) => {
  const step = page.getByRole('checkbox', { name: 'Déclarer vos comptes à l’étranger' })
  await step.check()
  await expect(page.getByText('1 étape faite sur 5')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('img', { name: BOX_3AN }).last()).toBeVisible()
  await expect(step).toBeChecked()
})

test('le résultat respecte les règles d’accessibilité automatisables', async ({ page }) => {
  await page.locator('#regime').getByText('11 %', { exact: true }).click()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
