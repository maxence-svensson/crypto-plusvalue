# Formats d'import

Chaque plateforme exporte ses transactions dans son propre format. Les importeurs
(`shared/importers/`) les traduisent dans le format commun décrit dans
`shared/portfolio/transaction.ts`. Les fichiers sont lus dans le navigateur et ne sont envoyés
nulle part.

Règles communes :

- les colonnes sont repérées par leur nom, pas par leur position ;
- une ligne crypto que l'importeur ne sait pas traiter n'est jamais perdue en silence : elle est
  listée pour que l'utilisateur la vérifie ;
- une ligne illisible (date, montant, symbole, devise autre que l'euro, ligne mal formée) est
  écartée et signalée avec son numéro, les autres lignes sont importées ; un fichier dont la
  majorité des lignes est mal formée est refusé en entier ;
- le symbole d'une crypto ne contient que des lettres majuscules et des chiffres (15 au plus) :
  une formule de tableur (`=…`) est refusée ;
- encodages acceptés : UTF-8 avec ou sans BOM, UTF-16 (« texte Unicode » d'Excel) et
  Windows-1252 (CSV réenregistré par Excel sous Windows) ;
- un classeur Excel, une archive ZIP ou un PDF est refusé avec une explication, de même qu'un
  fichier de plus de 50 Mo ;
- **rien n'entre dans le calcul sans confirmation** : un aperçu montre la période, les
  opérations à importer, celles déjà présentes et les lignes ignorées ou écartées.

## Doublons

- **Même identifiant** qu'une opération déjà importée : ignorée. Réimporter un fichier, ou deux
  exports qui se chevauchent, n'ajoute rien.
- **Doublon probable** : même type, mêmes actifs, mêmes quantités et même montant, à moins de deux
  minutes d'écart, mais un autre identifiant (la même opération exportée par deux outils, ou un
  export modifié). Écarté par défaut, l'utilisateur coche ceux qui sont réellement différents.
  Deux achats identiques à des moments différents, comme un plan d'épargne, ne sont pas des
  doublons (`shared/portfolio/duplicates.ts`).

## Transferts et qualité des données

Un envoi depuis une plateforme est rapproché de la réception de la même crypto sur une autre :
même actif, réception jusqu'à 72 heures après l'envoi (ou une heure avant, pour les horloges), et
au moins 95 % de la quantité envoyée (`shared/portfolio/transfers.ts`). Le calcul n'en dépend
pas : un transfert entre portefeuilles du foyer est neutre. Mais un envoi ou une réception sans
contrepartie signale un historique incomplet.

Le **diagnostic** (`shared/portfolio/quality.ts`) range les points relevés en trois niveaux :

| Niveau      | Exemples                                                                                                     | Effet                           |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| bloquant    | achats manquants, cours introuvables                                                                         | résultat déclaré « provisoire » |
| à vérifier  | réception ou envoi sans contrepartie, lignes non prises en charge ou illisibles, historique antérieur à 2019 | résultat affiché, points listés |
| information | récompenses entrées à prix d'acquisition nul                                                                 | choix de calcul expliqué        |

Le niveau global (complet, à vérifier, incomplet) mesure la complétude de l'historique ; ce n'est
pas une garantie de conformité fiscale.

## Trade Republic

**Export :** application mobile, Profil → Relevés → Export de transactions, période « depuis
l'ouverture ». Disponible depuis avril 2026. Ne pas ouvrir le fichier dans Excel avant l'import :
il modifie les guillemets en l'enregistrant.

**Format :** CSV séparé par des virgules, valeurs entre guillemets, dates en UTC (ISO 8601, à la
milliseconde ou à la microseconde). Une variante séparée par des points-virgules est aussi
acceptée.

```
datetime,date,account_type,category,type,asset_class,name,symbol,shares,price,amount,fee,tax,currency,original_amount,original_currency,fx_rate,description,transaction_id,counterparty_name,counterparty_iban,payment_reference,mcc_code
```

Le fichier couvre tout le compte : espèces, titres et crypto. Seules les lignes
`asset_class = CRYPTO` sont lues. Les **ETF et ETN sur le thème de la crypto** (`FUND`, `STOCK`)
sont des titres : ils relèvent du formulaire 2074, pas du 2086, et sont ignorés.

| `category` / `type`          | Transaction          | Montants                                                         |
| ---------------------------- | -------------------- | ---------------------------------------------------------------- |
| `TRADING` / `BUY`            | achat                | `amount` = montant brut (quantité × prix), `fee` = frais d'ordre |
| `TRADING` / `SELL`           | vente                | idem ; la vente est imposable                                    |
| `DELIVERY` / `FREE_RECEIPT`  | récompense (staking) | quantité, et `price` = cours du jour à la réception              |
| `DELIVERY` / `FREE_DELIVERY` | transfert sortant    | quantité seulement                                               |
| `DELIVERY` / `MIGRATION`     | ignorée              | paires −x / +x de migration interne, sans effet                  |
| autres lignes crypto         | à vérifier           | listées dans le résultat de l'import                             |

`amount` et `fee` sont signés (négatifs quand l'argent sort) : l'import garde leur valeur
absolue. Les plans d'épargne et le Saveback n'ont pas de frais d'ordre ; un ordre ponctuel coûte
1 €. Le spread est compris dans le prix.

`symbol` contient le symbole de la crypto (`BTC`), sauf pour les symboles longs : Trade Republic
y met alors un pseudo-ISIN de 12 caractères, comme `XF0RENDER015` pour RENDER. L'import retrouve
le symbole.

**Vérifié sur deux exports réels** (2 700 lignes au total) :

- achats ponctuels avec 1 € de frais et achats par plan d'épargne, sans frais ;
- une vente : quantité négative, `amount` brut positif, 1 € de frais ;
- 106 récompenses de staking (SOL, NEAR, ETH) en `FREE_RECEIPT`. Une vente de NEAR porte
  exactement sur les NEAR achetés plus ceux reçus en staking : traiter ces lignes comme des
  transferts aurait signalé à tort un historique incomplet ;
- l'exclusion des titres, des fonds (dont un ETF sur le thème de la crypto) et des produits
  dérivés.

**Pas encore vérifié sur un export réel :**

- une réception depuis un portefeuille externe, qui porte aussi le type `FREE_RECEIPT` : elle
  est lue comme une récompense, à requalifier en transfert ;
- les envois vers un portefeuille externe (`FREE_DELIVERY`) ;
- le paiement par carte en crypto et le Crypto Saveback : leurs lignes sont listées comme « à
  vérifier ».

## Coinbase

**Export :** Relevés → Générer un relevé personnalisé → CSV, toutes les opérations depuis
l'ouverture du compte.

**Format :** quelques lignes d'information précèdent l'en-tête (« Transactions », puis le nom de
l'utilisateur ; les relevés de 2023 commencent aussi par un avertissement). L'import cherche la
première ligne qui commence par `ID,Timestamp` ou `Timestamp,` et ignore ce qui précède, sans le
conserver.

```
ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
```

Les anciens relevés n'ont pas de colonne `ID` (l'identifiant est alors construit à partir de la
date et du numéro de ligne), datent les opérations au format ISO (`2023-07-14T10:40:14Z`) plutôt
qu'en `2024-12-05 06:33:40 UTC`, et nomment certaines colonnes `Spot Price Currency`,
`Total (inclusive of fees)` ou `Fees`. Les montants s'écrivent à l'anglaise, avec le symbole de la
devise : `-€1,234.56`. Les opérations vont de la plus récente à la plus ancienne.

| `Transaction Type`                                            | Transaction                | Montants                                                         |
| ------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| `Buy`, `Advanced Trade Buy`                                   | achat                      | `Subtotal` hors frais, `Fees and/or Spread`                      |
| `Sell`, `Advanced Trade Sell`, `Retail Simple Dust`           | vente                      | `Subtotal` brut, `Fees and/or Spread`                            |
| `Convert`                                                     | échange entre cryptos      | actif reçu lu dans `Notes` : « Converted 0.002 BTC to 0.05 ETH » |
| `Staking Income`, `Rewards Income`, `Coinbase Earn`…          | récompense                 | valeur `Subtotal`                                                |
| `Receive` avec « Coinbase Earn », « Rewards » ou « Referral » | récompense                 | valeur `Subtotal`                                                |
| `Card Spend`, `Subscription`                                  | paiement en crypto         | `Subtotal`, `Fees and/or Spread`                                 |
| `Receive`, `Send`                                             | transfert entrant, sortant | quantité seulement                                               |
| `Pro Deposit`, `Retail Staking Transfer`…                     | ignorée                    | mouvement entre comptes Coinbase                                 |
| `Deposit`, `Withdrawal` d'euros                               | ignorée                    | hors portefeuille crypto                                         |
| autres types                                                  | à vérifier                 | `Donation`, `Asset Migration`…                                   |

Cas particuliers :

- **ETH2**, l'ETH placé en staking chez Coinbase jusqu'en 2025, est traité comme de l'ETH. Sa
  conversion depuis l'ETH n'a donc aucun effet, pas plus que l'envoi d'ETH2 suivi de la
  réception d'ETH qui l'a remplacé.
- **Ordres avancés contre une autre crypto** (paire BTC-USDC…) : à vérifier, seuls les ordres
  contre des euros sont lus.
- **Devises** : un relevé peut mêler euros et dollars. Une opération en dollars est lue si son
  montant ne sert pas au calcul (échange, transfert) ; un achat, une vente ou un paiement en
  dollars est à vérifier.

**Vérifié sur des exemples publics seulement**, faute de compte Coinbase : la documentation de
projets open source qui lisent ce format, et l'extrait de relevé réel publié par
[Export-To-Ghostfolio](https://github.com/dickwolff/Export-To-Ghostfolio) (staking, conversions,
ETH2, achat en euros et en dollars).

## Kraken (expérimental)

Grand livre : History → Export → **Ledgers**, format CSV. Kraken livre une archive ZIP : importez
le fichier `ledgers.csv` qu'elle contient. Une ligne par mouvement d'un actif, heures en UTC,
montant signé et frais à part dans l'actif de la ligne (`solde = solde précédent + amount − fee`).
Les quatre variantes de l'en-tête (9 à 12 colonnes, avec ou sans `subtype`, `wallet`,
`subclass`) sont acceptées.

| `type` / `subtype`                                        | Transaction                | Quantités                                             |
| --------------------------------------------------------- | -------------------------- | ----------------------------------------------------- |
| `trade`, `spend` / `receive` (deux lignes, même `refid`)  | achat, vente ou échange    | ce qui sort frais compris, ce qui entre frais déduits |
| `deposit`, `withdrawal` de crypto                         | transfert entrant, sortant | frais de retrait comptés comme frais de réseau        |
| `earn/reward`, `earn/airdrop`, `staking`, `invite bonus`  | récompense                 | frais déduits ; pas de valeur en euros dans l'export  |
| `earn/allocation`, `transfer/spottostaking`…              | ignorée                    | mouvement entre portefeuilles Kraken                  |
| dépôts et retraits d'euros, ligne sans `txid`, `KFEE`     | ignorée                    | ligne en attente doublée par sa version confirmée     |
| `margin`, `rollover`, `settled`, `dividend`, `adjustment` | à vérifier                 | marge, dérivés, actifs tokenisés : autre régime       |
| échange contre une autre monnaie que l'euro               | à vérifier                 |                                                       |

- **Codes d'actifs** : table explicite pour les codes historiques (`XXBT` → BTC, `XETH` → ETH,
  `ZEUR` → EUR…), sans retirer un X ou un Z initial au hasard (`XTZ` reste XTZ). Les suffixes de
  solde (`.S`, `.M`, `.P`, `.B`, `.F`, `.T`, `.HOLD`) désignent le même actif.
- **Doublons** : `txid` est unique ; un même ledger importé deux fois n'ajoute rien.

## Crypto.com (expérimental)

Application : Comptes → Historique → Export → **Token Wallet**, fichier
`crypto_transactions_record_….csv` (trois ans au plus par export). N'importez pas l'export du
portefeuille espèces (`fiat_transactions_record`) : les achats en euros figurent déjà dans le
fichier crypto. Heures en UTC ; valeur en euros dans `Native Amount` quand la monnaie
d'affichage de l'application est l'euro.

| `Transaction Kind`                                          | Transaction                | Montants                                            |
| ----------------------------------------------------------- | -------------------------- | --------------------------------------------------- |
| `viban_purchase`, `recurring_buy_order`, `…purchase_commit` | achat                      | euros réellement débités (`Amount`), pas de frais   |
| `crypto_purchase` (carte bancaire)                          | achat                      | `Native Amount`, si l'application affiche des euros |
| `crypto_viban_exchange`, `…sell_commit`, `card_top_up`      | vente                      | `To Amount` en euros, ou `Native Amount`            |
| `crypto_exchange`, `…crypto_wallet.exchange`                | échange entre cryptos      | `To Currency`, `To Amount`                          |
| `crypto_deposit`, `crypto_withdrawal`, transferts Exchange  | transfert entrant, sortant |                                                     |
| intérêts Earn, staking, parrainage, cashback                | récompense                 | valeur `Native Amount`                              |
| `crypto_payment`                                            | paiement en crypto         | `Native Amount`                                     |
| ordres limites `…_lock` / `…_unlock`, mouvements Earn       | ignorée                    | blocage de fonds, sans effet sur les avoirs         |
| poussières, transferts entre utilisateurs, paniers, autres  | à vérifier                 | sur plusieurs lignes, ou qualification à décider    |

- **Identifiant** : l'export n'en a pas. Il est tiré du contenu de la ligne (date, type,
  montants), avec un numéro d'occurrence pour les lignes identiques : une opération présente dans
  deux exports qui se chevauchent n'est comptée qu'une fois.
- **Frais** : pas de colonne ; l'écart de cours est compris dans le prix.

## Bitvavo (expérimental)

Historique des transactions → **Exporter**, format CSV. Une ligne par opération, quantité signée.
Date et heure sont lues dans le fuseau de la colonne `Timezone` (`Europe/Amsterdam`). Les lignes
dont le statut n'est pas `Completed` ou `Distributed` (en attente, annulées) sont ignorées.
Virgule ou point-virgule comme séparateur.

| `Type`                                                   | Transaction                | Montants                                          |
| -------------------------------------------------------- | -------------------------- | ------------------------------------------------- |
| `buy`                                                    | achat                      | euros débités moins les frais, frais `Fee amount` |
| `sell`                                                   | vente                      | euros crédités plus les frais (prix brut), frais  |
| `deposit`, `withdrawal` de crypto                        | transfert entrant, sortant | frais de retrait dans la crypto retirée           |
| `staking`, `fixed_staking`, `affiliate`, `rebate`, prime | récompense                 | pas de valeur en euros dans l'export              |
| dépôts et retraits d'euros                               | ignorée                    |                                                   |
| autres types (prêt…)                                     | à vérifier                 |                                                   |

Incertitudes : l'heure est supposée locale au fuseau indiqué (la colonne n'aurait pas lieu
d'être sinon), et l'on ne sait pas si la quantité d'un retrait inclut les frais de réseau.

## Sources des formats expérimentaux

Documentation des plateformes ([Kraken, champs du grand livre](https://support.kraken.com/articles/360001169383-how-to-interpret-ledger-history-fields),
[Crypto.com, export de l'historique](https://help.crypto.com/en/articles/3438579-how-do-i-export-my-transaction-history-app)),
et projets open source qui lisent ces formats : BittyTax et rotki (AGPL-3.0, lus pour comprendre
le format, sans reprise de code), GhostfolioSidekick (MIT) et Export-To-Ghostfolio (Apache-2.0)
pour Bitvavo. Les fichiers de test du dépôt sont inventés, dans la structure de ces formats.

## Ajouter une plateforme

1. Écrire l'importeur dans `shared/importers/` : `readCsv` pour lire le fichier, `eachRow` pour
   écarter une ligne illisible sans bloquer les autres, `cryptoSymbol` pour valider les symboles.
2. Traduire chaque type d'opération en transaction commune (`shared/portfolio/transaction.ts`) ;
   ce qui n'est pas sûr va dans `unsupported`, jamais dans le calcul.
3. L'ajouter au registre `IMPORTERS` (`shared/importers/detect.ts`), avec `verified: false`
   tant qu'aucun export réel ne l'a confirmé.
4. Des tests avec un fichier inventé dans la structure réelle, dont un calcul du 2086 de bout en
   bout, et une section dans ce document.
