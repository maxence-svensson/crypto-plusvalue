import type { Page } from '@playwright/test'

import { accessibilityViolations, expect, test } from './fixtures'

const EXAMPLE = 'public/exemples/trade-republic.csv'
const rows = (page: Page) => page.locator('tbody tr')

async function importExample(page: Page) {
  await page.goto('/plateformes')
  await page.setInputFiles('#fichier-import', EXAMPLE)
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByText('14 opérations crypto lues')).toBeVisible()
}

test.describe('liste des opérations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions?exemple')
    await expect(rows(page)).toHaveCount(14)
  })

  test('cherche, filtre et trie', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Rechercher une opération' }).fill('eth')
    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByText('2 opérations sur 14')).toBeVisible()

    await page.getByLabel('Type', { exact: true }).selectOption({ label: 'Vente' })
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('1 487,22 €')

    await page.getByRole('button', { name: 'Effacer les filtres' }).first().click()
    await expect(rows(page)).toHaveCount(14)

    await page.getByLabel('Crypto', { exact: true }).selectOption('SOL')
    await expect(rows(page)).toHaveCount(5)
    await page.getByLabel('Crypto', { exact: true }).selectOption('')

    // Tri par montant : le plus élevé d'abord, puis le plus faible.
    const amount = page.getByRole('button', { name: 'Montant' })
    await amount.click()
    await expect(page.getByRole('columnheader', { name: 'Montant' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    await expect(rows(page).first()).toContainText('1 487,22 €')
    await amount.click()
    await expect(rows(page).first()).toContainText('2,22 €')
  })

  test('ajoute une opération après avoir signalé les champs faux, puis l’annule', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Ajouter une opération' }).click()
    const dialog = page.getByRole('dialog', { name: 'Ajouter une opération' })
    await dialog.getByRole('button', { name: 'Ajouter l’opération' }).click()
    await expect(dialog.getByText('Symbole obligatoire, par exemple BTC.')).toBeVisible()
    await expect(dialog.getByText('Quantité obligatoire.')).toBeVisible()
    await expect(dialog.getByText('Montant en euros obligatoire.')).toBeVisible()
    await expect(dialog.getByRole('alert')).toHaveText(/3 champs à corriger/)

    await dialog.getByLabel('Date').fill('2025-09-15')
    await dialog.getByLabel('Heure (Paris)').fill('11:30')
    await dialog.getByLabel('Crypto achetée').fill('eth')
    await dialog.getByLabel('Quantité reçue').fill('0,1')
    await dialog.getByLabel('Montant payé, hors frais (€)').fill('250')
    await dialog.getByLabel('Libellé, facultatif').fill('Achat sur Ledger Live')
    await dialog.getByRole('button', { name: 'Ajouter l’opération' }).click()

    await expect(dialog).toBeHidden()
    await expect(rows(page)).toHaveCount(15)
    const added = rows(page).filter({ hasText: '15/09/2025 11:30' })
    await expect(added).toContainText('Saisie manuelle')
    await expect(added).toContainText('+0,1 ETH')
    await expect(
      page.getByRole('status').filter({ hasText: 'Ajout : Achat de 0,1 ETH du 15/09/2025' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Annuler', exact: true }).click()
    await expect(rows(page)).toHaveCount(14)
    await expect(page.getByText('Dernière correction')).toBeHidden()
  })

  test('modifie une opération depuis sa fiche et garde la trace', async ({ page }) => {
    await page.getByRole('button', { name: 'Détails de l’opération du 20/11/2025 16:22' }).click()
    const details = page.getByRole('dialog', { name: 'Détails de l’opération' })
    await expect(details.getByText('trade-republic:exemple-0017')).toBeVisible()
    await expect(details.getByText('2025-11-20T15:22:09.000Z')).toBeVisible()
    await details.getByRole('button', { name: 'Modifier' }).click()

    const form = page.getByRole('dialog', { name: 'Modifier l’opération' })
    await expect(form.getByLabel('Montant obtenu, avant frais (€)')).toHaveValue('313,98')
    await form.getByLabel('Montant obtenu, avant frais (€)').fill('320')
    await form.getByRole('button', { name: 'Enregistrer les modifications' }).click()

    const row = rows(page).first()
    await expect(row).toContainText('320,00 €')
    await expect(row).toContainText('Trade Republic, corrigée')

    await page.getByText('Journal des corrections (1)').click()
    await expect(
      page.getByText('Modification : Vente de 0,004 BTC du 20/11/2025').first(),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Annuler la dernière correction' }).click()
    await expect(row).toContainText('313,98 €')
    await expect(page.getByText(/Journal des corrections/)).toBeHidden()
  })

  test('supprime plusieurs opérations après confirmation', async ({ page }) => {
    await page
      .getByRole('checkbox', { name: 'Sélectionner l’opération du 01/07/2025 21:00' })
      .check()
    await page
      .getByRole('checkbox', { name: 'Sélectionner l’opération du 01/06/2025 21:00' })
      .check()
    await expect(page.getByText('2 opérations sélectionnées')).toBeVisible()
    await page.getByRole('button', { name: 'Supprimer', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Supprimer 2 opérations ?' })
    await dialog.getByRole('button', { name: 'Annuler' }).click()
    await expect(rows(page)).toHaveCount(14)

    await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
    await dialog.getByRole('button', { name: 'Supprimer' }).click()
    await expect(rows(page)).toHaveCount(12)
    await expect(
      page.getByRole('status').filter({ hasText: 'Suppression de 2 opérations' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Annuler', exact: true }).click()
    await expect(rows(page)).toHaveCount(14)
  })

  test('exporte la liste filtrée en CSV', async ({ page }) => {
    await page.getByLabel('Crypto', { exact: true }).selectOption('BTC')
    await expect(rows(page)).toHaveCount(7)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exporter la liste (CSV)' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^operations-crypto-\d{4}-\d{2}-\d{2}\.csv$/)
    const { readFile } = await import('node:fs/promises')
    const text = (await readFile(await file.path())).toString('utf8')
    const lines = text
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n')
    expect(lines).toHaveLength(8)
    expect(lines[0]).toMatch(/^Date \(Paris\);Date \(UTC\);Type;Plateforme;/)
    expect(lines[1]).toContain(';Vente;Trade Republic;BTC;0,004;;;313,98;1;')
  })

  test('respecte les règles d’accessibilité, fenêtres ouvertes comprises', async ({ page }) => {
    expect(await accessibilityViolations(page)).toEqual([])
    await page.getByRole('button', { name: 'Ajouter une opération' }).click()
    await page
      .getByRole('dialog', { name: 'Ajouter une opération' })
      .getByRole('button', {
        name: 'Ajouter l’opération',
      })
      .click()
    expect(await accessibilityViolations(page)).toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Détails de l’opération du 20/11/2025 16:22' }).click()
    expect(await accessibilityViolations(page)).toEqual([])
  })
})

test('les corrections sont enregistrées et une suppression résiste à un nouvel import', async ({
  page,
}) => {
  await importExample(page)
  await page.goto('/transactions')
  await page.getByRole('button', { name: 'Détails de l’opération du 20/11/2025 16:22' }).click()
  await page
    .getByRole('dialog', { name: 'Détails de l’opération' })
    .getByRole('button', {
      name: 'Supprimer',
    })
    .click()
  await page
    .getByRole('dialog', { name: 'Supprimer l’opération ?' })
    .getByRole('button', {
      name: 'Supprimer',
    })
    .click()
  await expect(rows(page)).toHaveCount(13)

  await page.reload()
  await expect(rows(page)).toHaveCount(13)
  await expect(page.getByText('Journal des corrections (1)')).toBeVisible()

  // Le même fichier, réimporté : l'opération supprimée ne revient pas.
  await page.goto('/plateformes')
  await page.setInputFiles('#fichier-import', EXAMPLE)
  await expect(page.getByText('14 déjà importées, ignorées')).toBeVisible()
})

test('ouvre la liste sur les opérations à vérifier', async ({ page }) => {
  await page.goto('/transactions?exemple')
  await expect(rows(page)).toHaveCount(14)
  await page.getByRole('button', { name: 'Détails de l’opération du 10/02/2025 15:12' }).click()
  await page
    .getByRole('dialog', { name: 'Détails de l’opération' })
    .getByRole('button', {
      name: 'Supprimer',
    })
    .click()
  await page
    .getByRole('dialog', { name: 'Supprimer l’opération ?' })
    .getByRole('button', {
      name: 'Supprimer',
    })
    .click()
  // Sans l'achat d'ETH, la vente d'ETH porte sur des cryptos absentes de l'historique.
  await page.getByText('Seulement les opérations à vérifier (1)').click()
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Achats manquants')
})
