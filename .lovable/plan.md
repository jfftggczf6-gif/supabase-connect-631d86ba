

## Analyse du flux de reconstruction

### Ce qui s'est passe

Le flux a fonctionne correctement en 5 etapes :

1. **Upload** des 12 fichiers vers `documents/{enterpriseId}/reconstruction/` — OK
2. **Parsing** via le serveur Python — OK (12 fichiers parses, 257K caracteres caches)
3. **Reconstruction IA** (`reconstruct-from-traces`) — OK, le score de confiance s'est affiche
4. **Pre-screening auto** (`generate-pre-screening`) — **ECHOUE** silencieusement (le log console montre : `Pre-screening failed (non-blocking): TypeError: Load failed`)
5. **Ecran de resultat** : l'ecran de confiance (score, hypotheses, donnees manquantes) s'est affiche correctement

### Probleme 1 : Le pre-screening n'a pas ete lance

Le pre-screening a echoue avec `TypeError: Load failed` — c'est une erreur reseau (timeout ou connexion coupee). L'appel au pre-screening arrive a la fin de la reconstruction (etape 5, ligne 182-196 de `ReconstructionUploader.tsx`), apres deja ~2-3 minutes de traitement. Le navigateur peut couper la connexion.

Le code gere cette erreur comme "non-blocking" (`catch` a la ligne 194), donc le flux continue sans erreur visible. Mais `onPreScreeningDone` n'est jamais appele, donc la navigation vers le module `pre_screening` n'a pas lieu.

### Probleme 2 : L'ecran de confiance a disparu

C'est le comportement normal actuel. L'ecran de confiance est un **etat local** du composant `ReconstructionUploader` (la variable `result`). Quand vous cliquez sur "Utiliser ces donnees" ou quand vous naviguez vers un autre module dans la sidebar, le composant se demonte et l'etat est perdu. Il n'y a aucune persistance de ce resultat.

### Corrections proposees

#### 1. Rendre le pre-screening plus robuste
- Ajouter un timeout explicite de 180s pour l'appel pre-screening (comme pour la reconstruction)
- En cas d'echec, afficher un bouton "Relancer le pre-screening" au lieu de silencieusement ignorer l'erreur
- Notifier l'utilisateur que le pre-screening sera disponible apres relance

#### 2. Persister le score de confiance
- Sauvegarder le resultat de reconstruction dans le deliverable `reconstruction_data` (deja fait par l'edge function)
- Afficher un indicateur de confiance permanent dans le header ou l'overview du dashboard, en lisant le deliverable existant
- Quand l'utilisateur revient sur le module "upload", afficher le dernier resultat de reconstruction s'il existe

#### 3. Ameliorer le flux post-reconstruction
- Apres reconstruction reussie + pre-screening OK : naviguer automatiquement vers le pre-screening
- Apres reconstruction reussie + pre-screening echoue : rester sur l'ecran de confiance avec un bouton explicite "Voir le pre-screening" (grise) et "Relancer l'analyse"

### Fichiers concernes

- `src/components/dashboard/ReconstructionUploader.tsx` — timeout pre-screening, gestion d'erreur visible, persistance resultat
- `src/components/dashboard/EntrepreneurDashboard.tsx` — affichage confiance dans overview, lecture du deliverable reconstruction

