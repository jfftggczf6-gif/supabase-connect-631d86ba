# Phase A — Foundation PE — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Établir le squelette utilisable du segment PE (Private Equity) sur ESONO : nouveaux rôles MD/IM/Analyst avec hiérarchie soft, table `pe_deals` overlay sur `enterprises`, RLS hiérarchique, kanban drag-drop, page team + page deal placeholder.

**Architecture:** Backend = nouvelles migrations Supabase (enums + tables + triggers + helpers SECURITY DEFINER + RLS) + 3 edge functions Deno (create-pe-deal, update-pe-deal-stage, assign-pe-team). Frontend = 3 nouvelles pages dans `src/pages/pe/`, étendre `src/lib/roles.ts`, ajouter routes dans `App.tsx`, brancher routing dans `Dashboard.tsx`. Travail sur branche `pe-demo`, déploiement preview Vercel auto.

**Tech Stack:** PostgreSQL (RLS, enums, triggers, SECURITY DEFINER), Supabase Edge Functions (Deno), React 18 + Vite + TypeScript, react-router-dom v6, @dnd-kit/core (drag-drop), shadcn/ui, sonner (toasts), Vitest (tests unitaires).

---

## File Structure

**Migrations SQL (backend) :**
- Create: `supabase/migrations/20260430000001_pe_phase_a_enums.sql` — enums hors transaction
- Create: `supabase/migrations/20260430000002_pe_phase_a_tables.sql` — tables + triggers + helpers + RLS

**Edge functions (backend) :**
- Create: `supabase/functions/create-pe-deal/index.ts`
- Create: `supabase/functions/update-pe-deal-stage/index.ts`
- Create: `supabase/functions/assign-pe-team/index.ts`

**Lib & roles (frontend) :**
- Modify: `src/lib/roles.ts` — étendre OrgRole, ROLE_LABELS, RELEVANT_ROLES, ROLE_PRIORITY
- Create: `src/lib/roles.test.ts` — tests unitaires getInvitableRoles
- Modify: `src/integrations/supabase/types.ts` — auto-régénéré

**Pages PE (frontend) :**
- Create: `src/pages/pe/PePipelinePage.tsx`
- Create: `src/pages/pe/PeDealDetailPage.tsx`
- Create: `src/pages/pe/PeTeamPage.tsx`
- Create: `src/components/pe/PeDealCard.tsx` — carte deal réutilisable
- Create: `src/components/pe/CreateDealDialog.tsx` — dialog création deal
- Create: `src/components/pe/StageTransitionDialog.tsx` — confirm transitions sensibles
- Create: `src/components/pe/AssignTeamDialog.tsx` — dialog mapping IM↔Analyst
- Create: `src/components/pe/PeRequireType.tsx` — guard de route

**Routing & dashboard :**
- Modify: `src/App.tsx` — 3 nouvelles routes
- Modify: `src/pages/Dashboard.tsx` — branch routing pour `type='pe'`

**Wizard org :**
- Modify: `src/contexts/OrganizationContext.tsx` ou wizard create-org existant — ajouter champ `code` si type=pe

---

## Task 1 : Migration enums (hors transaction)

**Files:**
- Create: `supabase/migrations/20260430000001_pe_phase_a_enums.sql`

- [ ] **Step 1.1: Créer le fichier de migration des enums**

```sql
-- ===========================================================================
-- Migration : Phase A Foundation PE — Enums (hors transaction)
--
-- Ce fichier contient UNIQUEMENT les ALTER TYPE / CREATE TYPE qui ne peuvent
-- pas tourner dans une transaction (ALTER TYPE ADD VALUE en particulier).
--
-- Le fichier compagnon `20260430000002_pe_phase_a_tables.sql` contient les
-- tables, triggers, helpers et RLS, et tourne en transaction normale.
-- ===========================================================================

-- 1. Étendre app_role avec les rôles PE manquants
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'managing_director';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'investment_manager';
-- 'analyst' existe déjà depuis multi_segment_enums

-- 2. Nouvel enum pour les stages du pipeline PE
DO $$ BEGIN
  CREATE TYPE pe_deal_stage AS ENUM (
    'sourcing', 'pre_screening', 'analyse',
    'ic1', 'dd', 'ic_finale', 'closing',
    'portfolio', 'lost'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Nouvel enum pour la source des deals
DO $$ BEGIN
  CREATE TYPE pe_deal_source AS ENUM (
    'reseau_pe', 'inbound', 'dfi', 'banque', 'mandat_ba', 'conference', 'autre'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
```

- [ ] **Step 1.2: Appliquer la migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` avec :
- `project_id`: `gszwotgppuinpfnyrjnu`
- `name`: `pe_phase_a_enums`
- `query`: contenu du fichier ci-dessus

Expected: succès, pas d'erreur.

- [ ] **Step 1.3: Vérifier que les enums sont bien créés**

Use `mcp__claude_ai_Supabase__execute_sql` avec :
```sql
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'pe_deal_stage'::regtype ORDER BY enumsortorder;
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'pe_deal_source'::regtype ORDER BY enumsortorder;
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'app_role'::regtype AND enumlabel IN ('managing_director', 'investment_manager');
```

Expected: 9 valeurs pour pe_deal_stage, 7 pour pe_deal_source, 2 pour app_role.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260430000001_pe_phase_a_enums.sql
git commit -m "feat(pe): migration phase A enums (app_role + pe_deal_stage + pe_deal_source)"
```

---

## Task 2 : Migration tables, triggers, helpers, RLS

**Files:**
- Create: `supabase/migrations/20260430000002_pe_phase_a_tables.sql`

- [ ] **Step 2.1: Créer le fichier — section 1/4 : ALTER organizations + tables**

```sql
-- ===========================================================================
-- Migration : Phase A Foundation PE — Tables, triggers, helpers, RLS
-- Fichier compagnon de 20260430000001_pe_phase_a_enums.sql
-- ===========================================================================

-- 1. Étendre organizations avec le code utilisé pour generer les deal_ref
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS code VARCHAR(6);

-- 2. Table pe_deals : un deal = un cycle d'investissement sur une enterprise
CREATE TABLE IF NOT EXISTS pe_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
  deal_ref TEXT NOT NULL,
  stage pe_deal_stage NOT NULL DEFAULT 'sourcing',
  lead_analyst_id UUID REFERENCES auth.users(id),
  ticket_demande NUMERIC,
  currency TEXT DEFAULT 'EUR',
  source pe_deal_source DEFAULT 'autre',
  source_detail TEXT,
  score_360 INTEGER,
  lost_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, deal_ref)
);

CREATE INDEX IF NOT EXISTS idx_pe_deals_org_stage ON pe_deals(organization_id, stage);
CREATE INDEX IF NOT EXISTS idx_pe_deals_lead_analyst ON pe_deals(lead_analyst_id);
CREATE INDEX IF NOT EXISTS idx_pe_deals_enterprise ON pe_deals(enterprise_id);

-- 3. Table pe_team_assignments : mapping IM ↔ Analyste (M-to-N)
CREATE TABLE IF NOT EXISTS pe_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  im_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analyst_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, im_user_id, analyst_user_id)
);

CREATE INDEX IF NOT EXISTS idx_pe_team_im ON pe_team_assignments(im_user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pe_team_analyst ON pe_team_assignments(analyst_user_id) WHERE is_active = true;

-- 4. Table pe_deal_history : audit des transitions de stage
CREATE TABLE IF NOT EXISTS pe_deal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  from_stage pe_deal_stage,
  to_stage pe_deal_stage NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_deal_history_deal ON pe_deal_history(deal_id, created_at DESC);
```

- [ ] **Step 2.2: Section 2/4 : Triggers**

Append au même fichier :
```sql
-- 5. Trigger : auto-génère deal_ref {ORG_CODE}-{YEAR}-{SEQ}
CREATE OR REPLACE FUNCTION generate_pe_deal_ref() RETURNS TRIGGER AS $$
DECLARE
  org_code TEXT;
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.deal_ref IS NULL OR NEW.deal_ref = '' THEN
    SELECT COALESCE(code, 'DEAL') INTO org_code FROM organizations WHERE id = NEW.organization_id;
    year_str := to_char(now(), 'YYYY');
    SELECT COALESCE(MAX(CAST(split_part(deal_ref, '-', 3) AS INTEGER)), 0) + 1
      INTO seq_num
      FROM pe_deals
      WHERE organization_id = NEW.organization_id
        AND deal_ref LIKE org_code || '-' || year_str || '-%';
    NEW.deal_ref := org_code || '-' || year_str || '-' || lpad(seq_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pe_deals_generate_ref ON pe_deals;
CREATE TRIGGER pe_deals_generate_ref
  BEFORE INSERT ON pe_deals
  FOR EACH ROW EXECUTE FUNCTION generate_pe_deal_ref();

-- 6. Trigger : enterprise_id requis dès stage > sourcing, lost_reason requis si stage=lost
CREATE OR REPLACE FUNCTION enforce_pe_deal_invariants() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage <> 'sourcing' AND NEW.enterprise_id IS NULL THEN
    RAISE EXCEPTION 'enterprise_id requis dès le stage pre_screening (deal %)', NEW.deal_ref USING ERRCODE = '23514';
  END IF;
  IF NEW.stage = 'lost' AND (NEW.lost_reason IS NULL OR trim(NEW.lost_reason) = '') THEN
    RAISE EXCEPTION 'lost_reason requis quand stage=lost (deal %)', NEW.deal_ref USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pe_deals_enforce_invariants ON pe_deals;
CREATE TRIGGER pe_deals_enforce_invariants
  BEFORE INSERT OR UPDATE ON pe_deals
  FOR EACH ROW EXECUTE FUNCTION enforce_pe_deal_invariants();

-- 7. Trigger audit : trace tout changement de stage dans pe_deal_history
CREATE OR REPLACE FUNCTION track_pe_deal_stage_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO pe_deal_history (deal_id, from_stage, to_stage, changed_by, reason)
    VALUES (NEW.id, NULL, NEW.stage, NEW.created_by, NULL);
  ELSIF TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO pe_deal_history (deal_id, from_stage, to_stage, changed_by, reason)
    VALUES (NEW.id, OLD.stage, NEW.stage,
            COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'sub', NULL)::UUID,
            CASE WHEN NEW.stage = 'lost' THEN NEW.lost_reason ELSE NULL END);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS pe_deals_track_stage ON pe_deals;
CREATE TRIGGER pe_deals_track_stage
  AFTER INSERT OR UPDATE ON pe_deals
  FOR EACH ROW EXECUTE FUNCTION track_pe_deal_stage_change();
```

- [ ] **Step 2.3: Section 3/4 : Helpers SECURITY DEFINER**

Append au même fichier :
```sql
-- 8. Helper : true si user est MD/owner/admin de l'org
CREATE OR REPLACE FUNCTION is_pe_md_or_owner(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND is_active = true
      AND role IN ('owner', 'admin', 'managing_director')
  )
  OR public.has_role(p_user_id, 'super_admin'::app_role);
$$;

-- 9. Helper : true si im_user supervise analyst_user dans cette org
CREATE OR REPLACE FUNCTION is_supervising_analyst(p_org_id UUID, p_im_user UUID, p_analyst_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pe_team_assignments
    WHERE organization_id = p_org_id
      AND im_user_id = p_im_user
      AND analyst_user_id = p_analyst_user
      AND is_active = true
  );
$$;

-- 10. Helper : true si user peut voir le deal
CREATE OR REPLACE FUNCTION can_see_pe_deal(p_deal_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pe_deals d
    WHERE d.id = p_deal_id
      AND (
        d.lead_analyst_id = p_user_id
        OR public.is_pe_md_or_owner(d.organization_id, p_user_id)
        OR EXISTS (
          SELECT 1 FROM public.pe_team_assignments t
          WHERE t.organization_id = d.organization_id
            AND t.im_user_id = p_user_id
            AND t.analyst_user_id = d.lead_analyst_id
            AND t.is_active = true
        )
      )
  );
$$;

-- 11. Helper : retourne le rôle de l'utilisateur dans l'org
CREATE OR REPLACE FUNCTION get_pe_role(p_org_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id AND is_active = true
  LIMIT 1;
$$;
```

- [ ] **Step 2.4: Section 4/4 : RLS policies**

Append au même fichier :
```sql
-- 12. RLS sur pe_deals
ALTER TABLE pe_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pe_deals_select" ON pe_deals;
CREATE POLICY "pe_deals_select" ON pe_deals
  FOR SELECT USING (can_see_pe_deal(id, auth.uid()));

DROP POLICY IF EXISTS "pe_deals_insert" ON pe_deals;
CREATE POLICY "pe_deals_insert" ON pe_deals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = pe_deals.organization_id
        AND user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner', 'admin', 'managing_director', 'investment_manager', 'analyst')
    )
  );

DROP POLICY IF EXISTS "pe_deals_update" ON pe_deals;
CREATE POLICY "pe_deals_update" ON pe_deals
  FOR UPDATE USING (can_see_pe_deal(id, auth.uid()))
  WITH CHECK (can_see_pe_deal(id, auth.uid()));

-- 13. RLS sur pe_team_assignments
ALTER TABLE pe_team_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pe_team_select" ON pe_team_assignments;
CREATE POLICY "pe_team_select" ON pe_team_assignments
  FOR SELECT USING (
    is_pe_md_or_owner(organization_id, auth.uid())
    OR im_user_id = auth.uid()
    OR im_user_id IN (
      SELECT t.im_user_id FROM pe_team_assignments t
      WHERE t.analyst_user_id = auth.uid() AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "pe_team_modify" ON pe_team_assignments;
CREATE POLICY "pe_team_modify" ON pe_team_assignments
  FOR ALL USING (is_pe_md_or_owner(organization_id, auth.uid()))
  WITH CHECK (is_pe_md_or_owner(organization_id, auth.uid()));

-- 14. RLS sur pe_deal_history
ALTER TABLE pe_deal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pe_deal_history_select" ON pe_deal_history;
CREATE POLICY "pe_deal_history_select" ON pe_deal_history
  FOR SELECT USING (can_see_pe_deal(deal_id, auth.uid()));
-- Pas de policy INSERT publique : alimentée uniquement via le trigger
```

- [ ] **Step 2.5: Appliquer la migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` avec name=`pe_phase_a_tables` et query = contenu complet du fichier.

Expected: succès. Si erreur, NE PAS relancer aveuglément — diagnostiquer.

- [ ] **Step 2.6: Vérifier que tout est créé**

Use `mcp__claude_ai_Supabase__execute_sql` :
```sql
-- Tables
SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'pe_%';
-- Helpers
SELECT proname FROM pg_proc WHERE proname IN ('is_pe_md_or_owner', 'is_supervising_analyst', 'can_see_pe_deal', 'get_pe_role');
-- Policies
SELECT polname, tablename FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid WHERE c.relname LIKE 'pe_%';
-- Trigger refs
SELECT tgname FROM pg_trigger WHERE tgname LIKE 'pe_deals%';
```

Expected: 3 tables (pe_deals, pe_team_assignments, pe_deal_history), 4 fonctions helpers, ≥6 policies, 3 triggers.

- [ ] **Step 2.7: Commit**

```bash
git add supabase/migrations/20260430000002_pe_phase_a_tables.sql
git commit -m "feat(pe): migration phase A tables + triggers + helpers + RLS"
```

---

## Task 3 : Tests RLS hiérarchiques

**Files:**
- Aucun fichier — tests via SQL direct (pas de framework de tests SQL ici).

- [ ] **Step 3.1: Setup data de test**

Use `mcp__claude_ai_Supabase__execute_sql` pour créer une org PE et des users de test :
```sql
-- Suppose qu'on a déjà un user owner sellarts.ci (id à récupérer)
-- Créer une org PE de test
INSERT INTO organizations (name, type, code, devise_defaut)
VALUES ('Test PE Fund', 'pe', 'TPE', 'EUR')
RETURNING id;
-- Note l'id retourné, on l'appellera <org_id> dans les steps suivants
```

- [ ] **Step 3.2: Vérifier auto-génération deal_ref**

```sql
INSERT INTO pe_deals (organization_id, source)
VALUES ('<org_id>', 'reseau_pe')
RETURNING deal_ref;
-- Expected: 'TPE-2026-001'

INSERT INTO pe_deals (organization_id, source)
VALUES ('<org_id>', 'inbound')
RETURNING deal_ref;
-- Expected: 'TPE-2026-002'
```

- [ ] **Step 3.3: Vérifier trigger enterprise_id requis**

```sql
-- Doit échouer
UPDATE pe_deals SET stage = 'pre_screening' WHERE deal_ref = 'TPE-2026-001';
-- Expected: ERROR: enterprise_id requis dès le stage pre_screening
```

- [ ] **Step 3.4: Vérifier trigger lost_reason requis**

```sql
UPDATE pe_deals SET stage = 'lost' WHERE deal_ref = 'TPE-2026-001';
-- Expected: ERROR: lost_reason requis quand stage=lost

UPDATE pe_deals SET stage = 'lost', lost_reason = 'Hors thèse' WHERE deal_ref = 'TPE-2026-001';
-- Expected: succès
```

- [ ] **Step 3.5: Vérifier audit dans pe_deal_history**

```sql
SELECT from_stage, to_stage, reason FROM pe_deal_history
WHERE deal_id IN (SELECT id FROM pe_deals WHERE deal_ref = 'TPE-2026-001')
ORDER BY created_at;
-- Expected: 2 rows : (NULL→sourcing) et (sourcing→lost, reason='Hors thèse')
```

- [ ] **Step 3.6: Cleanup**

```sql
DELETE FROM pe_deals WHERE organization_id = '<org_id>';
DELETE FROM organizations WHERE id = '<org_id>';
```

- [ ] **Step 3.7: Commit (rien à committer mais étape de validation)**

Cette étape est manuelle. Si tous les SQL passent → Task 3 OK.

---

## Task 4 : Régénération des types TypeScript

**Files:**
- Modify: `src/integrations/supabase/types.ts` (auto-régénéré)

- [ ] **Step 4.1: Régénérer les types**

Use `mcp__claude_ai_Supabase__generate_typescript_types` avec `project_id`=`gszwotgppuinpfnyrjnu`.

Le tool renvoie le contenu mis à jour. Écrire le résultat dans `src/integrations/supabase/types.ts` (overwrite total).

- [ ] **Step 4.2: Vérifier que les nouveaux types apparaissent**

```bash
grep -E "pe_deals|pe_team_assignments|pe_deal_history|pe_deal_stage|pe_deal_source" src/integrations/supabase/types.ts | head -10
```

Expected: au moins une dizaine de matches (Tables, Insert, Update types pour chaque table + enum types).

- [ ] **Step 4.3: Vérifier que la compilation TS passe**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4.4: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(pe): regenerate supabase types after phase A migrations"
```

---

## Task 5 : Étendre `src/lib/roles.ts`

**Files:**
- Modify: `src/lib/roles.ts`
- Create: `src/lib/roles.test.ts`

- [ ] **Step 5.1: Étendre le type OrgRole**

Modifier `src/lib/roles.ts` ligne `export type OrgRole = ...` pour ajouter les 2 nouveaux rôles :

```ts
export type OrgRole = 'owner' | 'admin' | 'manager' | 'managing_director' | 'investment_manager' | 'coach' | 'analyst' | 'entrepreneur';
```

- [ ] **Step 5.2: Étendre ROLE_LABELS pour 'pe'**

Modifier l'objet `ROLE_LABELS.pe` :
```ts
pe: {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: "Directeur d'investissement",
  managing_director: 'Managing Director',
  investment_manager: 'Investment Manager',
  analyst: 'Analyste',
  coach: 'Coach',
  entrepreneur: 'Entrepreneur',
},
```

Idem pour `programme.managing_director`, `programme.investment_manager` (mettre 'Directeur' / 'Investment Manager' — peu utilisés mais évite les undefined). Idem pour `mixed`.

- [ ] **Step 5.3: Étendre RELEVANT_ROLES**

```ts
const RELEVANT_ROLES: Record<OrgType, OrgRole[]> = {
  programme: ['owner', 'admin', 'manager', 'coach', 'entrepreneur'],
  pe:        ['owner', 'admin', 'managing_director', 'investment_manager', 'analyst', 'entrepreneur'],
  mixed:     ['owner', 'admin', 'manager', 'managing_director', 'investment_manager', 'coach', 'analyst', 'entrepreneur'],
};
```

- [ ] **Step 5.4: Étendre ROLE_PRIORITY**

```ts
const ROLE_PRIORITY: Record<OrgRole, number> = {
  owner: 0,
  admin: 1,
  manager: 2,
  managing_director: 2,    // niveau manager (chef de fond)
  investment_manager: 3,   // niveau supérieur à analyst, inférieur à MD
  coach: 4,
  analyst: 4,
  entrepreneur: 5,
};
```

- [ ] **Step 5.5: Étendre ROLE_DESCRIPTIONS**

```ts
managing_director: 'Pilote du fond PE. Valide les comités d\'investissement, vue portefeuille global.',
investment_manager: 'Supervise une équipe d\'analystes. Valide les sections memo, peut intervenir sur tous les deals de son équipe.',
```

- [ ] **Step 5.6: Créer les tests unitaires `src/lib/roles.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getInvitableRoles, humanizeRole, ROLE_LABELS } from './roles';

describe('getInvitableRoles', () => {
  it("retourne les rôles PE pour un owner d'org PE", () => {
    const roles = getInvitableRoles('pe', 'owner').map(r => r.value);
    expect(roles).toContain('admin');
    expect(roles).toContain('managing_director');
    expect(roles).toContain('investment_manager');
    expect(roles).toContain('analyst');
    expect(roles).not.toContain('coach');
  });

  it('un MD ne peut pas inviter un admin', () => {
    const roles = getInvitableRoles('pe', 'managing_director').map(r => r.value);
    expect(roles).not.toContain('admin');
    expect(roles).toContain('investment_manager');
    expect(roles).toContain('analyst');
  });

  it('un IM ne peut pas inviter un MD ni un autre IM', () => {
    const roles = getInvitableRoles('pe', 'investment_manager').map(r => r.value);
    expect(roles).not.toContain('managing_director');
    expect(roles).not.toContain('investment_manager');
    expect(roles).toContain('analyst');
  });

  it("un analyste ne peut inviter personne", () => {
    const roles = getInvitableRoles('pe', 'analyst').map(r => r.value);
    expect(roles).toEqual([]);
  });

  it('un super_admin invite tout', () => {
    const roles = getInvitableRoles('pe', 'analyst', true).map(r => r.value);
    expect(roles.length).toBeGreaterThan(0);
  });
});

describe('humanizeRole', () => {
  it('libelle MD pour PE', () => {
    expect(humanizeRole('managing_director', 'pe')).toBe('Managing Director');
  });

  it("libelle IM pour PE", () => {
    expect(humanizeRole('investment_manager', 'pe')).toBe('Investment Manager');
  });
});
```

- [ ] **Step 5.7: Run les tests**

```bash
npm run test -- src/lib/roles.test.ts
```

Expected: 7 tests passent.

- [ ] **Step 5.8: Commit**

```bash
git add src/lib/roles.ts src/lib/roles.test.ts
git commit -m "feat(pe): étend roles.ts avec managing_director + investment_manager"
```

---

## Task 6 : Edge function `create-pe-deal`

**Files:**
- Create: `supabase/functions/create-pe-deal/index.ts`

- [ ] **Step 6.1: Créer le fichier de l'edge function**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_SOURCES = ['reseau_pe', 'inbound', 'dfi', 'banque', 'mandat_ba', 'conference', 'autre'];
const ALLOWED_ROLES = ['owner', 'admin', 'managing_director', 'investment_manager', 'analyst'];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const body = await req.json();
    const {
      organization_id,
      enterprise_id,
      enterprise_name,
      ticket_demande,
      currency,
      source,
      source_detail,
      lead_analyst_id,
    } = body;

    if (!organization_id) throw new Error("organization_id required");
    if (source && !VALID_SOURCES.includes(source)) {
      throw new Error(`Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}`);
    }

    // 1. Vérifier que user est membre actif avec rôle autorisé
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!membership || !ALLOWED_ROLES.includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Si enterprise_name fourni mais pas enterprise_id, créer enterprise minimale
    let resolvedEnterpriseId = enterprise_id ?? null;
    if (!resolvedEnterpriseId && enterprise_name && enterprise_name.trim()) {
      const { data: ent, error: entErr } = await adminClient
        .from("enterprises")
        .insert({
          name: enterprise_name.trim(),
          organization_id,
          user_id: user.id,
          phase: 'identite',
        })
        .select('id')
        .single();
      if (entErr) throw entErr;
      resolvedEnterpriseId = ent.id;
    }

    // 3. INSERT dans pe_deals (le trigger génère deal_ref)
    const { data: deal, error: dealErr } = await adminClient
      .from("pe_deals")
      .insert({
        organization_id,
        enterprise_id: resolvedEnterpriseId,
        ticket_demande: ticket_demande ?? null,
        currency: currency ?? 'EUR',
        source: source ?? 'autre',
        source_detail: source_detail ?? null,
        lead_analyst_id: lead_analyst_id ?? user.id,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (dealErr) throw dealErr;

    return new Response(JSON.stringify({ success: true, deal }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[create-pe-deal] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 6.2: Déployer la fonction**

Use `mcp__claude_ai_Supabase__deploy_edge_function` :
- `project_id`: `gszwotgppuinpfnyrjnu`
- `name`: `create-pe-deal`
- `files`: `[{ name: 'index.ts', content: <contenu du fichier> }]`

Expected: succès.

- [ ] **Step 6.3: Tester via curl** (optionnel — peut être fait depuis l'UI plus tard)

À tester depuis l'UI une fois la page pipeline créée. Validation Task 8.

- [ ] **Step 6.4: Commit**

```bash
git add supabase/functions/create-pe-deal/
git commit -m "feat(pe): edge function create-pe-deal avec génération deal_ref auto"
```

---

## Task 7 : Edge function `update-pe-deal-stage`

**Files:**
- Create: `supabase/functions/update-pe-deal-stage/index.ts`

- [ ] **Step 7.1: Créer le fichier**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stages autorisés selon rôle (lost est toujours autorisé pour tous)
const STAGES_BY_ROLE: Record<string, string[]> = {
  analyst: ['sourcing', 'pre_screening', 'analyse'],
  investment_manager: ['sourcing', 'pre_screening', 'analyse', 'ic1', 'dd', 'ic_finale'],
  managing_director: ['sourcing', 'pre_screening', 'analyse', 'ic1', 'dd', 'ic_finale', 'closing', 'portfolio'],
  admin: ['sourcing', 'pre_screening', 'analyse', 'ic1', 'dd', 'ic_finale', 'closing', 'portfolio'],
  owner: ['sourcing', 'pre_screening', 'analyse', 'ic1', 'dd', 'ic_finale', 'closing', 'portfolio'],
};

const VALID_STAGES = ['sourcing', 'pre_screening', 'analyse', 'ic1', 'dd', 'ic_finale', 'closing', 'portfolio', 'lost'];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { deal_id, new_stage, lost_reason } = await req.json();
    if (!deal_id || !new_stage) throw new Error("deal_id and new_stage required");
    if (!VALID_STAGES.includes(new_stage)) throw new Error(`Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}`);
    if (new_stage === 'lost' && (!lost_reason || !lost_reason.trim())) {
      throw new Error('lost_reason required when stage=lost');
    }

    // 1. Charger le deal
    const { data: deal } = await adminClient
      .from("pe_deals")
      .select("id, organization_id, stage, lead_analyst_id")
      .eq("id", deal_id)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found");

    // 2. Récupérer le rôle de l'utilisateur dans l'org
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", deal.organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) throw new Error("Not a member of this organization");

    // 3. Vérifier RLS visibilité (peut-il voir ce deal ?)
    const { data: canSee } = await adminClient.rpc('can_see_pe_deal', {
      p_deal_id: deal_id, p_user_id: user.id,
    });
    if (!canSee) {
      return new Response(JSON.stringify({ error: "Cannot see this deal" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Vérifier transition autorisée selon rôle (lost toujours autorisé)
    const allowedStages = STAGES_BY_ROLE[membership.role] || [];
    if (new_stage !== 'lost' && !allowedStages.includes(new_stage)) {
      return new Response(JSON.stringify({
        error: `Stage '${new_stage}' réservé à un rôle supérieur (votre rôle: ${membership.role})`
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. UPDATE (les triggers gèrent enterprise_id requis + audit)
    const updatePayload: any = { stage: new_stage };
    if (new_stage === 'lost') updatePayload.lost_reason = lost_reason.trim();

    const { data: updated, error: updErr } = await adminClient
      .from("pe_deals")
      .update(updatePayload)
      .eq("id", deal_id)
      .select('*')
      .single();
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, deal: updated }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[update-pe-deal-stage] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 7.2: Déployer**

Use `mcp__claude_ai_Supabase__deploy_edge_function` avec name=`update-pe-deal-stage`.

- [ ] **Step 7.3: Commit**

```bash
git add supabase/functions/update-pe-deal-stage/
git commit -m "feat(pe): edge function update-pe-deal-stage avec validation rôle"
```

---

## Task 8 : Edge function `assign-pe-team`

**Files:**
- Create: `supabase/functions/assign-pe-team/index.ts`

- [ ] **Step 8.1: Créer le fichier**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { organization_id, im_user_id, analyst_user_id, action } = await req.json();
    if (!organization_id || !im_user_id || !analyst_user_id || !action) {
      throw new Error("organization_id, im_user_id, analyst_user_id, action required");
    }
    if (!['add', 'remove'].includes(action)) throw new Error("action must be 'add' or 'remove'");

    // 1. Vérifier que l'auteur est MD/owner/admin
    const { data: canManage } = await adminClient.rpc('is_pe_md_or_owner', {
      p_org_id: organization_id, p_user_id: user.id,
    });
    if (!canManage) {
      return new Response(JSON.stringify({ error: "Only MD/owner/admin can manage team" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Vérifier les rôles des 2 users
    const { data: members } = await adminClient
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organization_id)
      .in("user_id", [im_user_id, analyst_user_id])
      .eq("is_active", true);

    const im = members?.find(m => m.user_id === im_user_id);
    const analyst = members?.find(m => m.user_id === analyst_user_id);
    if (!im || im.role !== 'investment_manager') {
      throw new Error("im_user_id n'a pas le rôle investment_manager dans cette org");
    }
    if (!analyst || analyst.role !== 'analyst') {
      throw new Error("analyst_user_id n'a pas le rôle analyst dans cette org");
    }

    // 3. Action
    if (action === 'add') {
      const { error } = await adminClient
        .from("pe_team_assignments")
        .upsert({
          organization_id, im_user_id, analyst_user_id,
          is_active: true,
          assigned_by: user.id,
        }, { onConflict: 'organization_id,im_user_id,analyst_user_id' });
      if (error) throw error;
    } else {
      const { error } = await adminClient
        .from("pe_team_assignments")
        .update({ is_active: false })
        .eq("organization_id", organization_id)
        .eq("im_user_id", im_user_id)
        .eq("analyst_user_id", analyst_user_id);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[assign-pe-team] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 8.2: Déployer**

Use `mcp__claude_ai_Supabase__deploy_edge_function` avec name=`assign-pe-team`.

- [ ] **Step 8.3: Commit**

```bash
git add supabase/functions/assign-pe-team/
git commit -m "feat(pe): edge function assign-pe-team pour mapping IM↔Analyst"
```

---

## Task 9 : Routing dans App.tsx + Dashboard.tsx + guard PE

**Files:**
- Create: `src/components/pe/PeRequireType.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 9.1: Créer le guard `PeRequireType.tsx`**

```tsx
import { Navigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export default function PeRequireType({ children }: Props) {
  const { currentOrg, loading } = useOrganization();
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!currentOrg || currentOrg.type !== 'pe') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 9.2: Créer les 3 pages stubs**

Crée 3 fichiers minimaux (juste un titre, on les remplit dans Tasks 10-12) :

`src/pages/pe/PePipelinePage.tsx` :
```tsx
import DashboardLayout from '@/components/dashboard/DashboardLayout';
export default function PePipelinePage() {
  return <DashboardLayout title="Pipeline PE"><p>Pipeline PE — TODO Task 11</p></DashboardLayout>;
}
```

`src/pages/pe/PeDealDetailPage.tsx` :
```tsx
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useParams } from 'react-router-dom';
export default function PeDealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  return <DashboardLayout title="Deal"><p>Deal {dealId} — TODO Task 12</p></DashboardLayout>;
}
```

`src/pages/pe/PeTeamPage.tsx` :
```tsx
import DashboardLayout from '@/components/dashboard/DashboardLayout';
export default function PeTeamPage() {
  return <DashboardLayout title="Équipe PE"><p>Team PE — TODO Task 10</p></DashboardLayout>;
}
```

- [ ] **Step 9.3: Ajouter les imports + routes dans App.tsx**

Modifier `src/App.tsx` :

Imports (vers ligne 36) :
```tsx
import PeRequireType from "./components/pe/PeRequireType";
import PePipelinePage from "./pages/pe/PePipelinePage";
import PeDealDetailPage from "./pages/pe/PeDealDetailPage";
import PeTeamPage from "./pages/pe/PeTeamPage";
```

Routes (après les routes /programmes, avant /candidature) :
```tsx
<Route path="/pe/pipeline" element={
  <ProtectedRoute><PeRequireType><PePipelinePage /></PeRequireType></ProtectedRoute>
} />
<Route path="/pe/deals/:dealId" element={
  <ProtectedRoute><PeRequireType><PeDealDetailPage /></PeRequireType></ProtectedRoute>
} />
<Route path="/pe/team" element={
  <ProtectedRoute><PeRequireType><PeTeamPage /></PeRequireType></ProtectedRoute>
} />
```

- [ ] **Step 9.4: Modifier Dashboard.tsx pour rediriger les rôles PE**

Modifier `src/pages/Dashboard.tsx`. Ajouter, juste avant le bloc `if (currentOrg.type === 'banque' && ...)` (ligne ~66) :

```tsx
// Org PE → tout le monde (sauf entrepreneur) atterrit sur le pipeline PE
const peRoles = [
  'owner', 'admin', 'manager',
  'managing_director', 'investment_manager', 'analyst', 'partner',
];
if (currentOrg.type === 'pe' && orgRole && peRoles.includes(orgRole)) {
  return <Navigate to="/pe/pipeline" replace />;
}
```

- [ ] **Step 9.5: Vérifier que la compilation passe**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: aucune erreur.

- [ ] **Step 9.6: Commit**

```bash
git add src/App.tsx src/pages/Dashboard.tsx src/pages/pe/ src/components/pe/PeRequireType.tsx
git commit -m "feat(pe): routing /pe/{pipeline,deals/:id,team} + guard + dashboard redirect"
```

---

## Task 10 : Page `/pe/team`

**Files:**
- Modify: `src/pages/pe/PeTeamPage.tsx` (remplacer le stub)
- Create: `src/components/pe/AssignTeamDialog.tsx`

- [ ] **Step 10.1: Créer `AssignTeamDialog.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onAssigned: () => void;
}

interface Member { user_id: string; full_name: string | null; email: string | null; role: string; }

export default function AssignTeamDialog({ open, onOpenChange, organizationId, onAssigned }: Props) {
  const [ims, setIms] = useState<Member[]>([]);
  const [analysts, setAnalysts] = useState<Member[]>([]);
  const [imId, setImId] = useState('');
  const [analystId, setAnalystId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('role', ['investment_manager', 'analyst']);
      const userIds = (members || []).map((m: any) => m.user_id);
      if (!userIds.length) { setIms([]); setAnalysts([]); return; }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const enriched = (members || []).map((m: any) => ({
        ...m,
        full_name: profMap.get(m.user_id)?.full_name || null,
        email: profMap.get(m.user_id)?.email || null,
      }));
      setIms(enriched.filter(m => m.role === 'investment_manager'));
      setAnalysts(enriched.filter(m => m.role === 'analyst'));
    })();
  }, [open, organizationId]);

  const handleAssign = async () => {
    if (!imId || !analystId) { toast.error('Sélectionne un IM et un Analyste'); return; }
    setSubmitting(true);
    const { error } = await supabase.functions.invoke('assign-pe-team', {
      body: { organization_id: organizationId, im_user_id: imId, analyst_user_id: analystId, action: 'add' },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Assignation enregistrée');
    setImId(''); setAnalystId('');
    onAssigned();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assigner un analyste à un IM</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Investment Manager</Label>
            <Select value={imId} onValueChange={setImId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un IM" /></SelectTrigger>
              <SelectContent>
                {ims.map(im => (
                  <SelectItem key={im.user_id} value={im.user_id}>
                    {im.full_name || im.email || im.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!ims.length && <p className="text-xs text-muted-foreground">Aucun IM dans l'org. Invite-en un depuis /org/members.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Analyste</Label>
            <Select value={analystId} onValueChange={setAnalystId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un analyste" /></SelectTrigger>
              <SelectContent>
                {analysts.map(a => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {a.full_name || a.email || a.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!analysts.length && <p className="text-xs text-muted-foreground">Aucun analyste dans l'org.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleAssign} disabled={submitting || !imId || !analystId}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Assigner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 10.2: Remplacer le stub de `PeTeamPage.tsx` (vue MD)**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { toast } from 'sonner';
import AssignTeamDialog from '@/components/pe/AssignTeamDialog';

interface Member { user_id: string; full_name: string | null; email: string | null; role: string; }
interface Assignment { id: string; im_user_id: string; analyst_user_id: string; }

export default function PeTeamPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { role: orgRole, isSuperAdmin } = useCurrentRole();
  const [ims, setIms] = useState<Member[]>([]);
  const [analysts, setAnalysts] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);

  const isManager = orgRole === 'owner' || orgRole === 'admin' || orgRole === 'managing_director' || isSuperAdmin;

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', currentOrg.id)
      .eq('is_active', true);
    const userIds = (members || []).map((m: any) => m.user_id);
    let profMap = new Map<string, any>();
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds);
      profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
    }
    const enriched = (members || []).map((m: any) => ({ ...m, full_name: profMap.get(m.user_id)?.full_name || null, email: profMap.get(m.user_id)?.email || null }));
    setIms(enriched.filter(m => m.role === 'investment_manager'));
    setAnalysts(enriched.filter(m => m.role === 'analyst'));

    const { data: asg } = await supabase
      .from('pe_team_assignments')
      .select('id, im_user_id, analyst_user_id')
      .eq('organization_id', currentOrg.id)
      .eq('is_active', true);
    setAssignments(asg || []);
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (im_user_id: string, analyst_user_id: string) => {
    if (!confirm("Retirer cette assignation ?")) return;
    const { error } = await supabase.functions.invoke('assign-pe-team', {
      body: { organization_id: currentOrg!.id, im_user_id, analyst_user_id, action: 'remove' },
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Assignation retirée');
    load();
  };

  if (loading) return <DashboardLayout title="Équipe PE"><Loader2 className="h-6 w-6 animate-spin" /></DashboardLayout>;

  // Analystes non rattachés
  const assignedAnalystIds = new Set(assignments.map(a => a.analyst_user_id));
  const orphanAnalysts = analysts.filter(a => !assignedAnalystIds.has(a.user_id));

  const memberName = (uid: string) => {
    const m = [...ims, ...analysts].find(x => x.user_id === uid);
    return m?.full_name || m?.email || uid.slice(0, 8);
  };

  return (
    <DashboardLayout title="Équipe PE" subtitle={currentOrg?.name || ''}>
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate('/dashboard')}>
        ← Retour au dashboard
      </Button>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{ims.length}</span> Investment Manager{ims.length > 1 ? 's' : ''}
          {' · '}
          <span className="font-medium text-foreground">{analysts.length}</span> Analyste{analysts.length > 1 ? 's' : ''}
        </div>
        {isManager && (
          <Button onClick={() => setShowAssign(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Assigner un analyste
          </Button>
        )}
      </div>

      {ims.length === 0 ? (
        <Card><CardContent className="p-5 text-sm text-muted-foreground">Aucun IM dans l'organisation. Invitez-en depuis la page Membres.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {ims.map(im => {
            const supervised = assignments.filter(a => a.im_user_id === im.user_id);
            return (
              <Card key={im.user_id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{im.full_name || im.email}</p>
                      <p className="text-xs text-muted-foreground">{im.email}</p>
                    </div>
                    <Badge variant="outline">{supervised.length} analyste{supervised.length > 1 ? 's' : ''}</Badge>
                  </div>
                  {supervised.length > 0 && (
                    <ul className="ml-4 space-y-1">
                      {supervised.map(a => (
                        <li key={a.id} className="flex items-center justify-between text-sm py-1">
                          <span>{memberName(a.analyst_user_id)}</span>
                          {isManager && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                              onClick={() => handleRemove(im.user_id, a.analyst_user_id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {orphanAnalysts.length > 0 && isManager && (
        <Card className="border-amber-300 bg-amber-50/50 mt-4">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              <p className="font-medium text-sm">{orphanAnalysts.length} analyste{orphanAnalysts.length > 1 ? 's' : ''} non rattaché{orphanAnalysts.length > 1 ? 's' : ''}</p>
            </div>
            <p className="text-xs text-muted-foreground">Leurs deals seront visibles uniquement au MD.</p>
            <ul className="ml-4 text-sm">
              {orphanAnalysts.map(a => <li key={a.user_id}>· {a.full_name || a.email}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {currentOrg && (
        <AssignTeamDialog open={showAssign} onOpenChange={setShowAssign}
          organizationId={currentOrg.id} onAssigned={load} />
      )}
    </DashboardLayout>
  );
}
```

- [ ] **Step 10.3: Tester en local**

```bash
npm run dev
```

Aller sur `/pe/team` (avec une org de type PE). Vérifier :
- Si pas membre → redirige vers /dashboard (via PeRequireType)
- Si MD → voit la liste des IM avec leurs analystes
- Bouton "Assigner" ouvre le dialog
- Assignation → toast OK, liste se met à jour

- [ ] **Step 10.4: Commit**

```bash
git add src/pages/pe/PeTeamPage.tsx src/components/pe/AssignTeamDialog.tsx
git commit -m "feat(pe): page /pe/team avec gestion mapping IM↔Analyst"
```

---

## Task 11 : Page `/pe/pipeline` (kanban drag-drop)

**Files:**
- Modify: `src/pages/pe/PePipelinePage.tsx`
- Create: `src/components/pe/PeDealCard.tsx`
- Create: `src/components/pe/CreateDealDialog.tsx`
- Create: `src/components/pe/StageTransitionDialog.tsx`

- [ ] **Step 11.1: Créer `PeDealCard.tsx`**

```tsx
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';

interface Deal {
  id: string;
  deal_ref: string;
  enterprise_name?: string | null;
  ticket_demande: number | null;
  currency: string | null;
  lead_analyst_initials?: string;
  score_360: number | null;
}

export default function PeDealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };

  const fmtTicket = deal.ticket_demande
    ? `${(deal.ticket_demande / 1000000).toFixed(1)}M ${deal.currency || ''}`
    : '—';

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={onClick}
      className="bg-white rounded-md border p-3 cursor-pointer hover:shadow-md space-y-1 select-none">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{deal.deal_ref}</span>
        {deal.score_360 != null && (
          <Badge variant="outline" className="text-[10px]">{deal.score_360}/100</Badge>
        )}
      </div>
      <p className="font-medium text-sm truncate">{deal.enterprise_name || <span className="italic text-muted-foreground">—</span>}</p>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{fmtTicket}</span>
        {deal.lead_analyst_initials && (
          <span className="bg-muted rounded-full px-1.5 py-0.5 font-mono">{deal.lead_analyst_initials}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 11.2: Créer `CreateDealDialog.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const SOURCES = [
  { value: 'reseau_pe', label: 'Réseau PE' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'dfi', label: 'DFI' },
  { value: 'banque', label: 'Banque' },
  { value: 'mandat_ba', label: "Mandat banque d'affaires" },
  { value: 'conference', label: 'Conférence' },
  { value: 'autre', label: 'Autre' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentUserId: string;
  onCreated: () => void;
}

export default function CreateDealDialog({ open, onOpenChange, organizationId, currentUserId, onCreated }: Props) {
  const [enterpriseName, setEnterpriseName] = useState('');
  const [ticket, setTicket] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [source, setSource] = useState('reseau_pe');
  const [sourceDetail, setSourceDetail] = useState('');
  const [leadAnalystId, setLeadAnalystId] = useState(currentUserId);
  const [analysts, setAnalysts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLeadAnalystId(currentUserId);
    (async () => {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('role', ['analyst', 'investment_manager', 'managing_director']);
      const ids = (members || []).map((m: any) => m.user_id);
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      setAnalysts((members || []).map((m: any) => ({
        ...m,
        full_name: profMap.get(m.user_id)?.full_name || null,
        email: profMap.get(m.user_id)?.email || null,
      })));
    })();
  }, [open, organizationId, currentUserId]);

  const handleCreate = async () => {
    if (!enterpriseName.trim() && source !== 'autre') {
      // toléré : sourcing peut commencer sans nom, mais on insiste
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('create-pe-deal', {
      body: {
        organization_id: organizationId,
        enterprise_name: enterpriseName.trim() || null,
        ticket_demande: ticket ? Number(ticket) * 1000000 : null,
        currency,
        source,
        source_detail: source === 'autre' ? sourceDetail.trim() || null : null,
        lead_analyst_id: leadAnalystId,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success(`Deal ${(data as any).deal.deal_ref} créé`);
    setEnterpriseName(''); setTicket(''); setSourceDetail('');
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouveau deal</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nom de la cible</Label>
            <Input value={enterpriseName} onChange={e => setEnterpriseName(e.target.value)} placeholder="PharmaCi Industries" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ticket demandé (M)</Label>
              <Input type="number" step="0.1" value={ticket} onChange={e => setTicket(e.target.value)} placeholder="4.2" />
            </div>
            <div className="space-y-1.5">
              <Label>Devise</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="FCFA">FCFA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {source === 'autre' && (
            <div className="space-y-1.5">
              <Label>Précision</Label>
              <Input value={sourceDetail} onChange={e => setSourceDetail(e.target.value)} placeholder="…" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Analyste lead</Label>
            <Select value={leadAnalystId} onValueChange={setLeadAnalystId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {analysts.map((a: any) => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {a.full_name || a.email} {a.user_id === currentUserId ? '(moi)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 11.3: Créer `StageTransitionDialog.tsx`**

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromStage: string;
  toStage: string;
  dealRef: string;
  onConfirm: (lostReason?: string) => Promise<void>;
}

const STAGE_LABELS: Record<string, string> = {
  sourcing: 'Sourcing', pre_screening: 'Pre-screening', analyse: 'Analyse',
  ic1: 'IC1', dd: 'Due Diligence', ic_finale: 'IC finale',
  closing: 'Closing', portfolio: 'Portfolio', lost: 'Perdu',
};

export default function StageTransitionDialog({ open, onOpenChange, fromStage, toStage, dealRef, onConfirm }: Props) {
  const [lostReason, setLostReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isLost = toStage === 'lost';

  const handle = async () => {
    if (isLost && !lostReason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(isLost ? lostReason.trim() : undefined);
      setLostReason('');
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLost && <AlertTriangle className="h-4 w-4 text-red-500" />}
            Confirmer la transition
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm">
            Deal <span className="font-mono">{dealRef}</span>
            <br />
            <span className="text-muted-foreground">{STAGE_LABELS[fromStage]}</span>
            {' → '}
            <span className="font-medium">{STAGE_LABELS[toStage]}</span>
          </p>
          {isLost && (
            <div className="space-y-1.5">
              <Label>Raison du rejet *</Label>
              <Textarea rows={3} value={lostReason} onChange={e => setLostReason(e.target.value)}
                placeholder="Hors thèse, problème de gouvernance, etc." />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handle} disabled={submitting || (isLost && !lostReason.trim())}
            variant={isLost ? 'destructive' : 'default'}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 11.4: Remplacer `PePipelinePage.tsx` (kanban complet)**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import PeDealCard from '@/components/pe/PeDealCard';
import CreateDealDialog from '@/components/pe/CreateDealDialog';
import StageTransitionDialog from '@/components/pe/StageTransitionDialog';

const COLUMNS: { stage: string; label: string }[] = [
  { stage: 'sourcing', label: 'Sourcing' },
  { stage: 'pre_screening', label: 'Pre-screening' },
  { stage: 'analyse', label: 'Analyse' },
  { stage: 'ic1', label: 'IC1' },
  { stage: 'dd', label: 'DD' },
  { stage: 'ic_finale', label: 'IC finale' },
  { stage: 'closing', label: 'Closing' },
  { stage: 'portfolio', label: 'Portfolio' },
];

const SENSITIVE_TRANSITIONS = new Set(['ic1', 'dd', 'ic_finale', 'closing', 'lost']);

interface Deal {
  id: string;
  deal_ref: string;
  enterprise_id: string | null;
  enterprise_name?: string | null;
  stage: string;
  ticket_demande: number | null;
  currency: string | null;
  lead_analyst_id: string | null;
  lead_analyst_initials?: string;
  score_360: number | null;
}

function Column({ stage, label, count, children }: { stage: string; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage}` });
  return (
    <div ref={setNodeRef}
      className={`flex flex-col min-w-[220px] max-w-[260px] bg-muted/30 rounded-lg p-2 ${isOver ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 230px)' }}>
        {children}
      </div>
    </div>
  );
}

export default function PePipelinePage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{ deal: Deal; toStage: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);

    const { data: dealsData } = await supabase
      .from('pe_deals')
      .select('id, deal_ref, enterprise_id, stage, ticket_demande, currency, lead_analyst_id, score_360')
      .eq('organization_id', currentOrg.id)
      .neq('stage', 'lost')
      .order('created_at', { ascending: false });

    const entIds = [...new Set((dealsData || []).map((d: any) => d.enterprise_id).filter(Boolean))];
    const userIds = [...new Set((dealsData || []).map((d: any) => d.lead_analyst_id).filter(Boolean))];

    const [{ data: ents }, { data: profs }] = await Promise.all([
      entIds.length ? supabase.from('enterprises').select('id, name').in('id', entIds) : Promise.resolve({ data: [] }),
      userIds.length ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds) : Promise.resolve({ data: [] }),
    ]);
    const entMap = new Map((ents || []).map((e: any) => [e.id, e.name]));
    const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
    const initials = (name: string | null) => {
      if (!name) return '??';
      return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
    };

    setDeals((dealsData || []).map((d: any) => ({
      ...d,
      enterprise_name: entMap.get(d.enterprise_id) || null,
      lead_analyst_initials: initials(profMap.get(d.lead_analyst_id) || null),
    })));
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  const performTransition = async (deal: Deal, toStage: string, lostReason?: string) => {
    const { error, data } = await supabase.functions.invoke('update-pe-deal-stage', {
      body: { deal_id: deal.id, new_stage: toStage, lost_reason: lostReason },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message);
      load(); // re-sync (la carte rebondit)
      return;
    }
    toast.success(`Deal passé en ${toStage}`);
    load();
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const dealId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || !overId.startsWith('col-')) return;
    const toStage = overId.replace('col-', '');
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stage === toStage) return;

    if (SENSITIVE_TRANSITIONS.has(toStage)) {
      setPendingTransition({ deal, toStage });
    } else {
      performTransition(deal, toStage);
    }
  };

  if (loading) return <DashboardLayout title="Pipeline PE"><Loader2 className="h-6 w-6 animate-spin" /></DashboardLayout>;

  const dealsByStage = (stage: string) => deals.filter(d => d.stage === stage);
  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null;

  return (
    <DashboardLayout title="Pipeline PE" subtitle={currentOrg?.name || ''}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{deals.length}</span> deal{deals.length > 1 ? 's' : ''} actif{deals.length > 1 ? 's' : ''}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/pe/team')}>Équipe</Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nouveau deal
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map(c => (
            <Column key={c.stage} stage={c.stage} label={c.label} count={dealsByStage(c.stage).length}>
              {dealsByStage(c.stage).map(d => (
                <PeDealCard key={d.id} deal={d} onClick={() => navigate(`/pe/deals/${d.id}`)} />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay>{activeDeal && <PeDealCard deal={activeDeal} onClick={() => {}} />}</DragOverlay>
      </DndContext>

      {currentOrg && user && (
        <CreateDealDialog open={showCreate} onOpenChange={setShowCreate}
          organizationId={currentOrg.id} currentUserId={user.id} onCreated={load} />
      )}

      {pendingTransition && (
        <StageTransitionDialog
          open={!!pendingTransition}
          onOpenChange={(open) => { if (!open) setPendingTransition(null); }}
          fromStage={pendingTransition.deal.stage}
          toStage={pendingTransition.toStage}
          dealRef={pendingTransition.deal.deal_ref}
          onConfirm={async (reason) => {
            await performTransition(pendingTransition.deal, pendingTransition.toStage, reason);
            setPendingTransition(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
```

- [ ] **Step 11.5: Vérifier compilation et tester**

```bash
npx tsc --noEmit && npm run dev
```

Tester sur `/pe/pipeline` :
- Créer un deal via le bouton → apparaît dans Sourcing
- Drag entre Sourcing → Pre-screening → erreur (enterprise_id requis si on n'a pas saisi de nom). Attendu ou bug ? Si pas de nom au create, on doit autoriser. Re-créer avec un nom.
- Drag vers IC1 → mini-confirm s'ouvre
- Drag vers Lost → demande raison

- [ ] **Step 11.6: Commit**

```bash
git add src/pages/pe/PePipelinePage.tsx src/components/pe/PeDealCard.tsx src/components/pe/CreateDealDialog.tsx src/components/pe/StageTransitionDialog.tsx
git commit -m "feat(pe): page /pe/pipeline avec kanban drag-drop + création deal + confirm transitions sensibles"
```

---

## Task 12 : Page `/pe/deals/:dealId`

**Files:**
- Modify: `src/pages/pe/PeDealDetailPage.tsx`

- [ ] **Step 12.1: Remplacer le stub**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export default function PeDealDetailPage() {
  const navigate = useNavigate();
  const { dealId } = useParams<{ dealId: string }>();
  const { role: orgRole, isSuperAdmin } = useCurrentRole();
  const { currentOrg } = useOrganization();
  const [deal, setDeal] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [analysts, setAnalysts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ticket_demande: '', currency: 'EUR', source: 'autre', source_detail: '', lead_analyst_id: '' });

  const isMd = orgRole === 'owner' || orgRole === 'admin' || orgRole === 'managing_director' || isSuperAdmin;

  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    const { data: d } = await supabase.from('pe_deals').select('*').eq('id', dealId).single();
    if (!d) { setLoading(false); return; }
    let entName: string | null = null;
    if (d.enterprise_id) {
      const { data: e } = await supabase.from('enterprises').select('name').eq('id', d.enterprise_id).single();
      entName = e?.name || null;
    }
    let leadName: string | null = null;
    if (d.lead_analyst_id) {
      const { data: p } = await supabase.from('profiles').select('full_name, email').eq('user_id', d.lead_analyst_id).single();
      leadName = p?.full_name || p?.email || null;
    }
    setDeal({ ...d, enterprise_name: entName, lead_analyst_name: leadName });
    setForm({
      ticket_demande: d.ticket_demande != null ? String(d.ticket_demande / 1000000) : '',
      currency: d.currency || 'EUR',
      source: d.source || 'autre',
      source_detail: d.source_detail || '',
      lead_analyst_id: d.lead_analyst_id || '',
    });

    const { data: hist } = await supabase
      .from('pe_deal_history')
      .select('id, from_stage, to_stage, changed_by, reason, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });
    setHistory(hist || []);

    if (currentOrg) {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', currentOrg.id)
        .eq('is_active', true)
        .in('role', ['analyst', 'investment_manager', 'managing_director']);
      const ids = (members || []).map((m: any) => m.user_id);
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      setAnalysts((members || []).map((m: any) => ({ ...m, full_name: profMap.get(m.user_id)?.full_name || null, email: profMap.get(m.user_id)?.email || null })));
    }

    setLoading(false);
  }, [dealId, currentOrg]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!deal) return;
    setSaving(true);
    const { error } = await supabase
      .from('pe_deals')
      .update({
        ticket_demande: form.ticket_demande ? Number(form.ticket_demande) * 1000000 : null,
        currency: form.currency,
        source: form.source,
        source_detail: form.source === 'autre' ? form.source_detail.trim() || null : null,
        lead_analyst_id: form.lead_analyst_id || null,
      })
      .eq('id', deal.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Deal mis à jour');
    load();
  };

  const handleMarkLost = async () => {
    const reason = prompt('Raison du rejet ?');
    if (!reason || !reason.trim()) return;
    const { error, data } = await supabase.functions.invoke('update-pe-deal-stage', {
      body: { deal_id: deal.id, new_stage: 'lost', lost_reason: reason.trim() },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success('Deal marqué comme perdu');
    navigate('/pe/pipeline');
  };

  if (loading) return <DashboardLayout title="Deal"><Loader2 className="h-6 w-6 animate-spin" /></DashboardLayout>;
  if (!deal) return <DashboardLayout title="Deal"><p>Deal introuvable</p></DashboardLayout>;

  return (
    <DashboardLayout title={deal.deal_ref} subtitle={deal.enterprise_name || '—'}>
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate('/pe/pipeline')}>
        <ArrowLeft className="h-4 w-4" /> Retour au pipeline
      </Button>

      <div className="flex items-center gap-3 mb-4">
        <Badge variant="outline">{deal.stage}</Badge>
        {deal.lead_analyst_name && <span className="text-sm text-muted-foreground">Lead : {deal.lead_analyst_name}</span>}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="prescreening" disabled>Pre-screening</TabsTrigger>
          <TabsTrigger value="memo" disabled>Memo</TabsTrigger>
          <TabsTrigger value="valuation" disabled>Valuation</TabsTrigger>
          <TabsTrigger value="dd" disabled>DD</TabsTrigger>
          {deal.stage === 'portfolio' && <TabsTrigger value="monitoring" disabled>Monitoring</TabsTrigger>}
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card><CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ticket (M)</Label>
                <Input type="number" step="0.1" value={form.ticket_demande}
                  onChange={e => setForm(f => ({ ...f, ticket_demande: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Devise</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="FCFA">FCFA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reseau_pe">Réseau PE</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="dfi">DFI</SelectItem>
                  <SelectItem value="banque">Banque</SelectItem>
                  <SelectItem value="mandat_ba">Mandat BA</SelectItem>
                  <SelectItem value="conference">Conférence</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.source === 'autre' && (
              <div className="space-y-1.5">
                <Label>Précision</Label>
                <Input value={form.source_detail} onChange={e => setForm(f => ({ ...f, source_detail: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Lead analyst</Label>
              <Select value={form.lead_analyst_id} onValueChange={v => setForm(f => ({ ...f, lead_analyst_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {analysts.map((a: any) => (
                    <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enregistrer
              </Button>
              {isMd && deal.stage !== 'lost' && (
                <Button variant="destructive" onClick={handleMarkLost} className="gap-2">
                  <Trash2 className="h-4 w-4" /> Marquer comme perdu
                </Button>
              )}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Transition</th>
                <th className="text-left p-3">Raison</th>
              </tr></thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b">
                    <td className="p-3 text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString('fr-FR')}</td>
                    <td className="p-3">{h.from_stage || '—'} → <span className="font-medium">{h.to_stage}</span></td>
                    <td className="p-3 text-xs">{h.reason || '—'}</td>
                  </tr>
                ))}
                {!history.length && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Aucune transition enregistrée.</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="prescreening"><Card><CardContent className="p-8 text-center text-muted-foreground"><p>Disponible en Phase B (pre-screening 360°).</p></CardContent></Card></TabsContent>
        <TabsContent value="memo"><Card><CardContent className="p-8 text-center text-muted-foreground"><p>Disponible en Phase C (Investment Memo 12 sections).</p></CardContent></Card></TabsContent>
        <TabsContent value="valuation"><Card><CardContent className="p-8 text-center text-muted-foreground"><p>Disponible en Phase D (Valuation DCF + multiples).</p></CardContent></Card></TabsContent>
        <TabsContent value="dd"><Card><CardContent className="p-8 text-center text-muted-foreground"><p>Disponible en Phase E (Due Diligence + findings IA).</p></CardContent></Card></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
```

- [ ] **Step 12.2: Tester en local**

`/pe/deals/<id>` doit afficher les détails, permettre l'édition, et l'historique doit montrer la création comme première ligne.

- [ ] **Step 12.3: Commit**

```bash
git add src/pages/pe/PeDealDetailPage.tsx
git commit -m "feat(pe): page /pe/deals/:id avec onglets Détails + Historique + placeholders B-F"
```

---

## Task 13 : Wizard org PE (champ `code`)

**Files:**
- Modify: création d'org existante (chercher où elle vit)

- [ ] **Step 13.1: Localiser le wizard de création d'org**

```bash
grep -rln "create-organization\|CreateOrganization\|organization.*type.*pe" src --include="*.tsx" 2>/dev/null | head -5
```

Trouver le composant. Probablement dans `src/components/onboarding/` ou `src/pages/org/`.

- [ ] **Step 13.2: Ajouter le champ `code`**

Dans le composant trouvé, ajouter un input `code` (4-6 chars uppercase) visible quand `type === 'pe'`. Validation regex `/^[A-Z0-9]{2,6}$/`. L'envoyer dans le body de l'edge function `create-organization`.

- [ ] **Step 13.3: Modifier l'edge function `create-organization`**

Ajouter `code` au body parsé et à l'INSERT dans `organizations`.

```ts
const { name, type, code, devise_defaut } = await req.json();
// ...
await adminClient.from('organizations').insert({ name, type, code, devise_defaut, ... });
```

Redéployer la fonction.

- [ ] **Step 13.4: Tester**

Créer une org PE avec `code='TST'`, créer un deal, vérifier que `deal_ref = 'TST-2026-001'`.

- [ ] **Step 13.5: Commit**

```bash
# Adapter selon les fichiers réellement modifiés en step 13.1-13.3 :
git add src/components/onboarding/ src/contexts/OrganizationContext.tsx supabase/functions/create-organization/
git commit -m "feat(pe): wizard org PE avec champ code (préfixe deal_ref)"
```

---

## Task 14 : Smoke test final + push branch

**Files:** aucune modif, validation E2E.

- [ ] **Step 14.1: Push de la branche pe-demo**

```bash
git push origin pe-demo
```

Vercel détecte le push et déploie une preview. URL : voir dashboard Vercel ou l'output de `npx vercel ls esono-banque-demo`.

- [ ] **Step 14.2: Test E2E sur la preview Vercel**

Sur la preview URL :
1. Login en tant que owner (sellarts.ci@gmail.com)
2. Créer une nouvelle org type PE avec code='TST' → success
3. Switcher sur cette org → redirige vers `/pe/pipeline`
4. Créer un deal "PharmaCi" avec ticket 4.2M EUR, source réseau_pe → apparaît en Sourcing
5. Inviter un user role `investment_manager` → l'invitation part
6. Inviter un user role `analyst`
7. Aller sur `/pe/team` → voir 1 IM, 1 Analyste, alerte "1 analyste non rattaché"
8. Cliquer "Assigner un analyste" → assigner l'analyste à l'IM
9. Drag-drop le deal de Sourcing → Pre-screening → erreur (enterprise_id requis ? non si on a saisi le nom au create)
10. Drag → Analyse → OK
11. Drag → IC1 → mini-confirm s'ouvre, valider → OK
12. Cliquer la carte → ouvre /pe/deals/<id> → onglet Historique montre les 3 transitions
13. Onglet Détails → modifier le ticket à 5.0, save → success
14. Bouton "Marquer comme perdu" → demande raison, valider → retour au pipeline, deal disparaît
15. Login en tant qu'analyste invité (compte test) → /pe/pipeline → ne voit que ses deals
16. Login en tant qu'IM → ne voit que les deals de son analyste

- [ ] **Step 14.3: Validation user**

Demander au user de tester et valider sur la preview Vercel. Si OK → mergeable sur main.

- [ ] **Step 14.4: (Optionnel — si user valide) Merger sur main**

Selon la préférence du user. Soit PR via GitHub, soit merge direct.

```bash
git checkout main
git merge pe-demo
git push origin main
```

---

## Fin Phase A

À la fin : un fond PE peut créer son org, inviter son équipe, gérer les rattachements IM↔Analyst, créer des deals et les déplacer dans le kanban. **Aucun contenu IA** dans les onglets — c'est l'objet des phases B-G qui suivront.

**Prochaine étape :** spec et plan de Phase B (Pre-screening 360°).
