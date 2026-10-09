import type { Download } from '@playwright/test'

import { accessibilityViolations, expect, test } from './fixtures'

/** Valeurs calculées à part (e2e/README.md), avec les cours simulés. */
const BOX_3AN = 'Case 3AN : 362 €'

async function pdfOf(download: Download) {
  const path = await download.path()
  const { readFile } = await import('node:fs/promises')
  return readFile(path)
}

test.describe('page Fiscalité', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fiscalite?exemple')
    await expect(page.getByRole('img', { name: BOX_3AN })).toBeVisible()
  })

  test('calcule les montants à déclarer de l’exemple', async ({ page }) => {
    const result = page.locator('#contenu')
    await expect(result.getByText('+361,88 €').first()).toBeVisible()
    await expect(result.getByText('1 799,20 €').first()).toBeVisible()
    await expect(result.getByText('+315,46 €')).toBeVisible()
    await expect(result.getByText('+46,43 €')).toBeVisible()
    // 12,8 % et 18,6 % de 361,88 €, arrondis au centime chacun : 46,32 € + 67,31 €.
    await expect(result.getByText('Impôt estimé')).toBeVisible()
    await expect(result.getByText('113,63 €').first()).toBeVisible()
    await expect(page.getByText('Résultat provisoire')).toBeHidden()
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
    await expect(page.getByRole('img', { name: BOX_3AN })).toBeVisible()
    await expect(step).toBeChecked()
  })

  test('le résultat respecte les règles d’accessibilité automatisables', async ({ page }) => {
    await page.locator('#regime').getByText('11 %', { exact: true }).click()
    expect(await accessibilityViolations(page)).toEqual([])
  })
})

test('le tableau de bord résume l’exemple et juge son historique complet', async ({ page }) => {
  await page.goto('/?exemple')
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
  await expect(page.getByText('+361,88 €')).toBeVisible()
  const diagnostic = page.locator('section[aria-labelledby="diagnostic"]')
  await expect(diagnostic.getByText('Complet', { exact: true })).toBeVisible()
  await expect(diagnostic.getByText('Récompenses à prix d’acquisition nul')).toBeVisible()
})

test('télécharge les rapports pour un comptable : classeur Excel et CSV', async ({ page }) => {
  await page.goto('/fiscalite?exemple')
  await expect(page.getByRole('img', { name: 'Case 3AN : 362 €' })).toBeVisible()
  const reports = page.getByRole('group', { name: 'Rapports pour un comptable ou un tableur' })
  const { readFile } = await import('node:fs/promises')

  const workbook = page.waitForEvent('download')
  await reports.getByRole('button', { name: 'Classeur Excel' }).click()
  const xlsx = await readFile(await (await workbook).path())
  expect(xlsx.subarray(0, 2).toString()).toBe('PK')
  expect(xlsx.toString('utf8')).toContain('<sheet name="Cessions 2025"')

  const disposals = page.waitForEvent('download')
  await reports.getByRole('button', { name: 'Cessions (CSV)' }).click()
  const file = await disposals
  expect(file.suggestedFilename()).toBe('cessions-crypto-2025.csv')
  const lines = (await readFile(await file.path())).toString('utf8').trim().split('\r\n')
  // Les deux ventes de l'exemple, plus-values calculées à part (e2e/README.md).
  expect(lines).toHaveLength(3)
  expect(lines[1]).toMatch(/;315,46;/)
  expect(lines[2]).toMatch(/;46,43;/)
})
