import { accessibilityViolations, expect, test } from './fixtures'

test('présente l’outil et propose d’importer ou d’essayer l’exemple', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Vos plus-values crypto, prêtes à recopier sur le 2086.',
  )
  await expect(page.getByRole('button', { name: 'Importer mon export' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Voir un exemple' })).toBeVisible()
})

test('l’exemple ouvre le tableau de bord en mode démonstration, qu’on peut quitter', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Voir un exemple' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
  await expect(page.getByText('Mode démonstration.')).toBeVisible()
  await page.getByRole('button', { name: 'Quitter la démonstration' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Vos plus-values crypto, prêtes à recopier sur le 2086.',
  )
})

/** Chaque section : son adresse, son titre, son libellé dans la navigation et dans les onglets. */
const PAGES = [
  { path: '/', title: 'Tableau de bord', label: 'Tableau de bord', tab: 'Accueil' },
  { path: '/transactions', title: 'Transactions', label: 'Transactions', tab: 'Opérations' },
  { path: '/fiscalite', title: 'Fiscalité', label: 'Fiscalité', tab: 'Fiscalité' },
  {
    path: '/simulateur',
    title: 'Et si je vendais aujourd’hui ?',
    label: 'Simulateur',
    tab: 'Simuler',
  },
  { path: '/portefeuille', title: 'Portefeuille', label: 'Portefeuille' },
  { path: '/plateformes', title: 'Plateformes', label: 'Plateformes' },
  { path: '/parametres', title: 'Paramètres', label: 'Paramètres' },
]

test('chaque section s’ouvre depuis la navigation, sans recharger la page', async ({
  page,
  isMobile,
}) => {
  await page.goto('/?exemple')
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  for (const { path, title, label, tab } of PAGES.slice(1)) {
    if (!isMobile) {
      await nav.getByRole('link', { name: label, exact: true }).click()
    } else if (tab) {
      await nav.getByRole('link', { name: tab, exact: true }).click()
    } else {
      // Sur téléphone, les autres sections sont dans « Plus ».
      await nav.getByRole('button', { name: 'Plus' }).click()
      await page.locator('#menu-plus').getByRole('link', { name: label, exact: true }).click()
    }
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
  }
  // Une navigation sans rechargement garde les données de l'exemple.
  await expect(page.getByText('Mode démonstration.')).toBeVisible()
})

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`ne défile pas horizontalement à ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/fiscalite?exemple')
    await expect(page.getByRole('img', { name: /^Case 3AN/ }).last()).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test('le menu « Plus » s’ouvre, se ferme avec Échap et rend le focus', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'barre d’onglets réservée aux petits écrans')
  await page.goto('/')
  await page.getByRole('button', { name: 'Plus' }).click()
  const menu = page.locator('#menu-plus')
  await expect(menu.getByRole('link')).toHaveText([
    'Portefeuille',
    'Plateformes',
    'Paramètres',
    'Méthode et sources',
    'Code source',
  ])
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(page.getByRole('button', { name: 'Plus' })).toBeFocused()
})

test('l’accueil respecte les règles d’accessibilité automatisables', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  expect(await accessibilityViolations(page)).toEqual([])
})

for (const { path, title } of PAGES) {
  test(`la page « ${title} » respecte les règles d’accessibilité automatisables`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${path}?exemple`)
    await expect(page.getByText('Mode démonstration.')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    expect(await accessibilityViolations(page)).toEqual([])
  })
}
