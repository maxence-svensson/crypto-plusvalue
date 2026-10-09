# Journal des modifications

Les changements notables, du plus récent au plus ancien. Chaque entrée renvoie à sa pull request.

## 9 octobre 2026

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
