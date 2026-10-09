# Tests de bout en bout

```bash
npm run build
npm run test:e2e
```

Les cours sont simulés (`fixtures.ts`) : BTC à 100 000 €, SOL à 150 €, ETH à 3 000 €, quelle que
soit la minute. Avec l'exemple fictif (`public/exemples/trade-republic.csv`), les résultats
attendus ont été calculés à part, avec un script Python indépendant du moteur de l'application :

| Cession         | Ligne 212  | Ligne 223  | Plus-value |
| --------------- | ---------- | ---------- | ---------- |
| ETH, 14/08/2025 | 2 670,17 € | 2 102,00 € | +315,46 €  |
| BTC, 20/11/2025 | 1 096,93 € | 931,24 €   | +46,43 €   |

Ligne 224 : +361,88 € ; ligne 51 : 1 799,20 € ; case 3AN : 362 € ; impôt estimé au prélèvement
forfaitaire des revenus 2025 : 46,32 € + 67,31 € = 113,63 €. À la tranche de 11 % : prélèvement
forfaitaire 113,63 €, barème 107,12 €, écart 6,51 €.
