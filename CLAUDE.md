# ESONO BIS Studio — CLAUDE.md
# Branche : main · Environnement : PRODUCTION

## Environnement
- **Supabase** : gszwotgppuinpfnyrjnu (eu-west-1)
- **Front** : esono.tech (Lovable)
- **Branche Git** : main
- **⚠ PRODUCTION** — ne jamais déployer sans review complète

## Contexte projet
SaaS B2B multi-tenant francophone Africa.
Clients : fonds PE (Adiwale, Comoé, I&P, Joliba), opérateurs programmes (Enabel, GIZ, AFD), banques d'affaires.
Stack : React / Vite / TypeScript / Tailwind / Supabase Edge Functions (Deno).

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

## Tables principales (prod)

### Core
| Table | Rows | Rôle |
|-------|------|------|
| organizations | 4 | Orgs clientes (Enabel, GIZ, KPMG + 1). Types : programme, pe, mixed, banque_affaires |
| organization_members | — | Membres par org avec rôle et is_active |
| organization_presets | 3 | Config par org (Programme, PE, Advisory) |
| profiles | — | Profils utilisateurs auth |

### Entreprises & deals
| Table | Rôle |
|-------|------|
| enterprises | Sociétés analysées |
| pe_deals | Pipeline PE (stages : sourcing→pre_screening→analyse→note_ic1→dd→note_ic_finale→closing→portfolio→lost) |
| pe_deal_documents | Documents uploadés par deal |

### Livrables & IA
| Table | Rôle |
|-------|------|
| deliverables | Livrables générés (pre_screening, valuation, onepager, investment_memo, etc.) |
| deliverable_versions | Historique versions |
| deliverable_corrections | Corrections manuelles |
| ai_cost_log | Trace **obligatoire** de chaque appel LLM |
| ai_jobs | Queue jobs asynchrones |

### Memo PE
| Table | Rôle |
|-------|------|
| investment_memos | 1 par deal |
| memo_versions | Versions (IC1, post-DD, IC finale) |
| memo_sections | 12 sections par version |
| memo_section_validations | Historique review |

### Knowledge Base
| Table | Rôle |
|-------|------|
| knowledge_base | KB globale avec embeddings |
| knowledge_chunks | Chunks RAG |
| knowledge_benchmarks | Benchmarks sectoriels UEMOA |
| knowledge_risk_params | Paramètres risque pays |
| knowledge_country_data | Données macro pays |

### Matching
| Table | Rôle |
|-------|------|
| funding_programs | Programmes de financement disponibles |
| funding_matches | Matching enterprise ↔ funding avec score |

---

## Edge Functions déployées (prod)

| Fonction | Rôle |
|----------|------|
| generate-pre-screening | Pre-screening 360° (getKnowledgeForAgent + double red flag) |
| generate-investment-memo | Investment Memo IC1 (pipeline parallèle) |
| generate-valuation | Valorisation DCF + multiples + ANCC |
| generate-onepager | One-pager anonymisé |
| generate-screening-report | Rapport screening programme |

---

## Enums

```typescript
type PeDealStage = 'sourcing' | 'pre_screening' | 'analyse' | 'note_ic1' | 
                   'dd' | 'note_ic_finale' | 'closing' | 'portfolio' | 'lost'

type OrgRole = 'owner' | 'admin' | 'manager' | 'analyst' | 'coach' | 
               'entrepreneur' | 'partner' | 'managing_director' | 'investment_manager'

type MemoSectionCode = 'executive_summary' | 'shareholding_governance' | 
                       'top_management' | 'services' | 'competition_market' |
                       'unit_economics' | 'financials_pnl' | 'financials_balance' |
                       'investment_thesis' | 'support_requested' | 'esg_risks' | 'annexes'

type PeDealSource = 'reseau_pe' | 'inbound' | 'dfi' | 'banque' | 'mandat_ba' | 'conference' | 'autre'
```

---

## Sécurité

⚠ **CRITIQUE :**
- `user_roles` a RLS désactivé → ne pas toucher sans instruction explicite
- 151 RLS policies en prod → ne pas modifier sans discussion
- Ne jamais écrire de requête sans filtre `organization_id`

---

## Règles de développement

### Ne jamais toucher sans instruction explicite
- `supabase/migrations/` → aucune migration sans discussion
- `src/types/` → ne pas modifier les types existants, seulement ajouter
- `user_roles` table
- Edge Functions existantes (si la session vise une autre feature)

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

## Commande /session

Usage : `/session [feature] [url-brief] [url-wireframe] [ecran]`

ÉTAPE 0 — CONTRAT TYPESCRIPT
Génère `src/types/[feature].ts` depuis le wireframe.
→ Montre le fichier. Attends validation.

ÉTAPE 1 — BACK
Crée l'Edge Function dans `supabase/functions/[feature]/`
Contraintes : RLS · organization_id · erreurs · ai_cost_log si LLM
NE PAS TOUCHER : src/components/ src/pages/ src/hooks/
Teste avec curl. → Attends validation.

ÉTAPE 2 — FRONT
Crée le composant dans `src/components/[feature]/`
Conforme au wireframe. Fixtures si back pas prêt.
NE PAS TOUCHER : supabase/functions/ src/types/
→ Attends validation.

ÉTAPE 3 — INTÉGRATION
Remplace fixtures par appel réel.
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
6. Conventions de nommage respectées (kebab-case Edge Fns, PascalCase composants, etc.) ?
7. Critères du brief Basecamp passent ?

Rapport : ✅ passe / ❌ bloque / ⚠️ surveiller

---

## Règle de session
- Maximum 1 feature à la fois
- Valider chaque étape avant la suivante
- Toujours lire `src/types/[feature].ts` avant de coder

*Branche main · Production · Généré le 14/05/2026*
