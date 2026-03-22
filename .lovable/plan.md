

# Simplification Pilote — Ce qui reste

## Statut actuel

Sur les 13 points du prompt, **11 sont terminés**. Il reste **2 corrections** :

### Fix 6 — Supprimer le lancement automatique du pre-screening après reconstruction

Actuellement, `ReconstructionUploader` appelle automatiquement `generate-pre-screening` après la reconstruction (lignes 220-244) et invoque `onPreScreeningDone`. Le bon flow est : upload → reconstruction → STOP. Le pre-screening se lance uniquement via "Générer tout le pipeline".

**Fichiers concernés :**
- `src/components/dashboard/ReconstructionUploader.tsx` : Supprimer le bloc qui appelle `generate-pre-screening` après la reconstruction (lignes 220-244). Supprimer la prop `onPreScreeningDone` de l'interface et du composant. Supprimer aussi le retry pre-screening (`handleRetryPreScreening`).
- `src/components/dashboard/EntrepreneurDashboard.tsx` : Retirer la prop `onPreScreeningDone` passée au `ReconstructionUploader` (ligne 1199).

### Fix 13 — Plein écran par défaut quand le coach clique "Voir"

Le prompt demande que le plein écran soit activé par défaut. Actuellement `fullscreen` démarre à `false` et le bouton "Voir" ne l'active pas.

**Fichier concerné :**
- `src/components/dashboard/CoachDashboard.tsx` (ligne 574) : Ajouter `setFullscreen(true)` dans le handler du bouton "Voir".

### Résumé des changements

| Fichier | Action |
|---------|--------|
| `ReconstructionUploader.tsx` | Supprimer auto-launch pre-screening + prop `onPreScreeningDone` |
| `EntrepreneurDashboard.tsx` | Retirer `onPreScreeningDone` du composant `ReconstructionUploader` |
| `CoachDashboard.tsx` | Activer fullscreen quand le coach clique "Voir" |

