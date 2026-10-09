import { expect, test } from './fixtures'

const PASSWORD = 'une phrase de passe assez longue'

test('télécharge une sauvegarde chiffrée et la restaure après avoir tout effacé', async ({
  page,
}) => {
  await page.goto('/plateformes')
  await page.setInputFiles('#fichier-import', 'public/exemples/trade-republic.csv')
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByText(/Enregistré dans ce navigateur le/)).toBeVisible()

  await page.goto('/parametres')
  const panel = page.getByRole('region', { name: 'Sauvegarde chiffrée' })
  await panel.getByLabel('Mot de passe', { exact: true }).first().fill('court')
  await panel.getByRole('button', { name: 'Télécharger la sauvegarde' }).click()
  await expect(panel.getByRole('alert')).toHaveText('12 caractères au moins.')

  await panel.getByLabel('Mot de passe', { exact: true }).first().fill(PASSWORD)
  await panel.getByLabel('Confirmer le mot de passe').fill(PASSWORD)
  const download = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Télécharger la sauvegarde' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^cryptoplusvalue-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await file.path()
  const { readFile } = await import('node:fs/promises')
  const text = (await readFile(path)).toString('utf8')
  // Rien de lisible : hors des données chiffrées, seulement les paramètres de chiffrement ; dans
  // le chiffré, aucun libellé en clair. (Des chaînes courtes comme « BTC » peuvent apparaître par
  // hasard dans le base64 : on cherche des chaînes longues.)
  const { data, ...envelope } = JSON.parse(text)
  expect(Object.keys(envelope).sort()).toEqual(['cipher', 'createdAt', 'format', 'kdf', 'version'])
  const sealed = Buffer.from(data, 'base64').toString('latin1')
  expect(sealed).not.toContain('trade-republic:exemple')
  expect(sealed).not.toContain('Trade Republic')

  await page.getByRole('button', { name: 'Tout effacer' }).click()
  await page
    .getByRole('dialog', { name: 'Tout effacer ?' })
    .getByRole('button', {
      name: 'Tout effacer',
    })
    .click()
  await expect(page.getByText('Tout a été effacé de ce navigateur.')).toBeVisible()

  await panel.getByLabel('Fichier').setInputFiles(path)
  await expect(panel.getByText(/sauvegarde du \d{2}\/\d{2}\/\d{4}/)).toBeVisible()
  await panel.getByLabel('Mot de passe', { exact: true }).last().fill('pas le bon mot de passe')
  await panel.getByRole('button', { name: 'Restaurer' }).click()
  await expect(panel.getByRole('alert')).toContainText('Mot de passe incorrect')

  await panel.getByLabel('Mot de passe', { exact: true }).last().fill(PASSWORD)
  await panel.getByRole('button', { name: 'Restaurer' }).click()
  await expect(panel.getByText('Sauvegarde restaurée : 14 opérations.')).toBeVisible()

  await page.goto('/transactions')
  await expect(page.locator('tbody tr')).toHaveCount(14)
})

test('refuse un fichier qui n’est pas une sauvegarde', async ({ page }) => {
  await page.goto('/parametres')
  const panel = page.getByRole('region', { name: 'Sauvegarde chiffrée' })
  await panel.getByLabel('Fichier').setInputFiles('public/exemples/trade-republic.csv')
  await expect(panel.getByRole('alert')).toHaveText(
    'Ce fichier n’est pas une sauvegarde CryptoPlusValue.',
  )
})
