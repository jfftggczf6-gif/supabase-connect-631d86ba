

# Corrections Audit #4 — Points 1, 2, 6 et 7 uniquement

Points exclus : 3 (mapping BP 5 ans), 4 (renommage OPUS_MODEL dans generate-business-plan), 5 (renommage dans generate-framework).

---

## 1. CRITIQUE — Fix destructuring `tauxIS` (`normalizers.ts` L522)

`getFiscalParams()` retourne `{ is: 25, ... }` mais le code fait `const { tauxIS } = ...` ce qui donne `undefined` → tous les cashflows dérivés sont `NaN`.

**Correction** : `const { is: tauxIS } = getFiscalParams(country || "Côte d'Ivoire");`

---

## 2. HAUTE — `normalizeSic` : ajouter `score_global` (`normalizers.ts` L83)

Après `d.score = toNumber(...)`, ajouter `d.score_global = d.score;` pour cohérence avec le reste du système.

---

## 6. MOYENNE — `normalizeOdd` : calculer un score (`normalizers.ts` L350-378)

Calculer `score` à partir de `resume_par_odd` : moyenne des `score` de chaque ODD. Ajouter `score` et `score_global` dans l'objet retourné.

---

## 7. FAIBLE — `richTypes` : améliorer détection ODD et plan_ovo (`generate-deliverables/index.ts` L63-69)

Ajouter des conditions spécifiques :
- `odd_analysis` : matcher sur `evaluation_cibles_odd` ou `synthese`
- `plan_ovo` : matcher sur `scenarios` uniquement (pas `resume_executif` qui appartient au BP)

---

**Fichiers modifiés** : `normalizers.ts`, `generate-deliverables/index.ts`

