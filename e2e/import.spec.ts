import { readFileSync } from 'node:fs'

import { expect, test } from './fixtures'

const EXAMPLE = 'public/exemples/trade-republic.csv'

test('importe un export Trade Republic', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#fichier-import', EXAMPLE)
  await expect(page.getByText('14 opérations crypto lues')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Case 3AN : 362 €' })).toBeVisible()
})

test('explique qu’un fichier n’est pas au bon format', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#fichier-import', {
    name: 'releve-banque.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Date,Libellé,Montant\n2025-01-01,Café,-2.50\n'),
  })
  await expect(page.getByText(/Format non reconnu/)).toBeVisible()

  await page.setInputFiles('#fichier-import', {
    name: 'releve.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 ...'),
  })
  await expect(page.getByText(/Ce fichier est un PDF/)).toBeVisible()
})

test('écarte une ligne illisible et importe les autres', async ({ page }) => {
  // L'achat d'ETH du 10 février reçoit un montant illisible.
  const text = readFileSync(EXAMPLE, 'utf8').replace('"-1000.00"', '"mille euros"')
  await page.goto('/')
  await page.setInputFiles('#fichier-import', {
    name: 'export-abime.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(text),
  })
  await expect(page.getByText('13 opérations crypto lues')).toBeVisible()
  await page.getByText('1 ligne écartée').click()
  await expect(page.getByText(/« mille euros » n'est pas un nombre/)).toBeVisible()
})

test('importe un grand livre Kraken, plateforme marquée expérimentale', async ({ page }) => {
  const ledger = [
    '"txid","refid","time","type","subtype","aclass","subclass","asset","wallet","amount","fee","balance"',
    '"LTR01A","TRADE01","2025-03-03 08:20:02","trade","tradespot","currency","fiat","EUR","spot / main",-400.0000,1.0000,599.0000',
    '"LTR01B","TRADE01","2025-03-03 08:20:02","trade","tradespot","currency","crypto","BTC","spot / main",0.0045000000,0,0.0045000000',
    '"LTR02A","TRADE02","2025-05-02 12:00:00","trade","tradespot","currency","crypto","BTC","spot / main",-0.0015000000,0,0.0030000000',
    '"LTR02B","TRADE02","2025-05-02 12:00:00","trade","tradespot","currency","fiat","EUR","spot / main",150.0000,0.4000,698.6000',
  ].join('\n')
  await page.goto('/')
  await expect(page.locator('#calcul').getByText('expérimental').first()).toBeVisible()
  await page.setInputFiles('#fichier-import', {
    name: 'ledgers.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(ledger),
  })
  await expect(page.getByText('Kraken : 2 opérations crypto lues')).toBeVisible()
  // Une seule vente de 150 € : sous le seuil de 305 €, exonérée.
  await expect(
    page.getByText(/ne dépassent pas 305 € : elles sont exonérées/).first(),
  ).toBeVisible()
})
