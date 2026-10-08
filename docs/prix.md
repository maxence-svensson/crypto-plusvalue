# Cours historiques

Pour chaque cession, le formulaire 2086 demande la valeur globale du portefeuille : il faut le
cours en euros de chaque crypto détenue, à la minute de la cession. Le serveur de l'application
fournit ces cours (`GET /api/price`). C'est la seule chose qu'il fait.

```
GET /api/price?asset=SOL&at=2026-09-27T05:59:25Z

{
  "asset": "SOL",
  "minute": "2026-09-27T05:59:00.000Z",
  "priceEur": "106.353934922",
  "source": "Binance SOL/EUR"
}
```

**Confidentialité :** le serveur ne reçoit qu'un symbole et une minute, jamais les quantités, les
montants ni le fichier importé.

## Sources, dans l'ordre

1. **Binance, paire en euros** (`SOLEUR`), bougie d'une minute, si des échanges ont eu lieu
   pendant cette minute. Une paire en euros peu échangée peut afficher un cours périmé : elle
   est alors ignorée.
2. **Binance, paire en USDT** (`RENDERUSDT`), convertie en euros avec la paire `EURUSDT` de la
   même minute (disponible depuis janvier 2020).
3. **Coinbase Exchange, paire en euros** (`NEAR-EUR`) : dernier cours des dix minutes
   précédentes, Coinbase ne publiant que les minutes où il y a eu des échanges.

Le cours d'une bougie est son **prix moyen pondéré par les volumes** (montant échangé divisé par
la quantité échangée), plus représentatif que le cours de clôture. La doctrine fiscale admet les
cotations publiées par les plateformes ([BOFiP BOI-RPPM-PVBMC-30-20][b20], §150). La réponse
indique toujours la source, pour que l'utilisateur puisse justifier le chiffre.

Ces API publiques ne demandent aucune clé. CoinGecko, limité aux 365 derniers jours, et
CryptoCompare, dont l'offre gratuite a disparu en mai 2026, ne sont pas utilisés.

## Cache

Un cours passé ne change plus : une réponse réussie porte
`Cache-Control: public, s-maxage=31536000, immutable` et le CDN de Vercel la garde un an. Les
erreurs ne sont pas mises en cache. La minute en cours est refusée tant que sa bougie n'est pas
close.

## Erreurs

| Statut | Cas                                                  |
| ------ | ---------------------------------------------------- |
| 400    | symbole mal formé, date invalide ou trop récente     |
| 404    | aucune source ne connaît l'actif à cette minute      |
| 502    | une source répond en erreur (panne, limite de débit) |

Quand aucun cours n'est trouvé, l'utilisateur pourra le saisir lui-même.

[b20]: https://bofip.impots.gouv.fr/bofip/11968-PGP.html
