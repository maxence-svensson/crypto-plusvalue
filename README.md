# CryptoPlusValue

Calcul des plus-values sur cryptomonnaies pour la déclaration d'impôts française (**formulaire 2086**).
Importez l'historique de vos plateformes, obtenez les montants à reporter, cession par cession.

**Démo :** https://crypto-plusvalue.vercel.app, ou directement
[le résultat de l'exemple fictif](https://crypto-plusvalue.vercel.app/?exemple).

![Accueil : la case 3AN de l'exemple, remplie au surligneur](docs/captures/accueil.jpg)

> CryptoPlusValue est un outil indépendant, sans lien avec l'administration fiscale : ses
> résultats sont indicatifs et ne remplacent pas un conseil fiscal.

## Fonctionnalités

- **Import des historiques** Trade Republic et Coinbase, reconnus automatiquement : seules les
  opérations crypto sont lues, le reste (espèces, actions, fonds) est ignoré.
- **Reconstitution du portefeuille** à chaque vente, avec une alerte quand l'historique est
  incomplet (achats faits sur une autre plateforme).
- **Cours historiques à la minute** pour la valeur globale du portefeuille, avec leur source
  ([`docs/prix.md`](docs/prix.md)), et saisie manuelle quand aucune source ne connaît l'actif.
- **Le formulaire 2086 officiel, rempli, en PDF** : toutes les cases calculées, généré dans le
  navigateur ([`docs/formulaire-2086.md`](docs/formulaire-2086.md)), avec les cases 3AN / 3BN de
  la 2042 C et le seuil de 305 €.
- **Prélèvement forfaitaire ou barème** : la comparaison des deux selon votre tranche
  d'imposition (ou votre revenu et vos parts), et s'il faut cocher la case 3CN.
- **« Et si je vendais aujourd'hui ? »** : la plus-value et l'impôt d'une vente aux cours du
  moment, compte tenu des ventes déjà faites dans l'année et du seuil de 305 €. Fonctionne aussi
  sans fichier, à partir de trois montants.
- **Un exemple fictif** pour essayer sans fichier.

![Le résultat : case 3AN, lignes 224 et 51, puis le formulaire 2086 colonne par colonne](docs/captures/resultat.jpg)

![Le formulaire 2086 officiel, rempli par le site avec l'exemple fictif](docs/captures/formulaire-2086.jpg)

![Le simulateur : part de BTC à vendre au curseur, plus-value et impôt estimés](docs/captures/simulateur.jpg)

<p align="center">
  <img src="docs/captures/mobile.jpg" alt="L'accueil sur mobile" width="320">
</p>

## Principes

- **Vos transactions restent dans votre navigateur.** Le serveur ne sert qu'à obtenir des cours
  historiques : il reçoit un symbole et une minute, jamais vos montants.
- **Le calcul officiel, ligne par ligne**, testé sur les exemples chiffrés de la doctrine
  fiscale (BOFiP). Les règles et leurs sources sont détaillées dans
  [`docs/regles-fiscales.md`](docs/regles-fiscales.md).
- **Imports vérifiés sur de vrais fichiers** : Trade Republic sur deux exports réels, Coinbase sur
  des exemples publics. Formats et limites dans [`docs/imports.md`](docs/imports.md).
- **Un design tiré du formulaire lui-même** : cases en peigne, champs bleutés et surligneur ; choix et contrastes dans [`docs/design.md`](docs/design.md).

## Stack

| Domaine     | Outils                                                       |
| ----------- | ------------------------------------------------------------ |
| Framework   | Nuxt 4, Vue 3, TypeScript strict, Pinia                      |
| Interface   | Tailwind CSS 4, Archivo variable (hébergée par le site)      |
| Calcul      | decimal.js (décimal exact, aucun nombre à virgule flottante) |
| PDF         | pdf-lib, chargé seulement au téléchargement du formulaire    |
| Serveur     | Routes Nitro : cours Binance et Coinbase Exchange, cache CDN |
| Hébergement | Vercel (région de Francfort)                                 |
| Qualité     | Vitest, ESLint, Prettier, GitHub Actions                     |

## Lancer le projet

Prérequis : Node.js 24.

```bash
npm install
npm run dev
```

| Commande            | Rôle                       |
| ------------------- | -------------------------- |
| `npm run dev`       | serveur de développement   |
| `npm test`          | tests unitaires (Vitest)   |
| `npm run lint`      | ESLint                     |
| `npm run typecheck` | vérification des types     |
| `npm run format`    | mise en forme (Prettier)   |
| `npm run build`     | build de production        |
| `npm run captures`  | captures d'écran du README |
