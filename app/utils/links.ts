export const REPOSITORY = 'https://github.com/maxence-svensson/crypto-plusvalue'

/** Lien vers une page de documentation du dépôt : docUrl('prix') pour docs/prix.md. */
export function docUrl(name: string): string {
  return `${REPOSITORY}/blob/main/docs/${name}.md`
}
