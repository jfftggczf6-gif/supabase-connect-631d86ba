# Phase B' — Living document + Pre-screening 360° PE — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Inline execution chosen by user — pas de subagents.

**Goal:** Brancher la génération auto pre-screening PE sur le drop de documents dans le kanban, avec versionning living document à 12 sections, viewer 13 blocs mockup-driven, et clone v1 lors du drag vers Note IC1.

**Architecture:** 4 nouvelles tables (`pe_deal_documents`, `investment_memos`, `memo_versions`, `memo_sections`) + 1 nouvelle edge function PE (`generate-pe-pre-screening`) qui appelle Claude via `buildToneForAgent` (TONE_PE) et écrit dans le living document + 1 edge function de clone (`generate-ic1-memo`) + 7 atoms PE et 12 section renderers React + modifs `PePipelinePage` (7 colonnes, drag-drop docs, filtre rôle) et `PeDealDetailPage` (onglets Pre-screening / Memo IC1 / Documents / Historique).

**Tech Stack:** Supabase Postgres + RLS, Edge Functions Deno + Claude API, Storage privé, React 18 + Vite + TypeScript + shadcn/ui + @dnd-kit + recharts, Tailwind.

**Branche d'implémentation:** `pe-demo` (locale Docker Supabase pour DB ; Vercel preview pour validation visuelle ; jamais sur prod sans accord).

---

## File structure

### À créer

```
supabase/migrations/
├── 20260501000001_pe_phase_b_rename_stages.sql           [Task 1]
├── 20260501000002_pe_phase_b_documents.sql               [Task 2]
└── 20260501000003_pe_phase_b_memo.sql                    [Task 3]

supabase/functions/
├── _shared/
│   └── memo-helpers.ts                                   [Task 5]
├── generate-pe-pre-screening/
│   └── index.ts                                          [Task 6]
└── generate-ic1-memo/
    └── index.ts                                          [Task 7]

src/components/pe/
├── DocumentDropzone.tsx                                  [Task 11]
├── RegenerateConfirmDialog.tsx                           [Task 11]
├── MemoSectionsViewer.tsx                                [Task 12]
├── DealDocumentsList.tsx                                 [Task 18]
├── DealHistoryTimeline.tsx                               [Task 18]
└── sections/
    ├── ExecutiveSummarySection.tsx                       [Task 13]
    ├── ShareholdingGovernanceSection.tsx                 [Task 13]
    ├── TopManagementSection.tsx                          [Task 13]
    ├── ServicesSection.tsx                               [Task 13]
    ├── CompetitionMarketSection.tsx                      [Task 14]
    ├── UnitEconomicsSection.tsx                          [Task 14]
    ├── FinancialsPnlSection.tsx                          [Task 14]
    ├── FinancialsBalanceSection.tsx                      [Task 14]
    ├── InvestmentThesisSection.tsx                       [Task 14]
    ├── SupportRequestedSection.tsx                       [Task 14]
    ├── EsgRisksSection.tsx                               [Task 14]
    └── AnnexesSection.tsx                                [Task 14]

src/components/dashboard/viewers/atoms/pe/
├── ScoreCircle.tsx                                       [Task 10]
├── ClassificationTag.tsx                                 [Task 10]
├── FinancialTable.tsx                                    [Task 10]
├── ScenariosBox.tsx                                      [Task 10]
├── MatchCriteriaList.tsx                                 [Task 10]
├── RedFlagItem.tsx                                       [Task 10]
└── DocCategoryCard.tsx                                   [Task 10]

src/lib/
└── pe-stage-config.ts                                    [Task 15]
```

### À modifier

```
src/index.css                                             [Task 9 — ajouter palette CSS]
src/integrations/supabase/types.ts                        [Task 8 — regen auto]
src/components/pe/PeDealCard.tsx                          [Task 16]
src/pages/pe/PePipelinePage.tsx                           [Task 15]
src/pages/pe/PeDealDetailPage.tsx                         [Task 17]
```

### Total: ~25 fichiers nouveaux, 5 fichiers modifiés

---

## Task ordering & checkpoints

20 tâches en 6 phases. **Checkpoint utilisateur** après chaque phase pour valider avant de passer à la suivante.

| Phase | Tasks | Checkpoint |
|---|---|---|
| 1. Database | 1-4 | DB locale appliquée + RLS testé |
| 2. Backend edge functions | 5-8 | Génération end-to-end via curl |
| 3. Frontend atoms + palette | 9-11 | Atoms isolés rendent OK |
| 4. Frontend renderers | 12-14 | Viewer rend une version mockée |
| 5. Frontend pages | 15-18 | Kanban + page deal fonctionnels |
| 6. Integration & QA | 19-20 | Checklist 10 tests + push pe-demo |

---

# Phase 1 — Database

## Task 1: Migration rename stages PE

**Files:**
- Create: `supabase/migrations/20260501000001_pe_phase_b_rename_stages.sql`

- [ ] **Step 1: Créer la migration**

Contenu complet de `supabase/migrations/20260501000001_pe_phase_b_rename_stages.sql` :

```sql
-- Phase B' Step 1 — Rename PE deal stages to align with architecture v2.5
-- ic1 → note_ic1
-- ic_finale → note_ic_finale
-- analyse → migrer données vers pre_screening (mais l'enum value reste,
--           Postgres ne permet pas DROP VALUE sur un enum)

-- 1) Rename enum values (preserves all existing rows)
ALTER TYPE pe_deal_stage RENAME VALUE 'ic1' TO 'note_ic1';
ALTER TYPE pe_deal_stage RENAME VALUE 'ic_finale' TO 'note_ic_finale';

-- 2) Migrer les rows utilisant 'analyse' vers 'pre_screening'
--    'analyse' reste dans l'enum mais ne sera plus jamais affichée/utilisée.
UPDATE pe_deals SET stage = 'pre_screening' WHERE stage = 'analyse';
UPDATE pe_deal_history SET to_stage = 'pre_screening' WHERE to_stage = 'analyse';
UPDATE pe_deal_history SET from_stage = 'pre_screening' WHERE from_stage = 'analyse';

-- 3) Note de scope
COMMENT ON TYPE pe_deal_stage IS 'PE deal pipeline stages. analyse est legacy (Phase A). Phase B'' utilise: sourcing, pre_screening, note_ic1, dd, note_ic_finale, closing, portfolio, lost.';
```

- [ ] **Step 2: Appliquer en local Docker Supabase**

Run:
```bash
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
npx supabase db reset --local
```

Expected: La migration s'applique sans erreur. Les seed deals précédemment en `analyse` passent en `pre_screening`.

- [ ] **Step 3: Vérifier dans la DB locale**

Run:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'pe_deal_stage'::regtype ORDER BY enumsortorder;"
```

Expected output (les 9 valeurs avec ic1/ic_finale renommées) :
```
sourcing
pre_screening
analyse
note_ic1
dd
note_ic_finale
closing
portfolio
lost
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260501000001_pe_phase_b_rename_stages.sql
git commit -m "migration(pe): rename stages ic1→note_ic1, ic_finale→note_ic_finale, drop analyse"
```

---

## Task 2: Migration pe_deal_documents + Storage bucket

**Files:**
- Create: `supabase/migrations/20260501000002_pe_phase_b_documents.sql`

- [ ] **Step 1: Créer la migration**

Contenu complet de `supabase/migrations/20260501000002_pe_phase_b_documents.sql` :

```sql
-- Phase B' Step 2 — Documents uploadés sur les deals PE + Storage bucket

-- 1) Table pe_deal_documents
CREATE TABLE IF NOT EXISTS pe_deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_bytes BIGINT,
  category TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_deal_documents_deal_id
  ON pe_deal_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_pe_deal_documents_org_recent
  ON pe_deal_documents(organization_id, created_at DESC);

-- 2) RLS
ALTER TABLE pe_deal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_deal_documents_select"
  ON pe_deal_documents FOR SELECT
  USING (can_see_pe_deal(deal_id));

CREATE POLICY "pe_deal_documents_insert"
  ON pe_deal_documents FOR INSERT
  WITH CHECK (can_see_pe_deal(deal_id));

CREATE POLICY "pe_deal_documents_delete"
  ON pe_deal_documents FOR DELETE
  USING (can_see_pe_deal(deal_id));

-- 3) Storage bucket privé pour les docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pe_deal_docs', 'pe_deal_docs', false)
ON CONFLICT (id) DO NOTHING;

-- 4) Storage RLS : path pattern <org_id>/<deal_id>/<filename>
--    On autorise lecture si le user a un rôle PE actif dans l'org du path[1]
DROP POLICY IF EXISTS "pe_deal_docs_select" ON storage.objects;
CREATE POLICY "pe_deal_docs_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pe_deal_docs'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
        AND om.role IN ('managing_director', 'investment_manager', 'analyste', 'analyst', 'admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "pe_deal_docs_insert" ON storage.objects;
CREATE POLICY "pe_deal_docs_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pe_deal_docs'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
        AND om.role IN ('managing_director', 'investment_manager', 'analyste', 'analyst', 'admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "pe_deal_docs_delete" ON storage.objects;
CREATE POLICY "pe_deal_docs_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pe_deal_docs'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.organization_id::text = SPLIT_PART(name, '/', 1)
        AND om.role IN ('managing_director', 'investment_manager', 'analyste', 'analyst', 'admin', 'owner')
    )
  );
```

- [ ] **Step 2: Appliquer en local**

Run: `npx supabase db reset --local`

Expected: Pas d'erreur, table créée, bucket `pe_deal_docs` créé.

- [ ] **Step 3: Vérifier la table**

Run:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d pe_deal_documents"
```

Expected: 9 colonnes (`id`, `deal_id`, `organization_id`, `filename`, `storage_path`, `mime_type`, `size_bytes`, `category`, `uploaded_by`, `created_at`), RLS enabled.

- [ ] **Step 4: Vérifier le bucket Storage**

Run:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT id, name, public FROM storage.buckets WHERE id = 'pe_deal_docs';"
```

Expected: 1 row avec `public = false`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260501000002_pe_phase_b_documents.sql
git commit -m "migration(pe): table pe_deal_documents + bucket Storage pe_deal_docs avec RLS"
```

---

## Task 3: Migration tables living document (memo)

**Files:**
- Create: `supabase/migrations/20260501000003_pe_phase_b_memo.sql`

- [ ] **Step 1: Créer la migration**

Contenu complet de `supabase/migrations/20260501000003_pe_phase_b_memo.sql` :

```sql
-- Phase B' Step 3 — Living document: investment_memos, memo_versions, memo_sections

-- 1) Enum pour les codes des 12 sections fixes
DO $$ BEGIN
  CREATE TYPE memo_section_code AS ENUM (
    'executive_summary',
    'shareholding_governance',
    'top_management',
    'services',
    'competition_market',
    'unit_economics',
    'financials_pnl',
    'financials_balance',
    'investment_thesis',
    'support_requested',
    'esg_risks',
    'annexes'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Enum pour le statut d'une version
DO $$ BEGIN
  CREATE TYPE memo_version_status AS ENUM (
    'generating', 'ready', 'validated', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3) investment_memos : 1 row par deal, conteneur immortel
CREATE TABLE IF NOT EXISTS investment_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES pe_deals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4) memo_versions : snapshots versionnés
CREATE TABLE IF NOT EXISTS memo_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID NOT NULL REFERENCES investment_memos(id) ON DELETE CASCADE,
  parent_version_id UUID REFERENCES memo_versions(id),
  label TEXT NOT NULL,
  stage pe_deal_stage NOT NULL,
  status memo_version_status NOT NULL DEFAULT 'generating',
  overall_score NUMERIC,
  classification TEXT,
  error_message TEXT,
  generated_by_agent TEXT,
  generated_by_user_id UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memo_versions_unique_label UNIQUE(memo_id, label)
);
CREATE INDEX IF NOT EXISTS idx_memo_versions_memo_recent
  ON memo_versions(memo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memo_versions_stage_status
  ON memo_versions(stage, status);

-- 5) memo_sections : contenu riche, 12 par version
CREATE TABLE IF NOT EXISTS memo_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES memo_versions(id) ON DELETE CASCADE,
  section_code memo_section_code NOT NULL,
  title TEXT,
  content_md TEXT,
  content_json JSONB,
  source_doc_ids UUID[] DEFAULT '{}',
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memo_sections_unique_code UNIQUE(version_id, section_code)
);
CREATE INDEX IF NOT EXISTS idx_memo_sections_version
  ON memo_sections(version_id);

-- 6) Trigger updated_at sur memo_sections
CREATE OR REPLACE FUNCTION set_memo_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_memo_sections_updated_at ON memo_sections;
CREATE TRIGGER trg_memo_sections_updated_at
  BEFORE UPDATE ON memo_sections
  FOR EACH ROW
  EXECUTE FUNCTION set_memo_sections_updated_at();

-- 7) RLS
ALTER TABLE investment_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investment_memos_select"
  ON investment_memos FOR SELECT
  USING (can_see_pe_deal(deal_id));

ALTER TABLE memo_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memo_versions_select"
  ON memo_versions FOR SELECT
  USING (
    memo_id IN (
      SELECT id FROM investment_memos WHERE can_see_pe_deal(deal_id)
    )
  );

ALTER TABLE memo_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memo_sections_select"
  ON memo_sections FOR SELECT
  USING (
    version_id IN (
      SELECT mv.id FROM memo_versions mv
      JOIN investment_memos im ON im.id = mv.memo_id
      WHERE can_see_pe_deal(im.deal_id)
    )
  );

-- 8) Comments doc
COMMENT ON TABLE investment_memos IS 'Conteneur "dossier d''investissement" PE — 1 par deal, créé à la 1ère génération.';
COMMENT ON TABLE memo_versions IS 'Snapshots versionnés du living document. 1 nouvelle version à chaque transition de stage IA.';
COMMENT ON TABLE memo_sections IS 'Les 12 sections fixes du dossier, attachées à une version.';
COMMENT ON COLUMN memo_versions.overall_score IS 'Score global 0-100 (1 seul score affiché — le scoring multi-dim est Phase F'').';
```

- [ ] **Step 2: Appliquer en local**

Run: `npx supabase db reset --local`

Expected: Pas d'erreur. 3 nouvelles tables + 2 nouveaux enums.

- [ ] **Step 3: Vérifier les tables**

Run:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d investment_memos" \
  -c "\d memo_versions" \
  -c "\d memo_sections"
```

Expected: les 3 tables avec les colonnes attendues, RLS enabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260501000003_pe_phase_b_memo.sql
git commit -m "migration(pe): tables living document (investment_memos, memo_versions, memo_sections)"
```

---

## Task 4: Smoke test RLS sur les nouvelles tables

**Files:**
- (Pas de nouveau fichier — vérification SQL en local)

- [ ] **Step 1: Insert test direct (service_role)**

Run :
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
-- Pick a real deal_id from seed
SELECT id, name FROM pe_deals LIMIT 1;
"
```

Note la valeur de `id` retournée (ex: `abc-123`). Puis :

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
INSERT INTO investment_memos (deal_id) VALUES ('<deal_id_from_above>');
INSERT INTO memo_versions (memo_id, label, stage, status)
SELECT id, 'pre_screening_v1', 'pre_screening', 'ready'
FROM investment_memos WHERE deal_id = '<deal_id_from_above>';

SELECT v.id, v.label, v.status, v.stage
FROM memo_versions v
JOIN investment_memos m ON m.id = v.memo_id
WHERE m.deal_id = '<deal_id_from_above>';
"
```

Expected: 1 row avec label `pre_screening_v1`, status `ready`, stage `pre_screening`.

- [ ] **Step 2: Cleanup test data**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
DELETE FROM investment_memos WHERE deal_id = '<deal_id_from_above>';
"
```

(Le DELETE cascade vers memo_versions et memo_sections.)

- [ ] **Step 3: Pas de commit (test seulement)**

---

# Phase 2 — Backend edge functions

## Task 5: Helpers shared `_shared/memo-helpers.ts`

**Files:**
- Create: `supabase/functions/_shared/memo-helpers.ts`

- [ ] **Step 1: Créer le fichier**

Contenu complet de `supabase/functions/_shared/memo-helpers.ts` :

```typescript
// _shared/memo-helpers.ts
// Helpers pour manipuler le living document PE (investment_memos, memo_versions, memo_sections).
// Utilisé par generate-pe-pre-screening et generate-ic1-memo.

export type MemoSectionCode =
  | 'executive_summary'
  | 'shareholding_governance'
  | 'top_management'
  | 'services'
  | 'competition_market'
  | 'unit_economics'
  | 'financials_pnl'
  | 'financials_balance'
  | 'investment_thesis'
  | 'support_requested'
  | 'esg_risks'
  | 'annexes';

export type MemoVersionStatus = 'generating' | 'ready' | 'validated' | 'rejected';

export interface MemoVersionRow {
  id: string;
  memo_id: string;
  parent_version_id: string | null;
  label: string;
  stage: string;
  status: MemoVersionStatus;
  overall_score: number | null;
  classification: string | null;
  error_message: string | null;
  generated_by_agent: string | null;
  generated_by_user_id: string | null;
  generated_at: string | null;
  created_at: string;
}

export interface MemoSectionRow {
  id: string;
  version_id: string;
  section_code: MemoSectionCode;
  title: string | null;
  content_md: string | null;
  content_json: any;
  source_doc_ids: string[];
  position: number;
  created_at: string;
  updated_at: string;
}

// Ordre canonique des 12 sections (correspond au mockup)
export const SECTION_ORDER: MemoSectionCode[] = [
  'executive_summary',
  'shareholding_governance',
  'top_management',
  'services',
  'competition_market',
  'unit_economics',
  'financials_pnl',
  'financials_balance',
  'investment_thesis',
  'support_requested',
  'esg_risks',
  'annexes',
];

/** Crée un investment_memos pour un deal (idempotent : retourne l'id existant si déjà créé). */
export async function ensureInvestmentMemo(
  supabase: any,
  dealId: string,
  userId: string,
): Promise<string> {
  const existing = await supabase
    .from('investment_memos')
    .select('id')
    .eq('deal_id', dealId)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id;

  const { data, error } = await supabase
    .from('investment_memos')
    .insert({ deal_id: dealId, created_by: userId })
    .select('id')
    .single();
  if (error) throw new Error(`ensureInvestmentMemo failed: ${error.message}`);
  return data.id;
}

/** Crée une nouvelle memo_versions row. */
export async function createMemoVersion(
  supabase: any,
  args: {
    memo_id: string;
    label: string;
    parent_version_id?: string | null;
    stage: string;
    status?: MemoVersionStatus;
    overall_score?: number | null;
    classification?: string | null;
    generated_by_agent: string;
    generated_by_user_id?: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from('memo_versions')
    .insert({
      memo_id: args.memo_id,
      label: args.label,
      parent_version_id: args.parent_version_id ?? null,
      stage: args.stage,
      status: args.status ?? 'generating',
      overall_score: args.overall_score ?? null,
      classification: args.classification ?? null,
      generated_by_agent: args.generated_by_agent,
      generated_by_user_id: args.generated_by_user_id ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`createMemoVersion failed: ${error.message}`);
  return data.id;
}

/** Patch d'une version (status, scores, error_message, generated_at). */
export async function updateMemoVersion(
  supabase: any,
  versionId: string,
  patch: Partial<{
    status: MemoVersionStatus;
    overall_score: number | null;
    classification: string | null;
    error_message: string | null;
    generated_at: string;
  }>,
): Promise<void> {
  const { error } = await supabase
    .from('memo_versions')
    .update(patch)
    .eq('id', versionId);
  if (error) throw new Error(`updateMemoVersion failed: ${error.message}`);
}

/** Insère 12 sections d'un coup à partir d'un map {section_code → contenu}. */
export async function insertMemoSections(
  supabase: any,
  versionId: string,
  sections: Record<MemoSectionCode, {
    content_md?: string;
    content_json?: any;
    source_doc_ids?: string[];
    title?: string;
  }>,
): Promise<void> {
  const rows = SECTION_ORDER.map((code, index) => ({
    version_id: versionId,
    section_code: code,
    title: sections[code]?.title ?? null,
    content_md: sections[code]?.content_md ?? null,
    content_json: sections[code]?.content_json ?? null,
    source_doc_ids: sections[code]?.source_doc_ids ?? [],
    position: index,
  }));
  const { error } = await supabase.from('memo_sections').insert(rows);
  if (error) throw new Error(`insertMemoSections failed: ${error.message}`);
}

/** Récupère la dernière version pour un deal sur un stage donné, optionnellement filtrée par status. */
export async function getLatestVersion(
  supabase: any,
  dealId: string,
  stage: string,
  status?: MemoVersionStatus,
): Promise<MemoVersionRow | null> {
  let query = supabase
    .from('memo_versions')
    .select('*, investment_memos!inner(deal_id)')
    .eq('investment_memos.deal_id', dealId)
    .eq('stage', stage)
    .order('created_at', { ascending: false })
    .limit(1);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(`getLatestVersion failed: ${error.message}`);
  return data?.[0] ?? null;
}

/** Récupère les 12 sections d'une version. */
export async function fetchSections(
  supabase: any,
  versionId: string,
): Promise<MemoSectionRow[]> {
  const { data, error } = await supabase
    .from('memo_sections')
    .select('*')
    .eq('version_id', versionId)
    .order('position');
  if (error) throw new Error(`fetchSections failed: ${error.message}`);
  return data ?? [];
}

/** Récupère les documents uploadés d'un deal. */
export async function fetchDealDocuments(
  supabase: any,
  dealId: string,
): Promise<Array<{ id: string; filename: string; storage_path: string; mime_type: string | null }>> {
  const { data, error } = await supabase
    .from('pe_deal_documents')
    .select('id, filename, storage_path, mime_type')
    .eq('deal_id', dealId)
    .order('created_at');
  if (error) throw new Error(`fetchDealDocuments failed: ${error.message}`);
  return data ?? [];
}

/** Détermine le label de version suivant (pre_screening_v1, v2...). */
export async function nextVersionLabel(
  supabase: any,
  memoId: string,
  stage: string,
): Promise<{ label: string; parent_id: string | null }> {
  const { data, error } = await supabase
    .from('memo_versions')
    .select('id, label')
    .eq('memo_id', memoId)
    .eq('stage', stage)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`nextVersionLabel failed: ${error.message}`);
  const count = (data ?? []).length;
  return {
    label: `${stage}_v${count + 1}`,
    parent_id: data?.[0]?.id ?? null,
  };
}
```

- [ ] **Step 2: Vérifier syntaxiquement (deno check)**

Run:
```bash
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
npx supabase functions serve --no-verify-jwt 2>&1 | head -5 &
SERVE_PID=$!
sleep 3
kill $SERVE_PID 2>/dev/null
```

Expected: Pas d'erreur de compilation Deno sur memo-helpers.ts (le simple démarrage du serveur le valide).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/memo-helpers.ts
git commit -m "feat(pe): _shared/memo-helpers.ts pour manipuler le living document"
```

---

## Task 6: Edge function `generate-pe-pre-screening`

**Files:**
- Create: `supabase/functions/generate-pe-pre-screening/index.ts`

**Note d'architecture** : on crée une edge function PE dédiée plutôt que de modifier `generate-pre-screening` (qui est focalisée programme avec `verifyAndGetContext`/`enterprise_id`). Ça évite tout risque de régression sur programme et garde les responsabilités séparées. Réutilisation des helpers shared (`buildToneForAgent`, `callAI`).

- [ ] **Step 1: Créer le fichier**

Contenu complet de `supabase/functions/generate-pe-pre-screening/index.ts` :

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildToneForAgent } from "../_shared/agent-tone.ts";
import {
  ensureInvestmentMemo,
  createMemoVersion,
  updateMemoVersion,
  insertMemoSections,
  fetchDealDocuments,
  nextVersionLabel,
  type MemoSectionCode,
} from "../_shared/memo-helpers.ts";

const SYSTEM_PROMPT_PE = `Tu produis un PRÉ-SCREENING 360° pour un deal de Private Equity.

═══ OBJECTIF ═══
Tu prépares un dossier d'investissement structuré en 12 sections fixes qui sera utilisé tel quel par le comité d'investissement. Chaque section doit être actionnable pour la décision d'investir ou non.

═══ FORMAT DE RÉPONSE ═══
Tu DOIS répondre avec un OBJET JSON STRICT respectant ce schéma :

{
  "overall_score": <number 0-100>,                     // score global du dossier
  "classification": <string: 'go_conditionnel' | 'hold' | 'reject' | 'go_direct'>,
  "ai_synthesis": {
    "paragraph": <string narratif synthèse>,
    "strengths_tags": [<string>, ...],                  // ex: ["croissance CA", "marge brute"]
    "weaknesses_tags": [<string>, ...]                  // ex: ["gouvernance", "concentration"]
  },
  "kpis_bandeau": [                                    // 5 KPIs synthèse pour le bandeau
    { "label": "CA 2025", "value": "2.8 Mds", "hint": "+18% YoY", "hint_color": "ok" },
    ...
  ],
  "context": {
    "activite": <string paragraphe>,
    "actionnariat": { "items": [{ "label": "M. Kouassi", "percent": 72, "subtitle": "Fondateur/DG" }, ...] },
    "management": { "items": [{ "name": "A. Kouassi", "role": "DG/Fondateur", "tag": "warning", "note": "Cumule DG+DAF — risque homme-clé" }, ...] }
  },
  "snapshot_3y": {
    "headers": ["2023", "2024", "2025"],
    "rows": [
      { "label": "Chiffre d'affaires", "values": ["2.0 Mds", "2.4 Mds", "2.8 Mds"] },
      { "label": "EBITDA déclaré", "values": ["250M", "340M", "420M"] },
      { "label": "EBITDA retraité", "values": ["n/d", "n/d", "320M"], "highlight": "warning" },
      { "label": "Résultat net", "values": ["120M", "180M", "230M"] },
      { "label": "Dette nette", "values": ["400M", "350M", "280M"] }
    ],
    "footnote": <string>                                 // explication retraitements
  },
  "use_of_proceeds": [
    { "label": "Nouvelle ligne de production", "percent": 60 },
    { "label": "Expansion régionale", "percent": 25 },
    { "label": "Fonds de roulement", "percent": 15 }
  ],
  "scenarios_returns": {
    "bear":  { "moic": "1.8x", "irr": "12%", "description": "..." },
    "base":  { "moic": "2.8x", "irr": "22%", "description": "..." },
    "bull":  { "moic": "4.1x", "irr": "33%", "description": "..." },
    "pre_money_indicatif": "10-14M EUR"
  },
  "thesis_match": {
    "criteria": [
      { "label": "Secteur cible", "status": "match" },
      { "label": "Ticket dans la fourchette", "status": "match" },
      { "label": "Géographie éligible", "status": "match" },
      { "label": "CA minimum requis", "status": "match" },
      { "label": "États financiers certifiés", "status": "partial" },
      { "label": "EBITDA positif exigé", "status": "match" }
    ],
    "match_count": 5,
    "total": 6,
    "score_percent": 83
  },
  "red_flags": [
    {
      "title": "Concentration client élevée",
      "severity": "high",                                // 'high' | 'medium' | 'low'
      "detail": "Top 3 clients = 62% du CA. Seuil d'alerte : 40%."
    },
    ...
  ],
  "doc_quality": {
    "categories": [
      {
        "name": "Financier",
        "level": "N2",                                    // 'N0' | 'N1' | 'N2'
        "checklist": [
          { "label": "Liasses SYSCOHADA 3 ans", "status": "ok" },
          { "label": "Audit / certification", "status": "partial" }
        ]
      },
      ...
    ],
    "global_level": "N1.5",
    "summary": "8 documents fournis / 16 attendus"
  },
  "benchmark": {
    "headers": ["PharmaCi", "Médiane", "Quartile"],
    "rows": [
      { "ratio": "Marge brute", "company": "32%", "median": "28%", "quartile": "Q3" },
      ...
    ],
    "source": "knowledge_benchmarks pharma UEMOA · IFC 2024 · 14 entreprises"
  },
  "recommendation": {
    "verdict": "go_conditionnel",
    "summary": <string narratif>,
    "conditions": [
      { "n": 1, "text": "Obtenir les liasses 2024-2025 certifiées" },
      { "n": 2, "text": "..." },
      { "n": 3, "text": "..." }
    ],
    "deal_breakers": ["Concentration client > 70%", "EBITDA retraité < 8%"],
    "conviction": "modéré"                               // 'fort' | 'modéré' | 'faible'
  },
  "sections_md": {
    "executive_summary": <string markdown ~200 mots>,
    "shareholding_governance": <string markdown>,
    "top_management": <string markdown>,
    "services": <string markdown>,
    "competition_market": <string markdown>,
    "unit_economics": <string markdown>,
    "financials_pnl": <string markdown>,
    "financials_balance": <string markdown>,
    "investment_thesis": <string markdown>,
    "support_requested": <string markdown>,
    "esg_risks": <string markdown>,
    "annexes": <string markdown>
  }
}

═══ RÈGLES ═══
1. Chiffres EXACTS issus des documents. Pas d'invention.
2. Si une donnée manque : utilise "n/d" ou null, ne jamais inventer.
3. Cite les sources entre crochets : [Source: pitch.pdf p.3]
4. Le score global pondère : croissance, financier, thèse, ESG, qualité données, gouvernance.
5. Red flags : max 5, qualitatifs (sans points de pénalité).
6. Tu réponds UNIQUEMENT avec le JSON. Pas de préambule, pas de conclusion.`;

interface RequestBody {
  deal_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Authorization required", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse("Not authenticated", 401);

    const body: RequestBody = await req.json();
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    // 1) Vérifier que le user peut voir ce deal (RLS)
    const { data: deal, error: dealErr } = await userClient
      .from("pe_deals")
      .select("id, name, organization_id, ticket_amount, sector, country, source, deal_ref, stage")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (dealErr || !deal) return errorResponse("Deal not found or not accessible", 404);

    // 2) Récupérer les documents
    const docs = await fetchDealDocuments(adminClient, body.deal_id);
    if (docs.length === 0) return errorResponse("No documents to analyze", 400);

    // 3) Créer le memo + nouvelle version
    const memoId = await ensureInvestmentMemo(adminClient, body.deal_id, user.id);
    const { label, parent_id } = await nextVersionLabel(adminClient, memoId, "pre_screening");
    const versionId = await createMemoVersion(adminClient, {
      memo_id: memoId,
      label,
      parent_version_id: parent_id,
      stage: "pre_screening",
      status: "generating",
      generated_by_agent: "generate-pe-pre-screening",
      generated_by_user_id: user.id,
    });

    // 4) Auto-move stage si on est en sourcing
    if (deal.stage === "sourcing") {
      await adminClient.from("pe_deals").update({ stage: "pre_screening" }).eq("id", deal.id);
    }

    try {
      // 5) Lire chaque document via Storage + parser Railway
      let docContents = "";
      for (const doc of docs) {
        const { data: file, error: dlErr } = await adminClient
          .storage.from("pe_deal_docs").download(doc.storage_path);
        if (dlErr || !file) {
          console.warn(`[generate-pe-pre-screening] download failed for ${doc.filename}: ${dlErr?.message}`);
          continue;
        }
        const arrayBuffer = await file.arrayBuffer();
        const text = await callRailwayParser(arrayBuffer, doc.filename, doc.mime_type ?? "application/octet-stream");
        docContents += `\n\n=== ${doc.filename} ===\n${text}`;
      }
      if (!docContents.trim()) throw new Error("Aucun document n'a pu être lu");

      // 6) Compose tone PE
      const toneBlock = await buildToneForAgent(adminClient, deal.organization_id);
      const finalSystemPrompt = `${toneBlock}\n\n${SYSTEM_PROMPT_PE}`;

      // 7) Appel Claude
      const userPrompt = `Voici les documents du deal "${deal.name}" (deal_ref: ${deal.deal_ref ?? "n/d"}, ticket: ${deal.ticket_amount ?? "n/d"} EUR, secteur: ${deal.sector ?? "n/d"}, pays: ${deal.country ?? "n/d"}).\n\n${docContents}\n\nProduis le pré-screening 360° au format JSON strict défini dans tes instructions système.`;

      const claudeJSON = await callAI(finalSystemPrompt, userPrompt, 24576, undefined, 0.2, {
        functionName: "generate-pe-pre-screening",
        enterpriseId: deal.id,  // utilisé pour l'audit log
      });

      // 8) Parse JSON
      let parsed: any;
      try {
        parsed = typeof claudeJSON === "string" ? JSON.parse(claudeJSON) : claudeJSON;
      } catch (e) {
        throw new Error(`Claude response is not valid JSON: ${e.message}`);
      }

      // 9) Construire les 12 sections à partir du JSON Claude
      const sectionDocIds = docs.map(d => d.id);
      const sectionsMap: Record<MemoSectionCode, any> = {
        executive_summary: {
          content_md: parsed.sections_md?.executive_summary ?? null,
          content_json: { kpis_bandeau: parsed.kpis_bandeau, ai_synthesis: parsed.ai_synthesis },
          source_doc_ids: sectionDocIds,
        },
        shareholding_governance: {
          content_md: parsed.sections_md?.shareholding_governance ?? null,
          content_json: { actionnariat: parsed.context?.actionnariat },
          source_doc_ids: sectionDocIds,
        },
        top_management: {
          content_md: parsed.sections_md?.top_management ?? null,
          content_json: { management: parsed.context?.management },
          source_doc_ids: sectionDocIds,
        },
        services: {
          content_md: parsed.sections_md?.services ?? null,
          content_json: { activite: parsed.context?.activite },
          source_doc_ids: sectionDocIds,
        },
        competition_market: {
          content_md: parsed.sections_md?.competition_market ?? null,
          content_json: { benchmark: parsed.benchmark },
          source_doc_ids: sectionDocIds,
        },
        unit_economics: {
          content_md: parsed.sections_md?.unit_economics ?? null,
          content_json: {},
          source_doc_ids: sectionDocIds,
        },
        financials_pnl: {
          content_md: parsed.sections_md?.financials_pnl ?? null,
          content_json: { snapshot_3y: parsed.snapshot_3y },
          source_doc_ids: sectionDocIds,
        },
        financials_balance: {
          content_md: parsed.sections_md?.financials_balance ?? null,
          content_json: {},
          source_doc_ids: sectionDocIds,
        },
        investment_thesis: {
          content_md: parsed.sections_md?.investment_thesis ?? null,
          content_json: {
            thesis_match: parsed.thesis_match,
            scenarios_returns: parsed.scenarios_returns,
            recommendation: parsed.recommendation,
          },
          source_doc_ids: sectionDocIds,
        },
        support_requested: {
          content_md: parsed.sections_md?.support_requested ?? null,
          content_json: { use_of_proceeds: parsed.use_of_proceeds },
          source_doc_ids: sectionDocIds,
        },
        esg_risks: {
          content_md: parsed.sections_md?.esg_risks ?? null,
          content_json: { red_flags: parsed.red_flags },
          source_doc_ids: sectionDocIds,
        },
        annexes: {
          content_md: parsed.sections_md?.annexes ?? null,
          content_json: { doc_quality: parsed.doc_quality },
          source_doc_ids: sectionDocIds,
        },
      };

      // 10) Insert sections + finalize version
      await insertMemoSections(adminClient, versionId, sectionsMap);
      await updateMemoVersion(adminClient, versionId, {
        status: "ready",
        overall_score: typeof parsed.overall_score === "number" ? parsed.overall_score : null,
        classification: parsed.classification ?? null,
        generated_at: new Date().toISOString(),
      });

      return jsonResponse({
        success: true,
        memo_id: memoId,
        version_id: versionId,
        overall_score: parsed.overall_score,
        classification: parsed.classification,
      });
    } catch (genErr: any) {
      // Marquer la version comme rejected + rollback stage si on était en sourcing
      console.error(`[generate-pe-pre-screening] generation failed: ${genErr.message}`);
      await updateMemoVersion(adminClient, versionId, {
        status: "rejected",
        error_message: genErr.message?.slice(0, 500) ?? "Unknown error",
      });
      if (deal.stage === "sourcing") {
        await adminClient.from("pe_deals").update({ stage: "sourcing" }).eq("id", deal.id);
      }
      return errorResponse(`Generation failed: ${genErr.message}`, 500);
    }
  } catch (err: any) {
    console.error(`[generate-pe-pre-screening] outer error: ${err.message}`);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});

/** Appel proxy-parser pour extraire le texte d'un document. */
async function callRailwayParser(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const railwayUrl = Deno.env.get("RAILWAY_URL");
  const parserKey = Deno.env.get("PARSER_API_KEY");
  if (!railwayUrl || !parserKey) {
    console.warn("[generate-pe-pre-screening] RAILWAY_URL or PARSER_API_KEY not set, returning empty text");
    return "";
  }
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: mimeType }), filename);
  const resp = await fetch(`${railwayUrl}/parse`, {
    method: "POST",
    headers: { "x-api-key": parserKey },
    body: formData,
  });
  if (!resp.ok) {
    console.warn(`[generate-pe-pre-screening] parser returned ${resp.status} for ${filename}`);
    return "";
  }
  const data = await resp.json();
  return data.text ?? data.content ?? "";
}
```

- [ ] **Step 2: Déployer en local et test smoke**

Run:
```bash
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
npx supabase functions serve generate-pe-pre-screening --no-verify-jwt --env-file ./supabase/.env.local 2>&1 &
SERVE_PID=$!
sleep 5

# Smoke test : sans body → doit retourner 400
curl -sS -X POST http://127.0.0.1:54321/functions/v1/generate-pe-pre-screening \
  -H "Authorization: Bearer <anon-key-local>" \
  -H "Content-Type: application/json" \
  -d '{}'

kill $SERVE_PID 2>/dev/null
```

Expected: `{"error":"deal_id required"}` avec status 400.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/generate-pe-pre-screening/index.ts
git commit -m "feat(pe): edge function generate-pe-pre-screening (Claude → 12 sections living document)"
```

---

## Task 7: Edge function `generate-ic1-memo`

**Files:**
- Create: `supabase/functions/generate-ic1-memo/index.ts`

- [ ] **Step 1: Créer le fichier**

Contenu complet de `supabase/functions/generate-ic1-memo/index.ts` :

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import {
  createMemoVersion,
  updateMemoVersion,
  insertMemoSections,
  fetchSections,
  getLatestVersion,
  type MemoSectionCode,
} from "../_shared/memo-helpers.ts";

interface RequestBody {
  deal_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Authorization required", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse("Not authenticated", 401);

    const body: RequestBody = await req.json();
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    // Vérifier que le user voit le deal (RLS)
    const { data: deal, error: dealErr } = await userClient
      .from("pe_deals").select("id").eq("id", body.deal_id).maybeSingle();
    if (dealErr || !deal) return errorResponse("Deal not found or not accessible", 404);

    // Trouver la dernière version pre_screening ready
    const lastPreScreening = await getLatestVersion(adminClient, body.deal_id, "pre_screening", "ready");
    if (!lastPreScreening) {
      return errorResponse("No ready pre_screening version to clone from", 400);
    }

    // Vérifier qu'il n'y a pas déjà une note_ic1 pour ce memo
    const existingIc1 = await getLatestVersion(adminClient, body.deal_id, "note_ic1");
    if (existingIc1) {
      return jsonResponse({
        success: true,
        version_id: existingIc1.id,
        already_exists: true,
      });
    }

    // Créer la nouvelle version note_ic1_v1 (clone)
    const newVersionId = await createMemoVersion(adminClient, {
      memo_id: lastPreScreening.memo_id,
      label: "note_ic1_v1",
      parent_version_id: lastPreScreening.id,
      stage: "note_ic1",
      status: "generating",
      overall_score: lastPreScreening.overall_score,
      classification: lastPreScreening.classification,
      generated_by_agent: "clone_from_pre_screening",
      generated_by_user_id: user.id,
    });

    // Cloner les 12 sections du parent
    const parentSections = await fetchSections(adminClient, lastPreScreening.id);
    const sectionsMap: Record<MemoSectionCode, any> = {} as any;
    for (const sec of parentSections) {
      sectionsMap[sec.section_code] = {
        title: sec.title,
        content_md: sec.content_md,
        content_json: sec.content_json,
        source_doc_ids: sec.source_doc_ids,
      };
    }
    await insertMemoSections(adminClient, newVersionId, sectionsMap);

    // Finalize
    await updateMemoVersion(adminClient, newVersionId, {
      status: "ready",
      generated_at: new Date().toISOString(),
    });

    return jsonResponse({
      success: true,
      version_id: newVersionId,
      cloned_from: lastPreScreening.id,
    });
  } catch (err: any) {
    console.error(`[generate-ic1-memo] error: ${err.message}`);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
```

- [ ] **Step 2: Vérifier syntaxe (deno check via supabase serve)**

Run:
```bash
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
npx supabase functions serve generate-ic1-memo --no-verify-jwt 2>&1 | head -3 &
sleep 3
kill %1 2>/dev/null
```

Expected: Pas d'erreur de compilation.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/generate-ic1-memo/index.ts
git commit -m "feat(pe): edge function generate-ic1-memo (clone v1 pre_screening → note_ic1_v1)"
```

---

## Task 8: Regenerate Supabase TypeScript types

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Régénérer les types**

Run:
```bash
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

- [ ] **Step 2: Vérifier la présence des nouveaux types**

Run:
```bash
grep -E "investment_memos|memo_versions|memo_sections|pe_deal_documents" src/integrations/supabase/types.ts | head -20
```

Expected: Les 4 noms de tables doivent apparaître plusieurs fois.

- [ ] **Step 3: TypeCheck**

Run:
```bash
npx tsc --noEmit
```

Expected: Aucune erreur (les types nouvellement générés sont compatibles).

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(types): regen Supabase types après migrations Phase B'"
```

---

# Phase 3 — Frontend atoms + palette

## Task 9: CSS variables palette PE

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Ajouter les CSS variables**

Open `src/index.css`. Trouve le bloc `:root { ... }` existant. Ajoute à la fin du bloc `:root` (avant la fermeture `}`) :

```css
  /* === Palette mockup PE (Phase B') === */
  /* Texte */
  --pe-text-primary: #1a1a2e;
  --pe-text-secondary: #555;
  --pe-text-tertiary: #999;
  /* Statut */
  --pe-ok: #27ae60;
  --pe-warning: #e67e22;
  --pe-danger: #c0392b;
  --pe-info: #2e75b6;
  --pe-purple: #7F77DD;
  /* Backgrounds statut */
  --pe-bg-ok: #eafaf1;
  --pe-bg-warning: #fef9e7;
  --pe-bg-danger: #fdedec;
  --pe-bg-info: #ebf5fb;
  --pe-bg-purple: #EEEDFE;
```

- [ ] **Step 2: TypeCheck (le CSS ne casse rien mais on valide)**

Run: `npx tsc --noEmit`

Expected: Aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style(pe): palette CSS variables mockup PE (statuts ok/warning/danger/info)"
```

---

## Task 10: 7 atoms PE

**Files:**
- Create: `src/components/dashboard/viewers/atoms/pe/ScoreCircle.tsx`
- Create: `src/components/dashboard/viewers/atoms/pe/ClassificationTag.tsx`
- Create: `src/components/dashboard/viewers/atoms/pe/FinancialTable.tsx`
- Create: `src/components/dashboard/viewers/atoms/pe/ScenariosBox.tsx`
- Create: `src/components/dashboard/viewers/atoms/pe/MatchCriteriaList.tsx`
- Create: `src/components/dashboard/viewers/atoms/pe/RedFlagItem.tsx`
- Create: `src/components/dashboard/viewers/atoms/pe/DocCategoryCard.tsx`

- [ ] **Step 1: Créer le dossier**

```bash
mkdir -p /Users/yacephilippe-emmanuel/supabase-connect-631d86ba/src/components/dashboard/viewers/atoms/pe
```

- [ ] **Step 2: ScoreCircle.tsx**

```tsx
// src/components/dashboard/viewers/atoms/pe/ScoreCircle.tsx
interface Props {
  score: number;          // 0-100
  size?: 'sm' | 'md' | 'lg';
}

export default function ScoreCircle({ score, size = 'lg' }: Props) {
  const color = score >= 70 ? 'var(--pe-ok)' : score >= 40 ? 'var(--pe-warning)' : 'var(--pe-danger)';
  const bg = score >= 70 ? 'var(--pe-bg-ok)' : score >= 40 ? 'var(--pe-bg-warning)' : 'var(--pe-bg-danger)';
  const sizes = { sm: { box: 'p-2', val: 'text-base', label: 'text-[9px]' }, md: { box: 'p-3', val: 'text-xl', label: 'text-[10px]' }, lg: { box: 'p-4', val: 'text-3xl', label: 'text-xs' } };
  const cls = sizes[size];
  return (
    <div className={`text-center rounded-xl ${cls.box}`} style={{ background: bg }}>
      <div className={`font-medium ${cls.val}`} style={{ color }}>{score}</div>
      <div className={cls.label} style={{ color }}>Score global</div>
    </div>
  );
}
```

- [ ] **Step 3: ClassificationTag.tsx**

```tsx
// src/components/dashboard/viewers/atoms/pe/ClassificationTag.tsx
interface Props { classification: string | null; }

const LABELS: Record<string, { label: string; color: string; bg: string }> = {
  go_direct:        { label: 'Go direct',        color: 'var(--pe-ok)',      bg: 'var(--pe-bg-ok)' },
  go_conditionnel:  { label: 'Go conditionnel',  color: 'var(--pe-ok)',      bg: 'var(--pe-bg-ok)' },
  hold:             { label: 'Hold',             color: 'var(--pe-warning)', bg: 'var(--pe-bg-warning)' },
  reject:           { label: 'Reject',           color: 'var(--pe-danger)',  bg: 'var(--pe-bg-danger)' },
};

export default function ClassificationTag({ classification }: Props) {
  if (!classification) return null;
  const def = LABELS[classification] ?? { label: classification, color: 'var(--pe-text-secondary)', bg: '#f0f0f0' };
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: def.bg, color: def.color }}>
      {def.label}
    </span>
  );
}
```

- [ ] **Step 4: FinancialTable.tsx**

```tsx
// src/components/dashboard/viewers/atoms/pe/FinancialTable.tsx
interface Row {
  label: string;
  values: (string | number | null)[];
  highlight?: 'ok' | 'warning' | 'danger';
}
interface Props {
  headers: string[];
  rows: Row[];
  footnote?: string;
}

export default function FinancialTable({ headers, rows, footnote }: Props) {
  const colorMap = { ok: 'var(--pe-ok)', warning: 'var(--pe-warning)', danger: 'var(--pe-danger)' };
  return (
    <div className="text-sm">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `1.8fr ${headers.map(() => '1fr').join(' ')}` }}>
        <span></span>
        {headers.map((h, i) => (
          <span key={i} className="text-right text-[10px] text-muted-foreground py-1">{h}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid py-1 border-b border-border/50" style={{ gridTemplateColumns: `1.8fr ${headers.map(() => '1fr').join(' ')}` }}>
          <span className="text-muted-foreground">{row.label}</span>
          {row.values.map((v, j) => (
            <span key={j} className="text-right" style={{ color: row.highlight ? colorMap[row.highlight] : undefined, fontWeight: j === row.values.length - 1 ? 500 : undefined }}>
              {v ?? '—'}
            </span>
          ))}
        </div>
      ))}
      {footnote && <p className="text-[10px] text-muted-foreground mt-1.5">{footnote}</p>}
    </div>
  );
}
```

- [ ] **Step 5: ScenariosBox.tsx**

```tsx
// src/components/dashboard/viewers/atoms/pe/ScenariosBox.tsx
interface Scenario { moic: string; irr: string; description?: string; }
interface Props {
  bear?: Scenario;
  base?: Scenario;
  bull?: Scenario;
  pre_money_indicatif?: string;
}

export default function ScenariosBox({ bear, base, bull, pre_money_indicatif }: Props) {
  return (
    <div>
      <div className="flex flex-col gap-1 text-sm">
        {bear && (
          <div className="flex justify-between"><span className="text-muted-foreground">Bear</span><span style={{ color: 'var(--pe-warning)', fontWeight: 500 }}>{bear.moic} · IRR {bear.irr}</span></div>
        )}
        {base && (
          <div className="flex justify-between"><span style={{ color: 'var(--pe-info)' }}>Base</span><span style={{ color: 'var(--pe-info)', fontWeight: 500 }}>{base.moic} · IRR {base.irr}</span></div>
        )}
        {bull && (
          <div className="flex justify-between"><span className="text-muted-foreground">Bull</span><span style={{ color: 'var(--pe-ok)', fontWeight: 500 }}>{bull.moic} · IRR {bull.irr}</span></div>
        )}
      </div>
      {pre_money_indicatif && (
        <p className="text-[10px] text-muted-foreground mt-1.5">Pre-money indicatif : {pre_money_indicatif}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: MatchCriteriaList.tsx**

```tsx
// src/components/dashboard/viewers/atoms/pe/MatchCriteriaList.tsx
interface Criterion { label: string; status: 'match' | 'partial' | 'no'; }
interface Props {
  criteria: Criterion[];
  match_count?: number;
  total?: number;
  score_percent?: number;
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  match:   { label: 'Match',   bg: 'var(--pe-bg-ok)',      color: 'var(--pe-ok)' },
  partial: { label: 'Partiel', bg: 'var(--pe-bg-warning)', color: 'var(--pe-warning)' },
  no:      { label: 'No-match',bg: 'var(--pe-bg-danger)',  color: 'var(--pe-danger)' },
};

export default function MatchCriteriaList({ criteria, match_count, total, score_percent }: Props) {
  return (
    <div>
      <div className="flex flex-col gap-1 text-sm">
        {criteria.map((c, i) => {
          const s = STATUS_STYLE[c.status] ?? STATUS_STYLE.no;
          return (
            <div key={i} className="flex justify-between">
              <span className="text-muted-foreground">{c.label}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: s.bg, color: s.color }}>{s.label}</span>
            </div>
          );
        })}
      </div>
      {(match_count !== undefined || score_percent !== undefined) && (
        <div className="border-t border-border mt-1.5 pt-1.5 text-sm">
          <span className="text-muted-foreground">{match_count}/{total} critères remplis · Adéquation</span>
          {' '}<span style={{ fontWeight: 500, color: 'var(--pe-ok)' }}>{score_percent}%</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: RedFlagItem.tsx**

```tsx
// src/components/dashboard/viewers/atoms/pe/RedFlagItem.tsx
interface Props {
  title: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
}

const SEV_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  high:   { bg: 'var(--pe-bg-danger)',  border: 'var(--pe-danger)',  color: 'var(--pe-danger)',  label: 'Impact fort' },
  medium: { bg: 'var(--pe-bg-warning)', border: 'var(--pe-warning)', color: 'var(--pe-warning)', label: 'Impact modéré' },
  low:    { bg: 'var(--pe-bg-info)',    border: 'var(--pe-info)',    color: 'var(--pe-info)',    label: 'Informatif' },
};

export default function RedFlagItem({ title, severity, detail }: Props) {
  const s = SEV_STYLE[severity];
  return (
    <div className="rounded px-2 py-1.5 my-1 text-sm" style={{ background: s.bg, borderLeft: `3px solid ${s.border}` }}>
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="font-medium text-[11px]" style={{ color: s.color }}>{title}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
      </div>
      <p className="text-[10px] leading-relaxed" style={{ color: s.color, opacity: 0.85 }}>{detail}</p>
    </div>
  );
}
```

- [ ] **Step 8: DocCategoryCard.tsx**

```tsx
// src/components/dashboard/viewers/atoms/pe/DocCategoryCard.tsx
interface ChecklistItem { label: string; status: 'ok' | 'partial' | 'missing'; }
interface Props {
  name: string;
  level: 'N0' | 'N1' | 'N2';
  checklist: ChecklistItem[];
}

const LEVEL_STYLE: Record<string, { bg: string; color: string }> = {
  N0: { bg: 'var(--pe-bg-danger)',  color: 'var(--pe-danger)' },
  N1: { bg: 'var(--pe-bg-warning)', color: 'var(--pe-warning)' },
  N2: { bg: 'var(--pe-bg-ok)',      color: 'var(--pe-ok)' },
};
const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  ok:      { icon: '✓',       color: 'var(--pe-ok)' },
  partial: { icon: 'partiel', color: 'var(--pe-warning)' },
  missing: { icon: '✗',       color: 'var(--pe-danger)' },
};

export default function DocCategoryCard({ name, level, checklist }: Props) {
  const ls = LEVEL_STYLE[level];
  return (
    <div className="text-[10px]">
      <div className="font-medium mb-1 flex items-center gap-2">
        <span>{name}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: ls.bg, color: ls.color }}>{level}</span>
      </div>
      {checklist.map((item, i) => (
        <div key={i} className="flex justify-between py-0.5">
          <span className="text-muted-foreground">{item.label}</span>
          <span style={{ color: STATUS_ICON[item.status].color }}>{STATUS_ICON[item.status].icon}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: TypeCheck**

Run: `npx tsc --noEmit`

Expected: Aucune erreur.

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard/viewers/atoms/pe/
git commit -m "feat(pe): 7 atoms PE (ScoreCircle, ClassificationTag, FinancialTable, ScenariosBox, MatchCriteriaList, RedFlagItem, DocCategoryCard)"
```

---

## Task 11: Composants partagés DocumentDropzone + RegenerateConfirmDialog

**Files:**
- Create: `src/components/pe/DocumentDropzone.tsx`
- Create: `src/components/pe/RegenerateConfirmDialog.tsx`

- [ ] **Step 1: DocumentDropzone.tsx**

```tsx
// src/components/pe/DocumentDropzone.tsx
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  dealId: string;
  organizationId: string;
  onUploaded?: (docId: string, filename: string) => void;
  className?: string;
  children?: React.ReactNode;
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export default function DocumentDropzone({ dealId, organizationId, onUploaded, className, children }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      const arr = Array.from(files);
      for (const file of arr) {
        if (file.size > MAX_SIZE_BYTES) {
          toast.error(`${file.name} dépasse la limite de 50 Mo`);
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${organizationId}/${dealId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from('pe_deal_docs').upload(path, file);
        if (upErr) {
          toast.error(`Upload ${file.name} échoué : ${upErr.message}`);
          continue;
        }
        const { data: { user } } = await supabase.auth.getUser();
        const { data: row, error: dbErr } = await supabase
          .from('pe_deal_documents')
          .insert({
            deal_id: dealId,
            organization_id: organizationId,
            filename: file.name,
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
            uploaded_by: user!.id,
          })
          .select('id')
          .single();
        if (dbErr) {
          toast.error(`Enregistrement ${file.name} échoué : ${dbErr.message}`);
          continue;
        }
        toast.success(`${file.name} uploadé`);
        onUploaded?.(row.id, file.name);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`relative rounded-lg border-2 border-dashed transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'} ${className ?? ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) await handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => { if (e.target.files) await handleFiles(e.target.files); e.target.value = ''; }}
      />
      {uploading ? (
        <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Upload en cours...
        </div>
      ) : children ? children : (
        <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
          <Upload className="h-4 w-4" /> Glisser-déposer ou cliquer pour ajouter des documents
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: RegenerateConfirmDialog.tsx**

```tsx
// src/components/pe/RegenerateConfirmDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newDocsCount: number;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function RegenerateConfirmDialog({ open, onOpenChange, newDocsCount, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Régénérer le pré-screening ?</DialogTitle>
          <DialogDescription>
            {newDocsCount} nouveau{newDocsCount > 1 ? 'x' : ''} document{newDocsCount > 1 ? 's' : ''} ajouté{newDocsCount > 1 ? 's' : ''}.
            Veux-tu régénérer le pré-screening en intégrant ce contenu ? Une nouvelle version sera créée et l'actuelle restera accessible dans l'onglet Historique.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onCancel?.(); onOpenChange(false); }}>Garder l'actuel</Button>
          <Button onClick={() => { onConfirm(); onOpenChange(false); }}>Régénérer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: TypeCheck**

Run: `npx tsc --noEmit`

Expected: Aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/components/pe/DocumentDropzone.tsx src/components/pe/RegenerateConfirmDialog.tsx
git commit -m "feat(pe): DocumentDropzone (drag-drop upload) + RegenerateConfirmDialog"
```

**🚦 Checkpoint phase 3** — Stop ici, demande au user de continuer vers Phase 4 (renderers).

---

# Phase 4 — Frontend renderers

## Task 12: MemoSectionsViewer (orchestrateur)

**Files:**
- Create: `src/components/pe/MemoSectionsViewer.tsx`
- Create: `src/components/pe/sections/index.ts` (barrel export)

- [ ] **Step 1: MemoSectionsViewer.tsx**

```tsx
// src/components/pe/MemoSectionsViewer.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import ScoreCircle from '@/components/dashboard/viewers/atoms/pe/ScoreCircle';
import ClassificationTag from '@/components/dashboard/viewers/atoms/pe/ClassificationTag';
import * as Sections from './sections';

type SectionCode =
  | 'executive_summary' | 'shareholding_governance' | 'top_management' | 'services'
  | 'competition_market' | 'unit_economics' | 'financials_pnl' | 'financials_balance'
  | 'investment_thesis' | 'support_requested' | 'esg_risks' | 'annexes';

const SECTION_RENDERERS: Record<SectionCode, React.ComponentType<{ section: any; allSections?: Record<string, any> }>> = {
  executive_summary:        Sections.ExecutiveSummarySection,
  shareholding_governance:  Sections.ShareholdingGovernanceSection,
  top_management:           Sections.TopManagementSection,
  services:                 Sections.ServicesSection,
  competition_market:       Sections.CompetitionMarketSection,
  unit_economics:           Sections.UnitEconomicsSection,
  financials_pnl:           Sections.FinancialsPnlSection,
  financials_balance:       Sections.FinancialsBalanceSection,
  investment_thesis:        Sections.InvestmentThesisSection,
  support_requested:        Sections.SupportRequestedSection,
  esg_risks:                Sections.EsgRisksSection,
  annexes:                  Sections.AnnexesSection,
};

interface Props {
  dealId: string;
  versionStage: 'pre_screening' | 'note_ic1' | 'note_ic_finale';
}

export default function MemoSectionsViewer({ dealId, versionStage }: Props) {
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<any>(null);
  const [sections, setSections] = useState<Record<string, any>>({});
  const [deal, setDeal] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: dealData } = await supabase.from('pe_deals').select('id, name, deal_ref, source, sector, country, ticket_amount').eq('id', dealId).maybeSingle();
      if (cancelled) return;
      setDeal(dealData);

      const { data: memo } = await supabase.from('investment_memos').select('id').eq('deal_id', dealId).maybeSingle();
      if (!memo) { setLoading(false); return; }
      const { data: versions } = await supabase.from('memo_versions')
        .select('*').eq('memo_id', memo.id).eq('stage', versionStage).eq('status', 'ready')
        .order('created_at', { ascending: false }).limit(1);
      const v = versions?.[0];
      if (!v) { setLoading(false); return; }
      setVersion(v);

      const { data: secs } = await supabase.from('memo_sections').select('*').eq('version_id', v.id).order('position');
      const map: Record<string, any> = {};
      (secs ?? []).forEach((s: any) => { map[s.section_code] = s; });
      if (cancelled) return;
      setSections(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId, versionStage]);

  if (loading) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> Chargement...</div>;
  if (!version) return <div className="p-8 text-muted-foreground">Aucune version {versionStage} disponible.</div>;

  return (
    <div className="space-y-3 text-sm">
      {/* Header */}
      <Card>
        <CardContent className="p-4 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Pré-screening 360° enrichi</span>
              <ClassificationTag classification={version.classification} />
            </div>
            <div className="text-lg font-medium">{deal?.name}</div>
            <div className="text-muted-foreground text-xs">
              {deal?.sector ?? '—'} · {deal?.country ?? '—'}
              {deal?.deal_ref && <> · Deal ref. {deal.deal_ref}</>}
            </div>
          </div>
          <div className="flex gap-2 items-start">
            {deal?.source && (
              <div className="text-center px-3 py-1.5 bg-muted rounded">
                <div className="text-[10px] text-muted-foreground">Source</div>
                <div className="text-sm font-medium">{deal.source}</div>
              </div>
            )}
            {version.overall_score != null && <ScoreCircle score={Number(version.overall_score)} />}
          </div>
        </CardContent>
      </Card>

      {/* 12 sections */}
      {(Object.keys(SECTION_RENDERERS) as SectionCode[]).map((code) => {
        const Renderer = SECTION_RENDERERS[code];
        const sec = sections[code];
        if (!sec) return null;
        return <Renderer key={code} section={sec} allSections={sections} />;
      })}
    </div>
  );
}
```

- [ ] **Step 2: barrel export `src/components/pe/sections/index.ts`**

```bash
mkdir -p /Users/yacephilippe-emmanuel/supabase-connect-631d86ba/src/components/pe/sections
```

Créer `src/components/pe/sections/index.ts` :

```typescript
export { default as ExecutiveSummarySection } from './ExecutiveSummarySection';
export { default as ShareholdingGovernanceSection } from './ShareholdingGovernanceSection';
export { default as TopManagementSection } from './TopManagementSection';
export { default as ServicesSection } from './ServicesSection';
export { default as CompetitionMarketSection } from './CompetitionMarketSection';
export { default as UnitEconomicsSection } from './UnitEconomicsSection';
export { default as FinancialsPnlSection } from './FinancialsPnlSection';
export { default as FinancialsBalanceSection } from './FinancialsBalanceSection';
export { default as InvestmentThesisSection } from './InvestmentThesisSection';
export { default as SupportRequestedSection } from './SupportRequestedSection';
export { default as EsgRisksSection } from './EsgRisksSection';
export { default as AnnexesSection } from './AnnexesSection';
```

- [ ] **Step 3: TypeCheck (échouera car les sections n'existent pas encore — c'est attendu)**

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: Erreurs `Cannot find module './ExecutiveSummarySection'` etc. → on fixe en Task 13.

- [ ] **Step 4: Pas de commit (attendre Task 13 pour avoir un état compilable)**

---

## Task 13: Section renderers 1-6

**Files:**
- Create: `src/components/pe/sections/ExecutiveSummarySection.tsx`
- Create: `src/components/pe/sections/ShareholdingGovernanceSection.tsx`
- Create: `src/components/pe/sections/TopManagementSection.tsx`
- Create: `src/components/pe/sections/ServicesSection.tsx`
- Create: `src/components/pe/sections/CompetitionMarketSection.tsx`
- Create: `src/components/pe/sections/UnitEconomicsSection.tsx`

Chaque section reçoit `{ section, allSections }`. Le content_json contient des données spécifiques à la section + on a accès aux autres sections via `allSections` pour composer le viewer.

- [ ] **Step 1: ExecutiveSummarySection.tsx (le plus riche, contient kpis_bandeau + ai_synthesis)**

```tsx
// src/components/pe/sections/ExecutiveSummarySection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

interface Props { section: { content_md: string | null; content_json: any }; allSections?: Record<string, any>; }

export default function ExecutiveSummarySection({ section }: Props) {
  const kpis: any[] = section.content_json?.kpis_bandeau ?? [];
  const synth = section.content_json?.ai_synthesis;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Résumé exécutif</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {kpis.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {kpis.map((k: any, i: number) => (
              <div key={i} className="bg-muted rounded px-2 py-1.5 text-center flex-1 min-w-[100px]">
                <div className="text-[9px] text-muted-foreground">{k.label}</div>
                <div className="text-base font-medium">{k.value}</div>
                {k.hint && (
                  <div className="text-[9px]" style={{ color: k.hint_color === 'ok' ? 'var(--pe-ok)' : k.hint_color === 'warning' ? 'var(--pe-warning)' : 'var(--pe-text-secondary)' }}>{k.hint}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground"><ReactMarkdown>{section.content_md}</ReactMarkdown></div>
        )}
        {synth?.paragraph && (
          <div className="text-sm leading-relaxed text-muted-foreground border-t pt-2">
            <p>{synth.paragraph}</p>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {(synth.strengths_tags ?? []).map((t: string, i: number) => (
                <Badge key={i} variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>+ {t}</Badge>
              ))}
              {(synth.weaknesses_tags ?? []).map((t: string, i: number) => (
                <Badge key={i} variant="outline" style={{ background: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', border: 'none' }}>- {t}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: ShareholdingGovernanceSection.tsx**

```tsx
// src/components/pe/sections/ShareholdingGovernanceSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function ShareholdingGovernanceSection({ section }: Props) {
  const items: any[] = section.content_json?.actionnariat?.items ?? [];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Actionnariat et gouvernance</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.length > 0 && (
          <div className="space-y-1 text-sm">
            {items.map((it: any, i: number) => (
              <div key={i} className="flex justify-between border-b border-border/50 py-1">
                <div>
                  <span className="font-medium">{it.label}</span>
                  {it.subtitle && <span className="text-xs text-muted-foreground ml-2">{it.subtitle}</span>}
                </div>
                {it.percent != null && <span className="font-medium">{it.percent}%</span>}
              </div>
            ))}
          </div>
        )}
        {section.content_md && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">{section.content_md}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: TopManagementSection.tsx**

```tsx
// src/components/pe/sections/TopManagementSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props { section: { content_md: string | null; content_json: any }; }

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  ok:      { bg: 'var(--pe-bg-ok)',      color: 'var(--pe-ok)' },
  warning: { bg: 'var(--pe-bg-warning)', color: 'var(--pe-warning)' },
  danger:  { bg: 'var(--pe-bg-danger)',  color: 'var(--pe-danger)' },
};

export default function TopManagementSection({ section }: Props) {
  const items: any[] = section.content_json?.management?.items ?? [];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Top management</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((m: any, i: number) => {
          const ts = m.tag ? TAG_STYLE[m.tag] : null;
          return (
            <div key={i} className="text-sm border-b border-border/50 py-1.5">
              <div className="flex items-center gap-2">
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">— {m.role}</span>
                {ts && <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: ts.bg, color: ts.color }}>{m.tag}</span>}
              </div>
              {m.note && <p className="text-xs text-muted-foreground mt-0.5">{m.note}</p>}
            </div>
          );
        })}
        {section.content_md && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">{section.content_md}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: ServicesSection.tsx**

```tsx
// src/components/pe/sections/ServicesSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function ServicesSection({ section }: Props) {
  const activite: string | undefined = section.content_json?.activite;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Services</CardTitle></CardHeader>
      <CardContent>
        {activite && <p className="text-sm leading-relaxed mb-2">{activite}</p>}
        {section.content_md && (
          <p className="text-sm text-muted-foreground leading-relaxed">{section.content_md}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: CompetitionMarketSection.tsx**

```tsx
// src/components/pe/sections/CompetitionMarketSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function CompetitionMarketSection({ section }: Props) {
  const bm = section.content_json?.benchmark;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Concurrence et marché — Benchmark sectoriel</CardTitle></CardHeader>
      <CardContent>
        {bm?.headers?.length > 0 && bm.rows?.length > 0 && (
          <div className="text-sm">
            <div className="grid grid-cols-4 border-b border-border text-[10px] text-muted-foreground py-1">
              <span>Ratio</span>
              {bm.headers.map((h: string, i: number) => <span key={i} className="text-right">{h}</span>)}
            </div>
            {bm.rows.map((r: any, i: number) => (
              <div key={i} className="grid grid-cols-4 py-1 border-b border-border/30">
                <span className="text-muted-foreground">{r.ratio}</span>
                <span className="text-right font-medium">{r.company}</span>
                <span className="text-right">{r.median}</span>
                <span className="text-right" style={{ color: 'var(--pe-ok)' }}>{r.quartile}</span>
              </div>
            ))}
          </div>
        )}
        {bm?.source && <p className="text-[10px] text-muted-foreground mt-1.5">Source : {bm.source}</p>}
        {section.content_md && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">{section.content_md}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: UnitEconomicsSection.tsx**

```tsx
// src/components/pe/sections/UnitEconomicsSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function UnitEconomicsSection({ section }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Units economics</CardTitle></CardHeader>
      <CardContent>
        {section.content_md
          ? <div className="prose prose-sm max-w-none text-foreground"><ReactMarkdown>{section.content_md}</ReactMarkdown></div>
          : <p className="text-sm text-muted-foreground">Non renseigné.</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: TypeCheck**

Run: `npx tsc --noEmit`

Expected: Erreurs résiduelles uniquement sur les 6 sections restantes (Task 14).

- [ ] **Step 8: Pas de commit (attendre Task 14)**

---

## Task 14: Section renderers 7-12

**Files:**
- Create: `src/components/pe/sections/FinancialsPnlSection.tsx`
- Create: `src/components/pe/sections/FinancialsBalanceSection.tsx`
- Create: `src/components/pe/sections/InvestmentThesisSection.tsx`
- Create: `src/components/pe/sections/SupportRequestedSection.tsx`
- Create: `src/components/pe/sections/EsgRisksSection.tsx`
- Create: `src/components/pe/sections/AnnexesSection.tsx`

- [ ] **Step 1: FinancialsPnlSection.tsx**

```tsx
// src/components/pe/sections/FinancialsPnlSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FinancialTable from '@/components/dashboard/viewers/atoms/pe/FinancialTable';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function FinancialsPnlSection({ section }: Props) {
  const snap = section.content_json?.snapshot_3y;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">États financiers PnL — Snapshot 3 ans</CardTitle></CardHeader>
      <CardContent>
        {snap?.headers?.length > 0 && snap?.rows?.length > 0 && (
          <FinancialTable headers={snap.headers} rows={snap.rows} footnote={snap.footnote} />
        )}
        {section.content_md && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">{section.content_md}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: FinancialsBalanceSection.tsx**

```tsx
// src/components/pe/sections/FinancialsBalanceSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function FinancialsBalanceSection({ section }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">États financiers — Bilan</CardTitle></CardHeader>
      <CardContent>
        {section.content_md
          ? <div className="prose prose-sm max-w-none text-foreground"><ReactMarkdown>{section.content_md}</ReactMarkdown></div>
          : <p className="text-sm text-muted-foreground">Non renseigné.</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: InvestmentThesisSection.tsx (le plus dense — match thèse + scénarios + recommandation)**

```tsx
// src/components/pe/sections/InvestmentThesisSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import MatchCriteriaList from '@/components/dashboard/viewers/atoms/pe/MatchCriteriaList';
import ScenariosBox from '@/components/dashboard/viewers/atoms/pe/ScenariosBox';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function InvestmentThesisSection({ section }: Props) {
  const thesisMatch = section.content_json?.thesis_match;
  const scenarios = section.content_json?.scenarios_returns;
  const reco = section.content_json?.recommendation;

  return (
    <Card style={{ borderColor: 'var(--pe-ok)', borderWidth: 2 }}>
      <CardHeader className="pb-2"><CardTitle className="text-base">Thèse d'investissement</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {thesisMatch && (
          <div>
            <div className="text-sm font-medium mb-1.5">Adéquation thèse du fonds</div>
            <MatchCriteriaList
              criteria={thesisMatch.criteria ?? []}
              match_count={thesisMatch.match_count}
              total={thesisMatch.total}
              score_percent={thesisMatch.score_percent}
            />
          </div>
        )}

        {scenarios && (
          <div>
            <div className="text-sm font-medium mb-1.5">Scénarios retour (horizon 5 ans)</div>
            <ScenariosBox bear={scenarios.bear} base={scenarios.base} bull={scenarios.bull} pre_money_indicatif={scenarios.pre_money_indicatif} />
          </div>
        )}

        {reco && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex gap-2 items-start">
              <Badge variant="default" style={{ background: 'var(--pe-bg-ok)', color: 'var(--pe-ok)', border: 'none', fontSize: '13px', padding: '4px 12px' }}>
                {reco.verdict?.replace('_', ' ') ?? '—'}
              </Badge>
              {reco.summary && <p className="text-xs text-muted-foreground leading-relaxed flex-1">{reco.summary}</p>}
            </div>
            {(reco.conditions ?? []).length > 0 && (
              <div className="space-y-1">
                {reco.conditions.map((c: any, i: number) => (
                  <div key={i} className="flex gap-2 items-start text-xs">
                    <Badge variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>Condition {c.n}</Badge>
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>
            )}
            {(reco.deal_breakers ?? []).length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="text-muted-foreground">Deal breakers : </span>
                {reco.deal_breakers.map((db: string, i: number) => <span key={i} style={{ color: 'var(--pe-danger)' }}>{i > 0 ? ' · ' : ''}{db}</span>)}
              </p>
            )}
            {reco.conviction && (
              <p className="text-xs"><span className="text-muted-foreground">Niveau de conviction : </span><span style={{ color: 'var(--pe-info)', fontWeight: 500 }}>{reco.conviction}</span></p>
            )}
          </div>
        )}

        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground border-t pt-2"><ReactMarkdown>{section.content_md}</ReactMarkdown></div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: SupportRequestedSection.tsx**

```tsx
// src/components/pe/sections/SupportRequestedSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function SupportRequestedSection({ section }: Props) {
  const uop: any[] = section.content_json?.use_of_proceeds ?? [];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Accompagnement demandé — Use of proceeds</CardTitle></CardHeader>
      <CardContent>
        {uop.length > 0 && (
          <div className="space-y-1 text-sm mb-2">
            {uop.map((u: any, i: number) => (
              <div key={i} className="flex justify-between border-b border-border/30 py-1">
                <span className="text-muted-foreground">{u.label}</span>
                <span className="font-medium">{u.percent}%</span>
              </div>
            ))}
          </div>
        )}
        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground"><ReactMarkdown>{section.content_md}</ReactMarkdown></div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: EsgRisksSection.tsx**

```tsx
// src/components/pe/sections/EsgRisksSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RedFlagItem from '@/components/dashboard/viewers/atoms/pe/RedFlagItem';
import ReactMarkdown from 'react-markdown';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function EsgRisksSection({ section }: Props) {
  const flags: any[] = section.content_json?.red_flags ?? [];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base" style={{ color: flags.length ? 'var(--pe-danger)' : undefined }}>ESG / Risques</CardTitle></CardHeader>
      <CardContent>
        {flags.length > 0 ? (
          <div className="space-y-1.5">
            {flags.map((f: any, i: number) => (
              <RedFlagItem key={i} title={f.title} severity={f.severity} detail={f.detail} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun red flag identifié.</p>
        )}
        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground mt-2 border-t pt-2"><ReactMarkdown>{section.content_md}</ReactMarkdown></div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: AnnexesSection.tsx**

```tsx
// src/components/pe/sections/AnnexesSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DocCategoryCard from '@/components/dashboard/viewers/atoms/pe/DocCategoryCard';
import ReactMarkdown from 'react-markdown';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function AnnexesSection({ section }: Props) {
  const dq = section.content_json?.doc_quality;
  const cats: any[] = dq?.categories ?? [];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Annexes — Qualité du dossier documentaire</CardTitle></CardHeader>
      <CardContent>
        {cats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cats.map((c: any, i: number) => (
              <DocCategoryCard key={i} name={c.name} level={c.level} checklist={c.checklist} />
            ))}
          </div>
        )}
        {(dq?.global_level || dq?.summary) && (
          <div className="border-t mt-2 pt-2 text-sm">
            {dq.global_level && <span className="font-medium" style={{ color: 'var(--pe-warning)' }}>Score qualité global : {dq.global_level} </span>}
            {dq.summary && <span className="text-muted-foreground">— {dq.summary}</span>}
          </div>
        )}
        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground mt-2"><ReactMarkdown>{section.content_md}</ReactMarkdown></div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Vérifier que `react-markdown` est installé**

Run:
```bash
grep "react-markdown" /Users/yacephilippe-emmanuel/supabase-connect-631d86ba/package.json
```

Expected: `"react-markdown": "^X.X.X"` doit apparaître. **Si manquant** :

```bash
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
npm install react-markdown
```

- [ ] **Step 8: TypeCheck complet**

Run: `npx tsc --noEmit`

Expected: Aucune erreur (12 sections + viewer + atoms tous compilent).

- [ ] **Step 9: Commit**

```bash
git add src/components/pe/MemoSectionsViewer.tsx src/components/pe/sections/
git commit -m "feat(pe): MemoSectionsViewer + 12 section renderers (mockup-driven)"
```

**🚦 Checkpoint phase 4** — Stop ici, demande au user de continuer vers Phase 5 (pages).

---

# Phase 5 — Frontend pages

## Task 15: PE stage config + PePipelinePage 7 colonnes

**Files:**
- Create: `src/lib/pe-stage-config.ts`
- Modify: `src/pages/pe/PePipelinePage.tsx`

- [ ] **Step 1: Créer pe-stage-config.ts**

```typescript
// src/lib/pe-stage-config.ts
// Définit les colonnes du kanban PE selon le rôle.

export type PeStage =
  | 'sourcing'
  | 'pre_screening'
  | 'note_ic1'
  | 'dd'
  | 'note_ic_finale'
  | 'closing'
  | 'portfolio'
  | 'lost'
  | 'analyse';  // legacy, ne sera plus jamais utilisé en Phase B'+

export interface StageDef { code: PeStage; label: string; }

// 7 colonnes en ordre canonique (sans 'lost' et sans 'analyse')
const ALL_STAGES: StageDef[] = [
  { code: 'sourcing',       label: 'Sourcing' },
  { code: 'pre_screening',  label: 'Pré-screening' },
  { code: 'note_ic1',       label: 'Note IC1' },
  { code: 'dd',             label: 'DD' },
  { code: 'note_ic_finale', label: 'Note IC finale' },
  { code: 'closing',        label: 'Closing' },
  { code: 'portfolio',      label: 'Portfolio' },
];

/** Retourne les stages affichés selon le rôle PE. */
export function getStagesForRole(role: string | null | undefined): StageDef[] {
  if (role === 'analyste' || role === 'analyst') {
    // Analyste : focus sur ses deals en travail (pas de sourcing initial, pas de portfolio)
    return ALL_STAGES.filter(s => !['sourcing', 'closing', 'portfolio'].includes(s.code));
  }
  if (role === 'investment_manager') {
    // IM : voit tout sauf sourcing et portfolio (focus sur deals en analyse + IC)
    return ALL_STAGES.filter(s => !['sourcing', 'portfolio'].includes(s.code));
  }
  // MD, admin, owner, super_admin : pipeline complet
  return ALL_STAGES;
}
```

- [ ] **Step 2: Lire le PePipelinePage actuel pour identifier les modifications**

Run:
```bash
head -80 /Users/yacephilippe-emmanuel/supabase-connect-631d86ba/src/pages/pe/PePipelinePage.tsx
```

Note : fichier de 188 lignes, on cherche le tableau `STAGES` ou `STAGE_LIST` à remplacer.

- [ ] **Step 3: Modifier PePipelinePage.tsx**

Ouvrir `src/pages/pe/PePipelinePage.tsx` et :

1. **Importer** `getStagesForRole` :
```tsx
import { getStagesForRole } from '@/lib/pe-stage-config';
import { useCurrentRole } from '@/hooks/useCurrentRole';
```

2. **Remplacer** la définition statique du tableau de stages (probablement nommé `STAGES`, `STAGE_LIST`, ou inline dans `kanbanColumns`) par un appel à `getStagesForRole`. Dans le composant, ajouter au début (après les autres hooks) :

```tsx
const { role } = useCurrentRole();
const stages = useMemo(() => getStagesForRole(role), [role]);
```

3. **Si l'ancien code itère** sur un tableau `STAGES` avec un mapping label, **remplacer** par `stages.map(s => ...)` qui utilise `s.code` et `s.label`.

4. **Renommer** dans tous les labels affichés : `IC1` → `Note IC1`, `IC finale` → `Note IC finale` (cohérence avec les nouveaux noms d'enum).

5. **Ne pas afficher** la colonne `analyse` (legacy).

- [ ] **Step 4: TypeCheck**

Run: `npx tsc --noEmit`

Expected: Aucune erreur.

- [ ] **Step 5: Démarrer le dev et vérifier visuellement**

Run:
```bash
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
npm run dev
```

Ouvrir `http://localhost:8080/pe/pipeline` connecté en tant que MD → vérifier 7 colonnes. Connecté en tant qu'analyste → vérifier 4 colonnes (sans Sourcing/Closing/Portfolio).

- [ ] **Step 6: Commit**

```bash
git add src/lib/pe-stage-config.ts src/pages/pe/PePipelinePage.tsx
git commit -m "feat(pe): kanban 7 colonnes filtré par rôle (lib pe-stage-config + useCurrentRole)"
```

---

## Task 16: PeDealCard avec badges + dropzone

**Files:**
- Modify: `src/components/pe/PeDealCard.tsx`

- [ ] **Step 1: Lire le fichier actuel**

Run:
```bash
cat /Users/yacephilippe-emmanuel/supabase-connect-631d86ba/src/components/pe/PeDealCard.tsx
```

44 lignes — assez court pour réécrire complètement.

- [ ] **Step 2: Réécrire PeDealCard.tsx**

```tsx
// src/components/pe/PeDealCard.tsx
import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Paperclip, FileCheck2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DocumentDropzone from './DocumentDropzone';
import RegenerateConfirmDialog from './RegenerateConfirmDialog';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface Props {
  deal: {
    id: string;
    name: string;
    organization_id: string;
    ticket_amount: number | null;
    sector?: string | null;
    stage: string;
  };
  onClick?: () => void;
  onRefresh?: () => void;
}

interface VersionSummary {
  status: 'generating' | 'ready' | 'rejected' | 'validated';
  overall_score: number | null;
  stage: string;
}

export default function PeDealCard({ deal, onClick, onRefresh }: Props) {
  const [docCount, setDocCount] = useState(0);
  const [latest, setLatest] = useState<VersionSummary | null>(null);
  const [pollOn, setPollOn] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingFiles = useRef<File[]>([]);

  const reloadCard = async () => {
    const [docsRes, versionsRes] = await Promise.all([
      supabase.from('pe_deal_documents').select('id', { count: 'exact' }).eq('deal_id', deal.id),
      supabase.from('memo_versions').select('status, overall_score, stage, investment_memos!inner(deal_id)').eq('investment_memos.deal_id', deal.id).order('created_at', { ascending: false }).limit(1),
    ]);
    setDocCount(docsRes.count ?? 0);
    setLatest((versionsRes.data?.[0] as any) ?? null);
    if ((versionsRes.data?.[0] as any)?.status === 'generating') setPollOn(true);
    else setPollOn(false);
  };

  useEffect(() => { reloadCard(); }, [deal.id]);

  // Polling pendant génération
  useEffect(() => {
    if (!pollOn) return;
    const t = setInterval(reloadCard, 3000);
    return () => clearInterval(t);
  }, [pollOn]);

  const triggerGeneration = async () => {
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pe-pre-screening`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ deal_id: deal.id }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Échec génération');
      toast.success(`Pré-screening lancé pour ${deal.name}`);
      setPollOn(true);
      onRefresh?.();
    } catch (e: any) {
      toast.error(`Génération échouée : ${e.message}`);
    }
  };

  const handleAfterUpload = async () => {
    await reloadCard();
    // Cas A : sourcing + 1ers docs → auto-trigger
    if (deal.stage === 'sourcing' && !latest) {
      await triggerGeneration();
      return;
    }
    // Cas B : déjà version pre_screening 'ready' → demander confirmation
    if (latest?.stage === 'pre_screening' && latest?.status === 'ready') {
      setConfirmOpen(true);
    }
  };

  const renderBadges = () => (
    <div className="flex items-center gap-1 text-[10px]">
      <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{docCount}</span>
      {latest?.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {latest?.status === 'ready' && latest?.stage === 'pre_screening' && <FileCheck2 className="h-3 w-3" style={{ color: 'var(--pe-ok)' }} aria-label="Pré-screening" />}
      {latest?.overall_score != null && (
        <span className="font-medium" style={{ color: latest.overall_score >= 70 ? 'var(--pe-ok)' : latest.overall_score >= 40 ? 'var(--pe-warning)' : 'var(--pe-danger)' }}>
          {latest.overall_score}
        </span>
      )}
    </div>
  );

  return (
    <>
      <DocumentDropzone
        dealId={deal.id}
        organizationId={deal.organization_id}
        onUploaded={handleAfterUpload}
        className="border-transparent"
      >
        <Card className="cursor-pointer hover:shadow-md transition-shadow p-2.5 text-xs" onClick={onClick}>
          <div className="font-medium mb-0.5">{deal.name}</div>
          <div className="text-muted-foreground text-[11px]">
            {deal.ticket_amount ? `${(deal.ticket_amount / 1_000_000).toFixed(1)}M €` : '—'}
            {deal.sector && <> · {deal.sector}</>}
          </div>
          <div className="mt-1.5">{renderBadges()}</div>
        </Card>
      </DocumentDropzone>

      <RegenerateConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        newDocsCount={1}
        onConfirm={triggerGeneration}
      />
    </>
  );
}
```

- [ ] **Step 3: TypeCheck**

Run: `npx tsc --noEmit`

Expected: Aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/components/pe/PeDealCard.tsx
git commit -m "feat(pe): PeDealCard avec dropzone + polling status + badges (docs, score, génération)"
```

---

## Task 17: PeDealDetailPage onglets enrichis

**Files:**
- Modify: `src/pages/pe/PeDealDetailPage.tsx`

- [ ] **Step 1: Lire le fichier actuel**

Run:
```bash
head -100 /Users/yacephilippe-emmanuel/supabase-connect-631d86ba/src/pages/pe/PeDealDetailPage.tsx
```

Identifier la structure existante des `Tabs` (probablement shadcn/ui `<Tabs><TabsList><TabsTrigger>...<TabsContent>`).

- [ ] **Step 2: Modifier PeDealDetailPage.tsx**

Importer les nouveaux composants en haut du fichier :

```tsx
import MemoSectionsViewer from '@/components/pe/MemoSectionsViewer';
import DealDocumentsList from '@/components/pe/DealDocumentsList';
import DealHistoryTimeline from '@/components/pe/DealHistoryTimeline';
```

Dans le bloc `<Tabs>`, **remplacer** les contenus placeholders des onglets `pre_screening`, `note_ic1`, `documents`, `historique` par :

```tsx
<TabsContent value="pre_screening">
  <MemoSectionsViewer dealId={deal.id} versionStage="pre_screening" />
</TabsContent>

<TabsContent value="note_ic1">
  <MemoSectionsViewer dealId={deal.id} versionStage="note_ic1" />
</TabsContent>

<TabsContent value="documents">
  <DealDocumentsList dealId={deal.id} organizationId={deal.organization_id} />
</TabsContent>

<TabsContent value="historique">
  <DealHistoryTimeline dealId={deal.id} />
</TabsContent>
```

Et **ajouter** les `<TabsTrigger>` correspondants dans `<TabsList>` si manquants (Documents et Historique étaient placeholders en Phase A) :

```tsx
<TabsTrigger value="documents">Documents</TabsTrigger>
<TabsTrigger value="historique">Historique</TabsTrigger>
```

- [ ] **Step 3: Pas de TypeCheck encore (DealDocumentsList et DealHistoryTimeline arrivent à la Task 18)**

- [ ] **Step 4: Pas de commit (attendre Task 18)**

---

## Task 18: DealDocumentsList + DealHistoryTimeline

**Files:**
- Create: `src/components/pe/DealDocumentsList.tsx`
- Create: `src/components/pe/DealHistoryTimeline.tsx`

- [ ] **Step 1: DealDocumentsList.tsx**

```tsx
// src/components/pe/DealDocumentsList.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import DocumentDropzone from './DocumentDropzone';

interface Props { dealId: string; organizationId: string; }

interface Doc {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string | null;
  created_at: string;
}

export default function DealDocumentsList({ dealId, organizationId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);

  const reload = async () => {
    const { data } = await supabase.from('pe_deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending: false });
    setDocs(data ?? []);
  };
  useEffect(() => { reload(); }, [dealId]);

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from('pe_deal_docs').createSignedUrl(d.storage_path, 60);
    if (error || !data) { toast.error(`Téléchargement échoué : ${error?.message}`); return; }
    window.open(data.signedUrl, '_blank');
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Supprimer ${d.filename} ?`)) return;
    const { error: storErr } = await supabase.storage.from('pe_deal_docs').remove([d.storage_path]);
    if (storErr) toast.warning(`Storage : ${storErr.message}`);
    const { error: dbErr } = await supabase.from('pe_deal_documents').delete().eq('id', d.id);
    if (dbErr) { toast.error(`DB : ${dbErr.message}`); return; }
    toast.success(`${d.filename} supprimé`);
    reload();
  };

  return (
    <div className="space-y-3">
      <DocumentDropzone dealId={dealId} organizationId={organizationId} onUploaded={reload} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Documents ({docs.length})</CardTitle></CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun document. Glisse-dépose ci-dessus.</p>
          ) : (
            <div className="space-y-1">
              {docs.map(d => (
                <div key={d.id} className="flex justify-between items-center border-b border-border/50 py-1.5 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{d.filename}</span>
                    {d.category && <span className="text-xs text-muted-foreground">[{d.category}]</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground hidden sm:inline">{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => download(d)} title="Télécharger"><Download className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(d)} title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: DealHistoryTimeline.tsx**

```tsx
// src/components/pe/DealHistoryTimeline.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props { dealId: string; }

interface Version {
  id: string;
  label: string;
  stage: string;
  status: string;
  overall_score: number | null;
  classification: string | null;
  generated_by_agent: string | null;
  generated_at: string | null;
  created_at: string;
  parent_version_id: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  generating: 'var(--pe-info)',
  ready:      'var(--pe-ok)',
  validated:  'var(--pe-ok)',
  rejected:   'var(--pe-danger)',
};

export default function DealHistoryTimeline({ dealId }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);

  useEffect(() => {
    (async () => {
      const { data: memo } = await supabase.from('investment_memos').select('id').eq('deal_id', dealId).maybeSingle();
      if (!memo) return;
      const { data } = await supabase.from('memo_versions').select('*').eq('memo_id', memo.id).order('created_at', { ascending: false });
      setVersions(data ?? []);
    })();
  }, [dealId]);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Historique des versions ({versions.length})</CardTitle></CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune version générée. Drop des documents sur la carte du deal pour générer le pré-screening.</p>
        ) : (
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="flex justify-between items-start border-l-2 border-border pl-3 py-1.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{v.label}</span>
                    <Badge variant="outline" style={{ borderColor: STATUS_COLOR[v.status], color: STATUS_COLOR[v.status] }}>{v.status}</Badge>
                    {v.overall_score != null && <span className="text-xs">Score : <strong>{v.overall_score}</strong></span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Stage : <strong>{v.stage}</strong>
                    {v.generated_by_agent && <> · {v.generated_by_agent}</>}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {v.generated_at ? new Date(v.generated_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: TypeCheck complet**

Run: `npx tsc --noEmit`

Expected: Aucune erreur (toute la stack frontend compile).

- [ ] **Step 4: Commit**

```bash
git add src/components/pe/DealDocumentsList.tsx src/components/pe/DealHistoryTimeline.tsx src/pages/pe/PeDealDetailPage.tsx
git commit -m "feat(pe): onglets Documents + Historique sur la page detail deal"
```

**🚦 Checkpoint phase 5** — Stop ici, demande au user de continuer vers Phase 6 (intégration + QA).

---

# Phase 6 — Integration & QA

## Task 19: Drag-drop transition stage → trigger generate-ic1-memo

**Files:**
- Modify: `src/pages/pe/PePipelinePage.tsx`

- [ ] **Step 1: Identifier le handler de drag-drop existant**

Lit le fichier (Phase A doit avoir un `handleDragEnd` qui appelle `update-pe-deal-stage`) :

```bash
grep -n "handleDragEnd\|onDragEnd\|update-pe-deal-stage" /Users/yacephilippe-emmanuel/supabase-connect-631d86ba/src/pages/pe/PePipelinePage.tsx
```

- [ ] **Step 2: Étendre le handler**

Dans `handleDragEnd` (ou son équivalent), **après** l'appel réussi à `update-pe-deal-stage` qui passe le deal de `pre_screening` à `note_ic1`, **ajouter** :

```tsx
// Si transition pre_screening → note_ic1, déclencher le clone du memo
if (toStage === 'note_ic1' && fromStage === 'pre_screening') {
  try {
    const token = await getValidAccessToken(null);
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ic1-memo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ deal_id: dealId }),
    });
    const result = await resp.json();
    if (resp.ok) {
      toast.success(result.already_exists ? 'Note IC1 existait déjà' : 'Note IC1 initialisée (12 sections clonées)');
    } else {
      toast.warning(`Note IC1 : ${result.error}`);
    }
  } catch (e: any) {
    toast.warning(`Note IC1 non générée : ${e.message}`);
  }
}
```

(Si `getValidAccessToken` n'est pas déjà importé, l'ajouter en haut : `import { getValidAccessToken } from '@/lib/getValidAccessToken';`)

- [ ] **Step 3: TypeCheck**

Run: `npx tsc --noEmit`

Expected: Aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/pages/pe/PePipelinePage.tsx
git commit -m "feat(pe): drag pre_screening→note_ic1 déclenche clone via generate-ic1-memo"
```

---

## Task 20: Tests d'intégration manuels + push pe-demo

**Files:**
- (Pas de fichiers — exécution checklist)

- [ ] **Step 1: Démarrer dev local**

```bash
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
npm run dev
```

Ouvrir `http://localhost:8080`.

- [ ] **Step 2: Déployer les edge functions en local**

Dans un autre terminal :

```bash
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
npx supabase functions serve --no-verify-jwt
```

- [ ] **Step 3: Exécuter checklist 10 tests**

| # | Test | OK ? |
|---|---|---|
| 1 | Login Analyst (seed local) → drop pitch.pdf sur deal "AgroCi" en sourcing → carte passe en pre_screening dans 60-90s avec score affiché | ☐ |
| 2 | Click sur la carte → onglet Pré-screening → 13 blocs visuels rendus correctement | ☐ |
| 3 | Re-drop financials.xlsx sur AgroCi → dialog "Régénérer ?" → confirmer → version v2 créée, v1 visible dans Historique | ☐ |
| 4 | Login MD → drag AgroCi de pre_screening vers note_ic1 → onglet "Memo IC1" devient cliquable, 12 sections clonées | ☐ |
| 5 | Login IM (manager d'Analyst) → voit les deals d'Analyst dans son kanban (RLS Phase A) | ☐ |
| 6 | Login Analyst → ne voit pas les deals d'un autre analyst de la même équipe | ☐ |
| 7 | Login MD → voit toutes les colonnes (sourcing inclus) | ☐ |
| 8 | Drop fichier > 50MB → toast erreur clair | ☐ |
| 9 | Couper le réseau pendant génération → status='rejected' + bouton "Régénérer" | ☐ |
| 10 | TypeCheck `npx tsc --noEmit` clean | ☐ |

Si un test fail : créer un commit fix dédié et noter l'issue.

- [ ] **Step 4: Push pe-demo vers GitHub**

```bash
cd /Users/yacephilippe-emmanuel/supabase-connect-631d86ba
git push origin pe-demo
```

Expected: Vercel preview déclenché automatiquement (cf. URL preview précédente : `https://supabase-connect-631d86ba-...vercel.app`).

- [ ] **Step 5: Validation visuelle sur preview Vercel**

⚠️ **Le preview Vercel pointe sur la PROD Supabase**, donc les tests fonctionnels (drop docs, génération) ne marcheront QUE si on a aussi déployé les migrations + edge functions sur la prod. **Cela nécessite l'accord explicite de l'utilisateur** (règle CLAUDE.md "ne touche plus à la prod sans mon accord").

Sur le preview, vérifier UNIQUEMENT le rendu visuel (kanban 7 colonnes, page detail tabs visibles), pas les flux fonctionnels.

- [ ] **Step 6: Demander validation utilisateur avant push prod**

Une fois le preview validé visuellement, demander : "OK pour appliquer les migrations + déployer les edge functions sur prod ?"

Si OUI :
```bash
# Migrations prod via Supabase MCP
# (à faire via mcp__claude_ai_Supabase__apply_migration pour chaque fichier de la Phase B')

# Edge functions prod
npx supabase functions deploy generate-pe-pre-screening --no-verify-jwt --project-ref gszwotgppuinpfnyrjnu
npx supabase functions deploy generate-ic1-memo --no-verify-jwt --project-ref gszwotgppuinpfnyrjnu
```

Si NON : la branche pe-demo reste sur preview, prod intouchée.

---

## Self-review checklist

Avant de commencer l'exécution, vérifier :

- [ ] Toutes les sections de `2026-04-30-phase-b-living-document-prescreening-design.md` ont une tâche correspondante
- [ ] Aucun "TBD"/"TODO"/"similar to Task X" dans le plan
- [ ] Les noms de fonction/types sont cohérents :
  - `MemoSectionCode` (Task 5) = utilisé partout
  - `getStagesForRole` (Task 15) = appelé Task 15
  - `MemoSectionsViewer` (Task 12) = utilisé Task 17
  - `DocumentDropzone` (Task 11) = utilisé Tasks 16 et 18
- [ ] Les paths de fichiers sont absolus dans les commandes shell
- [ ] Chaque task se termine par un commit (sauf checkpoints user)

## Execution checkpoint resume

Phase 1 (DB) → Phase 2 (Backend) → ⏸ checkpoint → Phase 3 (atoms) → Phase 4 (renderers) → ⏸ checkpoint → Phase 5 (pages) → ⏸ checkpoint → Phase 6 (intégration + push)
