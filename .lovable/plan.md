

# Fix "Load failed" — Timeout de la fonction d'orchestration

## Problème

La edge function `generate-deliverables` orchestre les 8 étapes du pipeline séquentiellement dans **un seul appel HTTP**. Chaque étape IA prend 30-90 secondes. Total: 4-10 minutes. Or les edge functions ont un timeout de ~150 secondes → la fonction est tuée → le client reçoit une connexion coupée → **"Load failed"**.

## Solution

**Piloter le pipeline depuis le client** au lieu du serveur. Le client appelle chaque edge function une par une, en séquence. Chaque appel individuel dure 30-90s (bien dans la limite de timeout).

### Modifications

**Fichier 1 : `src/components/dashboard/EntrepreneurDashboard.tsx`**

Réécrire `handleGenerate` pour :
1. Boucler sur `PIPELINE` côté client
2. Pour chaque étape, vérifier si un deliverable existe déjà (skip si `force=false`)
3. Appeler directement la edge function individuelle (`generate-bmc`, `generate-sic`, etc.)
4. Mettre à jour la barre de progression en temps réel (nom de l'étape en cours)
5. Si une étape échoue (402 crédits, 429 rate limit), arrêter le pipeline
6. Supprimer le polling DB (plus nécessaire, la progression est connue directement)
7. À la fin, appeler `fetchData()` pour rafraîchir + lancer l'Excel OVO

**Fichier 2 : `src/components/dashboard/CoachDashboard.tsx`**

Même refactoring pour la fonction de génération côté coach.

**Fichier 3 : `supabase/functions/generate-deliverables/index.ts`** (optionnel)

Garder la fonction pour compatibilité mais elle ne sera plus le chemin principal. Aucune suppression nécessaire.

### Avantages
- Plus de timeout serveur
- Progression réelle et précise (nom de l'étape affichée)
- Si une étape échoue, les précédentes sont déjà sauvegardées
- L'utilisateur peut voir les résultats apparaître au fur et à mesure
- Le calcul du score global se fait côté client à la fin (un simple `fetchData`)

### Gestion du score global

Après la boucle, le client appelle `fetchData()` qui récupère tous les deliverables avec leurs scores. Le score global peut être calculé en faisant la moyenne des scores existants, ou on garde un appel léger au serveur pour ça.

