import type { Platform } from '../portfolio/transaction'
import { importBitvavo } from './bitvavo'
import { importCoinbase } from './coinbase'
import { importCryptoCom } from './cryptocom'
import { ImportError, type ImportResult } from './csv'
import { importKraken } from './kraken'
import { importTradeRepublic } from './trade-republic'

export type { Platform }

export type Importer = {
  platform: Platform
  name: string
  /**
   * Vérifié sur de vrais exports. Sinon « expérimental » : écrit d'après la documentation de la
   * plateforme et des exemples publics, à confirmer sur un export réel.
   */
  verified: boolean
  /** Où trouver l'export, avec les mots de l'application ou du site. */
  howTo: string
  /** Reconnaît le format d'après le début du fichier (en-tête). */
  matches: (head: string) => boolean
  read: (text: string) => ImportResult
}

/** Les plateformes prises en charge. Pour en ajouter une : docs/imports.md, « Ajouter une plateforme ». */
export const IMPORTERS: readonly Importer[] = [
  {
    platform: 'trade-republic',
    name: 'Trade Republic',
    verified: true,
    howTo: 'Profil, Relevés, Export de transactions.',
    matches: (head) => head.includes('transaction_id') && head.includes('asset_class'),
    read: importTradeRepublic,
  },
  {
    platform: 'coinbase',
    name: 'Coinbase',
    verified: true,
    howTo: 'Relevés, Générer un relevé, format CSV.',
    matches: (head) => head.includes('Transaction Type') && head.includes('Quantity Transacted'),
    read: importCoinbase,
  },
  {
    platform: 'kraken',
    name: 'Kraken',
    verified: false,
    howTo: 'History, Export, Ledgers ; importez le fichier ledgers.csv de l’archive.',
    matches: (head) => head.includes('txid') && head.includes('refid') && head.includes('aclass'),
    read: importKraken,
  },
  {
    platform: 'crypto-com',
    name: 'Crypto.com',
    verified: false,
    howTo: 'Comptes, Historique, Export, Token Wallet (fichier crypto_transactions_record).',
    matches: (head) => head.includes('Timestamp (UTC)') && head.includes('Transaction Kind'),
    read: importCryptoCom,
  },
  {
    platform: 'bitvavo',
    name: 'Bitvavo',
    verified: false,
    howTo: 'Historique des transactions, Exporter, format CSV.',
    matches: (head) =>
      head.includes('Timezone') &&
      head.includes('Received / Paid') &&
      head.includes('Transaction ID'),
    read: importBitvavo,
  },
]

export const PLATFORM_NAMES = Object.fromEntries(
  IMPORTERS.map((importer) => [importer.platform, importer.name]),
) as Record<Platform, string>

/** Reconnaît la plateforme d'après les colonnes du fichier, puis l'importe. */
export function importFile(text: string): ImportResult & { platform: Platform } {
  // L'en-tête peut être précédé de quelques lignes (Coinbase) : on regarde le début du fichier.
  const head = text.replace(/^\uFEFF/, '').slice(0, 4000)
  const importer = IMPORTERS.find((candidate) => candidate.matches(head))
  if (!importer) {
    const names = IMPORTERS.map((candidate) => candidate.name)
    throw new ImportError(
      `Format non reconnu : importez un export ${names.slice(0, -1).join(', ')} ou ${names.at(-1)} au format CSV.`,
    )
  }
  return { platform: importer.platform, ...importer.read(text) }
}
