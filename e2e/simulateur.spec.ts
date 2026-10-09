import { expect, test } from './fixtures'

test('simule une vente sans fichier, à partir de trois montants', async ({ page }) => {
  await page.goto('/#simulation')
  const simulation = page.locator('#simulation')
  await simulation.getByLabel(/Somme investie en euros/).fill('5000')
  await simulation.getByLabel('Valeur actuelle de toutes vos cryptos').fill('8000')
  await simulation.getByLabel('Montant à vendre').fill('2000')
  // 2 000 − 5 000 × 2 000 / 8 000 = 750 € ; 31,4 % de 750 € = 235,50 €.
  await expect(simulation.getByText('+750,00 €').first()).toBeVisible()
  await expect(simulation.getByText('235,50 €')).toBeVisible()
  await expect(simulation.getByText('1 764,50 €')).toBeVisible()
})

test('règle la quantité à vendre au curseur', async ({ page }) => {
  await page.goto('/?exemple')
  await expect(page.getByRole('img', { name: 'Case 3AN : 362 €' }).last()).toBeVisible()
  const simulation = page.locator('#simulation')
  await simulation.locator('#part-a-vendre').fill('60')
  // 60 % des 0,002833 BTC détenus, au cours simulé de 100 000 €.
  await expect(simulation.getByLabel('Quantité')).toHaveValue('0,0016998')
  await expect(simulation.getByText('169,98 €').first()).toBeVisible()
})
