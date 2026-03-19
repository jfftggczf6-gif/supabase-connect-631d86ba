

## Problème

Actuellement il y a **un seul bouton** "Générer tout le pipeline" dans la sidebar, qui appelle `handleGenerate()` → `runPipelineFromClient()`. Ce pipeline commence directement par BMC car le `PIPELINE` array dans `dashboard-config.ts` ne contient pas le pre-screening.

Avant, l'ancien UX avait probablement deux boutons séparés : un pour le pre-screening/triage et un pour la génération complète.

Le problème est double :
1. Le **pre-screening manque** dans le `PIPELINE` array (côté client)
2. Le **pre-screening manque** dans `PIPELINE_STEPS` du serveur (`generate-deliverables/index.ts`)
3. Le **screening final** manque aussi dans les deux pipelines (il est en Phase 4 mais jamais exécuté automatiquement)

## Plan

### Étape 1 — Ajouter pre-screening + screening final dans le PIPELINE client

**Fichier** : `src/lib/dashboard-config.ts`

Modifier le tableau `PIPELINE` pour ajouter :
- En **tête** : `{ name: 'Pre-screening', fn: 'generate-pre-screening', type: 'pre_screening' }`
- En **fin** (déjà présent) : le screening report est déjà là ✓

### Étape 2 — Ajouter pre-screening dans le pipeline serveur

**Fichier** : `supabase/functions/generate-deliverables/index.ts`

- Ajouter `{ name: "Pre-screening", function: "generate-pre-screening" }` en tête de `PIPELINE_STEPS`
- Ajouter le mapping `"generate-pre-screening": "pre_screening"` dans `fnToDelivType`

### Étape 3 — Screening final dans le pipeline serveur

Ajouter `{ name: "Screening", function: "generate-screening-report" }` en fin de `PIPELINE_STEPS` + mapping `"generate-screening-report": "screening_report"`.

### Résumé des fichiers modifiés
| Fichier | Modification |
|---------|-------------|
| `src/lib/dashboard-config.ts` | Ajouter pre-screening en tête du PIPELINE |
| `supabase/functions/generate-deliverables/index.ts` | Ajouter pre-screening en tête + screening en fin de PIPELINE_STEPS, + mappings fnToDelivType |

Le bouton unique "Générer tout" exécutera alors correctement : Pre-screening → BMC → SIC → … → Screening final.

