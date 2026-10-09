import { Dec } from '../tax/decimal'
import type { Correction } from '../portfolio/corrections'
import type { CryptoAmount, Transaction } from '../portfolio/transaction'
import { fromPlain, toPlain, type Plain } from './serialize'

/**
 * Sauvegarde chiffrée : toutes les données dans un fichier protégé par un mot de passe, pour
 * les garder hors du navigateur ou les ouvrir sur un autre appareil. Tout se passe ici, avec
 * WebCrypto : la clé est dérivée du mot de passe (PBKDF2, SHA-256, 600 000 itérations) et les
 * données chiffrées et authentifiées (AES-GCM, 256 bits). Sans le mot de passe, le fichier est
 * illisible ; modifié, il est refusé. Le mot de passe n'est enregistré nulle part.
 */

export const BACKUP_FORMAT = 'cryptoplusvalue-sauvegarde'
const VERSION = 1
/** Recommandation OWASP (2023) pour PBKDF2-HMAC-SHA256. */
export const ITERATIONS = 600_000
export const MIN_PASSWORD_LENGTH = 12

export type BackupContent = {
  transactions: Transaction[]
  files: unknown[]
  prices: [string, { priceEur: Dec; source: string }][]
  corrections: Correction[]
}

type Envelope = {
  format: typeof BACKUP_FORMAT
  version: number
  createdAt: string
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string }
  data: string
}

export class BackupError extends Error {}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0))

/** Base64 par morceaux : `String.fromCharCode(...)` déborde la pile sur un gros fichier. */
function bytesToBase64(bytes: Uint8Array): string {
  let text = ''
  for (let start = 0; start < bytes.length; start += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
  }
  return btoa(text)
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBackup(
  content: BackupContent,
  password: string,
  { iterations = ITERATIONS, now = new Date() } = {},
): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BackupError(`Mot de passe trop court : ${MIN_PASSWORD_LENGTH} caractères au moins.`)
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, iterations)
  const plain = new TextEncoder().encode(JSON.stringify(toPlain(content)))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain))
  const envelope: Envelope = {
    format: BACKUP_FORMAT,
    version: VERSION,
    createdAt: now.toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: bytesToBase64(sealed),
  }
  return JSON.stringify(envelope, null, 2)
}

function readEnvelope(text: string): Envelope {
  let envelope: Partial<Envelope>
  try {
    envelope = JSON.parse(text) as Partial<Envelope>
  } catch {
    throw new BackupError('Ce fichier n’est pas une sauvegarde CryptoPlusValue.')
  }
  if (envelope?.format !== BACKUP_FORMAT) {
    throw new BackupError('Ce fichier n’est pas une sauvegarde CryptoPlusValue.')
  }
  if (envelope.version !== VERSION) {
    throw new BackupError('Sauvegarde d’une version plus récente : mettez la page à jour.')
  }
  const { kdf, cipher, data } = envelope
  if (
    kdf?.name !== 'PBKDF2' ||
    kdf.hash !== 'SHA-256' ||
    !Number.isInteger(kdf.iterations) ||
    kdf.iterations < 100_000 ||
    kdf.iterations > 10_000_000 ||
    typeof kdf.salt !== 'string' ||
    cipher?.name !== 'AES-GCM' ||
    typeof cipher.iv !== 'string' ||
    typeof data !== 'string'
  ) {
    throw new BackupError('Sauvegarde abîmée : paramètres de chiffrement illisibles.')
  }
  return envelope as Envelope
}

/** Date de la sauvegarde, lisible sans le mot de passe. */
export function backupDate(text: string): Date {
  return new Date(readEnvelope(text).createdAt)
}

export async function decryptBackup(text: string, password: string): Promise<BackupContent> {
  const envelope = readEnvelope(text)
  let plain: ArrayBuffer
  try {
    const key = await deriveKey(password, fromBase64(envelope.kdf.salt), envelope.kdf.iterations)
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv) },
      key,
      fromBase64(envelope.data),
    )
  } catch {
    throw new BackupError('Mot de passe incorrect, ou fichier modifié depuis la sauvegarde.')
  }
  let content: BackupContent
  try {
    content = fromPlain<BackupContent>(JSON.parse(new TextDecoder().decode(plain)) as Plain)
  } catch {
    throw new BackupError('Sauvegarde abîmée : contenu illisible.')
  }
  checkContent(content)
  return content
}

const ASSET = /^[A-Z0-9]{1,15}$/
const TYPES = new Set(['buy', 'sell', 'payment', 'swap', 'reward', 'transfer-in', 'transfer-out'])
const SOURCES = new Set(['trade-republic', 'coinbase', 'kraken', 'crypto-com', 'bitvavo', 'manual'])

const isAmount = (value: unknown): value is Dec => Dec.isDecimal(value) && !(value as Dec).isNeg()
const isCrypto = (value: unknown): value is CryptoAmount =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as CryptoAmount).asset === 'string' &&
  ASSET.test((value as CryptoAmount).asset) &&
  isAmount((value as CryptoAmount).quantity)

/** Une opération bien formée : rien d'inattendu n'entre dans le calcul. */
export function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  if (
    typeof item.id !== 'string' ||
    typeof item.label !== 'string' ||
    !TYPES.has(item.type as string) ||
    !SOURCES.has(item.source as string) ||
    !isDate(item.date)
  ) {
    return false
  }
  switch (item.type) {
    case 'buy':
      return isCrypto(item.received) && isAmount(item.amountEur) && isAmount(item.feeEur)
    case 'sell':
    case 'payment':
      return isCrypto(item.sent) && isAmount(item.amountEur) && isAmount(item.feeEur)
    case 'swap':
      return isCrypto(item.sent) && isCrypto(item.received)
    case 'reward':
      return isCrypto(item.received) && (item.valueEur === undefined || isAmount(item.valueEur))
    case 'transfer-in':
      return isCrypto(item.received)
    case 'transfer-out':
      return isCrypto(item.sent) && (item.fee === undefined || isCrypto(item.fee))
    default:
      return false
  }
}

const isDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime())

function isCorrection(value: unknown): value is Correction {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  if (!isDate(item.at)) return false
  switch (item.kind) {
    case 'add':
      return isTransaction(item.transaction)
    case 'edit':
      return isTransaction(item.before) && isTransaction(item.after)
    case 'delete':
      return (
        Array.isArray(item.removed) &&
        item.removed.every(
          (entry: { index?: unknown; transaction?: unknown }) =>
            Number.isInteger(entry?.index) &&
            (entry.index as number) >= 0 &&
            isTransaction(entry.transaction),
        )
      )
    default:
      return false
  }
}

const isLines = (value: unknown, text: 'label' | 'message') =>
  Array.isArray(value) &&
  value.every(
    (entry: Record<string, unknown>) =>
      typeof entry?.line === 'number' && typeof entry[text] === 'string',
  )

/** Fichier importé, tel que la page Plateformes l'affiche. */
function isImportedFile(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  if (typeof item.name !== 'string') return false
  if ('error' in item) return typeof item.error === 'string'
  return (
    typeof item.platform === 'string' &&
    SOURCES.has(item.platform) &&
    [item.transactions, item.skipped, item.duplicates].every(
      (count) => typeof count === 'number',
    ) &&
    isLines(item.unsupported, 'label') &&
    isLines(item.anomalies, 'message')
  )
}

function checkContent(content: BackupContent) {
  const ok =
    Array.isArray(content?.transactions) &&
    content.transactions.every(isTransaction) &&
    Array.isArray(content.files) &&
    content.files.every(isImportedFile) &&
    Array.isArray(content.prices) &&
    content.prices.every(
      (entry) =>
        Array.isArray(entry) &&
        typeof entry[0] === 'string' &&
        isAmount(entry[1]?.priceEur) &&
        typeof entry[1]?.source === 'string',
    ) &&
    Array.isArray(content.corrections) &&
    content.corrections.every(isCorrection)
  if (!ok) throw new BackupError('Sauvegarde abîmée : des opérations sont mal formées.')
}
