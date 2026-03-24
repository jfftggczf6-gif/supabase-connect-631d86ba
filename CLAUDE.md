# ESONO BIS Studio

## Projet
Application SaaS d'analyse financière pour PME africaines francophones.
Stack : React + Vite + TypeScript (frontend), Supabase (backend + edge functions), Railway (Python/Excel).

## Architecture

### Supabase (projet externe : gszwotgppuinpfnyrjnu)
- URL : https://gszwotgppuinpfnyrjnu.supabase.co
- 23 tables PostgreSQL avec RLS
- ~33 Edge Functions (Deno) dans `supabase/functions/`
- Fichiers partagés dans `supabase/functions/_shared/`
- 7 buckets Storage

### Railway (serveur Python)
- URL : https://esono-parser-production-8f89.up.railway.app
- Repo : https://github.com/jfftggczf6-gif/esono-railway.git
- Rôle : parsing de documents + remplissage Excel OVO

### Frontend (Lovable)
- React + Vite + Tailwind + shadcn/ui + recharts
- Client Supabase dans `src/integrations/supabase/client.ts`
- Dashboard coach dans `src/components/dashboard/EntrepreneurDashboard.tsx`
- Viewers pour chaque deliverable dans `src/components/dashboard/`

## Fichiers clés

### Edge Functions _shared
- `helpers_v5.ts` — corsHeaders, callAI, verifyAndGetContext, saveDeliverable, getFiscalParams
- `financial-knowledge.ts` — benchmarks sectoriels, guardrails
- `normalizers.ts` — normalisation des données IA
- `financial-compute.ts` — calculs déterministes (ratios, projections, VAN/TRI)
- `financial-calculator-tools.ts` — 5 outils tool_use pour calculatrice IA
- `ai-with-tools.ts` — boucle tool_use (IA ↔ calculatrice)

### Pipeline de génération
Le pipeline génère séquentiellement : pre-screening → BMC → SIC → inputs → plan_financier → business_plan → ODD → valuation → onepager → investment_memo → screening_report.
Config dans `src/lib/dashboard-config.ts` (PIPELINE, MODULE_CONFIG).

### Plan Financier (NOUVEAU)
`generate-plan-financier` remplace 3 anciennes étapes (framework + plan_ovo + ovo_plan).
1 appel IA avec tool_use → calculs déterministes → 1 objet JSON → viewer 7 onglets + Excel.

## Conventions
- Edge functions : Deno, imports depuis _shared via `../_shared/xxx.ts`
- Types Supabase : `src/integrations/supabase/types.ts` (auto-généré)
- Devise : FCFA par défaut, configurable par pays
- Enums : deliverable_type, module_code, app_role (dans PostgreSQL)

## Secrets requis
- ANTHROPIC_API_KEY — clé API Claude (pour l'IA)
- RAILWAY_URL — URL du serveur Python
- PARSER_API_KEY — clé d'authentification Railway

## Commandes utiles
```bash
# Déployer une edge function
npx supabase functions deploy generate-plan-financier --no-verify-jwt

# Déployer toutes les edge functions
for fn in $(ls -d supabase/functions/*/ | xargs -n1 basename | grep -v _shared); do
  npx supabase functions deploy "$fn" --no-verify-jwt
done

# Voir les logs
npx supabase functions logs generate-plan-financier

# Lister les fonctions
npx supabase functions list
```
