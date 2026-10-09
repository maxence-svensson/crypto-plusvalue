# Rapports pour un comptable ou un tableur

Sur la page Fiscalité, pour l'année affichée, trois fichiers produits dans le navigateur (rien
n'est envoyé) :

| Fichier                      | Contenu                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Classeur Excel** (`.xlsx`) | quatre feuilles : résumé, cessions de l'année, opérations jusqu'à la fin de l'année, points à vérifier        |
| **Cessions** (CSV)           | une ligne par cession imposable, avec les lignes 212 à 223 du 2086 et la plus ou moins-value                  |
| **Points à vérifier** (CSV)  | le diagnostic d'ensemble, chaque opération concernée, les lignes de fichiers écartées ou non prises en charge |

## Résumé

L'année, la date du rapport, le nombre de cessions, la somme des prix de cession (lignes 218), la
plus ou moins-value nette (ligne 224), l'exonération éventuelle (cessions de 305 € au plus), les
cases 3AN et 3BN en euros entiers, l'impôt estimé au prélèvement forfaitaire et ses taux, la
qualité des données et les sources. Une dernière ligne rappelle que les montants sont indicatifs.

## Arrondis

Le calcul n'arrondit rien en route ([`regles-fiscales.md`](regles-fiscales.md)). Les montants
calculés des rapports (lignes du 2086, plus-values) sont arrondis au centime ; les montants
importés (prix payés, frais) et les quantités sont repris tels quels.

## Formats

- **CSV** : point-virgule, virgule décimale, UTF-8 avec marque d'ordre des octets, pour qu'Excel
  et LibreOffice l'ouvrent sans réglage. Un texte qui commence par `=`, `+`, `-` ou `@` est
  précédé d'une apostrophe : aucun tableur ne l'exécute comme une formule.
- **XLSX** : écrit sans dépendance (`shared/reports/xlsx.ts`, archive ZIP sans compression) ;
  montants au format `# ##0,00 €`, dates à l'heure de Paris, première ligne figée. Le texte est
  toujours stocké comme du texte, jamais comme une formule. Vérifié avec openpyxl.
