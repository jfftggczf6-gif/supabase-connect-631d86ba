# Multi-Segment ESONO — Plan d'implémentation

Branche : `feature/multi-segment-infra`
Spec d'origine : `ESONO Architecture Multi Segment.pdf` + `ESONO Multi Segment Claude Code Prompt.pdf` (Avril 2026)

## Objectif

ESONO sert aujourd'hui 1 segment en production (Programme : 7 orgs, 35 entreprises, 238 deliverables) et veut servir 3 autres segments (PE, Banque d'affaires, Banque/IMF) avec le même moteur Claude + Supabase + Railway. Le découpage métier doit être pilotable par config, pas par dev custom à chaque client.

## Architecture en 3 couches

```
organizations          → identité (nom, slug, logo, couleurs, type)
organization_presets   → config métier par client (overrides du segment)
organizations.settings → préférences UI légères (dark mode, langue interface)
```

La source de vérité pour le segment est `organizations.type`. Les presets ne contiennent que les **overrides** spécifiques au client. Si pas de preset → on tombe sur les défauts du `SegmentConfig`.

## Les 4 segments cibles

| Segment | `organizations.type` | Statut | Livrable central |
|---|---|---|---|
| Programme | `programme` | ✅ Production | `diagnostic_data` |
| Private Equity | `pe` | 🚧 Construction | `investment_memo` |
| Banque d'affaires | `banque_affaires` | 📋 À construire | `teaser_anonymise` |
| Banque / IMF | `banque` | 📋 À construire | `note_credit` |

`mixed` reste valide dans le CHECK pour rétrocompat des données mais est traité comme `programme` côté code (`detectSegment` returns `'programme'`).

## État Phase 1 (cette branche)

✅ **Migrations SQL** (split en 2 fichiers — `ALTER TYPE` ne fonctionne pas en transaction) :

`supabase/migrations/20260427000000_multi_segment_tables.sql` (compatible transaction) :
- Élargit `organizations.type` CHECK (+banque_affaires, +banque, garde mixed)
- Crée `organization_presets` (avec RLS, devise nullable)
- Crée `organization_workflows` (avec RLS)
- Élargit `organization_members.role` CHECK (11 valeurs)

`supabase/migrations/20260427000001_multi_segment_enums.sql` (hors transaction) :
- `ALTER TYPE deliverable_type ADD VALUE` × 4
- `ALTER TYPE module_code ADD VALUE` × 4
- `ALTER TYPE app_role ADD VALUE` × 5

**NE PAS APPLIQUER** tant que le code Phase 1 n'est pas validé. Application recommandée via le SQL editor Supabase ou le MCP — pas via `supabase db push` qui peut planter sur le 2ᵉ fichier.

✅ **`_shared/segment-config.ts`** — source de vérité pour les défauts par segment :
- 4 tons (Programme / PE / BA / Banque) **sans devise hardcodée** (multi-devise respecté)
- 4 vocabulaires (entity / entity_owner / analyst / pipeline_term)
- 4 configurations (deliverables, workflow, scoring, roles)
- Fonctions d'accès : `getSegmentConfig`, `detectSegment`, `getPresets`, `getActiveDeliverables`, `getDevise`, `getScoringCriteres`, `getScoringWeights`

✅ **`_shared/agent-tone.ts`** — composeur du tone_block pour les agents :
- `buildToneForAgent(supabase, organizationId)` → renvoie le bloc d'identité
- Ajoute les blocs spécifiques (fund_segment pour PE, critères conformité pour Banque)
- Helpers rétrocompat : `detectPreset`, `detectFundSegment`

⛔ **Aucune modif** des 13 agents existants. Aucun déploiement requis. Le code est inerte tant qu'il n'est pas appelé.

## Décision clé — gestion devise

Le tone_block **ne hardcode aucune devise** (FCFA, EUR, USD). Raison : ESONO supporte déjà 23 pays / 9 devises distinctes via `getFiscalParams(country)` dans `helpers_v5.ts` (FCFA-XOF, FCFA-XAF, USD pour RDC, GHS pour Ghana, NGN pour Nigeria, KES pour Kenya, MAD pour Maroc, TND pour Tunisie, GNF pour Guinée, MGA, ETB, TZS, RWF, ZAR…).

La devise réelle des chiffres dans les livrables continue d'être résolue dynamiquement par `getFiscalParams(ent.country).devise` dans chaque agent — **aucune régression** sur les pays anglophones et hors-UEMOA actuellement supportés.

Le champ `devise_defaut` du SegmentConfig sert uniquement comme signal contextuel à l'IA et fallback UI quand aucune entreprise n'est sélectionnée.

## Décision clé — gestion identité (Q1 = 🅰️)

Plutôt que d'empiler 2 identités (celle déjà hardcodée dans chaque SYSTEM_PROMPT + le nouveau tone_block du segment), le pattern Phase 2 sera :

1. **Retirer la phrase d'identité initiale** des SYSTEM_PROMPT de chaque agent (`Tu es un consultant senior...`)
2. **Prepender le tone_block** depuis `buildToneForAgent` au reste du SYSTEM_PROMPT (qui contient désormais uniquement les instructions de tâche)

Pour Programme, le tone_block reproduit l'identité actuelle → **zéro régression** sur le ton produit. Pour PE/BA/Banque, le tone_block change l'identité → effet voulu.

## Phases suivantes (à venir)

### Phase 2 — Activation infra + agent test
1. Application de la migration SQL sur le projet Supabase prod (additif, safe)
2. Régénération des types TypeScript : `npx supabase gen types`
3. Modification de `generate-deliverables` (orchestrateur) pour lire les livrables actifs depuis `getActiveDeliverables(config, presets)` au lieu de la liste hardcodée
4. **Fix au passage** : la liste hardcodée actuelle référence `generate-plan-ovo` et `generate-ovo-plan` (obsolètes, remplacés par `generate-plan-financier`)
5. Modification de `generate-pre-screening` (1 agent test) pour utiliser `buildToneForAgent`
6. Test rétrocompat Programme : générer un pre-screening sur 3 entreprises Programme existantes, comparer JSON output avant/après → doit être structurellement identique
7. Si OK → étendre aux 12 autres agents par groupes

### Phase 3 — Agents Banque + onboarding clients
- Création de 3 nouvelles edge functions banque :
  - `generate-diagnostic-bancabilite`
  - `generate-credit-readiness-pack`
  - `generate-note-credit`
- Création d'une org test type `pe` avec preset Adiwale → test flow complet
- Création d'une org test type `banque` avec preset NSIA + funding_programs → test flow complet

## Commandes pour tester en local (Phase 2+)

```bash
# Installer Supabase CLI (une fois)
brew install supabase/tap/supabase

# Setup
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
supabase login
supabase link --project-ref gszwotgppuinpfnyrjnu

# Démarrer la stack locale (Postgres + Auth + Storage + Edge Functions)
supabase start

# Appliquer toutes les migrations sur la DB locale (y compris celle de Phase 1)
supabase db reset

# Setter les secrets pour les edge functions
cat > supabase/.env.local << 'EOF'
ANTHROPIC_API_KEY=ta_clé
VOYAGE_API_KEY=ta_clé
RAILWAY_URL=https://esono-parser-production-8f89.up.railway.app
PARSER_API_KEY=esono-parser-2026-prod
EOF

# Faire tourner les edge functions
supabase functions serve --env-file supabase/.env.local

# Lancer le frontend (autre terminal)
cat > .env.local << 'EOF'
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
EOF
# (récupérer la clé dans la sortie de "supabase start")

bun dev
```

L'app tourne sur `http://localhost:5173`, frappe le Supabase local (`localhost:54321`). Quand tu fermes Docker, tout est nettoyé. Aucun risque pour la prod.

## Pièges spécifiques au repo (extraits de l'audit)

- **Désynchro orchestrateur** : `generate-deliverables/index.ts` référence encore `generate-plan-ovo` / `generate-ovo-plan` qui ont été remplacés par `generate-plan-financier`. À fixer dans la même PR que la migration vers `getActiveDeliverables`.
- **Multi-langue** : `injectGuardrails(prompt, country)` bascule la langue selon le pays (FR pour francophones, EN pour Ghana/Nigeria/Kenya/etc.). Le tone_block doit être compatible avec ce switching — actuellement il est en français mais `injectGuardrails` ajoute un guardrail "réponds en anglais si pays anglophone" qui prime en sortie.
- **`generate-plan-financier`** : 201 versions, le plus modifié, utilise `callAIWithCalculator` (boucle tool_use) avec un `buildSystemPrompt` dynamique. À traiter en dernier en Phase 3 avec extra prudence.
- **`organization_members.role` (CHECK TEXT)** ≠ **`user_roles.role` (enum app_role)** — 2 systèmes parallèles, mettre à jour les deux pour les nouveaux rôles banque.
- **`ALTER TYPE ADD VALUE`** ne marche pas dans une transaction Postgres → si tu utilises `supabase db push`, ça peut planter sur le bloc enums. Solution : appliquer ces ALTER séparément dans le SQL editor Supabase, puis le reste de la migration via CLI.
