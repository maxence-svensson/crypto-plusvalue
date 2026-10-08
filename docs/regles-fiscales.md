# Règles fiscales appliquées

Ce document décrit les règles que suit le moteur de calcul (`shared/tax/form2086.ts`), avec leurs
sources. Il vise les particuliers qui réalisent des cessions occasionnelles d'actifs numériques
(article 150 VH bis du CGI), déclarées sur le formulaire 2086. État des textes au 8 octobre 2026.

> CryptoPlusValue est un outil indépendant, sans lien avec l'administration fiscale. Ses résultats
> sont indicatifs et ne remplacent pas un conseil fiscal.

## La formule

```
plus-value = prix de cession − prix total d'acquisition × prix de cession / valeur globale du portefeuille
```

Le foyer fiscal n'a **qu'un seul portefeuille**, tous comptes et plateformes confondus, suivi depuis
sa première acquisition ([BOFiP 30-20][b20] §70).

## Le formulaire 2086, ligne par ligne

Chaque cession imposable occupe une colonne. Lignes du déclarant 1 ([formulaire et notice][2086]) :

| Ligne | Libellé                                                | Calcul                                 |
| ----- | ------------------------------------------------------ | -------------------------------------- |
| 211   | Date de la cession                                     |                                        |
| 212   | Valeur globale du portefeuille au moment de la cession | voir plus bas                          |
| 213   | Prix de cession                                        | contrepartie reçue                     |
| 214   | Frais de cession                                       |                                        |
| 215   | Prix de cession net des frais                          | 213 − 214                              |
| 216   | Soulte reçue ou versée lors de la cession              |                                        |
| 217   | Prix de cession net des soultes                        | 213 + soulte reçue, ou − soulte versée |
| 218   | Prix de cession net des frais et soultes               | 217 − 214                              |
| 220   | Prix total d'acquisition                               | cumul depuis l'origine                 |
| 221   | Fractions de capital initial                           | cumul des cessions passées             |
| 222   | Soultes reçues lors d'échanges antérieurs              | cumul                                  |
| 223   | Prix total d'acquisition net                           | 220 − 221 − 222                        |
| —     | Plus ou moins-value de la cession                      | 218 − 223 × 217 / 212                  |
| 224   | Plus ou moins-value globale                            | somme des colonnes                     |

Les **frais** réduisent le premier terme (ligne 218) mais pas le quotient (ligne 217) : « les frais
déductibles, quels qu'ils soient, ne viennent pas en diminution du prix de cession pour la
détermination du quotient » ([notice 2086][2086] p. 7, [BOFiP 30-20][b20] §50). Des frais payés en
crypto font partie de la même opération ([BOFiP 30-20][b20] §50).

## Ce qui est imposable

| Opération                                                                  | Traitement                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| Vente contre des euros (ou une autre monnaie légale)                       | cession imposable                                      |
| Paiement d'un bien ou d'un service en crypto                               | cession imposable, au prix du bien ou du service       |
| Échange entre cryptos **avec** soulte                                      | cession imposable                                      |
| Échange entre cryptos **sans** soulte, stablecoins compris (voir plus bas) | sursis d'imposition : rien à déclarer                  |
| Transfert entre ses propres portefeuilles                                  | ni cession ni acquisition                              |
| Don de crypto                                                              | non imposable, mais réduit le prix total d'acquisition |

Sources : [CGI art. 150 VH bis][cgi], [BOFiP 30-10][b10] §70 et §80.

## Prix total d'acquisition (ligne 220)

Il additionne les prix payés en euros pour toutes les acquisitions passées, et la valeur des biens
ou services remis en échange de crypto, soultes versées comprises ([BOFiP 30-20][b20] §70).
Exemple officiel : 500 € d'achat, puis des biens valant 200 € et une soulte de 100 € échangés
contre de la crypto, donnent 800 €.

Il est ensuite **diminué** ([BOFiP 30-20][b20] §100 à §120) :

- de la **fraction de capital initial** de chaque cession passée, à titre gratuit ou onéreux :
  ligne 223 × ligne 217 / ligne 212 ;
- des **soultes reçues** lors d'échanges antérieurs.

Après un échange avec soulte, les actifs reçus entrent dans le prix total d'acquisition pour la
valeur des actifs remis (exemple officiel : [BOFiP 30-20][b20] §120).

## Valeur globale du portefeuille (ligne 212)

C'est la valeur, **au moment de la cession**, de tous les actifs numériques détenus juste avant :
actifs cédés compris, sur toutes les plateformes, y compris étrangères, et dans tous les
portefeuilles personnels ([BOFiP 30-20][b20] §140). Les cotations moyennes publiées par des sites
spécialisés sont admises (§150).

L'application la calcule ainsi (`shared/portfolio/`) :

1. elle rejoue tout l'historique importé pour connaître les actifs détenus juste avant la cession ;
2. elle compte les actifs cédés pour leur **prix de cession**, connu exactement : la valeur globale
   ne peut donc jamais être inférieure au prix obtenu ;
3. elle valorise les autres actifs au cours du marché au même moment.

Un transfert entre deux portefeuilles du foyer ne change pas ce que le foyer possède : il n'a
aucun effet, sauf ses frais de réseau, qui sortent du portefeuille. Si une vente porte sur plus
d'actifs que l'historique n'en contient, il manque des achats (une autre plateforme, un
portefeuille personnel) : l'application le signale au lieu de calculer sur des données fausses.

## Seuil de 305 €

Si la somme des prix de cession de l'année n'excède pas **305 €** pour tout le foyer, les cessions
sont exonérées. Au-delà, toutes sont imposables dès le premier euro ([BOFiP 30-10][b10] §90 à §110).
Le formulaire compare ce seuil à la somme des **lignes 218**, nettes de frais (ligne 51).

## Plus et moins-values de l'année

Les plus et moins-values de l'année se compensent. Le solde se déclare en case **3AN** de la
déclaration 2042 C s'il est positif, en case **3BN** s'il est négatif. Une moins-value nette ne se
reporte pas sur les années suivantes ([BOFiP 30-20][b20] §160 et §170).

L'année d'une opération est l'année civile **à l'heure de Paris** : une vente faite le 31 décembre à
23 h 30 UTC appartient à l'année suivante.

Taux : prélèvement forfaitaire unique de **31,4 %** (12,8 % d'impôt sur le revenu et 18,6 % de
prélèvements sociaux depuis la LFSS 2026), ou option pour le barème progressif en case 3CN
([FAQ impots.gouv.fr][faq]). Le BOFiP mentionne encore 30 %, un taux périmé.

## Choix de l'application sur les points incertains

| Question                              | Choix retenu                                                 | Pourquoi                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Frais d'achat                         | inclus dans le prix d'acquisition                            | Le texte retient les « prix effectivement acquittés » ; les logiciels du marché font de même.                 |
| Récompenses de staking, airdrops      | valeur d'acquisition nulle par défaut                        | Aucune doctrine ne fixe leur valeur d'entrée ; 0 € est le choix prudent.                                      |
| Échange avec soulte **versée**        | actifs reçus ajoutés pour la valeur remise plus la soulte    | Seul le cas de la soulte reçue a un exemple officiel ; le §70 inclut les soultes versées.                     |
| Stablecoins (USDT, USDC, EURC…)       | échange crypto contre stablecoin en sursis                   | Ce sont des actifs numériques ; seul le cas des jetons de monnaie électronique au sens de MiCA reste discuté. |
| Retraits vers un portefeuille externe | supposés rester dans le foyer                                | C'est le cas le plus courant ; un envoi à un tiers (paiement, don) doit être requalifié.                      |
| Frais de réseau d'un transfert        | sortent du portefeuille, sans être traités comme une cession | Les montants sont faibles et la tolérance du BOFiP ne vise que les frais d'une cession ou d'un échange.       |
| Arrondis                              | pleine précision, cases arrondies à l'euro                   | Aucune règle trouvée ; les fractions cumulées doivent rester exactes.                                         |
| Seuil de 305 €                        | comparé aux prix nets (ligne 218)                            | C'est le calcul du formulaire ; la FAQ parle de montant « brut ».                                             |

## Hors du périmètre actuel

- **Acquisitions antérieures à 2019** : règles particulières de reconstitution du prix total
  d'acquisition ([BOFiP 30-20][b20] §130).
- **NFT** : depuis le 1er janvier 2026, les jetons non fongibles relèvent d'un régime distinct
  (article 150 VH ter).
- **Activité professionnelle** (BIC ou BNC), minage et staking imposés à la réception.
- **ETF et ETN sur la crypto** : ce sont des titres, imposés comme des valeurs mobilières
  (formulaire 2074).

## Obligations à rappeler à l'utilisateur

- **Formulaire 3916-bis** : déclarer chaque compte d'actifs numériques ouvert auprès d'une entité
  étrangère (Binance, Coinbase, Trade Republic…). Amende de 750 € par compte non déclaré, 1 500 €
  au-delà de 50 000 € ([BOFiP 30-30][b30] §70 et §80).
- **DAC8** : depuis le 1er janvier 2026, les plateformes collectent les transactions de leurs clients
  pour les transmettre à l'administration fiscale à partir de 2027.

[cgi]: https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038612228
[b10]: https://bofip.impots.gouv.fr/bofip/11967-PGP.html
[b20]: https://bofip.impots.gouv.fr/bofip/11968-PGP.html
[b30]: https://bofip.impots.gouv.fr/bofip/11969-PGP.html
[2086]: https://www.impots.gouv.fr/sites/default/files/formulaires/2086/2026/2086_5515.pdf
[faq]: https://www.impots.gouv.fr/particulier/questions/comment-declarer-les-plus-ou-moins-values-sur-cessions-dactifs-numeriques
