

## Probleme identifie

Le classement des fichiers uploades dans les sections **"BMC & Impact Social"** et **"Inputs Financiers"** est base uniquement sur l'extension du fichier :

```
docFiles = uploadedFiles.filter(f => /\.(docx?|pdf|txt)$/i.test(f.name))
finFiles = uploadedFiles.filter(f => /\.(xlsx?|csv)$/i.test(f.name))
```

Tous les fichiers — qu'ils viennent du drag-and-drop de reconstruction ou des boutons d'upload specifiques — atterrissent dans le meme dossier Storage (`documents/{enterpriseId}/`). Le panneau d'upload ne fait aucune distinction d'origine.

Resultat : quand vous deposez 25 fichiers via le reconstructeur (etats financiers PDF, rapport d'activite DOCX, images, etc.), ils apparaissent tous sous "BMC & Impact Social" (pour les .pdf/.docx) et "Inputs Financiers" (pour les .xlsx), ce qui est trompeur.

## Solution proposee

**Separer visuellement les fichiers du reconstructeur des fichiers d'upload manuel** en utilisant le prefixe timestamp que le reconstructeur ajoute deja aux noms de fichiers.

### Changements

1. **`EntrepreneurDashboard.tsx`** — Modifier la logique de classification :
   - Les fichiers uploades via le reconstructeur ont un prefixe timestamp (`1773960..._{nom}`). Utiliser ce pattern pour les exclure des sections BMC/Inputs.
   - Creer une nouvelle section **"Documents de reconstruction"** qui affiche ces fichiers separement, avec un badge indiquant le nombre.
   - Les sections BMC et Inputs ne montrent que les fichiers uploades manuellement (sans prefixe timestamp).

2. **Alternative plus propre** (recommandee) : Stocker les fichiers du reconstructeur dans un sous-dossier distinct (`documents/{enterpriseId}/reconstruction/`) pour une separation nette.
   - Modifier `ReconstructionUploader.tsx` ligne ~103 : changer le path de `${enterpriseId}/${Date.now()}_${safeName}` a `${enterpriseId}/reconstruction/${Date.now()}_${safeName}`
   - Modifier `EntrepreneurDashboard.tsx` : filtrer les fichiers dont le nom commence par `reconstruction/` hors des sections BMC/Inputs, et les afficher dans une section dediee "Documents analysés par l'IA"

### Impact

- Les sections BMC et Inputs Financiers ne montrent que les fichiers volontairement uploades par l'utilisateur via ces boutons specifiques
- Les fichiers du reconstructeur apparaissent dans leur propre section clairement identifiee
- Aucun impact sur le backend — le cache `document_content` et les edge functions lisent tout le dossier de l'enterprise

