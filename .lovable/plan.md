

# Bouton "Arrêter la génération"

## Emplacement

Le bouton sera placé **en bas de la sidebar**, dans la zone du bouton "Générer tout le pipeline" (lignes 220-247 de `DashboardSidebar.tsx`).

Quand une génération est en cours, cette zone affichera **deux boutons empilés** :

```text
┌──────────────────────┐
│  ⏳ Inputs… (3/12)   │  ← Bouton vert (disabled, montre la progression)
├──────────────────────┤
│  ■  Arrêter           │  ← Bouton rouge, cliquable
└──────────────────────┘
```

Quand aucune génération n'est active, on retrouve le bouton vert normal "Générer tout le pipeline".

## Fichiers modifiés

### 1. `src/lib/pipeline-runner.ts`
- Ajouter `signal?: AbortSignal` aux options de `runPipelineFromClient`
- Vérifier `signal.aborted` au début de chaque step → sortir proprement
- Combiner le signal avec le timeout existant sur les `fetch`

### 2. `src/components/dashboard/EntrepreneurDashboard.tsx`
- Créer un `useRef<AbortController>` pour le controller actif
- Dans `handleGenerate`, créer un `AbortController`, le passer au pipeline
- Ajouter `handleStopGeneration` → `abort()` + reset état + toast "Génération interrompue"
- Passer `onStopGeneration` au `DashboardSidebar`

### 3. `src/components/dashboard/DashboardSidebar.tsx`
- Ajouter prop `onStopGeneration?: () => void`
- Quand `generating === true` : afficher le bouton de progression (disabled) + un bouton rouge "Arrêter" en dessous
- Le bouton rouge appelle `onStopGeneration`

