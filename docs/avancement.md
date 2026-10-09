# Avancement : audit, feuille de route et matrice de validation

Ce fichier suit la transformation de CryptoPlusValue en plateforme complète de préparation de la
fiscalité crypto. Il est mis à jour à chaque phase, pour pouvoir reprendre le travail à tout
moment. Dernière mise à jour : 9 octobre 2026, après la phase 2.

## 1. Diagnostic initial (9 octobre 2026)

Stack conservée : Nuxt 4, Vue 3, TypeScript strict, Pinia, Tailwind 4, decimal.js, pdf-lib,
Vitest, Vercel (Francfort). Le brief mentionne Next.js ; il demande aussi de garder la stack en
place sauf raison solide, et il n'y en a pas.

### Fonctionnel et testé

- Moteur du formulaire 2086 (article 150 VH bis) : lignes 211 à 224, soultes, dons, seuil de
  305 €, aucun arrondi intermédiaire ; testé sur les exemples chiffrés du BOFiP.
- Imports Trade Republic (validé sur deux exports réels) et Coinbase (exemples publics).
- Cours historiques à la minute (Binance en euros, Binance en USDT converti, Coinbase Exchange),
  mis en cache par le CDN.
- Formulaire 2086 officiel rempli (revenus 2025), dossier justificatif PDF, comparaison
  prélèvement forfaitaire / barème, simulateur de vente, étapes « Et maintenant ? », exemple.
- Interface responsive, mode sombre automatique.
- Lighthouse en production : mobile 96 en performance et 100 en accessibilité, bonnes pratiques
  et SEO ; ordinateur 100 partout.

### Partiel ou défectueux

| Constat                                                                                                | Conséquence                                                                                     |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Une seule ligne invalide faisait échouer tout le fichier.                                              | Corrigé en phase 1 : les lignes illisibles sont écartées et listées.                            |
| Le symbole de l'actif n'était pas validé (« =CMD » accepté).                                           | Corrigé en phase 1 : lettres majuscules et chiffres seulement.                                  |
| Une quantité négative est passée en valeur absolue.                                                    | Conservé : les exports signent les quantités selon le sens de l'opération.                      |
| Doublons détectés seulement par identifiant exact.                                                     | Un même relevé exporté deux fois avec d'autres identifiants serait compté deux fois.            |
| Taux de 31,4 % et barème 2025 étaient appliqués à toutes les années.                                   | Corrigé en phase 2 : règles par année (shared/tax/rules.ts), rien d'estimé sans règles connues. |
| Une requête de cours par actif et par cession : 25 000 requêtes pour 5 000 cessions.                   | Calcul très lent sur les gros historiques.                                                      |
| Import et calcul sur le fil principal : 2 s de blocage pour 50 000 lignes.                             | Interface figée sur les gros fichiers.                                                          |
| Aucune persistance : un rechargement efface tout.                                                      | Il faut tout réimporter à chaque visite.                                                        |
| Pas de gestion des opérations (ajout, modification, suppression), pas de rapprochement des transferts. | Un historique incomplet bloque l'utilisateur.                                                   |

### Manquant par rapport au brief

Navigation multi-pages, tableau de bord et graphiques, portefeuille et performances, page des
transactions, page des plateformes, rapports CSV et Excel, sauvegarde locale et export chiffré,
paramètres (thème manuel), centre d'aide, glossaire et FAQ, pages de contenu pour le
référencement, sitemap, Open Graph, URL canonique, données structurées, PWA, tests de bout en
bout, autres plateformes, documentation d'architecture, de sécurité, de tests et de déploiement,
journal des versions.

### Sécurité

- `npm audit` : 15 vulnérabilités (8 critiques, 7 élevées), toutes dans les outils de
  développement ou de build (devtools, simple-git, listhen, node-forge, braces).
- En-têtes HTTP : HSTS présent ; pas de Content-Security-Policy, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy ni protection contre l'inclusion dans un cadre.
- API de cours : entrée validée (zod, symbole en lettres et chiffres), aucun secret, mais le
  message d'erreur de validation renvoie le détail technique de zod.
- Aucun secret ni clé côté client ; aucun outil d'analyse d'audience ; fichiers lus localement.

### Mesures de performance

| Lignes | Lecture du fichier | Cours requis | Calcul des cessions |
| ------ | ------------------ | ------------ | ------------------- |
| 5 000  | 265 ms             | 2 500        | 13 ms               |
| 20 000 | 800 ms             | 10 000       | 38 ms               |
| 50 000 | 1 962 ms           | 25 000       | 76 ms               |

Le calcul fiscal est rapide ; ce sont la lecture du fichier (fil principal) et la récupération des
cours (une requête par cours) qui limitent.

## 2. Feuille de route

Chaque phase est livrée par une ou plusieurs pull requests testées. Elles sont fusionnées quand la
CI est verte, puis vérifiées en production.

| Phase                      | Contenu                                                                                                                                                                                      | État             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1. Stabilisation           | Vulnérabilités, en-têtes de sécurité, import ligne par ligne avec anomalies, validation des symboles, tests de bout en bout (Playwright)                                                     | fait (9 octobre) |
| 2. Moteur fiscal versionné | Taux et barèmes par année vérifiés aux sources, option 3CN selon l'année, blocage des estimations sans règles connues                                                                        | fait (9 octobre) |
| 3. Imports                 | Registre d'importeurs, aperçu et confirmation, doublons multicritères, qualité des données, cours groupés, lecture dans un Web Worker, nouvelles plateformes validées sur formats documentés | à faire          |
| 4. Interface               | Navigation multi-pages, persistance IndexedDB, page des transactions (recherche, filtres, ajout, modification, suppression, annulation, journal), tableau de bord                            | à faire          |
| 5. Fonctions avancées      | Portefeuille et performances, scénarios comparés, rapports CSV et Excel, sauvegarde chiffrée, centre d'aide, glossaire, FAQ, pages de contenu, thème manuel, PWA                             | à faire          |
| 6. Sécurité et performance | CSP stricte, injection CSV, limites de taille, tests de charge, Lighthouse                                                                                                                   | à faire          |
| 7. Validation finale       | Tests multi-navigateurs et multi-résolutions, documentation, rapport final                                                                                                                   | à faire          |

### Ce qui ne sera pas promis

- Une plateforme n'est annoncée compatible qu'après validation sur un export réel. Celles validées
  seulement sur des formats publics sont marquées « expérimental ».
- DeFi, NFT, produits dérivés, minage et activité professionnelle relèvent d'autres régimes ou
  d'une analyse au cas par cas : ces opérations sont signalées, jamais calculées comme des
  cessions ordinaires.
- L'« assistant pédagogique » est un contenu rédigé et sourcé, pas un générateur de réponses.

## 3. Matrice de validation

Statuts : TERMINÉ ET TESTÉ, TERMINÉ MAIS NON TESTÉ, PARTIEL, BLOQUÉ, NON IMPLÉMENTÉ.

| Fonctionnalité           | Statut           | Tests unitaires        | Intégration | Bout en bout | Remarques                                                           |
| ------------------------ | ---------------- | ---------------------- | ----------- | ------------ | ------------------------------------------------------------------- |
| Moteur 2086 (150 VH bis) | TERMINÉ ET TESTÉ | oui                    | oui         | oui          | exemples BOFiP ; exemple vérifié par un calcul indépendant          |
| Import Trade Republic    | TERMINÉ ET TESTÉ | oui                    | oui         | oui          | deux exports réels ; lignes illisibles écartées                     |
| Import Coinbase          | TERMINÉ ET TESTÉ | oui                    | oui         | non          | exemples publics                                                    |
| Cours historiques        | TERMINÉ ET TESTÉ | oui                    | non         | non          | une requête par cours                                               |
| 2086 officiel rempli     | TERMINÉ ET TESTÉ | oui                    | non         | oui          | revenus 2025                                                        |
| Dossier justificatif     | TERMINÉ ET TESTÉ | oui                    | oui         | oui          |                                                                     |
| Comparaison PFU / barème | TERMINÉ ET TESTÉ | oui (2023 à 2026)      | non         | oui          | barème de l'année ; 2026 signalé comme emprunté à 2025              |
| Simulateur de vente      | TERMINÉ ET TESTÉ | oui (2024, 2026, 2027) | non         | oui          | taux de l'année de la vente                                         |
| « Et maintenant ? »      | TERMINÉ ET TESTÉ | oui (calendrier)       | non         | oui          |                                                                     |
| Persistance locale       | NON IMPLÉMENTÉ   |                        |             |              |                                                                     |
| Gestion des transactions | NON IMPLÉMENTÉ   |                        |             |              |                                                                     |
| Tableau de bord          | NON IMPLÉMENTÉ   |                        |             |              |                                                                     |
| Sauvegarde chiffrée      | NON IMPLÉMENTÉ   |                        |             |              |                                                                     |
| Rapports CSV et Excel    | NON IMPLÉMENTÉ   |                        |             |              |                                                                     |
| Tests de bout en bout    | TERMINÉ ET TESTÉ |                        |             | oui          | 5 projets en CI, axe-core ; en-têtes de sécurité vérifiés avec curl |
