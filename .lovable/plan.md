

## Corriger les 3 erreurs de build

### 1. `supabase/functions/generate-business-plan/index.ts` (ligne 6)
Remplacer `import JSZip from "npm:jszip@3"` par `import JSZip from "https://esm.sh/jszip@3.10.1"`.

### 2. `src/components/dashboard/PlanOvoViewer.tsx`
- **Ligne 122** : Changer la signature de `{ data }: { data: any }` en `{ data, staleness }: { data: any; staleness?: { frameworkUpdatedAt: any; planOvoUpdatedAt: any } }` pour accepter la prop `staleness`.
- **Lignes 161-166** : Supprimer les 6 lignes des variables inutilisées (`rawTri`, `rawCagrRev`, `rawCagrEbitda`, `rawRoi`).

### 3. Aucun changement nécessaire sur `DeliverableViewer.tsx`
Le fix de la signature PlanOvoViewer résout l'erreur TS2322.

