# Phase A — Foundation PE : design

**Date :** 2026-04-30
**Statut :** validé en brainstorming, prêt pour writing-plans
**Effort estimé :** ~5 jours
**Branche d'implémentation :** `main`

## Contexte

ESONO supporte déjà multi-segment (`programme`, `banque`, `pe`, `banque_affaires`) au niveau enums DB et `segment-config-front.ts` (vocab, modules, devise par segment). Mais le segment `pe` n'a actuellement aucune page, aucun routing, aucune table métier — c'est un squelette vide.

Le user a fourni un doc d'expérience PE complet (3 rôles MD/IM/Analyste, 8 stages de pipeline, 12 sections de memo, etc.). Vu l'ampleur (~5-7 semaines de travail), le travail a été décomposé en 8 sous-projets (Phase A-H). **Ce spec couvre uniquement Phase A — Foundation.**

À la fin de Phase A, un user pourra :
- Créer une org de type `pe` depuis le wizard
- Inviter des membres avec rôles `managing_director`, `investment_manager`, `analyst`
- Gérer les rattachements IM ↔ Analyste (page team)
- Créer des deals et les déplacer dans un kanban 8 colonnes (drag-drop)
- Voir une fiche deal avec onglets placeholders (B-F arrivent plus tard)

Le contenu réel des onglets (Pre-screening 360°, Memo 12 sections, Valuation DCF, DD, Monitoring, Reporting LP) est **hors scope** Phase A.

## Décisions clés (validées avec le user)

| # | Décision | Choix | Pourquoi |
|---|---|---|---|
| 1 | Hiérarchie de visibilité | **Soft hierarchy** via mapping table `pe_team_assignments` (M-to-N) | Souplesse : marche avec ou sans IM, reorgs sans migration schéma |
| 2 | Modèle de données | **Table dédiée `pe_deals`** (overlay sur `enterprises`) | Cohérent avec `candidatures` (programme) et `dossier_dossiers` (banque). Permet 2ème tour / refinancement. |
| 3 | Préfixe `deal_ref` | **Par org** (ex: `ADW-2026-017`), via champ `code` sur `organizations` | Les fonds utilisent ces refs en externe ; un générique paraît amateur |
| 4 | `enterprise_id` | **Nullable au stage `sourcing`**, NOT NULL dès `pre_screening+` (trigger) | 80% des leads en sourcing n'iront jamais plus loin — pas de pollution de `enterprises` |
| 5 | Champ `source` | **Enum strict** : `reseau_pe`, `inbound`, `dfi`, `banque`, `mandat_ba`, `conference`, `autre` (+ `source_detail` text si `autre`) | Stats fiables en Phase G (reporting LP) |
| 6 | Visibilité team mapping | **Privée par équipe** : analyste voit son IM + co-analystes du même IM uniquement | Cloisonnement inter-équipes, attendu sur les fonds 10+ pers. |
| 7 | Transitions de stage | Analyste ≤ `analyse`, IM tout sauf `closing`/`portfolio`, MD tout | Empêche un analyste de pousser unilatéralement vers IC |
| 8 | UX changement de stage | **Drag-drop** dans le kanban, mini-confirm sur transitions sensibles (`ic1`, `dd`, `ic_finale`, `closing`, `lost`) | Standard CRM moderne, plus rapide qu'une fiche dédiée |
| 9 | Audit | Table `pe_deal_history` Phase A | 5 lignes de plus, info précieuse en cas de désaccord |
| 10 | Owner = MD ? | Non, on garde `owner` qui implique MD pour les permissions | Plus simple, moins de dette de rôles |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND                                                     │
│                                                              │
│  /pe/pipeline   /pe/deals/:id   /pe/team                    │
│       │              │               │                       │
│       └──────────────┴───────────────┘                       │
│                      │                                       │
│             supabase.from('pe_deals')                        │
│             supabase.from('pe_team_assignments')             │
│             functions.invoke('create-pe-deal')               │
│             functions.invoke('update-pe-deal-stage')         │
│             functions.invoke('assign-pe-team')               │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────▼──────────────┐
         │ RLS hiérarchique (Postgres)│
         │ - can_see_pe_deal()        │
         │ - is_pe_md_or_owner()      │
         │ - is_supervising_analyst() │
         └─────────────┬──────────────┘
                       │
       ┌───────────────┴────────────────┐
       │                                │
   pe_deals                    pe_team_assignments
   (overlay sur enterprises)   (mapping IM ↔ Analyst)
       │                                │
       └─────► pe_deal_history (audit)
```

## Modèle de données

### Enums

```sql
-- Étend l'enum app_role (fichier *_enums.sql séparé, pas en transaction)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'managing_director';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'investment_manager';
-- 'analyst' existe déjà depuis multi_segment_enums

-- Nouveau enum pour les stages du pipeline PE
CREATE TYPE pe_deal_stage AS ENUM (
  'sourcing',
  'pre_screening',
  'analyse',
  'ic1',
  'dd',
  'ic_finale',
  'closing',
  'portfolio',
  'lost'
);

-- Nouveau enum pour la source des deals
CREATE TYPE pe_deal_source AS ENUM (
  'reseau_pe', 'inbound', 'dfi', 'banque', 'mandat_ba', 'conference', 'autre'
);
```

### Table `pe_deals`

```sql
CREATE TABLE pe_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
  deal_ref TEXT NOT NULL,                      -- auto-généré par trigger
  stage pe_deal_stage NOT NULL DEFAULT 'sourcing',
  lead_analyst_id UUID REFERENCES auth.users(id),
  ticket_demande NUMERIC,
  currency TEXT DEFAULT 'EUR',
  source pe_deal_source DEFAULT 'autre',
  source_detail TEXT,                          -- libre, surtout utile si source='autre'
  score_360 INTEGER,                           -- rempli en Phase B (pre-screening 360)
  lost_reason TEXT,                            -- obligatoire si stage='lost'
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, deal_ref)
);

CREATE INDEX idx_pe_deals_org_stage ON pe_deals(organization_id, stage);
CREATE INDEX idx_pe_deals_lead_analyst ON pe_deals(lead_analyst_id);
CREATE INDEX idx_pe_deals_enterprise ON pe_deals(enterprise_id);

-- Trigger : génère deal_ref à l'insert {ORG_CODE}-{YEAR}-{SEQ}
CREATE OR REPLACE FUNCTION generate_pe_deal_ref() RETURNS TRIGGER AS $$
DECLARE
  org_code TEXT;
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.deal_ref IS NULL OR NEW.deal_ref = '' THEN
    SELECT COALESCE(code, 'DEAL') INTO org_code FROM organizations WHERE id = NEW.organization_id;
    year_str := to_char(now(), 'YYYY');
    -- Compteur scopé org+année
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

CREATE TRIGGER pe_deals_generate_ref
  BEFORE INSERT ON pe_deals
  FOR EACH ROW EXECUTE FUNCTION generate_pe_deal_ref();

-- Trigger : enterprise_id obligatoire dès stage > sourcing
CREATE OR REPLACE FUNCTION enforce_enterprise_required() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage <> 'sourcing' AND NEW.enterprise_id IS NULL THEN
    RAISE EXCEPTION 'enterprise_id requis dès le stage pre_screening (deal %)', NEW.deal_ref;
  END IF;
  IF NEW.stage = 'lost' AND (NEW.lost_reason IS NULL OR NEW.lost_reason = '') THEN
    RAISE EXCEPTION 'lost_reason requis quand stage=lost (deal %)', NEW.deal_ref;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pe_deals_enforce_enterprise
  BEFORE INSERT OR UPDATE ON pe_deals
  FOR EACH ROW EXECUTE FUNCTION enforce_enterprise_required();
```

### Table `pe_team_assignments`

```sql
CREATE TABLE pe_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  im_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analyst_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, im_user_id, analyst_user_id)
);

CREATE INDEX idx_pe_team_im ON pe_team_assignments(im_user_id) WHERE is_active = true;
CREATE INDEX idx_pe_team_analyst ON pe_team_assignments(analyst_user_id) WHERE is_active = true;
```

### Table `pe_deal_history` (audit)

```sql
CREATE TABLE pe_deal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  from_stage pe_deal_stage,
  to_stage pe_deal_stage NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,                               -- pour stage='lost' notamment
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pe_deal_history_deal ON pe_deal_history(deal_id, created_at DESC);
```

### Modification `organizations`

```sql
-- Préfixe utilisé pour générer les deal_ref des PE deals
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS code VARCHAR(6);
-- Pas de NOT NULL : seules les orgs PE en ont besoin, les programmes/banques s'en moquent.
```

## Helpers Postgres (SECURITY DEFINER)

```sql
-- Renvoie true si user_id est MD/owner/admin de l'org
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

-- Renvoie true si im_user supervise analyst_user dans cette org (mapping actif)
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

-- Renvoie true si user_id peut voir le deal
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
        d.lead_analyst_id = p_user_id  -- l'analyste lead
        OR public.is_pe_md_or_owner(d.organization_id, p_user_id)  -- MD/owner/admin
        OR EXISTS (  -- IM superviseur du lead
          SELECT 1 FROM public.pe_team_assignments t
          WHERE t.organization_id = d.organization_id
            AND t.im_user_id = p_user_id
            AND t.analyst_user_id = d.lead_analyst_id
            AND t.is_active = true
        )
      )
  );
$$;

-- Renvoie le rôle PE effectif de l'utilisateur dans l'org
CREATE OR REPLACE FUNCTION get_pe_role(p_org_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id AND is_active = true;
$$;
```

## Politiques RLS

### `pe_deals`

```sql
ALTER TABLE pe_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_deals_select" ON pe_deals
  FOR SELECT USING (can_see_pe_deal(id, auth.uid()));

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

CREATE POLICY "pe_deals_update" ON pe_deals
  FOR UPDATE USING (can_see_pe_deal(id, auth.uid()))
  WITH CHECK (can_see_pe_deal(id, auth.uid()));
-- La validation fine des transitions de stage par rôle est faite côté
-- edge function update-pe-deal-stage (CHECK SQL serait imbitable).

-- Pas de DELETE policy : on n'efface jamais, on passe stage='lost'.
```

### `pe_team_assignments`

```sql
ALTER TABLE pe_team_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_team_select" ON pe_team_assignments
  FOR SELECT USING (
    is_pe_md_or_owner(organization_id, auth.uid())
    OR im_user_id = auth.uid()
    OR im_user_id IN (
      SELECT t.im_user_id FROM pe_team_assignments t
      WHERE t.analyst_user_id = auth.uid() AND t.is_active = true
    )
  );

CREATE POLICY "pe_team_modify" ON pe_team_assignments
  FOR ALL USING (is_pe_md_or_owner(organization_id, auth.uid()))
  WITH CHECK (is_pe_md_or_owner(organization_id, auth.uid()));
```

### `pe_deal_history`

```sql
ALTER TABLE pe_deal_history ENABLE ROW LEVEL SECURITY;

-- Visible si on peut voir le deal
CREATE POLICY "pe_deal_history_select" ON pe_deal_history
  FOR SELECT USING (can_see_pe_deal(deal_id, auth.uid()));

-- Insert via trigger seulement (pas de policy INSERT publique)
```

## Edge functions

### `create-pe-deal` (nouvelle)

**Body** :
```json
{
  "organization_id": "uuid",
  "enterprise_name": "PharmaCi Industries SA",  // optionnel; si fourni, crée l'enterprise
  "enterprise_id": "uuid",                       // alternative: lier à une enterprise existante
  "ticket_demande": 4200000,
  "currency": "EUR",
  "source": "reseau_pe",
  "source_detail": null,
  "lead_analyst_id": "uuid"                     // optionnel; default = auth.uid()
}
```

**Logique** :
1. Vérifier que `auth.uid()` est membre actif de l'org avec rôle invitable
2. Si `enterprise_name` fourni mais pas `enterprise_id` : créer une row `enterprises` minimale (org_id, name, contact_email=null, etc.)
3. INSERT dans `pe_deals` (le trigger génère `deal_ref`)
4. Renvoyer le deal créé avec son `deal_ref`

### `update-pe-deal-stage` (nouvelle)

**Body** :
```json
{
  "deal_id": "uuid",
  "new_stage": "ic1",
  "lost_reason": null
}
```

**Logique** :
1. Charger le deal + le rôle de `auth.uid()` dans l'org (via `get_pe_role`)
2. Valider la transition selon la matrice :
   ```
   Analyste : sourcing ↔ pre_screening ↔ analyse  (max)
   IM       : tout sauf 'closing', 'portfolio'
   MD/owner : tout
   Tout rôle peut passer à 'lost' (avec lost_reason)
   ```
3. Si `new_stage='lost'`, exiger `lost_reason` non-vide
4. UPDATE `pe_deals` (le trigger valide enterprise_id requis si stage > sourcing)
5. INSERT dans `pe_deal_history` (from_stage, to_stage, changed_by, reason)

### `assign-pe-team` (nouvelle, MD/owner only)

**Body** :
```json
{
  "organization_id": "uuid",
  "im_user_id": "uuid",
  "analyst_user_id": "uuid",
  "action": "add"
}
// ou
{
  "organization_id": "uuid",
  "im_user_id": "uuid",
  "analyst_user_id": "uuid",
  "action": "remove"
}
```

**Logique** :
1. Vérifier `is_pe_md_or_owner(org_id, auth.uid())`
2. Vérifier que les 2 users sont membres actifs de l'org avec rôles cohérents :
   - `im_user_id` doit avoir `role='investment_manager'`
   - `analyst_user_id` doit avoir `role='analyst'`
3. Si `action='add'` : UPSERT dans `pe_team_assignments` (set is_active=true)
4. Si `action='remove'` : UPDATE `is_active=false` (soft delete pour préserver l'historique)

### Réutilisations sans modification

- `send-invitation` : déjà gère les rôles dynamiques. Aucune modif.
- `create-organization` : déjà gère le type. On passe `code` dans le body.

## Pages frontend (`src/pages/pe/`)

### `/pe/pipeline` (nouveau : `src/pages/pe/PePipelinePage.tsx`)

Inspiration : `CandidatureKanban.tsx` (programmes).

**Layout** :
- Header : titre, bouton `+ Nouveau deal`, filtres (lead_analyst dropdown, source multiselect, toggle "voir perdus")
- 8 colonnes scrollables horizontalement : Sourcing | Pre-screening | Analyse | IC1 | DD | IC finale | Closing | Portfolio
- Carte deal : `deal_ref` (font-mono), nom enterprise (ou "—" si null), ticket + devise, initiales lead_analyst, badge score_360 si présent

**Drag-drop** :
- `@dnd-kit/core` (déjà utilisé pour Kanban candidatures)
- onDragEnd → invoke `update-pe-deal-stage`
- Sur transitions sensibles (ic1, dd, ic_finale, closing, lost) : ouvrir un mini-dialog confirm avant d'envoyer
- Si lost : dialog avec champ `lost_reason` obligatoire
- Sur erreur (RLS refuse) : toast + carte rebondit (refresh local)

**Création deal** :
- Bouton `+ Nouveau deal` → dialog
- Champs : nom enterprise (libre, crée la row si nouvelle), ticket, source (select enum), lead_analyst (dropdown filtré sur membres actifs avec rôle analyst/IM/MD)
- Submit → `create-pe-deal` → toast + carte ajoutée en colonne sourcing

### `/pe/deals/:dealId` (nouveau : `src/pages/pe/PeDealDetailPage.tsx`)

**Header** :
- `deal_ref` + nom enterprise + stage badge + lead_analyst initiales + ticket
- Bouton retour vers pipeline

**Onglets** (Tabs) :
- **Détails** (Phase A) : form édition basique
  - nom enterprise (lien vers fiche enterprise si existe)
  - ticket / currency / source / source_detail
  - lead_analyst (dropdown avec liste membres autorisés)
  - bouton danger MD-only : `Marquer comme perdu` → dialog `lost_reason`
- **Pre-screening** (Phase B) : placeholder "Disponible en Phase B"
- **Memo** (Phase C) : placeholder
- **Valuation** (Phase D) : placeholder
- **DD** (Phase E) : placeholder
- **Monitoring** (Phase F) : placeholder, visible uniquement si `stage = 'portfolio'`
- **Historique** (Phase A) : table de `pe_deal_history` filtrée sur ce deal

### `/pe/team` (nouveau : `src/pages/pe/PeTeamPage.tsx`)

Logique conditionnée par rôle (calculé via `useCurrentRole`) :

**Si MD / owner / admin** :
- Section "IMs et leurs analystes" :
  - Pour chaque IM (queryé via `organization_members WHERE role='investment_manager'`), un bloc collapsible avec ses analystes assignés
  - Bouton X par ligne pour désactiver une assignation
- Bouton `+ Assigner un analyste à un IM` → dialog : sélecteur IM + sélecteur Analyste
- Section "Analystes non rattachés" en bas :
  - Liste des `analysts` dans l'org SANS aucune ligne active dans `pe_team_assignments`
  - Alerte si > 0 ("Ces analystes ne sont supervisés par aucun IM, leurs deals ne seront visibles qu'au MD")
- Lien vers `/org/members` pour inviter

**Si IM** :
- Section "Mon équipe" : liste de ses analystes (depuis `pe_team_assignments WHERE im_user_id = me`)
- Lien vers `/org/members` pour inviter

**Si Analyste** :
- Section "Mon superviseur" : nom + email (depuis `pe_team_assignments WHERE analyst_user_id = me`)
- Section "Mes co-analystes" : autres analystes sous le même IM
- Pas d'actions (juste lecture)

## Routing & onboarding

### `src/pages/Dashboard.tsx`

Ajouter un branch avant le routing programme :

```tsx
const peRoles = [
  'owner', 'admin', 'manager',
  'managing_director', 'investment_manager', 'analyst', 'partner',
];
if (currentOrg.type === 'pe' && orgRole && peRoles.includes(orgRole)) {
  return <Navigate to="/pe/pipeline" replace />;
}
```

### `src/App.tsx` (routes)

Ajouter :
```tsx
<Route path="/pe/pipeline" element={<RequireOrgPE><PePipelinePage /></RequireOrgPE>} />
<Route path="/pe/deals/:dealId" element={<RequireOrgPE><PeDealDetailPage /></RequireOrgPE>} />
<Route path="/pe/team" element={<RequireOrgPE><PeTeamPage /></RequireOrgPE>} />
```

`RequireOrgPE` est un wrapper qui redirige vers `/dashboard` si `currentOrg.type !== 'pe'`. Pattern existant pour banque (`RequireOrgBanque` ou équivalent).

### Wizard création org

Le wizard existant (`CreateOrganizationWizard` ou équivalent dans `OrganizationContext`) :
- Si `type === 'pe'` choisi : ajouter un step "Code et devise"
  - Input `code` (4-6 chars, uppercase, validation regex `^[A-Z0-9]{2,6}$`)
  - Select devise par défaut (EUR / FCFA / USD)
- Le créateur reçoit `role='owner'` (pas de `managing_director` séparé — owner suffit)
- Toast post-création : "Organisation PE créée. Invite ton équipe via /pe/team."

### `getInvitableRoles()` (`src/lib/roles.ts`)

Étendre :
```ts
case 'pe':
  if (myRole === 'owner' || myRole === 'admin') {
    return [
      { value: 'admin', label: 'Admin' },
      { value: 'managing_director', label: 'Managing Director' },
      { value: 'investment_manager', label: 'Investment Manager' },
      { value: 'analyst', label: 'Analyst' },
    ];
  }
  if (myRole === 'managing_director') {
    return [
      { value: 'investment_manager', label: 'Investment Manager' },
      { value: 'analyst', label: 'Analyst' },
    ];
  }
  if (myRole === 'investment_manager') {
    return [{ value: 'analyst', label: 'Analyst' }];
  }
  return [];
```

### `humanizeRole()` (`src/lib/roles.ts`)

Ajouter labels :
```ts
case 'managing_director':
  return orgType === 'pe' ? 'Managing Director' : 'Directeur';
case 'investment_manager':
  return 'Investment Manager';
case 'analyst':
  return orgType === 'pe' ? 'Analyste' : (orgType === 'banque_affaires' ? 'Analyste BA' : 'Analyste');
```

## Plan de migration

**Une seule PR sur `main`**, deux fichiers de migration :

1. `supabase/migrations/20260430000001_pe_phase_a_enums.sql` — `ALTER TYPE app_role ADD VALUE` + `CREATE TYPE pe_deal_stage` + `CREATE TYPE pe_deal_source` (hors transaction)
2. `supabase/migrations/20260430000002_pe_phase_a_tables.sql` — tables (`pe_deals`, `pe_team_assignments`, `pe_deal_history`), triggers, helpers SECURITY DEFINER, RLS, `ALTER TABLE organizations ADD COLUMN code`

**Aucune migration de données** : aucune org existante n'est de type `pe` (vérifié via SQL). Additif pur.

**Risques connus** :
- `ALTER TYPE app_role ADD VALUE` ne peut pas tourner dans une transaction → fichier `_enums.sql` séparé. Pattern déjà appliqué dans `20260427000001_multi_segment_enums.sql`.

## Tests à prévoir

Le détail des tests sera dans le plan d'implémentation. Cibles minimales :

**RLS** (SQL avec `set request.jwt.claims`) :
- Analyste voit ses deals
- Analyste ne voit PAS les deals d'un autre analyste
- IM voit les deals de ses analystes (mapping actif)
- IM ne voit PAS les deals d'un analyste hors mapping
- MD voit tout
- Désactiver un mapping → l'IM ne voit plus le deal immédiatement

**Edge functions** :
- `create-pe-deal` génère un `deal_ref` unique scopé org+année
- `update-pe-deal-stage` : analyste refusé pour ic1, IM accepté
- `update-pe-deal-stage` : transition vers `lost` sans `lost_reason` → erreur
- `assign-pe-team` refuse si l'inviteur n'est pas MD/owner

**Frontend** :
- Drag-drop dans le kanban : analyste drag de sourcing → ic1 = rebond + toast
- Création deal sans enterprise_name : reste en sourcing avec enterprise_id null
- Tentative d'avancer un deal sans enterprise au stage pre_screening : erreur du trigger remontée comme toast

## Hors scope Phase A (rappel)

Tout ce qui suit arrive en Phase B-H :

- **Phase B** : Pre-screening 360° (score 6 dimensions, red flags SYSCOHADA, qualité documentaire)
- **Phase C** : Investment Memo 12 sections (living document, validation par section, IC1 → IC finale)
- **Phase D** : Valuation détaillée (DCF + multiples + sensibilité)
- **Phase E** : DD process (upload rapports, findings IA, diff IC1→final, valo recalc)
- **Phase F** : Monitoring portefeuille (KPIs trimestriels, alertes)
- **Phase G** : Reporting LP (génération auto, validation MD)
- **Phase H** : Onboarding org PE avancé + accréditation IFC/2X + équipes M-to-N éventuelles
