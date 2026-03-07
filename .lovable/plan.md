
Objectif: corriger définitivement le cas “Connexion interrompue, vérification du statut en cours...” pour que la génération OVO ne reste plus bloquée en `processing`.

Constat confirmé (code + logs):
- Le backend coupe la réponse HTTP à ~150s (504), puis la fonction continue un peu.
- Dans `generate-ovo-plan`, `Attempt 1` timeout à 150s, `Attempt 2` démarre trop tard, puis la fonction est arrêtée avant fin (`shutdown`), donc le statut reste `processing`.
- Le frontend poll bien, mais sans statut terminal fiable il finit en boucle/timeout.

Plan d’implémentation
1) Refaire la stratégie de timeout/retry dans `supabase/functions/generate-ovo-plan/index.ts`
- Remplacer le retry fixe “2 attempts” par un retry “budget-aware”:
  - tentative 1 avec timeout plus court,
  - tentative 2 seulement s’il reste assez de temps d’exécution total.
- Ne jamais lancer une tentative qui ne peut pas finir avant la limite runtime.
- En cas d’échec final, écrire systématiquement `data.status = "failed"` avec `error_code` explicite.

2) Réduire la taille/complexité du prompt envoyé à l’IA
- Garder les contraintes financières critiques, mais compacter les blocs contextuels volumineux (résumés chiffrés au lieu de longs blocs texte/JSON).
- Limiter/tronquer champs verbeux (diagnostic, recommandations, textes longs).
- But: faire passer la génération IA dans la fenêtre de temps réelle.

3) Fiabiliser l’état du deliverable pendant traitement
- Lors du passage en `processing`: vider `file_url` (évite de montrer un ancien fichier).
- Ajouter métadonnées de suivi (`phase`, `attempt`, `last_update_at`) dans `data`.

4) Renforcer le fallback frontend dans `src/components/dashboard/EntrepreneurDashboard.tsx`
- Allonger le polling (ex: jusqu’à 6–8 min).
- Détecter `processing` “stale” (trop ancien) et afficher une erreur claire au lieu d’attendre indéfiniment.
- Mettre à jour le libellé “30-60 secondes” vers une estimation réaliste.
- Reprendre automatiquement le polling si la page est rechargée alors qu’un `request_id` est encore en `processing`.

Détails techniques (ciblés)
- Fichiers: 
  - `supabase/functions/generate-ovo-plan/index.ts`
  - `src/components/dashboard/EntrepreneurDashboard.tsx`
- Pas de migration DB obligatoire (on réutilise `deliverables.data` JSONB).
- Critère de succès:
  - plus de `processing` bloqué,
  - statut terminal toujours écrit (`completed` ou `failed`),
  - téléchargement proposé uniquement quand un nouveau fichier est réellement prêt.

Validation prévue
- Lancer une régénération OVO avec le même cas (4 produits + 2 services).
- Vérifier: logs backend, transition `processing -> completed/failed`, et comportement polling côté UI.
- Confirmer que le fichier final est nouveau (nom/horodatage) et téléchargeable.
