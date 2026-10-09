# Journal des modifications

Les changements notables, du plus récent au plus ancien. Chaque entrée renvoie à sa pull request.

## 9 octobre 2026

### Phase 3 (deuxième partie) : aperçu, doublons, transferts, diagnostic

- Aperçu avant import : période, opérations à importer, déjà présentes, lignes ignorées ou
  écartées ; rien n'entre dans le calcul sans « Importer ».
- Doublons : même identifiant ignoré ; doublon probable (même opération, autre identifiant)
  écarté par défaut, à confirmer par l'utilisateur.
- Rapprochement des transferts entre plateformes ; envois et réceptions sans contrepartie
  signalés.
- Diagnostic des données (complet, à vérifier, incomplet) ; résultat déclaré « provisoire » tant
  qu'il manque des achats.

### Phase 3 (première partie) : nouvelles plateformes

- Imports Kraken (grand livre), Crypto.com (application) et Bitvavo, marqués « expérimental » :
  écrits d'après la documentation des plateformes et des exemples publics, à confirmer sur un
  export réel. Marge, dérivés, conversions de poussières, transferts entre utilisateurs : à
  vérifier, jamais calculés d'office.
- Registre des importeurs : détection, liste des plateformes et instructions d'export viennent
  d'une seule table ; guide « Ajouter une plateforme » dans `docs/imports.md`.
- Heures locales converties selon le fuseau indiqué dans le fichier (Bitvavo), heure d'été
  comprise.

### Phase 2 : règles fiscales versionnées par année

- Taux par année de revenus : 30 % jusqu'en 2024, 31,4 % depuis 2025 (CSG à 10,6 %, LFSS 2026) ;
  option pour le barème (3CN) depuis 2023 ; barèmes 2023, 2024 et 2025. Aucune estimation pour
  une année sans règles connues (avant 2019, après 2026).
- Impôt estimé de l'année dans le résultat ; comparaison des régimes, simulateur et étapes
  adaptés à l'année ; avertissements pour un historique antérieur à 2019.

### Phase 1 : stabilisation

- Import ligne par ligne : une ligne illisible est écartée et signalée, les autres sont
  importées. Symboles de crypto validés (les formules de tableur sont refusées). Encodages UTF-16
  et Windows-1252 acceptés. Classeurs Excel, archives, PDF et fichiers de plus de 50 Mo refusés
  avec une explication.
- En-têtes de sécurité HTTP sur toutes les réponses ; message d'erreur générique pour l'API de
  cours.
- Tests de bout en bout (Playwright) sur Chromium, Firefox et WebKit, ordinateur et mobile, avec
  vérification d'accessibilité (axe-core).
- Tableaux qui défilent atteignables au clavier.
- `SECURITY.md`, `TESTING.md` et ce journal.

### Avant

- Audit initial et feuille de route ([#18](https://github.com/maxence-svensson/crypto-plusvalue/pull/18)).
- « Et maintenant ? » : étapes après le calcul et date limite ([#17](https://github.com/maxence-svensson/crypto-plusvalue/pull/17)).
- Dossier justificatif PDF ([#16](https://github.com/maxence-svensson/crypto-plusvalue/pull/16)).
- Design « verre » inspiré d'iOS et mode sombre ([#14](https://github.com/maxence-svensson/crypto-plusvalue/pull/14), [#15](https://github.com/maxence-svensson/crypto-plusvalue/pull/15)).
- Prélèvement forfaitaire ou barème ([#13](https://github.com/maxence-svensson/crypto-plusvalue/pull/13)).

## 8 octobre 2026

- Simulateur de vente et curseur de quantité ([#10](https://github.com/maxence-svensson/crypto-plusvalue/pull/10), [#11](https://github.com/maxence-svensson/crypto-plusvalue/pull/11)).
- Formulaire 2086 officiel rempli ([#9](https://github.com/maxence-svensson/crypto-plusvalue/pull/9)).
- Interface d'import, de vérification et de résultat ([#7](https://github.com/maxence-svensson/crypto-plusvalue/pull/7), [#8](https://github.com/maxence-svensson/crypto-plusvalue/pull/8)).
- Serveur de cours historiques ([#6](https://github.com/maxence-svensson/crypto-plusvalue/pull/6)).
- Imports Trade Republic et Coinbase ([#3](https://github.com/maxence-svensson/crypto-plusvalue/pull/3), [#4](https://github.com/maxence-svensson/crypto-plusvalue/pull/4), [#5](https://github.com/maxence-svensson/crypto-plusvalue/pull/5)).
- Moteur du formulaire 2086 et reconstitution du portefeuille ([#1](https://github.com/maxence-svensson/crypto-plusvalue/pull/1), [#2](https://github.com/maxence-svensson/crypto-plusvalue/pull/2)).
