# Patch NON APPLIQUÉ — tracer modèle + version de prompt dans `screening_data`

> **Statut : proposé, non appliqué.** La consigne du 2026-09-10 dit à la fois
> « Ne modifie pas `screen_candidatures.py` » et « enregistrer désormais modèle +
> version de prompt dans `screening_data` à chaque screening ». Cette écriture se
> fait dans `_run()`, dans ce fichier précisément — les deux ne peuvent pas tenir
> ensemble. Le patch est donc rédigé et laissé à l'arbitrage.

Fichier visé : `esono-ai-worker/api/agents/screen_candidatures.py`
Dépôt : `esono-ai-worker`, branche `main` (dernier commit `f1a4638`).

## Pourquoi

L'audit du 2026-09-10 a établi que `screening_data` ne conserve **ni le modèle,
ni la version de prompt** utilisés. Deux diagnostics produits à six mois d'écart
sont indistinguables : impossible de savoir si un écart de score vient d'un
changement de dossier, de modèle ou de prompt.

`RENDER_DIAGNOSTIC` inaugure le registre `ai_prompts` et enregistre sa traçabilité
sur chaque rendu. Le diagnostic source, lui, reste opaque tant que ce patch n'est
pas appliqué — c'est l'asymétrie que ce patch supprime.

## Le patch

Dans `_screen_one()`, le verdict retourné porte déjà `model` et `usage`. Il suffit
de les faire descendre dans le diagnostic écrit, sous une clé réservée `_meta`.

```python
# _run(), branche d'écriture — juste avant l'UPDATE atomique.

            elif writable:
                now_iso = datetime.now(timezone.utc).isoformat()

                # Traçabilité de production. Clé réservée `_meta` : préfixée par
                # un souligné comme _error/_at/_source, donc hors du schéma
                # métier et ignorée par extractProse (PROSE_PATHS ne la liste pas).
                diagnostic["_meta"] = {
                    "model": outcome["model"],
                    "prompt_code": "SCREEN_CANDIDATURE",
                    "prompt_version": SCREEN_PROMPT_VERSION,
                    "generated_at": now_iso,
                    "worker_build": os.getenv("RAILWAY_GIT_COMMIT_SHA", "unknown")[:12],
                    "status": outcome["status"],
                    "documents": outcome["totals"],
                }

                supabase.table("candidatures").update({
                    "screening_score": diagnostic.get("score") or 0,
                    "screening_data": diagnostic,
                    "screening_date": now_iso,
                    "updated_at": now_iso,
                }).eq("id", cid).execute()
```

Et en tête du module, la version du prompt de screening :

```python
# Version du prompt de screening. À incrémenter à CHAQUE modification de
# SCREENING_SYSTEM_PROMPT ou de SCREENING_SCHEMA — sans quoi deux diagnostics
# produits par des prompts différents se déclareraient identiques.
SCREEN_PROMPT_VERSION = 1
```

## Effets

- **Additif.** `_meta` est une clé nouvelle ; aucun champ existant n'est touché.
- **Sans effet sur l'invariance fr/en.** `_meta` n'est pas dans `PROSE_PATHS`,
  donc jamais transmise au rendu, donc identique dans les deux langues.
- **Sans effet sur l'affichage.** Ni le viewer ni l'export ne lisent `_meta`.
- **Ne s'applique qu'aux screenings futurs.** Les diagnostics déjà en base
  resteront sans traçabilité : c'est irrattrapable, l'information n'a jamais
  été écrite.

## Étape suivante si tu valides

Le prompt de screening devrait à terme migrer dans `ai_prompts`
(code `SCREEN_CANDIDATURE`), comme `RENDER_DIAGNOSTIC`, plutôt que de rester une
constante Python avec un numéro de version tenu à la main. `SCREEN_PROMPT_VERSION`
est un pis-aller : il dépend de la discipline de celui qui édite le prompt.
