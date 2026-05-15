# ESONO BIS Studio — CLAUDE.md
# Branche : pe-demo · Environnement : STAGING

## Environnement
- **Supabase** : flgxbwmxwdfzeuufcxti (staging-pe-demo)
- **Front** : Vercel preview URL (deploy manuel — `vercel deploy --yes`)
- **Branche Git** : pe-demo
- **STAGING** — OK pour expérimenter, mais ne jamais casser les données PE existantes (8 deals, 5 memos, 120 sections)

## Contexte projet
SaaS B2B multi-tenant francophone Africa.
Clients : fonds PE (Adiwale, Comoé, I&P, Joliba), opérateurs programmes (Enabel, GIZ, AFD, KPMG), banques d'affaires.
Stack : React / Vite / TypeScript / Tailwind / Supabase Edge Functions (Deno).

**Cette branche pe-demo contient TOUT le code applicatif :**
- ✅ Module **Programme** (origine main : pre-screening, BMC, plan financier, business plan, ODD, etc.)
- ✅ Module **PE** (pipeline d'investissement complet : sourcing → portfolio)
- 🔜 Module **BA** (Banque d'Affaires) — à construire (tables existent, code à venir)

---

## Architecture multi-tenant — règle absolue

Chaque table a une colonne `organization_id uuid`.

**Toute requête et toute Edge Function DOIT :**
1. Récupérer `organization_id` depuis le JWT
2. Filtrer toutes les requêtes par `organization_id`
3. Ne jamais retourner de données cross-tenant

```typescript
const { data: { user } } = await supabase.auth.getUser()
const { data: member } = await supabase
  .from('organization_members')
  .select('organization_id, role')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .single()
const organization_id = member.organization_id
```

---

## Tables — schéma staging

### Core multi-tenant
| Table | Rôle |
|-------|------|
| organizations | Orgs clientes. Types : `programme`, `pe`, `mixed`, `banque_affaires` |
| organization_members | Membres par org avec rôle + is_active |
| organization_presets | Config par org (Programme, PE, Advisory) |
| profiles | Profils utilisateurs auth |
| user_roles | ⚠ RLS désactivé — ne pas toucher sans instruction |

### Programme — entreprises & livrables (depuis main)
| Table | Rôle |
|-------|------|
| enterprises | Sociétés analysées (utilisé par Programme ET PE) |
| enterprise_modules | Pipeline Programme (bmc, sic, inputs, framework, diagnostic, plan_financier, business_plan, odd, valuation, onepager, investment_memo) |
| candidatures | Candidatures à un programme (status : received → in_review → pre_selected → selected → rejected) |
| programmes | Programmes d'accompagnement (cohortes, dates, critères) |
| programme_criteria | Critères d'éligibilité programme |
| programme_kpis | KPIs personnalisés par programme |
| coaching_notes | Notes du coach (livrable post-screening) |
| coach_uploads | Documents uploadés par le coach pour une entreprise |

### Programme — livrables IA
| Table | Rôle |
|-------|------|
| deliverables | Livrables générés (pre_screening, bmc_analysis, sic_analysis, framework_data, diagnostic_data, plan_financier, plan_ovo, business_plan, odd_analysis, valuation, onepager, investment_memo, screening_report) |
| deliverable_versions | Historique versions par livrable |
| deliverable_corrections | Corrections manuelles (édition par section) |

### PE — entreprises & deals
| Table | Rows | Rôle |
|-------|------|------|
| pe_deals | 8 | Pipeline PE (stages : sourcing → pre_screening → analyse → note_ic1 → dd → note_ic_finale → closing → portfolio → lost) |
| pe_deal_documents | 12 | Documents uploadés par deal |
| pe_deal_history | 21 | Historique transitions de stage |
| pe_deal_notes | — | Notes contextuelles par deal |
| pe_team_assignments | 4 | Assignation équipe par deal (lead_analyst, lead_im) |

### PE — Memo (living document)
| Table | Rows | Rôle |
|-------|------|------|
| investment_memos | 5 | 1 memo par deal |
| memo_versions | 11 | Versions (IC1, post-DD, IC finale) |
| memo_sections | 120 | 12 sections × versions × deals |
| memo_section_validations | — | Workflow review (analyst → IM → MD) |

### PE — Valorisation
| Table | Rows | Rôle |
|-------|------|------|
| pe_valuation | 5 | DCF + multiples + ANCC par deal |
| pe_periodic_valuations | 1 | NAV périodique (monitoring) |
| pe_score_history | 2 | Historique scoring 6 dimensions |

### PE — Due diligence
| Table | Rows | Rôle |
|-------|------|------|
| pe_dd_checklist | 25 | Items DD (pending → verified/red_flag/na) |
| pe_dd_findings | 20 | Findings DD (confirmation, adjustment, red_flag, informative) |

### PE — Comité & closing
| Table | Rows | Rôle |
|-------|------|------|
| pe_ic_decisions | 5 | Décisions IC1 et IC finale |
| pe_term_sheets | 1 | Term sheet signé |
| pe_disbursement_tranches | 2 | Tranches décaissement avec conditions |

### PE — Post-investissement
| Table | Rows | Rôle |
|-------|------|------|
| pe_quarterly_reports | 1 | Rapports trimestriels PnL/bilan/KPI |
| pe_action_plans | 6 | Plan 100 jours post-closing |
| pe_alert_signals | 3 | Signaux d'alerte automatiques |
| pe_lp_reports | — | Reporting LP |
| pe_exit_dossiers | 1 | Dossier de sortie |

### BA (en construction)
| Table | Rôle |
|-------|------|
| bank_teams | Équipes BA |
| bank_team_members | Membres par équipe BA |
| credit_dossiers | Dossiers crédit (futur) |

**Note :** les deals BA réutiliseront `pe_deals` avec `source = 'mandat_ba'` (pas de table séparée).

### IA — jobs & coûts (partagé Programme + PE)
| Table | Rôle |
|-------|------|
| ai_jobs | Queue jobs asynchrones (dispatch vers Railway worker) |
| ai_cost_log | **Trace obligatoire** de chaque appel LLM (input/output tokens, coût USD, durée) |

### Knowledge Base (partagé)
| Table | Rôle |
|-------|------|
| knowledge_base | KB globale avec embeddings Voyage 1024d |
| knowledge_chunks | Chunks RAG (Phase 2, org-scopable via filter_organization_id) |
| knowledge_benchmarks | Benchmarks sectoriels UEMOA |
| knowledge_risk_params | Paramètres risque pays |
| knowledge_country_data | Données macro pays |
| knowledge_pending_review | File de validation humaine (auto-enrich-knowledge) |
| knowledge_enrichment_log | Historique runs d'enrichissement KB |
| organization_knowledge | Docs privés par org (Phase 2 RAG, org-scoped) |

### Matching (à activer)
| Table | Rôle |
|-------|------|
| funding_programs | Programmes financement |
| funding_matches | Matching enterprise ↔ funding avec score |

### Data room
| Table | Rôle |
|-------|------|
| data_room_documents | Documents data room |
| data_room_shares | Partages data room (pour handoff BA → PE) |

---

## Enums

### Stages
```typescript
// Programme
type CandidatureStatus = 'received' | 'in_review' | 'pre_selected' | 'selected' | 'rejected'

// PE
type PeDealStage = 'sourcing' | 'pre_screening' | 'analyse' | 'note_ic1' |
                   'dd' | 'note_ic_finale' | 'closing' | 'portfolio' | 'lost'

// BA (à implémenter)
type BaMandatStage = 'recus' | 'im' | 'interets' | 'nego' | 'close'
```

### Rôles
```typescript
type OrgRole = 'owner' | 'admin' | 'manager' | 'analyst' | 'coach' |
               'entrepreneur' | 'partner' | 'managing_director' | 'investment_manager'

// Mapping rôles BA spécifiques
// partner = Partner BA (K. Cissé)
// managing_director = Senior (S. Diop)
// analyst = Analyste (F. Bamba, M. Koné)
```

### Sections memo PE
```typescript
type MemoSectionCode = 'executive_summary' | 'shareholding_governance' |
                       'top_management' | 'services' | 'competition_market' |
                       'unit_economics' | 'financials_pnl' | 'financials_balance' |
                       'investment_thesis' | 'support_requested' | 'esg_risks' | 'annexes'

type SectionStatus = 'empty' | 'draft' | 'submitted' | 'correction' | 'validated'
```

### Sources deal PE
```typescript
type PeDealSource = 'reseau_pe' | 'inbound' | 'dfi' | 'banque' | 'mandat_ba' | 'conference' | 'autre'
```

### Livrables Programme
```typescript
type ProgrammeDeliverableType =
  'pre_screening' | 'bmc_analysis' | 'sic_analysis' | 'inputs_data' |
  'framework_data' | 'diagnostic_data' | 'plan_financier' | 'plan_ovo' |
  'business_plan' | 'odd_analysis' | 'valuation' | 'onepager' |
  'investment_memo' | 'screening_report'
```

---

## Edge Functions (staging)

### Programme — pipeline génération
| Fonction | Rôle |
|----------|------|
| generate-pre-screening | Pre-screening 360° (RAG via getKnowledgeForAgent + double red flag) |
| generate-bmc | Business Model Canvas |
| generate-sic | Social Impact Canvas |
| generate-inputs | Inputs financiers structurés |
| generate-framework | Framework analyse financière |
| generate-diagnostic | Diagnostic expert |
| generate-plan-financier | Plan financier 7 onglets + Excel (tool_use IA + calculs déterministes) |
| generate-business-plan | Business plan narratif |
| generate-odd | ODD (objectifs développement durable) |
| generate-valuation | Valorisation DCF + multiples + ANCC |
| generate-onepager | One-pager anonymisé |
| generate-investment-memo | Investment memo Programme |
| generate-screening-report | Rapport screening programme |

### Candidature & sélection
| Fonction | Rôle |
|----------|------|
| submit-candidature | Soumission candidature + auto-screen (legacy schema) |
| screen-candidatures | Re-screening batch (legacy schema) |
| update-candidature | Move stage + createEnterpriseFromCandidature (auto-mapping contact, storage.copy idempotent) |

### PE — pipeline
| Fonction | Rôle |
|----------|------|
| create-pe-deal | Création deal PE |
| update-pe-deal-stage | Transition stage avec règles métier |
| assign-pe-team | Assignation équipe deal |

### Knowledge base
| Fonction | Rôle |
|----------|------|
| ingest-knowledge | Ingestion docs KB (auto-trigger chunking + embeddings) |
| rag-ingest | Chunking + embeddings Voyage 1024d |
| rag-search | Recherche vectorielle knowledge_chunks |
| generate-embeddings | Embedding `knowledge_base.embedding` (Voyage voyage-3 1024d) |
| auto-enrich-knowledge | Dispatch Railway worker pour enrichissement KB |

### Render & export
| Fonction | Rôle |
|----------|------|
| render-document | Proxy esono-render (Word/PPT/Excel/PDF) |
| generate-memo-pptx | Generation PPT PE (utilise slide_payload) |
| generate-pe-slide-payload | Génère JSON slide_payload pour le builder PPT |
| download-deliverable | Download HTML/XLSX livrable (avec check n-to-n permissions) |
| regenerate-excel-odd | Excel ODD |
| regenerate-excel-ovo | Excel OVO (plan financier) |

### Pattern obligatoire Edge Functions

```typescript
// 1. Auth + isolation org via helpers_v5
import { verifyAndGetContext } from "../_shared/helpers_v5.ts";
const ctx = await verifyAndGetContext(req);
// → ctx.user, ctx.enterprise, ctx.organization_id, ctx.supabase
// Le helper check : owner | legacy coach_id | n-to-n enterprise_coaches | org member | super_admin

// 2. Logger coût LLM (obligatoire)
await ctx.supabase.from('ai_cost_log').insert({
  enterprise_id: ctx.enterprise_id,
  organization_id: ctx.organization_id,
  function_name: 'nom-de-la-fonction',
  model: 'claude-sonnet-4-6',
  input_tokens, output_tokens, cost_usd, duration_ms
})
```

---

## Workers Railway

| Service | URL | Rôle |
|---------|-----|------|
| esono-parser-production-8f89 | esono-parser-production-8f89.up.railway.app | Parsing PDF/Word + génération Excel (OVO, ODD) |
| esono-ai-worker (staging) | esono-ai-worker-production.up.railway.app | Agents IA long-running (PE pipeline, auto-enrich-knowledge) — pointe sur staging Supabase |
| esono-render-svc | esono-render-svc-production.up.railway.app | Builder programmatique Word/PPT (DocxTemplater + memo-pptx) |

**Auto-deploy Railway KO :** après chaque push GitHub, faire manuellement :
```bash
cd ~/esono-ai-worker
railway link --project esono-ai-worker --environment production
railway up --detach
```

---

## Sécurité

⚠ **CRITIQUE :**
- `user_roles` a RLS désactivé → ne pas toucher sans instruction explicite
- Ne jamais écrire de requête sans filtre `organization_id`
- Staging OK pour expérimenter mais ne pas casser les données PE existantes (8 deals, 5 memos, 120 sections)
- Penser au check 4-way (owner / legacy coach_id / n-to-n enterprise_coaches / org member) pour toute action sur une `enterprise`

---

## Règles de développement

### Ne jamais toucher sans instruction explicite
- `supabase/migrations/` → aucune migration sans discussion
- `src/types/` → ne pas modifier les types existants, seulement ajouter
- `user_roles` table
- Edge Functions Programme existantes (si la session vise une feature PE/BA)
- Edge Functions PE existantes (si la session vise une feature Programme/BA)
- Données PE existantes (8 deals, 5 memos, 120 sections)

### Conventions
- Edge Functions : kebab-case → `generate-teaser-ba`
- Tables : snake_case → `pe_deal_documents`
- Composants React : PascalCase → `TeaserGenerator`
- Hooks : camelCase → `useGenerateTeaser`
- Types : PascalCase → `TeaserInput`, `TeaserOutput`
- Fichiers types : `src/types/[feature].ts`

### Structure
```
src/
  components/[feature]/    ← composants React
  hooks/use[Feature].ts    ← hooks
  types/[feature].ts       ← contrats TypeScript
supabase/
  functions/[feature]/     ← Edge Functions
    index.ts
```

---

## Modules actifs

### Module Programme (en prod via main, présent dans pe-demo)
- Pipeline complet candidature → screening → sélection → coaching
- 14 livrables IA (BMC, SIC, plan financier, business plan, ODD, etc.)
- Knowledge base + RAG Voyage 1024d (search_knowledge + search_knowledge_chunks)
- Auto-enrichissement KB hebdo (Railway worker)
- Admin tools : invitation entrepreneur, candidature recovery, knowledge review

### Module PE (en cours)
- Pipeline complet : sourcing → closing → portfolio
- 8 deals de test avec données réelles
- 5 memos avec 120 sections (living document)
- DD checklist et findings fonctionnels
- Post-investissement : quarterly reports, action plans, alert signals
- Export Word/PPT (esono-render programmatique)
- Séparation rôles MD / IM / Analyste

### Module BA (à construire)
- Tables `bank_teams` / `bank_team_members` existent (vides)
- Stages BA : recus → im → interets → nego → close
- Source deal : `mandat_ba` (réutilise `pe_deals`)
- Process Map et Feature Map validés (12 features)
- Wireframe BA existant
- Ordre de build : pipeline_mandats → upload → pre-screening → IM → valuation → teaser → matching → tracking
- 4 features réutilisent du code PE (benchmarks, pre-screening, valuation, fund_matching)

---

## Commande /session

Usage : `/session [feature] [url-brief] [url-wireframe] [ecran]`

ÉTAPE 0 — CONTRAT TYPESCRIPT
Génère `src/types/[feature].ts` depuis le wireframe.
Input = ce que l'utilisateur soumet.
Output = ce que la feature retourne.
Vérifie les types existants dans `src/types/`.
→ Montre le fichier. Attends validation.

ÉTAPE 1 — BACK
Crée l'Edge Function dans `supabase/functions/[feature]/`
Contraintes : RLS · `organization_id` · gestion d'erreur · `ai_cost_log` si appel LLM
NE PAS TOUCHER : `src/components/`, `src/pages/`, `src/hooks/`
Teste avec curl. → Attends validation.

ÉTAPE 2 — FRONT
Crée le composant dans `src/components/[feature]/`.
Conforme au wireframe. Fixtures si back pas prêt.
NE PAS TOUCHER : `supabase/functions/`, `src/types/`
→ Attends validation.

ÉTAPE 3 — INTÉGRATION
Remplace fixtures par appel réel.
Vérifie conformité avec `src/types/[feature].ts`.
Corrige uniquement la couche d'appel si ça casse.
→ Attends validation.

---

## Commande /review

Usage : `/review [feature]`

Vérifie :
1. Input/Output conformes à `src/types/[feature].ts` ?
2. Toutes les requêtes filtrées par `organization_id` ?
3. RLS respectée ?
4. Gestion d'erreur si données incomplètes ?
5. `ai_cost_log` renseigné si appel LLM ?
6. Conventions de nommage respectées (kebab-case Edge Fns, PascalCase composants) ?
7. Aucun fichier Programme ou PE existant modifié hors scope ?
8. Données PE existantes non impactées (8 deals, 120 sections) ?
9. Critères du brief Basecamp passent ?

Rapport : ✅ passe / ❌ bloque / ⚠️ surveiller

---

## Règle de session
- Maximum 1 feature à la fois
- Valider chaque étape avant la suivante
- Toujours lire `src/types/[feature].ts` avant de coder
- Ne pas casser les données PE existantes
- Tester en local avant push, deploy manuel Vercel après push

*Branche pe-demo · Staging · Couvre Programme + PE + BA (en construction) · Maj 14/05/2026*
