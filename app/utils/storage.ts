/**
 * Stockage dans le navigateur (IndexedDB) : une base, une table clé-valeur. Rien ne quitte
 * l'appareil. Les valeurs sont des objets simples (voir shared/persistence/serialize.ts).
 */
const DATABASE = 'cryptoplusvalue'
const TABLE = 'donnees'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(TABLE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (table: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(TABLE, mode)
    const request = action(transaction.objectStore(TABLE))
    transaction.oncomplete = () => {
      database.close()
      resolve(request.result)
    }
    transaction.onerror = transaction.onabort = () => {
      database.close()
      reject(transaction.error)
    }
  })
}

export const readStored = (key: string) => run<unknown>('readonly', (table) => table.get(key))
export const writeStored = (key: string, value: unknown) =>
  run('readwrite', (table) => table.put(value, key))
export const deleteStored = (key: string) => run('readwrite', (table) => table.delete(key))

/** Préférences de ce navigateur (localStorage), qui peut être indisponible : navigation privée. */
export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(`cryptoplusvalue:${key}`)
  } catch {
    return null
  }
}

export function writePreference(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(`cryptoplusvalue:${key}`)
    else localStorage.setItem(`cryptoplusvalue:${key}`, value)
  } catch {
    // Préférence non retenue : sans conséquence sur le calcul.
  }
}

/** Efface toutes les préférences de l'application dans ce navigateur. */
export function clearPreferences() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('cryptoplusvalue:')) localStorage.removeItem(key)
    }
  } catch {
    // Rien à effacer si le stockage est indisponible.
  }
}
