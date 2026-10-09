import { chronological } from '../portfolio/transaction'
import type { Dec } from '../tax/decimal'
import {
  ImportError,
  amount,
  cell,
  cryptoSymbol,
  eachRow,
  emptyResult,
  readCsv,
  signedAmount,
  utcDate,
  type CsvRow,
  type ImportResult,
} from './csv'

/**
 * Grand livre Kraken (`ledgers.csv` : History → Export → Ledgers). Une ligne par mouvement d'un
 * actif ; un échange tient sur deux lignes de même `refid`. Montants signés, frais à part dans
 * l'actif de la ligne : `solde = solde précédent + amount − fee`. Heures en UTC. Format détaillé
 * dans `docs/imports.md`. Expérimental : vérifié sur la documentation de Kraken et des exemples
 * publics, pas encore sur un export réel.
 */

const COLUMNS = ['txid', 'refid', 'time', 'type', 'asset', 'amount', 'fee']

/** Codes historiques de Kraken ; les actifs plus récents gardent leur symbole. */
const CODES: Record<string, string> = {
  XXBT: 'BTC',
  XBT: 'BTC',
  XETH: 'ETH',
  XXRP: 'XRP',
  XLTC: 'LTC',
  XXLM: 'XLM',
  XXDG: 'DOGE',
  XDG: 'DOGE',
  XXMR: 'XMR',
  XETC: 'ETC',
  XZEC: 'ZEC',
  XMLN: 'MLN',
  XREP: 'REP',
  ZEUR: 'EUR',
  ZUSD: 'USD',
  ZGBP: 'GBP',
  ZCAD: 'CAD',
  ZJPY: 'JPY',
  ZAUD: 'AUD',
  ZCHF: 'CHF',
  // ETH placé avant la mise à jour Shapella, DOT bloqué 28 jours : le même actif.
  ETH2: 'ETH',
  DOT28: 'DOT',
}
const FIAT = new Set(['EUR', 'USD', 'GBP', 'CAD', 'JPY', 'AUD', 'CHF'])

/** Mouvements entre portefeuilles Kraken (staking, Earn, futures) : sans effet sur les avoirs. */
const INTERNAL = new Set([
  'allocation',
  'deallocation',
  'autoallocation',
  'autoallocate',
  'migration',
  'spottostaking',
  'stakingfromspot',
  'stakingtospot',
  'spotfromstaking',
  'spottofutures',
  'spotfromfutures',
])

/** Marge, dérivés, actifs tokenisés, ajustements : hors du régime des particuliers ou à analyser. */
const OUT_OF_SCOPE = new Set([
  'margin',
  'rollover',
  'settled',
  'margin trade',
  'dividend',
  'adjustment',
])

type Leg = {
  row: CsvRow
  refid: string
  date: Date
  type: string
  subtype: string
  asset: string
  /** Montant signé : négatif quand l'actif sort. */
  amount: Dec
  fee: Dec
}

/** Symbole commun : code historique traduit, suffixe de solde retiré (`DOT.S`, `USDT.F`). */
function krakenAsset(row: CsvRow, code: string): string {
  const base = code.toUpperCase().replace(/\.(S|M|P|B|F|T|HOLD)$/, '')
  return cryptoSymbol(row, CODES[base] ?? base)
}

export function importKraken(text: string): ImportResult {
  const result = emptyResult()
  const legs: Leg[] = []

  eachRow(readCsv(text, COLUMNS), result, (row) => {
    // Les anciens exports listent deux fois certains dépôts : en attente (sans txid), puis
    // confirmés. Seule la ligne confirmée compte.
    if (cell(row, 'txid') === '') {
      result.skipped++
      return
    }
    // Crédits de frais Kraken : ni un actif ni une opération.
    if (cell(row, 'asset').toUpperCase() === 'KFEE') {
      result.skipped++
      return
    }
    legs.push({
      row,
      refid: cell(row, 'refid'),
      date: utcDate(row, 'time'),
      type: cell(row, 'type').toLowerCase(),
      subtype: cell(row, 'subtype').toLowerCase(),
      asset: krakenAsset(row, cell(row, 'asset')),
      amount: signedAmount(row, 'amount'),
      fee: amount(row, 'fee'),
    })
  })

  const trades = new Map<string, Leg[]>()
  for (const leg of legs) {
    if (['trade', 'spend', 'receive'].includes(leg.type)) {
      trades.set(leg.refid, [...(trades.get(leg.refid) ?? []), leg])
    } else {
      safely(result, [leg], () => single(leg, result))
    }
  }
  for (const [refid, group] of trades) safely(result, group, () => trade(refid, group, result))

  return { ...result, transactions: chronological(result.transactions) }
}

/** Une erreur sur une opération la signale sans arrêter l'import. */
function safely(result: ImportResult, legs: Leg[], handle: () => void) {
  try {
    handle()
  } catch (error) {
    if (!(error instanceof ImportError)) throw error
    for (const { row } of legs) {
      result.anomalies.push({ line: row.line, message: error.message.replace(/^Ligne \d+ : /, '') })
    }
  }
}

function unsupported(result: ImportResult, legs: Leg[], reason: string) {
  for (const { row, type, subtype, asset, amount: value } of legs) {
    const kind = subtype ? `${type}/${subtype}` : type
    result.unsupported.push({
      line: row.line,
      label: `${kind} ${value.toString()} ${asset} : ${reason}`,
    })
  }
}

/** Opération sur une seule ligne : dépôt, retrait, récompense, mouvement interne. */
function single(leg: Leg, result: ImportResult) {
  const { row, type, subtype, asset } = leg
  if (OUT_OF_SCOPE.has(type)) {
    unsupported(result, [leg], 'hors du régime des particuliers ou à analyser')
    return
  }
  if (FIAT.has(asset)) {
    result.skipped++
    return
  }
  if (INTERNAL.has(subtype)) return

  const base = { id: `kraken:${cell(row, 'txid')}`, source: 'kraken' as const, date: leg.date }
  const received = { asset, quantity: leg.amount.minus(leg.fee) }

  if (type === 'deposit' && leg.amount.gt(0)) {
    result.transactions.push({ ...base, label: 'Dépôt', type: 'transfer-in', received })
    return
  }
  if (type === 'withdrawal' && leg.amount.lt(0)) {
    result.transactions.push({
      ...base,
      label: 'Retrait',
      type: 'transfer-out',
      sent: { asset, quantity: leg.amount.abs() },
      ...(leg.fee.gt(0) ? { fee: { asset, quantity: leg.fee } } : {}),
    })
    return
  }
  const reward =
    (type === 'earn' && (subtype === 'reward' || subtype === 'airdrop')) ||
    type === 'staking' ||
    (type === 'transfer' && subtype === 'airdrop') ||
    type === 'invite bonus'
  if (reward && received.quantity.gt(0)) {
    result.transactions.push({
      ...base,
      label: `${type} ${subtype}`.trim(),
      type: 'reward',
      received,
    })
    return
  }
  unsupported(result, [leg], 'opération à vérifier')
}

/** Échange sur deux lignes de même `refid` : achat, vente ou échange entre cryptos. */
function trade(refid: string, group: Leg[], result: ImportResult) {
  const moved = group.filter((leg) => !leg.amount.isZero())
  const out = moved.find((leg) => leg.amount.lt(0))
  const into = moved.find((leg) => leg.amount.gt(0))
  if (moved.length !== 2 || !out || !into) {
    unsupported(result, group, 'échange en plus de deux lignes, à vérifier')
    return
  }

  const base = {
    id: `kraken:${refid}`,
    source: 'kraken' as const,
    date: out.date,
    label: `Échange ${out.asset} → ${into.asset}`,
  }
  // Ce qui sort, frais compris ; ce qui entre, frais déduits.
  const sent = { asset: out.asset, quantity: out.amount.abs().plus(out.fee) }
  const received = { asset: into.asset, quantity: into.amount.minus(into.fee) }
  const outFiat = FIAT.has(out.asset)
  const inFiat = FIAT.has(into.asset)

  if (outFiat && inFiat) {
    result.skipped++
    return
  }
  if ((outFiat && out.asset !== 'EUR') || (inFiat && into.asset !== 'EUR')) {
    unsupported(result, group, 'montant dans une autre monnaie que l’euro')
    return
  }
  if (outFiat) {
    result.transactions.push({
      ...base,
      type: 'buy',
      received,
      amountEur: out.amount.abs(),
      feeEur: out.fee,
    })
  } else if (inFiat) {
    result.transactions.push({
      ...base,
      type: 'sell',
      sent,
      amountEur: into.amount,
      feeEur: into.fee,
    })
  } else {
    result.transactions.push({ ...base, type: 'swap', sent, received })
  }
}
