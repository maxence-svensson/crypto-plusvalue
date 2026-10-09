# Tests

| Commande                            | Rôle                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `npm test`                          | tests unitaires et d'intégration (Vitest) : moteur fiscal, imports, cours, PDF |
| `npm run build && npm run test:e2e` | tests de bout en bout (Playwright) sur le build de production                  |

La CI (`.github/workflows/ci.yml`) lance, à chaque pull request : mise en forme, lint, types,
Vitest, build, puis Playwright sur Chromium, Firefox et WebKit, en version ordinateur et mobile.

## Principes

- **Valeurs attendues indépendantes** : les montants attendus viennent des exemples chiffrés du
  BOFiP et de la notice du 2086, ou d'un calcul fait à part (script Python pour les tests de bout
  en bout, voir [`e2e/README.md`](e2e/README.md)), jamais du moteur testé.
- **Aucune API réelle dans les tests** : les tests de bout en bout simulent l'API de cours
  (`e2e/fixtures.ts`) ; les tests du serveur de cours simulent les réponses des sources.
- **Accessibilité** : axe-core vérifie les règles WCAG 2.2 A et AA automatisables sur l'accueil et
  sur le résultat.

## Couverture des tests de bout en bout

| Fichier                   | Parcours                                                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accueil.spec.ts`         | accroche, absence de défilement horizontal de 320 à 1 440 px, menu mobile au clavier, accessibilité                                                                                          |
| `exemple.spec.ts`         | montants de l'exemple, comparaison des régimes, téléchargement du 2086, du dossier et des rapports, étapes retenues après rechargement, accessibilité                                        |
| `import.spec.ts`          | import d'un export, fichier au mauvais format, PDF, ligne illisible écartée                                                                                                                  |
| `simulateur.spec.ts`      | simulation sans fichier, curseur de quantité                                                                                                                                                 |
| `tableau-de-bord.spec.ts` | graphiques d'une seule année, plusieurs années et plateformes, période au choix, infobulles au clavier, vue tableau, accessibilité                                                           |
| `parametres.spec.ts`      | données relues après rechargement, sortie de la démonstration, thème retenu, « Tout effacer », conservation coupée                                                                           |
| `sauvegarde.spec.ts`      | sauvegarde chiffrée téléchargée, contenu illisible, mauvais mot de passe refusé, restauration après « Tout effacer », fichier étranger refusé                                                |
| `transactions.spec.ts`    | recherche, filtres et tri, ajout avec erreurs signalées, modification depuis la fiche, suppression multiple, annulation, export CSV, persistance des corrections, accessibilité des fenêtres |

En local, Playwright utilise Microsoft Edge installé sur la machine (projets `chromium` et
`mobile-chromium`) ; Firefox et WebKit ne tournent qu'en CI.
