/** Thème de l'interface : celui du système, ou clair ou sombre imposé par l'utilisateur. */
export type Theme = 'system' | 'light' | 'dark'

const META_COLORS = { light: '#f5f5f7', dark: '#000000' }

export function useTheme() {
  const theme = useState<Theme>('theme', () => 'system')

  /** À appeler une fois côté navigateur : relit le choix enregistré. */
  function load() {
    const saved = readPreference('theme')
    theme.value = saved === 'light' || saved === 'dark' ? saved : 'system'
  }

  function apply(value: Theme) {
    theme.value = value
    writePreference('theme', value === 'system' ? null : value)
    const root = document.documentElement
    if (value === 'system') delete root.dataset.theme
    else root.dataset.theme = value
    // Couleur de la barre du navigateur, sur téléphone.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      const scheme = meta.media.includes('dark') ? 'dark' : 'light'
      meta.content = META_COLORS[value === 'system' ? scheme : value]
    }
  }

  return { theme, load, apply }
}
