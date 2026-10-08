import { ImportError, type ImportResult } from './csv'
import { importCoinbase } from './coinbase'
import { importTradeRepublic } from './trade-republic'

export type Platform = 'trade-republic' | 'coinbase'

export const PLATFORM_NAMES: Record<Platform, string> = {
  'trade-republic': 'Trade Republic',
  coinbase: 'Coinbase',
}

/** Reconnaît la plateforme d'après les colonnes du fichier, puis l'importe. */
export function importFile(text: string): ImportResult & { platform: Platform } {
  // L'en-tête Coinbase peut être précédé de quelques lignes : on regarde le début du fichier.
  const head = text.slice(0, 2000)
  if (head.includes('transaction_id') && head.includes('asset_class')) {
    return { platform: 'trade-republic', ...importTradeRepublic(text) }
  }
  if (head.includes('Transaction Type') && head.includes('Quantity Transacted')) {
    return { platform: 'coinbase', ...importCoinbase(text) }
  }
  throw new ImportError(
    'Format non reconnu : importez un export Trade Republic ou un relevé Coinbase au format CSV.',
  )
}
