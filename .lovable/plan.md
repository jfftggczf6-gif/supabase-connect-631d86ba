

## Plan : Afficher les fichiers de reconstruction déjà uploadés

### Probleme
Le `ReconstructionUploader` utilise `useState<File[]>([])` — état local perdu au remontage du composant. Les fichiers sont bien dans le stockage mais ne sont jamais rechargés à l'affichage.

### Solution
Au montage du composant, lister les fichiers existants dans `{enterpriseId}/reconstruction/` depuis le stockage et les afficher comme "fichiers déjà uploadés". Séparer visuellement les fichiers déjà uploadés (non supprimables sauf action explicite) des nouveaux fichiers en attente.

### Changements

**Fichier : `src/components/dashboard/ReconstructionUploader.tsx`**

1. Ajouter un état `existingFiles` pour stocker les fichiers déjà présents en storage
2. Ajouter un `useEffect` au montage qui appelle `supabase.storage.from('documents').list('{enterpriseId}/reconstruction/')` et peuple `existingFiles`
3. Afficher ces fichiers existants dans une section "Documents déjà uploadés" au-dessus de la zone de drop, avec leur nom et taille
4. Après une reconstruction réussie, re-fetcher les fichiers existants pour refléter les nouveaux uploads
5. Ne pas reset `existingFiles` dans `handleReset` — seuls les nouveaux fichiers en attente sont vidés

### Résultat attendu
Quand l'utilisateur revient sur l'onglet reconstruction, il voit la liste des fichiers déjà uploadés. Il peut en ajouter de nouveaux pour relancer une reconstruction.

| Fichier | Modification |
|---|---|
| `ReconstructionUploader.tsx` | Ajouter fetch des fichiers existants au montage + affichage persistant |

