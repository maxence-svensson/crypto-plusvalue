# CryptoPlusValue

Calcul des plus-values sur cryptomonnaies pour la déclaration d'impôts française (**formulaire 2086**).
Importez l'historique de vos plateformes, obtenez les montants à reporter, cession par cession.

> Projet en cours de construction. CryptoPlusValue est un outil indépendant, sans lien avec
> l'administration fiscale : ses résultats sont indicatifs et ne remplacent pas un conseil fiscal.

## Principes

- **Vos transactions restent dans votre navigateur.** Le serveur ne sert qu'à obtenir des prix
  historiques : il ne reçoit jamais vos montants.
- **Le calcul officiel, ligne par ligne**, tel que le formulaire 2086 le présente, testé sur les
  exemples chiffrés de la doctrine fiscale (BOFiP). Les règles et leurs sources sont détaillées
  dans [`docs/regles-fiscales.md`](docs/regles-fiscales.md).
- **Imports prévus** : Coinbase et Trade Republic.

## Stack

| Domaine   | Outils                                                       |
| --------- | ------------------------------------------------------------ |
| Framework | Nuxt 4, Vue 3, TypeScript strict, Pinia                      |
| Interface | Tailwind CSS 4, IBM Plex Sans et Mono                        |
| Calcul    | decimal.js (décimal exact, aucun nombre à virgule flottante) |
| Qualité   | Vitest, ESLint, Prettier, GitHub Actions                     |

## Lancer le projet

Prérequis : Node.js 24.

```bash
npm install
npm run dev
```

| Commande            | Rôle                     |
| ------------------- | ------------------------ |
| `npm run dev`       | serveur de développement |
| `npm test`          | tests unitaires (Vitest) |
| `npm run lint`      | ESLint                   |
| `npm run typecheck` | vérification des types   |
| `npm run format`    | mise en forme (Prettier) |
| `npm run build`     | build de production      |
