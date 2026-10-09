# Dossier justificatif

En cas de contrôle, l'administration peut demander comment les montants du formulaire 2086 ont
été obtenus. Le site produit un **dossier justificatif** en PDF qui permet de refaire chaque
calcul à la main. Il est généré dans le navigateur (pdf-lib, chargé au clic) : rien n'est envoyé
à un serveur.

## Contenu

| Partie                   | Contenu                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| Synthèse                 | case 3AN ou 3BN, lignes 224 et 51, nombre de cessions, seuil de 305 €        |
| Fichiers importés        | nom, plateforme, opérations crypto lues, lignes ignorées                     |
| Méthode                  | formule, choix retenus (frais d'achat, récompenses), sources des cours       |
| Une section par cession  | valeur du portefeuille actif par actif (ligne 212), lignes 211 à 223, calcul |
| Prix total d'acquisition | les acquisitions et leur cumul (ligne 220)                                   |
| Cessions antérieures     | les fractions de capital des années précédentes (ligne 221), s'il y en a     |
| Cours utilisés           | actif, minute (heure de Paris), cours en euros, source                       |
| Historique               | toutes les opérations importées jusqu'au 31 décembre, dans l'ordre           |

## Exactitude

- Le dossier reprend le calcul de l'écran et du 2086 : la valeur globale du portefeuille vient de
  la même fonction (`shared/portfolio/valuation.ts`). Les tests vérifient que ses totaux
  retombent sur les lignes 212, 220 et 221.
- Montants au centime, quantités exactes, cours arrondis à l'affichage (au centime au-delà d'un
  euro, à six décimales en dessous). Le calcul, lui, n'arrondit rien.
- Heures de Paris, comme l'année d'imposition.

## Mise en page

- `shared/dossier/dossier.ts` rassemble les données (testé avec Vitest), `shared/dossier/pdf.ts`
  les met en page : A4, tableaux dont l'en-tête se répète à chaque page, pied de page numéroté.
- Polices standard du PDF (Helvetica, encodage WinAnsi) : rien à télécharger. Leurs chasses sont
  déclarées dans le fichier, sinon chaque lecteur applique les siennes ; Aperçu, sur macOS,
  décalait le texte et le signe € mordait sur le caractère suivant.
- Les caractères absents de WinAnsi (rares dans les libellés des plateformes) sont remplacés par
  « ? ».
