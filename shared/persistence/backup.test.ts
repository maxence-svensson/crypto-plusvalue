import { describe, expect, it } from 'vitest'

import { deletion } from '../portfolio/corrections'
import { buy, sell, transferOut } from '../portfolio/fixtures'
import { Dec } from '../tax/decimal'
import { toPlain } from './serialize'
import {
  BACKUP_FORMAT,
  BackupError,
  backupDate,
  decryptBackup,
  encryptBackup,
  isTransaction,
  type BackupContent,
} from './backup'

const PASSWORD = 'correct horse battery staple'
// Moins d'itérations qu'en vrai : le test reste rapide, le format est le même.
const FAST = { iterations: 100_000, now: new Date('2026-10-09T12:00:00Z') }

const transactions = [
  buy('a', '2025-01-02T08:40:00Z', 'BTC', '0.001084', '100', '1'),
  sell('b', '2025-11-20T15:22:09Z', 'BTC', '0.0000001', '313.98', '1'),
  transferOut('c', '2025-05-20T18:44:02Z', 'BTC', '0.002', '0.000015'),
]
const CONTENT: BackupContent = {
  transactions,
  files: [
    {
      name: 'export.csv',
      platform: 'trade-republic',
      transactions: 3,
      skipped: 1,
      unsupported: [],
      anomalies: [{ line: 4, message: 'date illisible' }],
      duplicates: 0,
    },
  ],
  prices: [['BTC@2025-11-20T15:22:00.000Z', { priceEur: new Dec('91234.5'), source: 'Binance' }]],
  corrections: [deletion(transactions, ['c'], new Date('2026-10-09T11:00:00Z'))],
}

describe('sauvegarde chiffrée', () => {
  it('rend exactement les données, décimaux et dates compris', async () => {
    const file = await encryptBackup(CONTENT, PASSWORD, FAST)
    expect(await decryptBackup(file, PASSWORD)).toEqual(CONTENT)
    expect(backupDate(file)).toEqual(FAST.now)
  })

  it('ne laisse rien de lisible dans le fichier', async () => {
    const file = await encryptBackup(CONTENT, PASSWORD, FAST)
    const envelope = JSON.parse(file)
    expect(envelope).toMatchObject({
      format: BACKUP_FORMAT,
      version: 1,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 100_000 },
      cipher: { name: 'AES-GCM' },
    })
    // Hors des données chiffrées, seulement les paramètres ; dans le chiffré, rien en clair.
    expect(Object.keys(envelope).sort()).toEqual([
      'cipher',
      'createdAt',
      'data',
      'format',
      'kdf',
      'version',
    ])
    expect(Buffer.from(envelope.data, 'base64').toString('latin1')).not.toContain('export.csv')
    // Sel et vecteur d'initialisation tirés au hasard : deux sauvegardes diffèrent.
    expect(await encryptBackup(CONTENT, PASSWORD, FAST)).not.toBe(file)
  })

  it('refuse un mot de passe trop court, faux, ou un fichier modifié', async () => {
    await expect(encryptBackup(CONTENT, 'court', FAST)).rejects.toThrow(/12 caractères/)
    const file = await encryptBackup(CONTENT, PASSWORD, FAST)
    await expect(decryptBackup(file, 'mauvais mot de passe')).rejects.toThrow(
      /Mot de passe incorrect/,
    )
    const envelope = JSON.parse(file)
    const data = Buffer.from(envelope.data, 'base64')
    data[0] = (data[0] ?? 0) ^ 1
    const tampered = JSON.stringify({ ...envelope, data: data.toString('base64') })
    await expect(decryptBackup(tampered, PASSWORD)).rejects.toThrow(/fichier modifié/)
  })

  it('reconnaît ce qui n’est pas une sauvegarde', async () => {
    await expect(decryptBackup('date;type\n', PASSWORD)).rejects.toThrow(BackupError)
    await expect(decryptBackup('{"format":"autre"}', PASSWORD)).rejects.toThrow(
      /pas une sauvegarde/,
    )
    const file = JSON.parse(await encryptBackup(CONTENT, PASSWORD, FAST))
    await expect(decryptBackup(JSON.stringify({ ...file, version: 2 }), PASSWORD)).rejects.toThrow(
      /version plus récente/,
    )
    await expect(
      decryptBackup(JSON.stringify({ ...file, kdf: { ...file.kdf, iterations: 1 } }), PASSWORD),
    ).rejects.toThrow(/abîmée/)
  })

  it('refuse une sauvegarde dont les opérations sont mal formées', async () => {
    const broken = {
      ...CONTENT,
      transactions: [{ ...transactions[0], received: { asset: '=CMD', quantity: new Dec(1) } }],
    }
    const file = await encryptBackup(broken as BackupContent, PASSWORD, FAST)
    await expect(decryptBackup(file, PASSWORD)).rejects.toThrow(/mal formées/)
  })
})

describe('isTransaction', () => {
  it('accepte les opérations des importeurs et refuse le reste', () => {
    for (const transaction of transactions) expect(isTransaction(transaction)).toBe(true)
    expect(isTransaction({ ...transactions[0], amountEur: new Dec(-1) })).toBe(false)
    expect(isTransaction({ ...transactions[0], type: 'margin' })).toBe(false)
    expect(isTransaction({ ...transactions[0], date: new Date('x') })).toBe(false)
    expect(isTransaction(toPlain(transactions[0]))).toBe(false)
  })
})
