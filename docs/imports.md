# Formats d'import

Chaque plateforme exporte ses transactions dans son propre format. Les importeurs
(`shared/importers/`) les traduisent dans le format commun décrit dans
`shared/portfolio/transaction.ts`. Les fichiers sont lus dans le navigateur et ne sont envoyés
nulle part.

Règles communes :

- les colonnes sont repérées par leur nom, pas par leur position ;
- une ligne crypto que l'importeur ne sait pas traiter n'est jamais perdue en silence : elle est
  listée pour que l'utilisateur la vérifie ;
- en cas d'erreur, le message indique le numéro de ligne dans le fichier.

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

| `category` / `type`          | Transaction       | Montants                                                         |
| ---------------------------- | ----------------- | ---------------------------------------------------------------- |
| `TRADING` / `BUY`            | achat             | `amount` = montant brut (quantité × prix), `fee` = frais d'ordre |
| `TRADING` / `SELL`           | vente             | idem ; la vente est imposable                                    |
| `DELIVERY` / `FREE_RECEIPT`  | transfert entrant | quantité seulement                                               |
| `DELIVERY` / `FREE_DELIVERY` | transfert sortant | quantité seulement                                               |
| `DELIVERY` / `MIGRATION`     | ignorée           | paires −x / +x de migration interne, sans effet                  |
| autres lignes crypto         | à vérifier        | listées dans le résultat de l'import                             |

`amount` et `fee` sont signés (négatifs quand l'argent sort) : l'import garde leur valeur
absolue. Les plans d'épargne et le Saveback n'ont pas de frais d'ordre ; un ordre ponctuel coûte
1 €. Le spread est compris dans le prix.

**Vérifié sur un export réel** (647 lignes, dont 29 achats de crypto par plan d'épargne) : les
achats, l'exclusion des titres et des fonds, la lecture des dates.

**Pas encore vérifié sur un export réel :**

- les ventes, d'après la documentation de projets open source qui lisent ce format ;
- `FREE_RECEIPT`, qui sert aussi aux récompenses de staking : elles sont pour l'instant traitées
  comme des transferts entrants, donc sans prix d'acquisition. Une vente ultérieure de ces actifs
  est signalée comme un historique incomplet ;
- le paiement par carte en crypto, le Crypto Saveback et le bonus sur les transferts entrants :
  leurs lignes sont listées comme « à vérifier ».
