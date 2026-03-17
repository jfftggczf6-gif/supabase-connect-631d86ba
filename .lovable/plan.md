

## Deux corrections : documents coach dans le contexte IA + extraction d'infos entreprise

### Problème 1 : Les documents coach ne sont pas lus par l'IA

Le coach uploade les fichiers dans `documents/{enterprise_id}/coach/{category}/...`, mais `verifyAndGetContext()` dans `helpers.ts` fait `list(enterprise_id)` qui ne liste que les fichiers **à la racine**. Les fichiers dans les sous-dossiers `coach/` ne sont jamais trouvés → l'IA hallucine.

**Correction dans `supabase/functions/_shared/helpers.ts`** — après la boucle de lecture des fichiers root (ligne ~195), ajouter :

1. Requête vers la table `coach_uploads` pour récupérer tous les `storage_path` liés à l'`enterprise_id`
2. Pour chaque entrée, télécharger le fichier via `storage_path` et le parser (docx/xlsx/csv/txt) avec les mêmes fonctions existantes
3. Ajouter le contenu parsé à `documentContent` avec un label `Document Coach ({category})`

Le `supabase` client utilisé est déjà le service role, donc pas de problème RLS.

### Problème 2 : Pas d'extraction d'infos (secteur, etc.) côté coach

Côté entrepreneur, après upload d'un document source, la fonction `extract-enterprise-info` est appelée et un dialog s'affiche pour confirmer le nom, pays et secteur extraits. Cette logique est **totalement absente** du `CoachDashboard`.

**Correction dans `src/components/dashboard/CoachDashboard.tsx`** :

1. Ajouter les states `extractedInfo`, `showExtractDialog`, `extractingEntId`
2. Après un upload réussi dans `handleUpload`, appeler `extract-enterprise-info` avec l'`enterprise_id` (best-effort, silencieux)
3. Si l'info extraite diffère de l'entreprise actuelle, afficher un Dialog de confirmation identique à celui de l'entrepreneur
4. Sur confirmation, mettre à jour l'entreprise via `supabase.from('enterprises').update(...)`

### Aucune migration requise
Les deux corrections utilisent des tables et fonctions existantes.

