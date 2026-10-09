# Design

Direction « verre » inspirée des interfaces iOS : un fond clair et calme, des surfaces en verre
dépoli qui créent la hiérarchie, une typographie système serrée et des animations courtes. Le site
garde deux repères du formulaire de déclaration : les **cases en peigne** (un chiffre par case) et
le **surligneur** sur les montants à recopier. Il ne cherche pas à ressembler au site des impôts
(pas de police Marianne ni de charte de l'État) ni à copier Apple : aucune police ni icône
propriétaire n'est embarquée.

Tous les jetons sont dans `app/assets/css/main.css`.

## Couleurs

| Jeton              | Clair                | Sombre               | Rôle                                 |
| ------------------ | -------------------- | -------------------- | ------------------------------------ |
| `--background`     | `#F5F5F7`            | `#000000`            | fond de page                         |
| `--elevated`       | `#FFFFFF`            | `#1C1C1E`            | surfaces pleines (tableaux, listes)  |
| `--surface`        | blanc à 62 %         | `#1C1C1E` à 62 %     | verre des cartes                     |
| `--surface-strong` | blanc à 78 %         | `#2C2C2E` à 78 %     | verre des cartes de résultat, menus  |
| `--text-primary`   | `#1D1D1F`            | `#F5F5F7`            | texte                                |
| `--text-secondary` | `#6E6E73`            | `#A1A1A6`            | texte secondaire                     |
| `--accent`         | `#0071E3`            | `#0071E3`            | boutons principaux                   |
| `--link`           | `#0066CC`            | `#2997FF`            | liens, étapes, états actifs          |
| `--gain`, `--loss` | `#1A7F37`, `#D70015` | `#30D158`, `#FF6961` | montants signés                      |
| `--warning`        | `#B83000`            | `#FF9F0A`            | alertes (historique incomplet…)      |
| `--highlight`      | `#FFE066`            | jaune à 45 %         | **uniquement** les montants à copier |

Les couleurs iOS (`--ios-blue`, `--ios-indigo`, `--ios-purple`, `--ios-pink`…) servent aux halos
du fond et au remplissage du curseur. Le bleu iOS `#007AFF` ne donne que 4:1 de contraste avec du
blanc : les boutons utilisent `#0071E3` (4,7:1) et les liens `#0066CC` (5,1:1 sur le fond). De
même, le vert et le rouge iOS sont trop clairs pour du texte sur fond clair : on garde leurs
variantes foncées. Chaque texte atteint au moins 4,5:1 (WCAG AA), et le vert et le rouge ne
portent jamais seuls l'information : les montants gardent leur signe.

## Graphiques

Dessinés à la main en SVG, sans bibliothèque (`ColumnChart`, `ShareBars`, `ChartCard`) :

- **Une forme par question.** Plus ou moins-value par année : colonnes de part et d'autre de la
  ligne de base. Achats et ventes : colonnes groupées par mois (ou par année). Répartition :
  barres horizontales classées, montant et part écrits. Une seule année, une seule plateforme :
  le chiffre plutôt qu'une colonne ou une barre seule.
- **Couleurs validées**, pour le daltonisme et le contraste, sur les cartes claires (`#FFFFFF`)
  et sombres (`#1C1C1E`) : `--series-1` (bleu, `#2A78D6` / `#3987E5`), `--series-2` (orange,
  `#EB6834` / `#D95926`), `--series-negative` (rouge, `#E34948` / `#E66767`). Le vert et le
  rouge des montants ne se distinguent pas assez en vision deutéranope (écart 3,7 en sombre) :
  les colonnes de plus-value sont bleues. La direction (au-dessus ou au-dessous de zéro) et le
  signe de l'étiquette portent aussi l'information.
- **Traits fins** : colonnes de 24 px au plus, arrondies de 4 px au bout de la donnée, carrées sur
  la ligne de base, 2 px entre deux colonnes voisines ; quadrillage d'un pixel, jamais pointillé.
- **Texte à l'encre du texte**, jamais à la couleur de la série ; valeurs écrites avec
  parcimonie (le maximum de chaque série, ou chaque colonne quand elles sont peu nombreuses).
- **Infobulle au survol comme au clavier** : un bouton transparent par colonne, dont le nom
  accessible donne toutes les valeurs ; légende dès deux séries ; vue tableau pour chaque
  graphique.

## Le verre, avec parcimonie

Quatre niveaux, du plus léger au plus flottant : `glass-subtle`, `glass`, `glass-strong` et
`glass-floating`. Chacun combine un flou d'arrière-plan avec saturation, une bordure presque
blanche, un reflet intérieur d'un pixel et un très léger dégradé interne qui imite la lumière.

- **Barre de navigation et menus** : `glass-floating`, le plus de flou et d'ombre. La barre passe
  de `glass` à `glass-floating` dès que la page défile.
- **Cartes principales** (dépôt de fichiers, résultat, comparaison, simulateur) : `glass` ou
  `glass-strong`.
- **Tableaux et listes** : surface pleine (`solid-card`), pour la lisibilité des chiffres.
- **Fond** : `#F5F5F7` presque opaque, avec quatre halos très diffus (bleu, violet, cyan, rose)
  qui donnent au verre quelque chose à flouter.

Le verre n'est jamais imbriqué dans du verre : un flou dans un flou ne floute plus la page.

## Typographie

La police du système : San Francisco sur les appareils Apple, Segoe UI sous Windows, Roboto sous
Android. Rien à télécharger.

- Accroche : `clamp(3rem, 7vw, 6.5rem)`, graisse 700, approche −0,055 em, interlignage 0,95.
- Titres : graisse 700, approche −0,035 em.
- Montants : chiffres tabulaires pour aligner les colonnes.

## Composants

- **Case en peigne** (`CombBox.vue`) : le code de la case, puis un chiffre par cellule, comme les
  champs de code à usage unique d'iOS. Le surligneur passe sur les cellules, puis les chiffres
  s'inscrivent un à un. Les lecteurs d'écran lisent « Case 3AN : 331 € ».
- **Boutons** (`.btn-primary`, `.btn-secondary`, `.btn-ghost`) : montée d'un pixel au survol,
  enfoncement à 97 % au clic.
- **Champs** (`.input`) : fond légèrement teinté, anneau bleu au focus.
- **Contrôle segmenté** (`.segmented`) : année des ventes et tranche d'imposition.
- **Volets dépliables** (`.disclosure`) : chevron qui pivote, hauteur animée.
- **Icônes** (`AppIcon.vue`) : trait fin, redessinées d'après Lucide (licence ISC).

## Navigation

- **Ordinateur et grande tablette** (1 024 px et plus) : barre de navigation en haut, en verre,
  qui reste visible au défilement et devient plus opaque dès qu'on descend. La marque à gauche,
  les six sections en libellés seuls (la section ouverte en pastille bleue), les paramètres en
  icône à droite. Ses marges sont celles du contenu : elle s'aligne sur les cartes de la page.
- **Téléphone et petite tablette** : barre d'onglets en verre en bas de l'écran, comme sur iOS,
  avec quatre onglets (Accueil, Opérations, Fiscalité, Simuler) et « Plus » pour le reste ; en
  haut, la marque et le rappel du mode démonstration. L'encoche et la barre d'accueil des iPhone
  sont respectées (`env(safe-area-inset-*)`).
- Une section n'apparaît dans la navigation que si elle a un contenu réel. Une page qui a besoin
  de données propose d'importer ou d'essayer l'exemple.
- **Mode démonstration** : bandeau en haut de chaque page, « Quitter la démonstration » ; un vrai
  fichier importé remplace les données fictives.

## Mouvement

Des animations courtes, sur l'opacité, la position et le flou, avec la courbe
`cubic-bezier(0.22, 1, 0.36, 1)` :

- à l'ouverture, l'accroche arrive en fondu, élément par élément, puis le surligneur passe sur la
  case 3AN ;
- les blocs encore hors de l'écran apparaissent quand on les atteint (`v-reveal`) ; ce qui est
  déjà visible n'est jamais masqué ;
- menus et volets s'ouvrent en fondu avec un léger zoom ;
- squelette de chargement pendant la récupération des cours.

Tout est désactivé si le système demande de réduire les animations (`prefers-reduced-motion`).

## Mode sombre

Il suit le réglage du système, ou le choix fait dans les paramètres (Système, Clair, Sombre).
Chaque couleur est déclarée une fois avec `light-dark()` ; l'attribut `data-theme` de `<html>`
fixe `color-scheme`, posé avant l'affichage par un court script pour éviter un éclair de l'autre
thème. Ce n'est pas une inversion : fond noir, surfaces gris foncé
translucides, bordures blanches à très faible opacité, halos un peu plus présents pour que le
verre reste visible.

## Accessibilité

- Lien d'évitement, focus visible en bleu sur tout élément interactif.
- La zone de dépôt est un `<label>` autour d'un `<input type="file">`, utilisable au clavier ; le
  bouton « Importer mon export » ouvre le même sélecteur.
- Menu mobile : `aria-expanded`, fermeture avec Échap (le focus revient au bouton) ou en touchant
  ailleurs.
- Zones tactiles d'au moins 44 px, tableaux avec `<caption>` et en-têtes `scope`, messages d'état
  dans des zones `aria-live`.
- Vérifié à 375 et 1 280 px de large, en clair et en sombre, sans défilement horizontal.
