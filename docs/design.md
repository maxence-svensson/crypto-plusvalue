# Design

Direction « surligneur » : l'outil emprunte au **formulaire de déclaration** ses cases numérotées
et ses champs en peigne (un chiffre par case), et au geste de celui qui le remplit son
**surligneur fluo**. Il ne cherche pas pour autant à ressembler au site des impôts : pas de police
Marianne ni de charte de l'État, et la mention « outil indépendant » en pied de page.

## Pourquoi cette direction

La première version, « fintech sobre », était propre mais anonyme. La refonte a suivi la méthode
du skill `frontend-design` d'Anthropic : partir du sujet plutôt que d'un style à la mode, et
écarter les choix par défaut des interfaces générées. Trois pistes ont été écartées pour cette
raison : fond crème avec titre à empattements et accent terre cuite, fond noir avec un accent
fluo, et le « kit SaaS » de cartes arrondies identiques avec ombres et dégradés.

Le sujet, lui, a un vocabulaire visuel fort : les cases 3AN et 3BN, les lignes 211 à 224, les
champs bleutés du formulaire papier. C'est de là que viennent les choix ci-dessous.

## Couleurs

| Nom         | Valeur               | Rôle                                                           |
| ----------- | -------------------- | -------------------------------------------------------------- |
| Encre       | `#1B2240`            | texte, boutons, filets forts                                   |
| Encre pâle  | `#4A5578`            | texte secondaire (7,3:1 sur blanc, 6,5:1 sur champ)            |
| Papier      | `#FFFFFF`            | fond                                                           |
| Champ       | `#EEF2F8`            | zones de saisie et de résultat, comme les champs du formulaire |
| Trait       | `#C9D2E3`            | séparateurs                                                    |
| Surligneur  | `#FFE94D`            | **uniquement** derrière les montants à recopier                |
| Gain, perte | `#0C6E42`, `#B02C16` | montants signés (au moins 5,6:1 sur champ)                     |

Le jaune n'apparaît qu'à un endroit à la fois : là où il y a quelque chose à recopier. C'est le
seul élément audacieux de la page ; tout le reste est à l'encre. Chaque texte dépasse 5,5:1 de
contraste (WCAG AA demande 4,5:1), et le vert et le rouge ne portent jamais seuls l'information :
les montants gardent leur signe.

## Typographie

Une seule famille, **Archivo** (variable en graisse et en largeur), hébergée par le site : aucune
requête vers un service de polices.

- Titres : graisse 700, largeur 118 %, interlignage serré. La largeur donne la personnalité.
- Texte : largeur normale, lignes de moins de 80 caractères.
- Montants : chiffres tabulaires (`font-variant-numeric: tabular-nums`) pour aligner les colonnes,
  sans police à chasse fixe.

## Composants

- **Case en peigne** (`CombBox.vue`) : le code de la case sur fond d'encre, puis un chiffre par
  cellule. Les lecteurs d'écran lisent « Case 3AN : 331 € ».
- **Lignes du 2086** : le numéro de ligne dans un petit cadre, la valeur dans un champ bleuté,
  une colonne par cession comme sur le formulaire.
- **Étapes numérotées** : importer, vérifier, recopier. Les numéros sont justifiés : c'est une
  vraie suite d'actions.

## Mouvement

Un seul moment animé : le surligneur passe sur la case, puis les chiffres s'y inscrivent un par
un. Il joue dans l'accroche et sur le résultat de l'utilisateur, et il est désactivé si le système
demande de réduire les animations (`prefers-reduced-motion`). Aucune autre animation d'entrée.

## Accessibilité

- Lien d'évitement, focus visible à l'encre sur tout élément interactif.
- La zone de dépôt est un `<label>` autour d'un `<input type="file">`, utilisable au clavier ; le
  bouton « Importer mon export » ouvre le même sélecteur.
- Tableaux avec `<caption>` et en-têtes `scope`, messages d'état dans des zones `aria-live`.
- Vérifié à 375, 800 et 1 280 px de large, sans défilement horizontal de la page.
