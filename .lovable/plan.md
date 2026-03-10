

# Plan : Bouton de suppression des fichiers sources + Migration extract vers Anthropic Sonnet

## Deux changements demandés

### 1. Ajouter un bouton de suppression pour chaque fichier uploadé dans le volet Sources

Actuellement, les fichiers sont listés dans le panneau gauche (lignes 932-938 pour les docs, 959-964 pour les financiers) mais sans aucune option de suppression.

**Modification** dans `src/components/dashboard/EntrepreneurDashboard.tsx` :
- Ajouter une fonction `handleDeleteFile(fileName)` qui appelle `supabase.storage.from('documents').remove([enterprise.id/fileName])` puis rafraîchit la liste
- Ajouter un bouton `X` (icône Trash ou X) à côté de chaque nom de fichier dans les deux sections (docFiles et finFiles)
- Ajouter une confirmation avant suppression via un `AlertDialog` ou un simple `confirm()`
- Stopper la propagation du clic pour éviter de déclencher l'upload

### 2. Migrer `extract-enterprise-info` vers l'API Anthropic directe avec Claude Sonnet

**Modification** dans `supabase/functions/extract-enterprise-info/index.ts` :
- Remplacer l'appel au gateway Lovable AI par un appel direct à `https://api.anthropic.com/v1/messages`
- Utiliser le secret `ANTHROPIC_API_KEY` (déjà configuré)
- Modèle : `claude-sonnet-4-20250514`
- Adapter le format de requête/réponse au format Anthropic Messages API (system séparé, `content[0].text` en sortie)

## Fichiers impactés
1. `src/components/dashboard/EntrepreneurDashboard.tsx` — ajout suppression fichiers
2. `supabase/functions/extract-enterprise-info/index.ts` — migration Anthropic Sonnet

