/** Une section de l'application, dans la barre du haut et la barre d'onglets. */
export type NavItem = {
  to: string
  label: string
  /** Libellé court de la barre d'onglets, sur téléphone. */
  short?: string
  icon: IconName
  /** Onglet direct sur téléphone ; les autres sections sont dans « Plus ». */
  tab?: boolean
}

export const NAVIGATION: readonly NavItem[] = [
  { to: '/', label: 'Tableau de bord', short: 'Accueil', icon: 'dashboard', tab: true },
  { to: '/transactions', label: 'Transactions', short: 'Opérations', icon: 'list', tab: true },
  { to: '/fiscalite', label: 'Fiscalité', icon: 'landmark', tab: true },
  { to: '/simulateur', label: 'Simulateur', short: 'Simuler', icon: 'calculator', tab: true },
  { to: '/portefeuille', label: 'Portefeuille', icon: 'wallet' },
  { to: '/plateformes', label: 'Plateformes', icon: 'layers' },
  { to: '/parametres', label: 'Paramètres', icon: 'settings' },
]

/** Liens vers la documentation du dépôt, dans le menu « Plus » du téléphone. */
export const EXTERNAL_LINKS = [
  { href: docUrl('regles-fiscales'), label: 'Méthode et sources' },
  { href: REPOSITORY, label: 'Code source' },
]
