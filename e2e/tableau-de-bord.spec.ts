import type { Page } from '@playwright/test'

import { accessibilityViolations, expect, test } from './fixtures'

/** Grand livre Kraken fictif de 2024 : un achat, puis une vente de 150 € (exonérée). */
const LEDGER_2024 = [
  '"txid","refid","time","type","subtype","aclass","subclass","asset","wallet","amount","fee","balance"',
  '"LTR01A","TRADE01","2024-03-03 08:20:02","trade","tradespot","currency","fiat","EUR","spot / main",-400.0000,1.0000,599.0000',
  '"LTR01B","TRADE01","2024-03-03 08:20:02","trade","tradespot","currency","crypto","BTC","spot / main",0.0045000000,0,0.0045000000',
  '"LTR02A","TRADE02","2024-05-02 12:00:00","trade","tradespot","currency","crypto","BTC","spot / main",-0.0015000000,0,0.0030000000',
  '"LTR02B","TRADE02","2024-05-02 12:00:00","trade","tradespot","currency","fiat","EUR","spot / main",150.0000,0.4000,698.6000',
].join('\n')

async function importBoth(page: Page) {
  await page.goto('/plateformes')
  await page.setInputFiles('#fichier-import', 'public/exemples/trade-republic.csv')
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByText('14 opérations crypto lues')).toBeVisible()
  await page.setInputFiles('#fichier-import', {
    name: 'ledgers.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(LEDGER_2024),
  })
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByText('Kraken : 2 opérations crypto lues')).toBeVisible()
  await expect(page.getByText(/Enregistré dans ce navigateur le/)).toBeVisible()
}

test('une seule année : achats et ventes par mois, sans graphique par année ni choix de période', async ({
  page,
}) => {
  await page.goto('/?exemple')
  const flows = page.getByRole('figure', { name: 'Achats et ventes' })
  await expect(flows).toBeVisible()
  await expect(
    page.getByRole('figure', { name: 'Plus ou moins-value nette par année' }),
  ).toBeHidden()
  await expect(page.getByRole('group', { name: 'Période' })).toBeHidden()

  // Une zone parcourue aux flèches : sa valeur annoncée donne les chiffres du mois, l'infobulle
  // les montre.
  const slider = flows.getByRole('slider', { name: /Achats et ventes par mois/ })
  await slider.focus()
  await expect(slider).toHaveAttribute('aria-valuetext', /^janv\., Achats : 100\s€/)
  await slider.press('ArrowRight')
  await expect(slider).toHaveAttribute(
    'aria-valuetext',
    /^févr\., Achats : 1\s100\s€, Ventes : 0\s€$/,
  )
  await expect(flows.getByText('1 100 €').first()).toBeVisible()

  // La vue tableau donne les mêmes chiffres.
  await flows.getByRole('button', { name: 'Voir le tableau' }).click()
  await expect(flows.getByRole('row', { name: /août/ })).toContainText('1 487,22 €')

  await expect(page.getByRole('figure', { name: 'Achats par crypto' })).toContainText('ETH')
  await expect(page.getByRole('figure', { name: 'Volume par plateforme' })).toContainText(
    'Toutes les opérations en 2025 viennent de Trade Republic',
  )
})

test('plusieurs années et plateformes : plus-value par année et période au choix', async ({
  page,
}) => {
  await importBoth(page)
  await page.goto('/')
  const gains = page
    .getByRole('figure', { name: 'Plus ou moins-value nette par année' })
    .getByRole('slider')
  await gains.focus()
  await expect(gains).toHaveAttribute(
    'aria-valuetext',
    /^2024, .*\+16\s€, 1 vente imposable, exonérée/,
  )
  await gains.press('End')
  await expect(gains).toHaveAttribute('aria-valuetext', /^2025, .*2 ventes imposables$/)

  // La période choisie s'applique à toute l'activité affichée.
  await expect(page.getByRole('group', { name: 'Période' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Activité en 2025' })).toBeVisible()
  await page.locator('label').filter({ hasText: '2024' }).click()
  await expect(page.getByRole('heading', { name: 'Activité en 2024' })).toBeVisible()
  await expect(page.getByRole('figure', { name: 'Achats par crypto' })).toContainText('BTC')
  await expect(page.getByRole('figure', { name: 'Achats par crypto' })).not.toContainText('ETH')

  await page.locator('label').filter({ hasText: 'Toutes' }).click()
  const volume = page.getByRole('figure', { name: 'Volume par plateforme' })
  await expect(volume.getByRole('listitem')).toHaveCount(2)
  await expect(volume).toContainText('Kraken')
  await expect(
    page.getByRole('figure', { name: 'Achats et ventes' }).getByRole('slider'),
  ).toHaveAttribute('aria-valuetext', /^2024, /)

  expect(await accessibilityViolations(page)).toEqual([])
})
