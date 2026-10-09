# Sécurité et confidentialité

## Données de l'utilisateur

- Les fichiers importés sont lus **dans le navigateur**. Ils ne sont envoyés à aucun serveur et
  ne sont pas conservés après la fermeture de la page.
- Le seul échange réseau lié aux calculs est la demande de cours (`GET /api/price`) : un symbole
  et une minute, jamais une quantité, un montant ou un nom de fichier ([`docs/prix.md`](docs/prix.md)).
- Les PDF (formulaire 2086, dossier justificatif) sont produits dans le navigateur.
- Aucun outil d'analyse d'audience, aucun traceur, aucun compte.
- **Conservation dans le navigateur**, activée par défaut et désactivable dans les paramètres :
  opérations, cours et noms des fichiers importés sont enregistrés dans IndexedDB, sur l'appareil
  seulement, pour les retrouver à la visite suivante. Couper l'option efface ce qui était
  enregistré ; « Tout effacer » supprime données et préférences après confirmation. Les données
  fictives de la démonstration ne sont jamais enregistrées.
- **Sauvegarde chiffrée** (Paramètres) : un fichier téléchargé, chiffré dans le navigateur avec
  WebCrypto. La clé est dérivée du mot de passe par PBKDF2-HMAC-SHA256 (600 000 itérations, sel
  aléatoire de 16 octets) ; les données sont chiffrées et authentifiées par AES-GCM 256 bits (IV
  aléatoire de 12 octets). Le mot de passe (12 caractères au moins) n'est ni enregistré ni envoyé :
  perdu, la sauvegarde est illisible. Un fichier modifié est refusé. À la restauration, chaque
  opération, cours, fichier et correction est vérifié avant de remplacer quoi que ce soit
  (`shared/persistence/backup.ts`).
- **Préférences** (`localStorage`) : thème, étapes cochées de « Et maintenant ? », choix de
  conservation. Aucun montant ni transaction.

## En-têtes HTTP

Posés sur toutes les réponses par `routeRules` (`nuxt.config.ts`) :

| En-tête                    | Valeur                                                                           |
| -------------------------- | -------------------------------------------------------------------------------- |
| Content-Security-Policy    | `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'` |
| X-Frame-Options            | `DENY`                                                                           |
| X-Content-Type-Options     | `nosniff`                                                                        |
| Referrer-Policy            | `strict-origin-when-cross-origin`                                                |
| Permissions-Policy         | caméra, micro, géolocalisation, paiement et USB désactivés                       |
| Cross-Origin-Opener-Policy | `same-origin`                                                                    |
| Strict-Transport-Security  | posé par Vercel (2 ans, `preload`)                                               |

La CSP ne restreint pas encore `script-src` : Nuxt intègre des scripts dans la page, ce qui demande
des nonces. C'est prévu (phase 6 de [`docs/avancement.md`](docs/avancement.md)).

## Entrées

- **Fichiers** : 50 Mo au plus ; classeurs Excel, archives et PDF refusés avant lecture ; lignes
  illisibles écartées une à une ; symboles limités aux lettres majuscules et aux chiffres, ce qui
  exclut les formules de tableur.
- **API de cours** : paramètres validés (zod, symbole `^[A-Z0-9]{1,15}$`, date ISO 8601) ; une
  erreur de validation renvoie un message générique, sans détail technique ; délai maximal de 5 s
  vers les sources ; aucune clé ni secret.
- **Affichage** : Vue échappe tout le texte affiché ; aucun `v-html`.
- **Export CSV** : un libellé qui commence par `=`, `+`, `-` ou `@` est précédé d'une
  apostrophe, pour qu'aucun tableur ne l'exécute comme une formule.

## Dépendances

`npm audit` signale 15 vulnérabilités (8 critiques, 7 élevées) au 9 octobre 2026. Toutes
concernent les outils de développement ou de build, absents du code déployé :

| Paquet             | Utilisé par   | Pourquoi sans risque en production           |
| ------------------ | ------------- | -------------------------------------------- |
| simple-git         | Nuxt DevTools | outil du serveur de développement            |
| node-forge         | listhen       | certificat local du serveur de développement |
| braces, micromatch | globby        | recherche de fichiers pendant le build       |

Les versions les plus récentes de ces paquets sont encore concernées : aucune correction n'est
disponible. À revérifier à chaque mise à jour de Nuxt.

## Signaler une faille

Par un [avis de sécurité privé](https://github.com/maxence-svensson/crypto-plusvalue/security/advisories/new)
sur GitHub, plutôt qu'un ticket public.
