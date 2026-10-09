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
  fichier de plus de 50 Mo.

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
