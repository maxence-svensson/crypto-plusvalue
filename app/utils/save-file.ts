/** Propose au téléchargement un fichier produit dans le navigateur : rien ne passe par un serveur. */
export function saveFile(bytes: Uint8Array, name: string, type = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Laisse au navigateur le temps de lancer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
