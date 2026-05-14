# ESONO BIS Studio — CLAUDE.md
# Branche : pe-demo · Environnement : STAGING

## Environnement
- **Supabase** : flgxbwmxwdfzeuufcxti
- **Front** : Vercel preview URL
- **Branche Git** : pe-demo
- **STAGING** — environnement de test, OK pour expérimenter

## Contexte projet
SaaS B2B multi-tenant francophone Africa.
Stack : React / Vite / TypeScript / Tailwind / Supabase Edge Functions (Deno).
Cette branche contient le développement des modules **PE** et **BA** (Banque d'affaires).

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

## Tables — schéma complet staging

### Core multi-tenant
| Table | Rows | Rôle |
|-------|------|------|
| organizations | 1 | Org de test staging |
| organization_members | 7 | Membres avec rôles |
| profiles | 7 | Profils utilisateurs |

### Entreprises & deals PE
| Table | Rows | Rôle |
|-------|------|------|
| enterprises | 6 | Sociétés analysées |
| pe_deals | 8 | Pipeline PE complet avec données réelles |
| pe_deal_documents | 12 | Documents uploadés |
| pe_deal_history | 21 | Historique transitions de stage |
| pe_deal_notes | 0 | Notes contextuelles par deal |
| pe_team_assignments | 4 | Assignation équipe par deal |

### Memo PE (living document)
| Table | Rows | Rôle |
|-------|------|------|
| investment_memos | 5 | 5 memos actifs |
| memo_versions | 11 | Versions (IC1, post-DD, IC finale) |
| memo_sections | 120 | 12 sections × versions × deals |
| memo_section_validations | 0 | Workflow review |

### Valorisation
| Table | Rows | Rôle |
|-------|------|------|
| pe_valuation | 5 | DCF + multiples + ANCC par deal |
| pe_periodic_valuations | 1 | NAV périodique (monitoring) |
| pe_score_history | 2 | Historique scoring 6 dimensions |

### Due diligence
| Table | Rows | Rôle |
|-------|------|------|
| pe_dd_checklist | 25 | Items DD (pending→verified/red_flag/na) |
| pe_dd_findings | 20 | Findings DD (confirmation, adjustment, red_flag, informative) |

### Comité & closing
| Table | Rows | Rôle |
|-------|------|------|
| pe_ic_decisions | 5 | Décisions IC1 et IC finale |
| pe_term_sheets | 1 | Term sheet signé |
| pe_disbursement_tranches | 2 | Tranches décaissement avec conditions |

### Post-investissement
| Table | Rows | Rôle |
|-------|------|------|
| pe_quarterly_reports | 1 | Rapports trimestriels PnL/bilan/KPI |
| pe_action_plans | 6 | Plan 100 jours post-closing |
| pe_alert_signals | 3 | Signaux d'alerte automatiques |
| pe_lp_reports | 0 | Reporting LP |
| pe_exit_dossiers | 1 | Dossier de sortie |

### Banque d'affaires (en construction)
| Table | Rows | Rôle |
|-------|------|------|
| bank_teams | 0 | Équipes BA |
| bank_team_members | 0 | Membres par équipe BA |
| credit_dossiers | 0 | Dossiers crédit (futur) |

### Livrables & IA
| Table | Rows | Rôle |
|-------|------|------|
| deliverables | 0 | Livrables générés |
| deliverable_versions | 0 | Historique versions |
| deliverable_corrections | 0 | Corrections manuelles |
| ai_cost_log | 0 | **Log obligatoire** appels LLM |
| ai_jobs | 34 | Queue jobs (34 exécutés) |

### Knowledge base
| Table | Rows | Rôle |
|-------|------|------|
| knowledge_base | 37 | KB avec embeddings (37 entrées) |
| knowledge_chunks | 14 | Chunks RAG |
| knowledge_benchmarks | 0 | Benchmarks sectoriels (à remplir) |
| knowledge_risk_params | 0 | Paramètres risque pays |

### Matching
| Table | Rows | Rôle |
|-------|------|------|
| funding_programs | 0 | Programmes financement |
| funding_matches | 0 | Matching enterprise ↔ funding |

### Data room
| Table | Rows | Rôle |
|-------|------|------|
| data_room_documents | 0 | Documents data room |
| data_room_shares | 0 | Partages data room (pour handoff BA→PE) |

---

## PE Deal Stages

```typescript
type PeDealStage = 'sourcing' | 'pre_screening' | 'analyse' | 'note_ic1' | 
                   'dd' | 'note_ic_finale' | 'closing' | 'portfolio' | 'lost'
```

## BA Mandat Stages (à implémenter)

```typescript
type BaMandatStage = 'recus' | 'im' | 'interets' | 'nego' | 'close'
```

## Rôles organisation

```typescript
type OrgRole = 'owner' | 'admin' | 'manager' | 'analyst' | 'coach' | 
               'entrepreneur' | 'partner' | 'managing_director' | 'investment_manager'

// Rôles BA spécifiques (mapping)
// partner = Partner BA (K. Cissé)
// managing_director = Senior (S. Diop)  
// analyst = Analyste (F. Bamba, M. Koné)
```

## Sections memo

```typescript
type MemoSectionCode = 'executive_summary' | 'shareholding_governance' | 
                       'top_management' | 'services' | 'competition_market' |
                       'unit_economics' | 'financials_pnl' | 'financials_balance' |
                       'investment_thesis' | 'support_requested' | 'esg_risks' | 'annexes'

// Statuts section
type SectionStatus = 'empty' | 'draft' | 'submitted' | 'correction' | 'validated'
```

## Sources deal

```typescript
type PeDealSource = 'reseau_pe' | 'inbound' | 'dfi' | 'banque' | 'mandat_ba' | 'conference' | 'autre'
```

---

## Edge Functions déployées (staging)

| Fonction | Rôle |
|----------|------|
| generate-pre-screening | Pre-screening 360° (getKnowledgeForAgent + double red flag) |
| generate-investment-memo | Investment Memo IC1 (pipeline parallèle) |
| generate-valuation | Valorisation DCF + multiples + ANCC |
| generate-onepager | One-pager (scope BA : anonymisation) |
| generate-screening-report | Rapport screening programme |

### Pattern obligatoire Edge Functions

```typescript
// 1. Auth
const authHeader = req.headers.get('Authorization')
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } }
})

// 2. Org isolation
const { data: { user } } = await supabase.auth.getUser()
const { data: member } = await supabase
  .from('organization_members')
  .select('organization_id, role')
  .eq('user_id', user.id)
  .single()

// 3. Logger coût LLM
await supabase.from('ai_cost_log').insert({
  enterprise_id,
  organization_id: member.organization_id,
  function_name: 'nom-de-la-fonction',
  model: 'claude-sonnet-4-20250514',
  input_tokens, output_tokens, cost_usd, duration_ms
})
```

---

## Sécurité

⚠ **CRITIQUE :**
- `user_roles` a RLS désactivé → ne pas toucher sans instruction explicite
- Ne jamais écrire de requête sans filtre `organization_id`
- Staging OK pour expérimenter mais ne pas casser les données PE existantes (8 deals, 120 sections)

---

## Règles de développement

### Ne jamais toucher sans instruction explicite
- `supabase/migrations/` → aucune migration sans discussion
- `src/types/` → ne pas modifier les types existants, seulement ajouter
- Edge Functions PE existantes (si la session vise une feature BA)
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

## Modules actifs sur cette branche

### Module PE (en cours)
- Pipeline complet : sourcing → closing → portfolio
- 8 deals de test avec données réelles
- 5 memos avec 120 sections
- DD checklist et findings fonctionnels
- Post-investissement : quarterly reports, action plans, alert signals

### Module BA (à construire)
- Tables `bank_teams` / `bank_team_members` existent (vides)
- Stages BA : recus → im → interets → nego → close
- Source deal : mandat_ba
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
Contraintes : RLS · organization_id · erreurs · ai_cost_log si LLM
NE PAS TOUCHER : src/components/ src/pages/ src/hooks/
Teste avec curl. → Attends validation.

ÉTAPE 2 — FRONT
Crée le composant dans `src/components/[feature]/`.
Conforme au wireframe. Fixtures si back pas prêt.
NE PAS TOUCHER : supabase/functions/ src/types/
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
6. Aucun fichier hors scope modifié ?
7. Données PE existantes non impactées ?
8. Critères du brief Basecamp passent ?

Rapport : ✅ passe / ❌ bloque / ⚠️ surveiller

---

## Règle de session
- Maximum 1 feature à la fois
- Valider chaque étape avant la suivante
- Toujours lire `src/types/[feature].ts` avant de coder
- Ne pas casser les données PE existantes

*Branche pe-demo · Staging · Généré le 14/05/2026*
