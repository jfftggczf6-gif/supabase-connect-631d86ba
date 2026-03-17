

## Correction : `generate-inputs` doit court-circuiter quand il n'y a pas de documents financiers réels

### Problème

Le pipeline exécute `generate-inputs` systématiquement. Quand seul un document BMC/SIC (Word narratif) est uploadé, l'IA "extrait" des données financières inventées au lieu de retourner des zéros. L'utilisateur veut que les Inputs ne soient basés que sur des données financières réelles.

### Solution

Modifier `supabase/functions/generate-inputs/index.ts` pour **détecter l'absence de documents financiers** et retourner un squelette vide sans appeler l'IA.

**Logique de détection :**
1. Après `verifyAndGetContext`, analyser `ctx.documentContent` pour vérifier s'il contient des documents financiers réels :
   - Présence de fichiers Excel (`.xlsx`, `.xls`) dans les labels du contenu
   - Présence de fichiers de catégorie `inputs` dans `coach_uploads`
2. Vérifier aussi si le contenu parsé contient des indicateurs financiers (mots-clés : "chiffre d'affaires", "bilan", "compte de résultat", "P&L", "total actif", etc.)

**Si aucun document financier détecté :**
- Sauvegarder un objet `inputs_data` vide avec `score: 0`, toutes valeurs à 0, et `fiabilite: "Aucune"` 
- Retourner immédiatement sans appeler `callAI` — économise crédits et empêche l'hallucination
- Ajouter dans `donnees_manquantes`: `["Aucun document financier uploadé"]`

**Si des documents financiers sont détectés :** comportement actuel inchangé.

**Renforcement du prompt (ceinture + bretelles) :**
Ajouter au system prompt une instruction explicite :
```
ATTENTION CRITIQUE: Si les documents fournis sont des questionnaires BMC, des canvas d'impact social, ou tout document NON FINANCIER, retourne TOUTES les valeurs numériques à 0 et score à 0. N'invente AUCUN chiffre à partir de descriptions narratives.
```

### Fichiers modifiés
- `supabase/functions/generate-inputs/index.ts` — ajout du guard de détection + squelette vide
- Redéploiement de la fonction `generate-inputs`

### Impact
- Les modules en aval (Framework, Plan OVO) recevront des inputs à zéro et adapteront leur comportement
- Économie d'un appel API quand pas de docs financiers
- Aucune migration DB requise

