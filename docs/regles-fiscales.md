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

## Taux par année

Les taux dépendent de l'année des revenus. Ils sont dans `shared/tax/rules.ts`. Une année sans
règles connues n'est jamais estimée avec celles d'une autre : l'application l'annonce et
n'affiche pas d'impôt.

| Revenus       | Impôt (PFU)  | Prélèvements sociaux | Total  | Option barème (3CN) | Barème par part                          |
| ------------- | ------------ | -------------------- | ------ | ------------------- | ---------------------------------------- |
| avant 2019    | autre régime |                      |        |                     | non calculé                              |
| 2019 à 2022   | 12,8 %       | 17,2 %               | 30 %   | non                 |                                          |
| 2023          | 12,8 %       | 17,2 %               | 30 %   | oui                 | 11 294 / 28 797 / 82 341 / 177 106 €     |
| 2024          | 12,8 %       | 17,2 %               | 30 %   | oui                 | 11 497 / 29 315 / 83 823 / 180 294 €     |
| 2025          | 12,8 %       | 18,6 %               | 31,4 % | oui                 | 11 600 / 29 579 / 84 577 / 181 917 €     |
| 2026          | 12,8 %       | 18,6 %               | 31,4 % | oui                 | pas encore voté : celui de 2025, signalé |
| 2027 et après | inconnus     |                      |        |                     |                                          |

- **Régime** : article 150 VH bis du CGI, pour les cessions faites depuis le 1er janvier 2019.
- **Prélèvements sociaux** : la CSG passe de 9,2 % à 10,6 % sur les revenus du patrimoine
  « à compter des revenus 2025 », la CSG déductible restant à 6,8 % (LFSS 2026, art. 12 ; CSS,
  art. L136-8 ; [Principales nouveautés, revenus 2025][nouveautes]). Les revenus fonciers, plus-values
  immobilières, l'assurance-vie et l'épargne logement restent à 9,2 % ; les plus-values crypto n'en
  font pas partie. Le BOFiP (30 %) décrit donc les revenus antérieurs à 2025.
- **Option pour le barème** : ouverte aux cessions réalisées depuis le 1er janvier 2023 (loi de
  finances pour 2022, art. 79 ; [BOFiP ACTU-2024-00078][option]).
- **Barèmes** : lois de finances pour 2024, 2025 et 2026 ([service-public.gouv.fr][bareme]). Tranches
  à 0 %, 11 %, 30 %, 41 % et 45 %, chacune à partir du seuil indiqué.

## Prélèvement forfaitaire ou barème

Par défaut, la plus-value nette est taxée au **prélèvement forfaitaire** : 12,8 % d'impôt sur le
revenu et les prélèvements sociaux de l'année (17,2 % ou 18,6 %). Sur option, en cochant la case **3CN** de la 2042 C,
elle est soumise au **barème progressif** : elle s'ajoute aux autres revenus du foyer, les
prélèvements sociaux restant dus, et 6,8 % de CSG deviennent déductibles des revenus de l'année
suivante. L'option est globale pour les plus-values crypto du foyer et indépendante de celle des
revenus de placements (case 2OP) ([notice 2086][2086] ; [BOFiP 30-30][b30] §15).

L'application compare les deux :

- à partir de la **tranche marginale** choisie par l'utilisateur : impôt = plus-value × tranche ;
- ou à partir du **revenu imposable** et du **nombre de parts** : impôt avec la plus-value moins
  impôt sans elle, au barème de l'année (tableau ci-dessus). Une plus-value qui fait changer de
  tranche est ainsi imposée exactement.

Pour les revenus antérieurs à 2023, l'option n'existait pas : l'application l'indique au lieu de
comparer.

Le barème n'est avantageux que dans les tranches à 0 % et 11 %. Le calcul ignore la décote, le
plafonnement du quotient familial et les réductions d'impôt ; l'économie de CSG déductible est
affichée à part, estimée à tranche égale.

## Simulation d'une vente

Le simulateur ajoute une vente fictive à l'historique, aux cours du moment, et refait tout le
calcul. L'impôt affiché est celui que la vente **ajoute** à l'année :
impôt de l'année avec la vente − impôt de l'année sans elle, au prélèvement forfaitaire de 31,4 %.
Ainsi :

- une vente en plus-value peut ne rien coûter si l'année compte déjà des moins-values ;
- une petite vente peut coûter plus que sa propre plus-value × 31,4 % si elle fait dépasser le
  seuil de 305 € : les ventes précédentes de l'année deviennent imposables elles aussi.

Sans historique, l'utilisateur donne trois montants (somme investie, valeur du portefeuille,
montant vendu) et la vente est supposée être la seule de l'année.

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

## Où et quand déclarer

L'encadré « Et maintenant ? » liste ce qu'il reste à faire après le calcul. Ses dates viennent de
`shared/tax/calendar.ts`, à compléter chaque printemps quand la DGFiP publie le calendrier.

- **En ligne** : l'annexe 2086 se trouve à l'étape 3, bouton « Déclarations annexes » ; son
  résultat remplit automatiquement la case 3AN ou 3BN. Sur papier, le total se reporte sur la
  2042 C ([impots.gouv.fr, actifs numériques][faq]).
- **Revenus 2025** : en ligne jusqu'au 21 mai 2026 (départements 01 à 19 et non-résidents),
  28 mai (20 à 54) ou 4 juin (55 à 974 et 976) ; sur papier jusqu'au 19 mai 2026
  ([modalités 2026][modalites]).
- **Correction en ligne** des revenus 2025 : jusqu'au 30 novembre 2026, pour les déclarations
  faites en ligne ([service-public.fr, 3 juin 2026][correction]). Une page plus ancienne
  d'impots.gouv.fr annonce « mi-décembre » ; la date la plus récente est retenue.
- **Ensuite**, une réclamation reste possible jusqu'au 31 décembre de la deuxième année qui suit
  la mise en recouvrement : fin 2028 pour les revenus 2025.
- **Retard** : un dépôt tardif entraîne en principe une majoration de 10 % (CGI, art. 1758 A).

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
[bareme]: https://www.service-public.gouv.fr/particuliers/vosdroits/F1419
[faq]: https://www.impots.gouv.fr/particulier/questions/comment-declarer-les-plus-ou-moins-values-sur-cessions-dactifs-numeriques
[modalites]: https://www.impots.gouv.fr/les-modalites-de-la-declaration-de-revenus-en-2026
[correction]: https://www.service-public.gouv.fr/particuliers/actualites/A17433
[nouveautes]: https://www.impots.gouv.fr/www2/fichiers/documentation/brochure/ir_2026/pdf_som/nouveautes.pdf
[option]: https://bofip.impots.gouv.fr/bofip/14201-PGP.html/ACTU-2024-00078
