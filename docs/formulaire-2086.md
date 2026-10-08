# Formulaire 2086 rempli

L'application remplit le **formulaire officiel** 2086 (cerfa n° 16043*07, « déclaration des plus
ou moins-values réalisées en 2025 ») avec les montants calculés, et le propose en PDF. Tout se
passe dans le navigateur : le formulaire rempli n'est envoyé à aucun serveur.

## Le modèle

`public/cerfa/2086-revenus-2025.pdf` est le formulaire publié sur impots.gouv.fr, sans
modification :

- source : https://www.impots.gouv.fr/sites/default/files/formulaires/2086/2026/2086_5515.pdf
- empreinte SHA-256 : `0415b17f236fa6a896f1f0676a83dae6729b5d8d9db4e719bf55b720e70a8a91`

Ce PDF n'a pas de champs de saisie. Les montants sont donc écrits aux coordonnées des cases
(`shared/cerfa/form2086.ts`), relevées sur les traits du formulaire puis vérifiées en
superposant un formulaire rempli à l'original.

## Ce qui est rempli

| Lignes      | Contenu                                                      |
| ----------- | ------------------------------------------------------------ |
| 211 à 218   | date, valeur globale du portefeuille, prix, frais, soultes   |
| 220 à 223   | prix total d'acquisition, fractions de capital, soultes, net |
| sans numéro | plus ou moins-value de chaque cession, précédée de son signe |
| 224         | total du déclarant 1                                         |
| 51 et 52    | totaux du foyer ; la ligne 52 se reporte en case 3AN ou 3BN  |

- **Euros entiers** sur chaque ligne, comme sur la déclaration en ligne ; l'écran garde le détail
  au centime.
- **Cessions exonérées** (ligne 51 ≤ 305 €) : seuls la date, les prix, les frais et la ligne 51
  sont remplis, comme le prévoit la notice.
- **Plus de 5 cessions** : les deux premières pages sont dupliquées en feuillets supplémentaires,
  cinq cessions chacun.

Restent à compléter par l'utilisateur : nom, prénoms et adresse, et les cadres du déclarant 2,
des personnes à charge et des personnes interposées.

## Années

Seul le formulaire des revenus 2025 est proposé. Pour les cessions de 2026, le formulaire n'est
pas encore publié (il le sera au printemps 2027) : l'application affiche les montants à
recopier.
