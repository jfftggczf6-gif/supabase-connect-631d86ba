

## Analyse de la suggestion Claude Code

L'analyse est **pertinente et bien ciblée**. Voici mon évaluation point par point :

### Fix 1 — Borner le ratio OPEX scaling (normalizers.ts L725-739) : **Bon diagnostic, bonne solution**

Le problème est réel : quand le Framework hallucine un EBITDA très négatif, `targetOpex = GP - EBITDA` explose (ex: 24.8M - (-16.5M) = 41.3M), et le ratio 3.3x déforme toutes les charges. La solution de borner le ratio à [0.4, 2.5] et inverser la cascade (dériver EBITDA depuis l'OPEX réel) est correcte et cohérente avec notre principe "les données réelles priment sur l'IA".

**Modification** : Remplacer lignes 725-739 dans `normalizers.ts` par le code proposé avec bounds [0.4, 2.5] et cascade inversée (EBITDA = GP - OPEX réel, net_profit plafonné, cashflow recalculé).

### Fix 2 — Guards frontend DSCR/Multiple EBITDA (PlanOvoViewer.tsx) : **Nécessaire**

Actuellement (ligne 190-191), `dscr` et `multiple_ebitda` passent les valeurs AI sans vérifier si l'EBITDA est négatif. Ajouter un guard : si year2 EBITDA ≤ 0, forcer ces deux métriques à `null` (affichage "—" gris).

**Modification** : Dans le `useMemo` (lignes 181-194), ajouter :
- `dscr: ebitdaSeries[3] <= 0 ? null : (ai?.dscr ?? ...)`  
- `multiple_ebitda: ebitdaSeries[3] <= 0 ? null : (ai?.multiple_ebitda ?? null)`

### Fix 3 — Seuil ROI (PlanOvoViewer.tsx L201) : **Correct**

`v > 50 ? 'good' : v > 20 ? 'warning' : 'bad'` est trop agressif. Avec un coût du capital à 12%, un ROI de 15% devrait être "warning", pas "bad".

**Modification** : Ligne 201, changer en `v > 30 ? 'good' : v > 10 ? 'warning' : 'bad'`.

### Fix 4 — multipleEbitdaStatus (PlanOvoViewer.tsx) : **Correct**

Actuellement il n'y a pas de fonction de seuil spécifique pour le multiple EBITDA. Ajouter :
```
const multipleEbitdaStatus = (v: number | null) => v == null ? 'neutral' : v >= 5 ? 'good' : v >= 3 ? 'warning' : 'bad';
```

---

### Résumé des modifications

| Fichier | Changement |
|---------|-----------|
| `normalizers.ts` L725-739 | Borner ratio OPEX [0.4, 2.5], cascade inversée si hors limites |
| `PlanOvoViewer.tsx` L186-191 | Guard DSCR/multiple_ebitda null si EBITDA year2 ≤ 0 |
| `PlanOvoViewer.tsx` L201 | ROI seuils : 30%/10% au lieu de 50%/20% |
| `PlanOvoViewer.tsx` après L203 | Ajouter `multipleEbitdaStatus` et l'utiliser dans le rendu |

Les 4 fixes sont tous valides et complémentaires : Fix 1 corrige la source (backend), Fixes 2-4 ajoutent des gardes défensives (frontend).

