

# Plan : Résoudre le template OVO manquant + fichier Excel corrompu

## Diagnostic

D'après les logs :
- **ODD Excel** : en réalité **déjà généré avec succès** (537 Ko uploadé dans `ovo-outputs`). Le problème précédent est résolu.
- **OVO Plan Excel** : échoue car le template `251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm` n'existe pas dans le bucket `ovo-templates`.
- **Screenshot** : le fichier `.xlsm` généré précédemment est corrompu — Excel refuse de l'ouvrir. Cela est dû à la compression ZIP qui casse les binaires VBA du fichier `.xlsm`.

Vous avez uploadé le template `.xlsm`. Il faut maintenant :
1. Le rendre disponible dans le bucket Storage
2. Corriger la corruption VBA dans la génération

## Modifications

### 1. Copier le template OVO dans le projet
- Copier `user-uploads://251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm` vers `public/templates/251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm`

### 2. Créer un edge function `upload-template` pour pousser le fichier dans le bucket
- Nouvelle fonction `supabase/functions/upload-template/index.ts`
- Télécharge le fichier depuis l'URL publique du projet et l'uploade dans le bucket `ovo-templates`
- Permet aussi d'uploader le template ODD dans le bucket `templates` si absent

### 3. Corriger la corruption VBA dans `generate-ovo-plan/index.ts`
Le code utilise JSZip pour manipuler le `.xlsm`. Les fichiers VBA (`xl/vbaProject.bin`, etc.) doivent être préservés en mode `STORE` (sans compression) pour ne pas corrompre les macros. Le code ODD le fait déjà correctement, mais `generate-ovo-plan` ne le fait probablement pas.

Modifications dans `generate-ovo-plan/index.ts` :
- Avant toute modification ZIP : sauvegarder tous les fichiers VBA en `Uint8Array`
- Après toutes les modifications : réinjecter les fichiers VBA avec `compression: "STORE"`
- Générer le ZIP final sans compression globale forcée

### 4. Appel automatique d'upload au démarrage du dashboard
- Dans `EntrepreneurDashboard.tsx` : appeler l'edge function `upload-template` une fois (best-effort, silencieux) pour s'assurer que les templates sont dans les buckets

## Fichiers impactés

| Fichier | Action |
|---|---|
| `public/templates/251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm` | Copie du fichier uploadé |
| `supabase/functions/upload-template/index.ts` | Nouveau : upload templates vers Storage |
| `supabase/functions/generate-ovo-plan/index.ts` | Fix préservation VBA (STORE) |
| `src/components/dashboard/EntrepreneurDashboard.tsx` | Appel initial upload-template |

