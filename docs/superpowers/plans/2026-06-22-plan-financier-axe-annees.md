# Plan Financier — Axe des années (current_year pivot) — Plan A

> **Pour l'exécutant :** exécution inline (executing-plans), TDD, commits fréquents. Branche `feature/plan-financier-axe-annees`. Ne PAS déployer sur prod (Supabase/Railway) tant que l'utilisateur n'a pas dit « pousser sur main ».

**Goal :** Découpler l'« année courante » du dernier bilan. Le `current_year` devient un pivot (défaut = année calendaire, surchargeable et figé), pour que les plans (ex. Savoki : bilans 2022-2024, reprise 2026) affichent l'année courante réelle (2026), un prévisionnel à partir de 2027, et les années sans bilan en « à compléter ».

**Architecture :**
- Le moteur pur `computeFullPlan` reçoit `inputs.annee_courante` (optionnel). Absent → comportement ACTUEL (pivot = dernière année de bilan) → zéro régression + tests stables, pas de `new Date()` dans la fonction pure.
- L'edge function `generate-plan-financier` calcule le défaut `annee_courante = inputs.annee_courante ?? max(annéeCalendaire, dernierBilan)`, le **persiste** dans le livrable `inputs_data` (stable à la régénération), puis appelle `computeFullPlan`.
- L'UI expose un champ éditable « Année courante » qui écrit `inputs.annee_courante`.
- Le gabarit OVO reste à 2 colonnes d'historique (limite documentée) ; la vue 4 ans complète est dans l'« Excel données ».

**Périmètre fichiers :**
- `supabase/functions/_shared/financial-compute.ts` — pivot + timeline (cœur).
- `supabase/functions/generate-plan-financier/index.ts` — défaut + persistance `annee_courante`.
- `src/lib/planFinancierExcel.ts` — vue historique complète (2022-2025 + courante + prévisionnel).
- UI inputs editor (à localiser : composant d'édition des inputs financiers) — champ éditable.
- Tests : `src/test/financial-compute.test.ts`, `src/test/planFinancierExcel.test.ts`.

---

## Principe de la timeline (référence)

Soit `pivot = annee_courante`, `lastReal = hist.n.annee` (dernier bilan).

- **Cas normal `pivot === lastReal`** (défaut sans saisie quand calendaire ≈ dernier bilan, et tous les tests existants) : structure INCHANGÉE — `[lastReal-2, lastReal-1, lastReal(CURRENT, réel), +1..+5 (forecast)]`.
- **Cas décalé `pivot > lastReal`** (Savoki) :
  - Les bilans réels restent à leurs vraies années (2022, 2023, 2024) → `is_reel=true`.
  - Années entre `lastReal+1` et `pivot-1` (ex. 2025) → `is_reel=false`, marquées « à compléter » (valeurs nulles/incomplet).
  - `pivot` (2026) = CURRENT YEAR, `is_reel=false` (prévisionnel, pas d'actuals).
  - Prévisionnel `pivot+1..` (2027+).

Le mapping OVO (par LABEL : `YEAR-2`/`YEAR-1`/`CURRENT YEAR`/`YEAR2..6`) reçoit la fenêtre `[pivot-2, pivot-1, pivot, pivot+1..+5]`. Les bilans antérieurs à `pivot-2` (2022, 2023 pour Savoki) n'ont pas de colonne OVO (limite assumée) mais figurent dans l'Excel données.

---

## Task 1 : Pivot dans le moteur pur (détermination)

**Files :** `supabase/functions/_shared/financial-compute.ts` (≈1495, 1894, 2006), test `src/test/financial-compute.test.ts`.

- [ ] **Step 1 — Test (rouge) :** ajouter un test « pivot = annee_courante quand fourni ; sinon dernier bilan ». Plan avec `historique_3ans.n.annee=2024` et `annee_courante=2026` → `result.current_year === 2026`. Sans `annee_courante` → `result.current_year === 2024` (inchangé).
- [ ] **Step 2 — Vérifier l'échec.** `npx vitest run src/test/financial-compute.test.ts`.
- [ ] **Step 3 — Implémentation :** introduire `const pivotYear = safe((inputs as any).annee_courante) || baseYearEarly;` et l'utiliser pour `current_year` (ligne 2006) et le mapping `years` (1929-1932) → `current_year: pivotYear`, `year_minus_2: pivotYear-2`, … `year6: pivotYear+5`. NE PAS encore toucher la math des projections (Task 2).
- [ ] **Step 4 — Vert.** Tests passent (les tests existants sans `annee_courante` restent verts).
- [ ] **Step 5 — Commit.** `feat(engine): current_year pivot via inputs.annee_courante (fallback inchangé)`

## Task 2 : Timeline des projections (cas décalé)

**Files :** `financial-compute.ts` `computeProjections` (≈888-1040) et `computeProductProjections` (≈1216), test.

- [ ] **Step 1 — Test (rouge) :** Savoki-like, `annee_courante=2026`, bilans 2022/2023/2024. Attendu dans `result.projections` : entrées réelles aux annee_num 2022,2023,2024 (`is_reel=true`), une entrée 2025 « gap » (`is_reel=false`, ca/valeurs marquées incomplètes), entrée 2026 (`annee==='CURRENT YEAR'`, `annee_num===2026`, `is_reel=false`), prévisionnel 2027+.
- [ ] **Step 2 — Vérifier l'échec.**
- [ ] **Step 3 — Implémentation :** passer `pivotYear` à `computeProjections`. Si `pivotYear===baseYear` → branche actuelle inchangée. Sinon (décalé) : construire la fenêtre OVO `[pivot-2..pivot+5]` ; placer les données réelles des bilans dont l'année tombe dans la fenêtre ; années sans bilan = gap (valeurs 0 + flag) ; `CURRENT YEAR` = pivot (forecast à partir du dernier réel via les taux de croissance). Idem `computeProductProjections`. Exposer aussi `is_gap?: boolean` sur `Projection` pour l'affichage.
- [ ] **Step 4 — Vert** + relancer TOUS les tests `financial-compute` (non-régression cas normal).
- [ ] **Step 5 — Commit.** `feat(engine): timeline décalée quand année courante > dernier bilan (gap à compléter)`

## Task 3 : Défaut + persistance dans l'edge function

**Files :** `supabase/functions/generate-plan-financier/index.ts`.

- [ ] **Step 1 :** avant l'appel `computeFullPlan`, calculer `const lastReal = inputs.historique_3ans?.n?.annee; const annee_courante = inputs.annee_courante ?? Math.max(new Date().getFullYear(), lastReal || 0) || lastReal;` et l'injecter dans `inputs.annee_courante`.
- [ ] **Step 2 :** persister `annee_courante` dans le livrable `inputs_data` (upsert du champ) pour stabilité à la régénération.
- [ ] **Step 3 — Vérif manuelle (curl/local) :** non déployé prod. Note dans le plan : déploiement uniquement sur « pousser sur main ».
- [ ] **Step 4 — Commit.** `feat(plan-financier): défaut année courante = calendaire, persisté dans inputs_data`

## Task 4 : Excel données — vue historique complète

**Files :** `src/lib/planFinancierExcel.ts`, test `src/test/planFinancierExcel.test.ts`.

- [ ] **Step 1 — Test (rouge) :** plan avec projections incluant 2022-2024 réel, 2025 gap, 2026 courante, 2027+ → l'onglet Projections liste les colonnes 2022,2023,2024,2025,2026,2027… ; 2025 (gap) affiche « à compléter » ; année courante = 2026.
- [ ] **Step 2 — Vérifier l'échec.**
- [ ] **Step 3 — Implémentation :** dans la feuille Projections, dériver les colonnes depuis `projections[].annee_num` (déjà le cas) ; pour les entrées `is_gap`, écrire « à compléter » au lieu de 0. Ajouter une mention sur l'onglet Hypothèses : « Année courante : <pivot> ».
- [ ] **Step 4 — Vert.**
- [ ] **Step 5 — Commit.** `feat(excel-donnees): vue historique complète + gap à compléter + année courante`

## Task 5 : UI — champ éditable « Année courante »

**Files :** composant d'édition des inputs (à localiser : `git grep -n "historique_3ans\|inputs_data\|annee" src/components`), + clés i18n.

- [ ] **Step 1 :** localiser l'éditeur des inputs financiers (probablement un viewer/éditeur d'`inputs_data`).
- [ ] **Step 2 :** ajouter un champ numérique « Année courante » lié à `inputs.annee_courante`, avec aide « Par défaut l'année en cours ; à ajuster si reprise/exercice décalé ».
- [ ] **Step 3 :** sauvegarde via le mécanisme existant de mise à jour des inputs.
- [ ] **Step 4 — Vérif local** (`npm run dev`) + tsc.
- [ ] **Step 5 — Commit.** `feat(ui): champ éditable Année courante (inputs financiers)`

## Task 6 : OVO — vérification (pas de chirurgie template)

**Files :** lecture seule `supabase/functions/_shared/plan-to-ovo-adapter.ts`, `~/esono-railway/ovo_filler.py`.

- [ ] **Step 1 :** confirmer que le bloc « Years » d'`ovo_filler.py` (lignes 175-187) suit bien `years.year_minus_2` → donc avec pivot, lignes 24-33 = `[pivot-2, pivot-1, pivot(CY/H1/H2), pivot+1..+5]`. Aucune modif code attendue (il dérive de `years`).
- [ ] **Step 2 :** documenter la limite « 2 colonnes d'historique » dans le plan / message utilisateur. Pas de déploiement Railway tant que pas « pousser sur main ».

## Finalisation

- [ ] `npx tsc --noEmit` + `npx vitest run` (tout vert).
- [ ] `npm run build`.
- [ ] Présenter à l'utilisateur pour validation locale. Déploiement (EF + Railway + merge main) UNIQUEMENT sur « pousser sur main ».
