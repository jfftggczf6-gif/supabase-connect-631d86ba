

# Plan : Consultation temps réel des livrables + Upload template ODD

## Deux changements

### 1. Rafraîchissement temps réel des livrables pendant la génération

Actuellement, le dashboard ne rafraîchit les livrables qu'une seule fois **après** la fin complète de la pipeline (ligne 308 : `await fetchData()`). L'utilisateur ne voit rien bouger pendant 5-10 minutes.

**Modification** dans `EntrepreneurDashboard.tsx` :
- Ajouter un `await fetchData()` **après chaque étape réussie** de la boucle pipeline (après ligne 289), pour que le livrable apparaisse immédiatement dans l'interface
- Même chose dans `CoachDashboard.tsx` pour la cohérence
- Le toast par étape existe déjà via `setGenerationProgress`, mais les données ne sont pas rechargées

### 2. Upload du template ODD Excel dans le bucket `templates`

Le fichier uploadé est `ODD_template.xlsx` mais le code attend `ODD_template.xlsm`. Comme le fichier n'a pas de macros VBA (c'est un `.xlsx`), il faut :
- Adapter le code dans `odd-excel-template.ts` pour chercher `ODD_template.xlsx` au lieu de `.xlsm`
- Adapter le type MIME de l'upload dans `generate-odd/index.ts`
- Uploader le fichier dans le bucket `templates` via le code (copie depuis user-uploads vers public, puis upload programmatique au Storage via migration ou edge function)

**Alternative plus simple** : Renommer la référence dans le code de `.xlsm` → `.xlsx` et uploader le fichier manuellement dans le bucket. Comme on n'a pas accès direct au Storage pour uploader un binaire, on va :
1. Copier le fichier dans `public/templates/ODD_template.xlsx`
2. Créer une petite fonction dans le dashboard qui upload le template au bucket `templates` au démarrage si absent (ou on le fait via un edge function utilitaire)

En fait, la meilleure approche : copier le fichier dans le projet et créer un edge function `upload-odd-template` qui le télécharge depuis une URL et l'envoie au bucket.

## Fichiers impactés

| Fichier | Changement |
|---|---|
| `src/components/dashboard/EntrepreneurDashboard.tsx` | `fetchData()` après chaque étape pipeline |
| `src/components/dashboard/CoachDashboard.tsx` | Idem |
| `supabase/functions/_shared/odd-excel-template.ts` | `.xlsm` → `.xlsx` |
| `supabase/functions/generate-odd/index.ts` | MIME type `.xlsm` → `.xlsx` |
| `public/templates/ODD_template.xlsx` | Copie du fichier uploadé |
| `supabase/functions/upload-template/index.ts` | Nouveau : edge function utilitaire pour pousser le template dans le bucket Storage |

