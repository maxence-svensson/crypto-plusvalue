# Design

Une **fintech sobre et claire** : l'outil doit inspirer confiance et se lire comme un document,
pas comme une application de trading. Il ne doit pas non plus ressembler au site des impôts :
pas de police Marianne ni de charte de l'État, et la mention « outil indépendant » en pied de
page.

## Principes

- **Un parcours en trois étapes numérotées** : importer, vérifier, déclarer. Chaque étape
  n'apparaît que lorsque la précédente a des données.
- **Le résultat ressemble au formulaire** : une colonne par cession, les numéros de ligne du 2086
  en face de chaque montant, pour recopier sans se tromper.
- **Montrer les sources** : chaque cours affiché indique d'où il vient ; les lignes ignorées et
  celles à vérifier sont listées, jamais cachées.
- **Pas d'icônes décoratives, pas d'ombres, pas de dégradés** : des filets fins et des fonds
  blancs sur un fond blanc cassé.

## Couleurs

| Rôle                     | Couleur   | Contraste minimal           |
| ------------------------ | --------- | --------------------------- |
| Texte                    | `#16181d` | 16,4:1                      |
| Texte secondaire         | `#595e66` | 5,7:1 (sur le vert pâle)    |
| Accent, liens et boutons | `#0b5d4b` | 6,8:1                       |
| Plus-value               | `#0b6b3a` | 6,6:1                       |
| Moins-value, erreurs     | `#b42318` | 6,6:1                       |
| Avertissements           | `#8a4b00` | 6,2:1 (sur son fond orangé) |

Chaque paire texte / fond dépasse 5,5:1 (WCAG AA demande 4,5:1). Le vert et le rouge ne portent
jamais seuls l'information : les montants gardent leur signe (+336,87 €, −5,52 €).

## Typographie

- **IBM Plex Sans** pour le texte, **IBM Plex Mono** à chiffres tabulaires pour les montants,
  quantités et dates : les colonnes de chiffres s'alignent.
- Format français partout : `1 799,20 €`, dates à l'heure de Paris.

## Accessibilité

- Lien d'évitement vers le contenu, focus visible sur tout élément interactif.
- La zone de dépôt est un `<label>` autour d'un `<input type="file">` : utilisable au clavier.
- Tableaux avec `<caption>` et en-têtes `scope`, messages d'état dans des zones `aria-live`.
- Vérifié de 375 px à 1 440 px de large ; le tableau du 2086 défile horizontalement en gardant
  les intitulés des lignes visibles.
