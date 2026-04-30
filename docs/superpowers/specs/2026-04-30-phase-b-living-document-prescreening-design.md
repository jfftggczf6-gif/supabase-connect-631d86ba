# Phase B' — Living document + Pre-screening 360° intégré (PE)

**Branche** : `pe-demo`
**Date** : 2026-04-30
**Auteur** : Philippe + Claude
**Phase précédente** : Phase A — Foundation PE (rôles MD/IM/Analyst, table `pe_deals`, RLS hiérarchique, kanban drag-drop)
**Phases suivantes** : C' (workspace analyste 3 colonnes), D' (DD), E' (Vue IM + Pipeline 7 colonnes consolidé), F' (Scoring 6 dim configurable), G' (Exports + Reporting LP)

---

## 1. Objectif

Brancher la génération auto du **pre-screening 360° PE** sur le drag-drop de documents dans le kanban, et matérialiser le résultat dans une infrastructure **"living document"** versionnée à 12 sections fixes — qui sera réutilisée par toutes les phases suivantes (DD, IC1, IC final).

**Résultat utilisateur en fin de Phase B'** :
1. Un MD/IM/Analyst drop des documents sur une carte deal en `sourcing` → 60-90s plus tard, le deal est en `pre_screening` avec un score global et un dossier d'investissement v1 lisible (12 sections).
2. Un MD drag la carte de `pre_screening` → `note_ic1` → l'onglet "Memo IC1" devient cliquable avec les 12 sections clonées de v1 (placeholder pour Phase C' où l'analyste éditera section par section).
3. Vue kanban filtrée par rôle (analyste = ses deals, IM = son équipe, MD = pipeline complet 7 colonnes).

---

## 2. Hors scope (Phases ultérieures)

- ❌ Workspace analyste 3 colonnes (édition section par section avec régénération IA ciblée) → **Phase C'**
- ❌ Édition par section dans le memo + validation IM section par section → **Phase C'**
- ❌ Due diligence : upload rapports + extraction findings + diff section par section → **Phase D'**
- ❌ Scoring 6 dimensions configurable par fonds (Croissance, Thèse, Financier, ESG, Données, Gouvernance) → **Phase F'**
- ❌ Exports (PDF, PPTX, Excel) et Reporting LP → **Phase G'**

---

## 3. Décisions de design clés

| Décision | Choix retenu | Alternative écartée |
|---|---|---|
| Stockage du contenu des 12 sections | `memo_sections.content_json` (souple) | colonnes typées |
| Score global | **1 seul score** affiché (74/100) — pas de décomposition 6 dim visible | scoring 6 dim de Phase F' |
| Métadonnées (score + classification) | Colonnes typées sur `memo_versions` | tout en JSON |
| Régénération si docs ajoutés sur deal déjà screené | Dialog confirmation → crée v_n+1 (parent_version_id) | auto-régénérer en silence ou ignorer |
| Versionning par snapshot complet | Une `memo_versions` = 12 `memo_sections` | sections versionnées indépendamment |
| Réutilisation viewer programme | Atoms factorisés + 12 PE section renderers nouveaux | réutiliser PreScreeningViewer monolithique |
| Génération au drag stage `pre_screening` → `note_ic1` | Clone v1 sans IA enrichie (placeholder Phase C') | enrichissement IA à chaque transition |
| Polling vs Realtime pour status génération | Polling 3s (simplicité) | Supabase Realtime |

---

## 4. Architecture globale

```
┌──────────────────────────────────────────────────────────────────────┐
│  /pe/pipeline (Kanban 7 colonnes filtré par rôle)                    │
│  Sourcing · Pre-screening · Note IC1 · DD · Note IC final ·          │
│  Closing · Portfolio                                                 │
│                                                                      │
│  Cartes deal : drop docs ⬇ + drag pour changer stage                 │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          │ drop docs sur carte → upload Storage
                          │ + INSERT pe_deal_documents
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Logique frontend                                                    │
│  ─ Si stage='sourcing' ET 1er doc : auto-trigger generate-pre-       │
│      screening                                                       │
│  ─ Si stage>='pre_screening' ET version existe : ouvre dialog        │
│      "Régénérer ?" → si OUI, crée v_n+1                              │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Edge function generate-pre-screening (existante, branchée PE)       │
│  ─ buildToneForAgent(orgId) → TONE_PE + bloc thèse fonds             │
│  ─ Lit pe_deal_documents → parse via Railway → texte                 │
│  ─ Claude génère JSON 12 sections + score global + classification    │
│  ─ INSERT investment_memos (1 par deal, ON CONFLICT DO NOTHING)      │
│  ─ INSERT memo_versions (label='pre_screening_v1', status='ready')   │
│  ─ INSERT 12 memo_sections                                           │
│  ─ UPDATE pe_deals SET stage='pre_screening' (auto-move)             │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          │ MD ouvre la carte
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  /pe/deals/:id (page detail, onglets)                                │
│  Détails · Pré-screening · Memo IC1 · Memo IC final · DD ·           │
│  Documents · Historique                                              │
│                                                                      │
│  Onglet "Pré-screening" : <MemoSectionsViewer> rend 13 blocs visuels │
│  fidèles au mockup (sans bloc 6-dim ni pts sur red flags)            │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          │ MD drag carte "Pré-screening" → "Note IC1"
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Edge function generate-ic1-memo (NOUVEAU)                           │
│  ─ Lit dernière version pre_screening (v1 ou v2)                     │
│  ─ Crée memo_versions (label='note_ic1_v1', parent=last_pre_screen)  │
│  ─ CLONE 12 memo_sections (même content_md, content_json)            │
│  ─ status='ready' immédiatement (pas d'IA en Phase B')               │
│  ─ Onglet "Memo IC1" devient cliquable                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Schéma DB

### 5.1 Renommage stages (migration enum)

```sql
ALTER TYPE pe_deal_stage RENAME VALUE 'ic1' TO 'note_ic1';
ALTER TYPE pe_deal_stage RENAME VALUE 'ic_finale' TO 'note_ic_finale';
-- Migration des deals seed actuellement en 'analyse'
UPDATE pe_deals SET stage = 'pre_screening' WHERE stage = 'analyse';
-- 'analyse' reste dans l'enum mais n'est plus jamais utilisé.
```

**7 colonnes affichées en kanban** : `sourcing → pre_screening → note_ic1 → dd → note_ic_finale → closing → portfolio`
**État `lost`** : pas une colonne, badge rouge sur la carte (filtré par défaut, comme le `is_active` des members).

### 5.2 Table `pe_deal_documents`

```sql
CREATE TABLE pe_deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,            -- pe-deals/<org_id>/<deal_id>/<filename>
  mime_type TEXT,
  size_bytes BIGINT,
  category TEXT,                                 -- 'financial' | 'pitch' | 'legal' | 'other' (libre, pas un enum strict)
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON pe_deal_documents(deal_id);
CREATE INDEX ON pe_deal_documents(organization_id, created_at DESC);

ALTER TABLE pe_deal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_via_deal" ON pe_deal_documents FOR SELECT
  USING (can_see_pe_deal(deal_id));
CREATE POLICY "insert_if_can_see" ON pe_deal_documents FOR INSERT
  WITH CHECK (can_see_pe_deal(deal_id));
CREATE POLICY "delete_if_can_see" ON pe_deal_documents FOR DELETE
  USING (can_see_pe_deal(deal_id));
```

**Storage bucket `pe_deal_docs`** (privé) :
- Path pattern : `<org_id>/<deal_id>/<filename>`
- RLS Storage : SPLIT_PART(name, '/', 1) doit matcher une org où le user a un rôle PE valide

### 5.3 Tables living document

```sql
-- Enum pour les codes des 12 sections fixes
CREATE TYPE memo_section_code AS ENUM (
  'executive_summary',       -- 1. Résumé exécutif
  'shareholding_governance', -- 2. Actionnariat et gouvernance
  'top_management',          -- 3. Top management
  'services',                -- 4. Services
  'competition_market',      -- 5. Concurrence et marché
  'unit_economics',          -- 6. Units economics
  'financials_pnl',          -- 7. États financiers PnL
  'financials_balance',      -- 8. États financiers Bilan
  'investment_thesis',       -- 9. Thèse d'investissement
  'support_requested',       -- 10. Accompagnement demandé
  'esg_risks',               -- 11. ESG / Risques
  'annexes'                  -- 12. Annexes
);

CREATE TYPE memo_version_status AS ENUM (
  'generating', 'ready', 'validated', 'rejected'
);

-- 1 row par deal, conteneur immortel
CREATE TABLE investment_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES pe_deals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Snapshots versionnés. 1 par transition de stage IA.
CREATE TABLE memo_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID NOT NULL REFERENCES investment_memos(id) ON DELETE CASCADE,
  parent_version_id UUID REFERENCES memo_versions(id),     -- chaîne d'héritage v1 → v2 → v3
  label TEXT NOT NULL,                                     -- 'pre_screening_v1', 'note_ic1_v1', etc.
  stage pe_deal_stage NOT NULL,
  status memo_version_status NOT NULL DEFAULT 'generating',

  -- Métadonnées (1 score global + 1 classification, pas de scoring 6 dim en Phase B')
  overall_score NUMERIC,                                   -- ex: 74
  classification TEXT,                                     -- 'go_conditionnel' | 'hold' | 'reject'
  error_message TEXT,                                      -- rempli si status='rejected'

  generated_by_agent TEXT,                                 -- 'generate-pre-screening' | 'generate-ic1-memo' | 'manual'
  generated_by_user_id UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(memo_id, label)
);
CREATE INDEX ON memo_versions(memo_id, created_at DESC);
CREATE INDEX ON memo_versions(stage, status);

-- Le contenu riche par section (12 par version)
CREATE TABLE memo_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES memo_versions(id) ON DELETE CASCADE,
  section_code memo_section_code NOT NULL,
  title TEXT,
  content_md TEXT,                                         -- markdown rendu (search + édition libre future)
  content_json JSONB,                                      -- structuré (KPIs, tableaux, citations sources)
  source_doc_ids UUID[] DEFAULT '{}',                      -- pe_deal_documents qui ont alimenté cette section
  position INT NOT NULL,                                   -- 0..11
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(version_id, section_code)
);
CREATE INDEX ON memo_sections(version_id);

-- RLS : cascade via memo → deal
ALTER TABLE investment_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_via_deal" ON investment_memos FOR SELECT
  USING (can_see_pe_deal(deal_id));

ALTER TABLE memo_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_via_memo" ON memo_versions FOR SELECT
  USING (memo_id IN (SELECT id FROM investment_memos WHERE can_see_pe_deal(deal_id)));

ALTER TABLE memo_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see_via_version" ON memo_sections FOR SELECT
  USING (version_id IN (
    SELECT mv.id FROM memo_versions mv
    JOIN investment_memos im ON im.id = mv.memo_id
    WHERE can_see_pe_deal(im.deal_id)
  ));
```

INSERT/UPDATE sur `memo_versions` et `memo_sections` : **service_role uniquement** (via edge functions). Pas de policy INSERT/UPDATE pour les users — empêche la corruption manuelle du living document.

---

## 6. Flux complets

### 6.1 Cas A — 1ère génération (deal en `sourcing`)

```
Frontend (PeDealCard.tsx)
  1. supabase.storage.from('pe_deal_docs').upload(`${org_id}/${deal_id}/${file.name}`, file)
  2. INSERT pe_deal_documents (deal_id, storage_path, filename, ...)
  3. Check : deal.stage === 'sourcing' && first_doc → call generate-pre-screening({ deal_id })

Edge function generate-pre-screening
  4. INSERT investment_memos (deal_id) ON CONFLICT DO NOTHING
  5. INSERT memo_versions (memo_id, label='pre_screening_v1', stage='pre_screening',
       status='generating', generated_by_agent='generate-pre-screening')
  6. UPDATE pe_deals SET stage='pre_screening'  (auto-move colonne)
  7. SELECT * FROM pe_deal_documents WHERE deal_id = ?
  8. Lit chaque PDF/Excel via Railway parser → texte
  9. tone = await buildToneForAgent(supabase, organization_id, 'pre_screening')
       → TONE_PE + bloc thèse fonds (selon presets) + secteurs cibles
 10. claude.messages.create({ system: tone, messages: [...] })
 11. Parse JSON : { overall_score, classification, sections: [...12...], ... }
 12. INSERT 12 rows memo_sections (version_id, section_code, content_md, content_json,
       source_doc_ids, position)
 13. UPDATE memo_versions SET status='ready', overall_score=?, classification=?, generated_at=now()
 14. RETURN { memo_id, version_id, latency_ms }

Frontend (polling 3s sur memo_versions.status)
 15. Carte kanban : badge ⏳ → ✓ pre, score 74 affiché
 16. Toast : "Pré-screening AgroCi généré (74/100)"
 17. Si user clique sur carte → /pe/deals/:id → onglet "Pré-screening" load v1
```

**Durée perçue** : 30-90s selon taille des docs.

### 6.2 Cas B — Régénération (déjà v1 sur stage `pre_screening`)

```
Frontend
  1. Upload Storage + INSERT pe_deal_documents (idem Cas A)
  2. Check : memo_versions(memo_id, stage='pre_screening', status='ready') existe ?
       → YES : ouvre <RegenerateConfirmDialog>

  Si user clique "Régénérer" :
  3. INSERT memo_versions (memo_id, label='pre_screening_v2', parent_version_id=v1.id,
       stage='pre_screening', status='generating')
  4. → call generate-pre-screening (flow Cas A à partir de l'étape 7)
  5. v1 reste accessible dans onglet "Historique" du deal detail

  Si user clique "Garder l'actuel" :
  3'. Aucune action additionnelle (le doc est uploadé mais pas de nouvelle génération)
```

### 6.3 Cas C — Transition stage par drag (`pre_screening` → `note_ic1`)

```
Frontend (drag-drop kanban)
  1. UPDATE pe_deals SET stage='note_ic1' (via update-pe-deal-stage edge fn — Phase A)
  2. Check : memo_versions(memo_id, stage='note_ic1') existe ?
       → NO : call generate-ic1-memo({ deal_id })

Edge function generate-ic1-memo (NOUVEAU)
  3. SELECT * FROM memo_versions WHERE memo_id = ? AND stage='pre_screening'
       AND status='ready' ORDER BY created_at DESC LIMIT 1
  4. INSERT memo_versions (memo_id, label='note_ic1_v1', parent_version_id=last_pre_screening.id,
       stage='note_ic1', status='generating',
       overall_score=parent.overall_score, classification=parent.classification)
  5. Pour Phase B' minimal :
       INSERT 12 memo_sections clonées du parent (même content_md, content_json,
         source_doc_ids, position)
  6. UPDATE memo_versions SET status='ready', generated_by_agent='clone_from_pre_screening',
       generated_at=now()

Frontend
  7. Onglet "Memo IC1" devient cliquable, affiche les 12 sections clonées
  8. Toast : "Note IC1 initialisée (12 sections clonées du pré-screening)"
```

### 6.4 Mapping JSON Claude → 13 blocs visuels

```
Claude output (JSON)               →  Stockage DB                          →  Composant React
══════════════════════════════════════════════════════════════════════════════════════════════
overall_score: 74                  →  memo_versions.overall_score          →  <ScoreCircle>
classification: "go_conditionnel"  →  memo_versions.classification         →  <ClassificationTag>
deal_ref                           →  pe_deals.deal_ref                    →  <DealHeader>

context.activite                   →  section 'services'.content_md        →  <ContextGrid> (card 1)
context.actionnariat               →  section 'shareholding_governance'    →  <ContextGrid> (card 2)
context.management                 →  section 'top_management'             →  <ContextGrid> (card 3)

kpis_bandeau: [...]                →  'executive_summary'.content_json     →  <KPIBandeau>

snapshot_3y                        →  'financials_pnl'.content_json        →  <FinancialSnapshot>

use_of_proceeds                    →  'support_requested'.content_json     →  <ProceedsAndReturns>
scenarios_returns                  →  'investment_thesis'.content_json     →  <ScenariosBox>

thesis_match                       →  'investment_thesis'.content_json     →  <ThesisMatch>

red_flags                          →  'esg_risks'.content_json             →  <RedFlagsList>
                                       (sans "-X pts" — qualitatif uniquement)

(scoring_6dim Phase F', pas en B')

doc_quality                        →  'annexes'.content_json               →  <DocQualityGrid>

ai_synthesis                       →  'executive_summary'.content_md       →  <AISynthesis>

benchmark                          →  'competition_market'.content_json    →  <BenchmarkTable>

recommendation                     →  'investment_thesis'.content_json     →  <RecommendationCard>
                                       (verdict + conditions + deal_breakers)
```

---

## 7. UI design

### 7.1 Pipeline kanban filtré par rôle

```
ANALYSTE (S. Koné) — voit ses 4 deals assignés, kanban ciblé
┌─ Pre-screening ┐ ┌─ Note IC1 ┐ ┌─ DD ┐ ┌─ IC soumis ┐
└────────────────┘ └───────────┘ └─────┘ └────────────┘

IM (A. Diallo) — voit son équipe (S. Koné + A. Touré), 5 colonnes
┌─ Pre-screening ┐ ┌─ Note IC1 ┐ ┌─ IC1 ┐ ┌─ DD ┐ ┌─ IC finale ┐
└────────────────┘ └───────────┘ └──────┘ └─────┘ └────────────┘

MD (K. N'Guessan) — voit pipeline complet 7 colonnes
┌─Sourcing─┐┌─Pre-scr─┐┌─Note IC1─┐┌─DD─┐┌─Note IC fin.─┐┌─Closing─┐┌─Portfolio─┐
└──────────┘└─────────┘└──────────┘└────┘└──────────────┘└─────────┘└───────────┘
```

Le filtrage du kanban repose sur `can_see_pe_deal()` (Phase A) — pas de logique additionnelle frontend, juste les RLS qui filtrent les rows. Les colonnes affichées dépendent du rôle (côté React via `useCurrentRole()`).

### 7.2 Carte deal kanban

```
┌────────────────────┐
│ AgroCi              │  ← deal.name + deal_ref
│ 4.2M €              │  ← deal.ticket_amount
│ 📎 3   ✓ pre   74   │  ← doc count + version badge + score
└────────────────────┘
```

Badges :
- `📎 N` : nombre de `pe_deal_documents`
- `⏳` : génération en cours (`memo_versions.status='generating'`)
- `✓ pre` : version pre_screening_vN existante et `ready`
- `✓ ic1` : version note_ic1_vN existante et `ready`
- `74` : score global de la dernière version `ready`

### 7.3 Page detail `/pe/deals/:id` — onglets

| Onglet | Phase A | Phase B' | Phase C'+ |
|---|---|---|---|
| Détails | infos deal | inchangé | — |
| **Pré-screening** | placeholder | **`<MemoSectionsViewer versionLabel="pre_screening">`** | — |
| **Memo IC1** | placeholder | **`<MemoSectionsViewer versionLabel="note_ic1">` (clone v1)** | édition par section (C') |
| Memo IC final | placeholder | placeholder | E' |
| DD | placeholder | placeholder | D' |
| **Documents** | n'existe pas | **liste pe_deal_documents + upload + download** | — |
| **Historique** | placeholder | **timeline memo_versions + bouton "voir cette version"** | — |

### 7.4 Pre-screening 360° viewer — 13 blocs (mockup-driven)

Mappés depuis le mockup `PE_experience_complete_1.html`, **avec ajustements simplification** :

| Bloc | Contenu | Composant React | Source DB |
|---|---|---|---|
| Header | Tag classification + score 74 + nom deal + deal_ref + source | `<DealHeader>` | `memo_versions` + `pe_deals` |
| 1-3 | Activité / Actionnariat / Management clé (3 cards) | `<ContextGrid>` | sections `services`, `shareholding_governance`, `top_management` |
| 4 | Bandeau 5 KPIs (CA, EBITDA, Marge, Dette/EBITDA, Ticket) | `<KPIBandeau>` | section `executive_summary.content_json.kpis_bandeau` |
| 5 | Snapshot 3 ans (table financière avec EBITDA déclaré + retraité) | `<FinancialSnapshot>` | section `financials_pnl.content_json.snapshot_3y` |
| 6 | Use of proceeds + Scénarios retour (bear/base/bull) | `<ProceedsAndReturns>` | sections `support_requested` + `investment_thesis` |
| 7 | Adéquation thèse fonds (6 critères Match/Partiel) | `<ThesisMatch>` | section `investment_thesis.content_json.thesis_match` |
| 8 | Red flags SYSCOHADA (qualitatifs, **sans "-X pts"**) | `<RedFlagsList>` | section `esg_risks.content_json.red_flags` |
| ~~9~~ | ~~Scoring 6 dimensions~~ | **SUPPRIMÉ** | — |
| 10 | Qualité dossier documentaire (4 catégories N0-N2) | `<DocQualityGrid>` | section `annexes.content_json.doc_quality` |
| 11-12 | Synthèse IA + Benchmark sectoriel | `<AISynthesis>` + `<BenchmarkTable>` | sections `executive_summary` + `competition_market` |
| 13 | Recommandation analyste (verdict + 3 conditions + actions par rôle) | `<RecommendationCard>` | section `investment_thesis.content_json.recommendation` |

### 7.5 Atoms factorisés vs nouveaux atoms PE

**Refacto à effectuer** : extraire de `PreScreeningViewer` (programme) les atoms suivants vers `src/components/dashboard/viewers/atoms/` :
- `<KPIBandeau>` (existe déjà sous une autre forme)
- `<BenchmarkTable>` (existe déjà sous une autre forme)
- `<SourceDocsLine>`
- `<SectionEditButton>` (déjà séparé)

**Nouveaux atoms PE** (`src/components/dashboard/viewers/atoms/pe/`) — **7 composants** (au lieu de 8 après suppression `<DimensionBar>`) :

```
src/components/dashboard/viewers/atoms/pe/
├── ScoreCircle.tsx            (cercle score 74 vert/jaune/rouge selon valeur)
├── ClassificationTag.tsx      ("Go conditionnel" / "Hold" / "Reject" avec couleur)
├── FinancialTable.tsx         (table 3 ans avec rows EBITDA déclaré + retraité)
├── ScenariosBox.tsx           (Bear/Base/Bull avec MOIC + IRR)
├── MatchCriteriaList.tsx      (liste critères Match/Partiel/No-match)
├── RedFlagItem.tsx            (rouge/orange + détail, SANS pts)
├── DocCategoryCard.tsx        (carte avec niveau N0-N2 + checklist docs)
└── RoleActions.tsx            (boutons selon rôle current : analyste/IM/MD)
```

### 7.6 Section renderers PE (12 composants)

```
src/components/pe/sections/
├── ExecutiveSummarySection.tsx
├── ShareholdingGovernanceSection.tsx
├── TopManagementSection.tsx
├── ServicesSection.tsx
├── CompetitionMarketSection.tsx
├── UnitEconomicsSection.tsx
├── FinancialsPnlSection.tsx
├── FinancialsBalanceSection.tsx
├── InvestmentThesisSection.tsx
├── SupportRequestedSection.tsx
├── EsgRisksSection.tsx
└── AnnexesSection.tsx
```

Chaque section renderer ~50 LOC, compose des atoms et expose les données de `memo_sections.content_json` selon le mockup.

### 7.7 Orchestrateur `<MemoSectionsViewer>`

```typescript
// src/components/pe/MemoSectionsViewer.tsx (~80 LOC)
interface Props {
  dealId: string;
  versionLabel: 'pre_screening' | 'note_ic1' | 'note_ic_finale';
}

export default function MemoSectionsViewer({ dealId, versionLabel }: Props) {
  // 1. Load memo_versions where stage matches versionLabel, ORDER BY created_at DESC LIMIT 1
  // 2. Load 12 memo_sections of that version
  // 3. Render header (DealHeader avec score + classification)
  // 4. Render 13 blocs en dispatch via section_code
}
```

### 7.8 Palette de couleurs (CSS variables du mockup)

```css
:root {
  --tp: #1a1a2e;     /* texte primaire */
  --ts: #555;        /* texte secondaire */
  --tt: #999;        /* texte tertiaire (hints) */
  --tok: #27ae60;    /* succès / Match / score >= 70 */
  --tw: #e67e22;     /* warning / Partiel / score 40-69 */
  --td: #c0392b;     /* danger / red flag / score < 40 */
  --ti: #2e75b6;     /* info / IC1 / sélection */
  --tpu: #7F77DD;    /* purple / valuation fourchette retenue */
}
```

À ajouter au theme Tailwind ou via CSS custom properties dans `index.css`.

---

## 8. Edge functions

### 8.1 `generate-pre-screening` — modification

L'edge function existe déjà (active prod programme). On ajoute une branche conditionnelle :

```typescript
// supabase/functions/generate-pre-screening/index.ts
const segment = await detectSegment(supabase, organization_id);

if (segment === 'pe') {
  // Branche PE (Phase B')
  const memoId = await ensureInvestmentMemo(supabase, deal_id, user_id);
  const versionId = await createMemoVersion(supabase, {
    memo_id: memoId,
    label: 'pre_screening_v1',  // ou v2, v3 si parent existant
    parent_version_id: latestPreScreening?.id ?? null,
    stage: 'pre_screening',
    status: 'generating',
    generated_by_agent: 'generate-pre-screening',
  });
  await updatePeDealStage(supabase, deal_id, 'pre_screening');

  const docs = await fetchDealDocuments(supabase, deal_id);
  const tone = await buildToneForAgent(supabase, organization_id, 'pre_screening');
  const claudeJSON = await callClaude({ system: tone, prompt: buildPEPrompt(docs) });

  await insertMemoSections(supabase, versionId, claudeJSON.sections);
  await updateMemoVersion(supabase, versionId, {
    status: 'ready',
    overall_score: claudeJSON.overall_score,
    classification: claudeJSON.classification,
    generated_at: new Date().toISOString(),
  });
} else {
  // Branche programme existante (inchangée)
  await saveDeliverable('pre_screening', enterprise_id, claudeOutput);
}
```

→ **Aucun impact sur le programme** : la branche `else` reste à l'identique.

### 8.2 `generate-ic1-memo` — nouveau

```typescript
// supabase/functions/generate-ic1-memo/index.ts
serve(async (req) => {
  const { deal_id } = await req.json();

  const lastPreScreening = await getLatestVersion(supabase, deal_id, 'pre_screening', 'ready');
  if (!lastPreScreening) throw new Error('No ready pre_screening to clone from');

  const newVersionId = await createMemoVersion(supabase, {
    memo_id: lastPreScreening.memo_id,
    label: 'note_ic1_v1',
    parent_version_id: lastPreScreening.id,
    stage: 'note_ic1',
    status: 'generating',
    overall_score: lastPreScreening.overall_score,
    classification: lastPreScreening.classification,
    generated_by_agent: 'clone_from_pre_screening',
  });

  // Clone les 12 sections
  const sections = await fetchSections(supabase, lastPreScreening.id);
  await insertMemoSections(supabase, newVersionId, sections);

  await updateMemoVersion(supabase, newVersionId, {
    status: 'ready',
    generated_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ version_id: newVersionId }));
});
```

### 8.3 Helpers partagés `_shared/memo-helpers.ts` — nouveau

```typescript
export async function ensureInvestmentMemo(supabase, dealId, userId): Promise<string>;
export async function createMemoVersion(supabase, data): Promise<string>;
export async function updateMemoVersion(supabase, versionId, patch): Promise<void>;
export async function insertMemoSections(supabase, versionId, sections): Promise<void>;
export async function getLatestVersion(supabase, dealId, stage, status): Promise<MemoVersion | null>;
export async function fetchSections(supabase, versionId): Promise<MemoSection[]>;
export async function fetchDealDocuments(supabase, dealId): Promise<PeDealDocument[]>;
```

---

## 9. Error handling

| Cas | Symptôme | Réponse |
|---|---|---|
| Upload Storage échoue | `supabase.storage.upload()` throw | Toast erreur, pas d'INSERT, pas de génération, retry possible |
| Claude timeout/5xx/JSON parsing | Edge function exception | `UPDATE memo_versions SET status='rejected', error_message=...` ; `UPDATE pe_deals SET stage='sourcing'` (rollback auto-move) ; toast "Génération échouée. Réessayer ?" + bouton régénérer |
| Drag-drop kanban refusé par RLS | `update-pe-deal-stage` retourne 403 | Toast "Action non autorisée" ; rollback @dnd-kit (la carte revient à sa position) |
| Re-upload sur deal `lost` | User drop sur deal archivé | Drop-zone disabled UI ; toast "Réactiver le deal d'abord" ; menu contextuel "Réactiver" → stage='sourcing' |
| Polling status après refresh page | User refresh pendant génération | Polling reprend automatiquement (lookup memo_versions par deal_id), pas d'état perdu |

---

## 10. Testing

### 10.1 Tests automatisés (Vitest)

- `roles.ts` : `getInvitableRoles` pour MD/IM/Analyst (déjà couvert Phase A — étendre si besoin)
- Helpers RLS : déjà testés Phase A
- `_shared/memo-helpers.ts` : tests unitaires sur `insertMemoSections` (asserter qu'on a bien 12 rows distinctes), `getLatestVersion` (filtre stage + status correct)
- Edge function `generate-ic1-memo` : mocker la lecture des sections parent, asserter clone fidèle

### 10.2 Tests d'intégration manuels — checklist

1. ☐ Login Analyst → drop pitch.pdf sur deal "AgroCi" en sourcing → carte passe en pre_screening dans 60-90s avec score affiché
2. ☐ Click sur la carte → onglet Pré-screening → 13 blocs visuels rendus correctement
3. ☐ Re-drop financials.xlsx sur AgroCi → dialog "Régénérer ?" → confirmer → version v2 créée, v1 visible dans Historique
4. ☐ Login MD → drag AgroCi de pre_screening vers note_ic1 → onglet "Memo IC1" devient cliquable, 12 sections clonées
5. ☐ Login IM (manager d'Analyst) → voit les deals d'Analyst dans son kanban (RLS Phase A)
6. ☐ Login Analyst → ne voit pas les deals d'un autre analyst de la même équipe
7. ☐ Login MD → voit toutes les colonnes (sourcing inclus)
8. ☐ Drop fichier > 50MB → toast erreur clair
9. ☐ Couper le réseau pendant génération → status='rejected' + bouton "Régénérer"
10. ☐ TypeCheck `npx tsc --noEmit` clean

**Pas de E2E Playwright** en Phase B' — trop d'effort vs ROI sur un MVP démo.

---

## 11. Migration plan

### 11.1 Étape 1 — DB migrations (local Docker uniquement)

```
supabase/migrations/
├── 20260501000001_pe_phase_b_rename_stages.sql
│     - RENAME 'ic1' → 'note_ic1'
│     - RENAME 'ic_finale' → 'note_ic_finale'
│     - UPDATE pe_deals SET stage='pre_screening' WHERE stage='analyse'
├── 20260501000002_pe_phase_b_documents.sql
│     - CREATE TABLE pe_deal_documents + index + RLS
│     - CREATE Storage bucket pe_deal_docs (privé) + Storage RLS
└── 20260501000003_pe_phase_b_memo.sql
      - CREATE TYPE memo_section_code (12 valeurs)
      - CREATE TYPE memo_version_status
      - CREATE TABLE investment_memos + RLS
      - CREATE TABLE memo_versions (overall_score + classification + error_message) + RLS
      - CREATE TABLE memo_sections + RLS
```

### 11.2 Étape 2 — Edge functions

```
supabase/functions/
├── generate-pre-screening/index.ts   (MODIFIER : branche PE)
├── generate-ic1-memo/index.ts        (NOUVEAU)
└── _shared/
    └── memo-helpers.ts               (NOUVEAU)
```

### 11.3 Étape 3 — Frontend

1. Créer atoms PE (7 nouveaux composants)
2. Créer 12 section renderers
3. Créer `MemoSectionsViewer` orchestrateur
4. Modifier `PePipelinePage.tsx` : 7 colonnes au lieu de 8, drag-drop docs sur cartes, filtre rôle
5. Modifier `PeDealDetailPage.tsx` : tabs Pré-screening / Memo IC1 / Documents / Historique
6. Créer `<RegenerateConfirmDialog>` et `<DocumentDropzone>` partagés

### 11.4 Plan de rollback

- **En local** : `psql $LOCAL_DB -f rollback_phase_b.sql` qui DROP les 4 tables nouvelles + restore enum
- **Sur preview Vercel** : `git revert <commit_phase_b>` puis push pe-demo
- **Prod (gszwotgppuinpfnyrjnu)** : intouchable tant que l'utilisateur n'a pas validé sur preview

---

## 12. Effort estimé

| Bloc | Effort |
|---|---|
| Migrations DB (3 fichiers) | 0.5j |
| Edge functions (modif `generate-pre-screening` + nouveau `generate-ic1-memo` + memo-helpers) | 1.5j |
| Atoms PE (7 nouveaux composants atomiques) | 1j |
| 12 section renderers PE | 1.5j |
| `MemoSectionsViewer` + intégration onglets | 0.5j |
| Modif `PePipelinePage` (7 colonnes + drag-drop docs + filtre rôle) | 1j |
| Tests + bug fixes + alignements visuels | 1j |
| **Total** | **~6 jours** |

---

## 13. Dépendances

- ✅ Phase A complète (pe_deals, RLS hiérarchique, kanban basique) — déjà sur pe-demo
- ✅ `buildToneForAgent` + `TONE_PE` actifs (segment-config.ts en prod)
- ✅ `generate-pre-screening` edge function active prod (programme)
- ✅ Railway parser pour PDF/Excel (active prod)
- ✅ Local Docker Supabase fonctionnel
- ⚠️ Storage bucket `pe_deal_docs` à créer (inclus migration 11.1)

---

## 14. Critères de succès

À la fin de Phase B', les 10 tests d'intégration manuels (§10.2) passent, et **un démo fluide** est possible sur preview Vercel pe-demo :

> Login Analyst → drop pitch.pdf sur "AgroCi" → 60s plus tard la carte montre score 74 → click carte → onglet Pré-screening montre les 13 blocs visuellement fidèles au mockup → MD drag carte vers Note IC1 → onglet Memo IC1 cliquable avec 12 sections clonées.

C'est le minimum viable pour valider l'infrastructure living document que toutes les phases ultérieures (C', D', E', F', G') vont étendre.
