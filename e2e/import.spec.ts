import { readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { accessibilityViolations, expect, test } from './fixtures'

const EXAMPLE = 'public/exemples/trade-republic.csv'

/** Ouvre une section par la navigation, sans recharger la page (les données restent). */
async function open(page: Page, isMobile: boolean, label: string, tab = label) {
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await nav.getByRole('link', { name: isMobile ? tab : label, exact: true }).click()
}

async function importFile(page: Page, file: Parameters<Page['setInputFiles']>[1]) {
  await page.setInputFiles('#fichier-import', file)
}

test('montre un aperçu, puis importe un export Trade Republic', async ({ page, isMobile }) => {
  await page.goto('/plateformes')
  await importFile(page, EXAMPLE)
  await expect(page.getByText('14 opérations crypto à importer')).toBeVisible()
  await expect(page.getByText('Opérations du 02/01/2025 au 20/11/2025')).toBeVisible()
  expect(await accessibilityViolations(page)).toEqual([])
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByText('14 opérations crypto lues')).toBeVisible()
  await open(page, isMobile, 'Fiscalité')
  await expect(page.getByRole('img', { name: 'Case 3AN : 362 €' })).toBeVisible()
})

test('explique qu’un fichier n’est pas au bon format', async ({ page }) => {
  await page.goto('/plateformes')
  await importFile(page, {
    name: 'releve-banque.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Date,Libellé,Montant\n2025-01-01,Café,-2.50\n'),
  })
  await expect(page.getByText(/Format non reconnu/)).toBeVisible()

  await importFile(page, {
    name: 'releve.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 ...'),
  })
  await expect(page.getByText(/Ce fichier est un PDF/)).toBeVisible()
})

test('écarte une ligne illisible et importe les autres', async ({ page }) => {
  // L'achat d'ETH du 10 février reçoit un montant illisible.
  const text = readFileSync(EXAMPLE, 'utf8').replace('"-1000.00"', '"mille euros"')
  await page.goto('/plateformes')
  await importFile(page, {
    name: 'export-abime.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(text),
  })
  await expect(page.getByText('1 ligne illisible écartée')).toBeVisible()
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByText('13 opérations crypto lues')).toBeVisible()
  await page.getByText('1 ligne écartée').click()
  await expect(page.getByText(/« mille euros » n'est pas un nombre/)).toBeVisible()
})

test('importe un grand livre Kraken, plateforme marquée expérimentale', async ({
  page,
  isMobile,
}) => {
  const ledger = [
    '"txid","refid","time","type","subtype","aclass","subclass","asset","wallet","amount","fee","balance"',
    '"LTR01A","TRADE01","2025-03-03 08:20:02","trade","tradespot","currency","fiat","EUR","spot / main",-400.0000,1.0000,599.0000',
    '"LTR01B","TRADE01","2025-03-03 08:20:02","trade","tradespot","currency","crypto","BTC","spot / main",0.0045000000,0,0.0045000000',
    '"LTR02A","TRADE02","2025-05-02 12:00:00","trade","tradespot","currency","crypto","BTC","spot / main",-0.0015000000,0,0.0030000000',
    '"LTR02B","TRADE02","2025-05-02 12:00:00","trade","tradespot","currency","fiat","EUR","spot / main",150.0000,0.4000,698.6000',
  ].join('\n')
  await page.goto('/plateformes')
  await expect(page.getByText('expérimental').first()).toBeVisible()
  await importFile(page, { name: 'ledgers.csv', mimeType: 'text/csv', buffer: Buffer.from(ledger) })
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByText('Kraken : 2 opérations crypto lues')).toBeVisible()
  // Une seule vente de 150 € : sous le seuil de 305 €, exonérée.
  await open(page, isMobile, 'Fiscalité')
  await expect(
    page.getByText(/ne dépassent pas 305 € : elles sont exonérées/).first(),
  ).toBeVisible()
})

test('ignore un fichier déjà importé et fait trancher les doublons probables', async ({
  page,
  isMobile,
}) => {
  await page.goto('/plateformes')
  await importFile(page, EXAMPLE)
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByText('14 opérations crypto lues')).toBeVisible()

  // Le même fichier : rien de nouveau.
  await importFile(page, EXAMPLE)
  await expect(page.getByText('14 déjà importées, ignorées')).toBeVisible()
  await expect(page.getByText('0 opération crypto à importer')).toBeVisible()
  await page.getByRole('button', { name: 'Annuler' }).click()

  // Les mêmes opérations sous d'autres identifiants : doublons probables, écartés par défaut.
  const copy = readFileSync(EXAMPLE, 'utf8').replaceAll('exemple-0', 'copie-0')
  await importFile(page, { name: 'copie.csv', mimeType: 'text/csv', buffer: Buffer.from(copy) })
  await expect(page.getByText('14 doublons probables')).toBeVisible()
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByText(/14 déjà présentes ou en double/)).toBeVisible()
  await open(page, isMobile, 'Fiscalité')
  await expect(page.getByRole('img', { name: 'Case 3AN : 362 €' })).toBeVisible()
})

test('déclare provisoire un résultat dont il manque des achats', async ({ page, isMobile }) => {
  // Une vente sans l'achat correspondant.
  const header = readFileSync(EXAMPLE, 'utf8').split('\n')[0]
  const sale =
    '"2025-06-10T10:00:00.000Z","2025-06-10","DEFAULT","TRADING","SELL","CRYPTO","Bitcoin","BTC","0.0040000000","100000","400.00","-1.00","","EUR","","","","Vente","seule-1","","","",""'
  await page.goto('/plateformes')
  await importFile(page, {
    name: 'vente-seule.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`${header}\n${sale}\n`),
  })
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await open(page, isMobile, 'Tableau de bord', 'Accueil')
  const diagnostic = page.locator('section[aria-labelledby="diagnostic"]')
  await expect(diagnostic.getByText('Incomplet', { exact: true })).toBeVisible()
  await expect(diagnostic.getByText('Achats manquants')).toBeVisible()
  await open(page, isMobile, 'Fiscalité')
  await expect(page.getByText('Résultat provisoire')).toBeVisible()
})

test('un vrai fichier remplace les données de démonstration', async ({ page }) => {
  await page.goto('/plateformes?exemple')
  await expect(page.getByText('Mode démonstration.')).toBeVisible()
  await importFile(page, EXAMPLE)
  await expect(page.getByText('Mode démonstration.')).toBeHidden()
  await expect(page.getByText('14 opérations crypto à importer')).toBeVisible()
})
