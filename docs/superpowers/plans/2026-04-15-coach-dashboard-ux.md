# Coach Dashboard UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the coach dashboard by removing phase-related UI, renaming labels, and converting the sector field from free text to a select list.

**Architecture:** All changes are in a single file (`CoachDashboard.tsx`) plus a new shared constant file for sectors. The sector list is derived from the 20 sector guardrails already defined in `financial-knowledge.ts` (edge function), but needs a frontend-accessible version since the edge function code is not importable from React.

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui, react-i18next

---

### Task 1: Create shared SECTORS constant for frontend

**Files:**
- Create: `src/lib/sectors.ts`

- [ ] **Step 1: Create the sectors file**

```typescript
// src/lib/sectors.ts
// Sector list matching the 20 guardrails in financial-knowledge.ts
// Labels are human-readable French names for display

export const SECTORS = [
  { value: 'agro_industrie', label: 'Agro-industrie' },
  { value: 'aviculture', label: 'Aviculture' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'agriculture_rente', label: "Agriculture de rente" },
  { value: 'commerce_detail', label: 'Commerce de détail' },
  { value: 'commerce_alimentaire', label: 'Commerce alimentaire' },
  { value: 'restauration', label: 'Restauration' },
  { value: 'services_b2b', label: 'Services B2B' },
  { value: 'tic', label: 'TIC / Télécommunications' },
  { value: 'services_it', label: 'Services IT' },
  { value: 'imprimerie', label: 'Imprimerie' },
  { value: 'energie', label: 'Énergie' },
  { value: 'sante', label: 'Santé' },
  { value: 'btp', label: 'BTP / Construction' },
  { value: 'industrie_manufacturiere', label: 'Industrie manufacturière' },
  { value: 'transport_logistique', label: 'Transport & Logistique' },
  { value: 'education_formation', label: 'Éducation & Formation' },
  { value: 'immobilier', label: 'Immobilier' },
  { value: 'textile_mode', label: 'Textile & Mode' },
  { value: 'mines_extraction', label: 'Mines & Extraction' },
] as const;

export type SectorValue = typeof SECTORS[number]['value'];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/sectors.ts
git commit -m "feat: add shared SECTORS constant for frontend select lists"
```

---

### Task 2: Remove phase filter dropdown

**Files:**
- Modify: `src/components/dashboard/CoachDashboard.tsx`

- [ ] **Step 1: Remove the filterPhase state declaration**

Find at line ~88:
```typescript
const [filterPhase, setFilterPhase] = useState('');
```
Delete this line.

- [ ] **Step 2: Remove filterPhase from the filter logic**

Find at lines ~361-367:
```typescript
const filteredEnts = enterprises.filter(e => {
  const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.contact_email || '').toLowerCase().includes(search.toLowerCase());
  const matchPhase = !filterPhase || e.phase === filterPhase;
  return matchSearch && matchPhase;
});
```

Replace with:
```typescript
const filteredEnts = enterprises.filter(e => {
  const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.contact_email || '').toLowerCase().includes(search.toLowerCase());
  return matchSearch;
});
```

- [ ] **Step 3: Remove the phase filter dropdown JSX**

Find at lines ~559-568 the `<select>` element with `filterPhase`:
```typescript
<select
  value={filterPhase}
  onChange={e => setFilterPhase(e.target.value)}
  className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none"
>
  <option value="">{t('dashboard_coach.all_phases')}</option>
  <option value="identite">{t('dashboard_coach.phase_identite')}</option>
  <option value="finance">{t('dashboard_coach.phase_finance')}</option>
  <option value="dossier">{t('dashboard_coach.phase_dossier')}</option>
</select>
```
Delete this entire `<select>` block.

- [ ] **Step 4: Verify build**

```bash
npx vite build 2>&1 | tail -3
```
Expected: `✓ built in Xs`

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/CoachDashboard.tsx
git commit -m "feat: remove phase filter dropdown from coach dashboard"
```

---

### Task 3: Remove phase badges on enterprise cards

**Files:**
- Modify: `src/components/dashboard/CoachDashboard.tsx`

- [ ] **Step 1: Remove the phase badge JSX**

Find at lines ~638-641:
```typescript
<div className="col-span-1 hidden sm:block">
  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: phaseColor, background: `${phaseColor}15` }}>
    {t(phaseKey)}
  </span>
</div>
```
Delete this entire `<div>` block.

- [ ] **Step 2: Remove the phaseColor and phaseKey variables used for this badge**

In the same map function rendering enterprise rows, find the lines that compute `phaseColor` and `phaseKey`:
```typescript
const phaseColor = getPhaseColor(e.phase || '');
const phaseKey = getPhaseKey(e.phase || '');
```
Delete these lines (only if they're not used elsewhere in the row — check first).

- [ ] **Step 3: Remove the helper functions if no longer used**

If `getPhaseColor` (lines ~40-47) and `getPhaseKey` (lines ~49-56) are not used anywhere else in the file, delete them:
```typescript
function getPhaseColor(phase: string) { ... }
function getPhaseKey(phase: string) { ... }
```

Search the file for any other reference to `getPhaseColor` or `getPhaseKey` before deleting. If the table header had a "Phase" column label, remove that too.

- [ ] **Step 4: Verify build**

```bash
npx vite build 2>&1 | tail -3
```
Expected: `✓ built in Xs`

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/CoachDashboard.tsx
git commit -m "feat: remove phase badges from enterprise cards"
```

---

### Task 4: Rename "Templates Vierges" to "Templates Questionnaires"

**Files:**
- Modify: `src/components/dashboard/CoachDashboard.tsx`
- Modify: i18n translation files (FR and EN)

- [ ] **Step 1: Find and update the button text**

Find at line ~540:
```typescript
<Button variant="outline" asChild className="gap-2">
  <a href="/templates"><Download className="h-4 w-4" /> {t('dashboard_coach.blank_templates')}</a>
</Button>
```

The text comes from the i18n key `dashboard_coach.blank_templates`. Find the translation files:
```bash
grep -r "blank_templates" src/locales/ --include="*.json" -l
```

Update the French translation value from "Templates Vierges" to "Templates Questionnaires".
Update the English translation value accordingly (e.g., "Questionnaire Templates").

- [ ] **Step 2: Verify build**

```bash
npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: rename Templates Vierges to Templates Questionnaires"
```

---

### Task 5: Convert sector field from text input to select list

**Files:**
- Modify: `src/components/dashboard/CoachDashboard.tsx`

- [ ] **Step 1: Add import for SECTORS**

At the top of CoachDashboard.tsx, add:
```typescript
import { SECTORS } from '@/lib/sectors';
```

- [ ] **Step 2: Replace the sector text input with a select**

Find at lines ~707-708:
```typescript
<input type="text" placeholder="Agro-industrie, Fintech..." value={addForm.sector} onChange={e => setAddForm(f => ({ ...f, sector: e.target.value }))} className="..." />
```

Replace with:
```typescript
<select
  value={addForm.sector}
  onChange={e => setAddForm(f => ({ ...f, sector: e.target.value }))}
  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none"
>
  <option value="">— Sélectionner un secteur —</option>
  {SECTORS.map(s => (
    <option key={s.value} value={s.value}>{s.label}</option>
  ))}
</select>
```

- [ ] **Step 3: Verify build**

```bash
npx vite build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/CoachDashboard.tsx
git commit -m "feat: sector field as select list with 20 guardrail sectors"
```

---

### Task 6: Remove "Description de l'activité" and city from add entrepreneur form

**Files:**
- Modify: `src/components/dashboard/CoachDashboard.tsx`

- [ ] **Step 1: Remove the description input**

Find at lines ~722-723:
```typescript
<input type="text" placeholder={t('dashboard_coach.description')} value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} className="..." />
```
Delete this entire `<input>` element (and any wrapping `<div>` or label).

- [ ] **Step 2: Remove the city input**

Find at lines ~713-714:
```typescript
<input type="text" placeholder="Abidjan, Lagos..." value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))} className="..." />
```
Delete this entire `<input>` element (and any wrapping `<div>` or label).

- [ ] **Step 3: Remove city and description from the addForm state**

Find at line ~91:
```typescript
const [addForm, setAddForm] = useState({ name: '', contact_email: '', country: '', sector: '', city: '', description: '' });
```

Replace with:
```typescript
const [addForm, setAddForm] = useState({ name: '', contact_email: '', country: '', sector: '' });
```

- [ ] **Step 4: Remove city and description from the handleAddEntrepreneur creation logic**

In the `handleAddEntrepreneur` function (lines ~250-306), find where `addForm.city` and `addForm.description` are used in the insert payload. Remove them from the object being inserted. The fields to keep: `name`, `country`, `sector`, `contact_email`, `coach_id`, `user_id`, `phase`, `score_ir`.

- [ ] **Step 5: Verify build**

```bash
npx vite build 2>&1 | tail -3
```

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/CoachDashboard.tsx
git commit -m "feat: remove description and city fields from add entrepreneur form"
```

---

### Task 7: Deploy preview and verify

- [ ] **Step 1: Deploy to Vercel preview**

```bash
vercel deploy --yes 2>&1 | tail -5
```

- [ ] **Step 2: Test with Playwright**

Open the preview URL, login as coach, verify:
- No phase filter dropdown next to search
- No phase badges on enterprise cards
- "Templates Questionnaires" label (not "Templates Vierges")
- Sector is a dropdown select (not text input) with 20 options
- No city or description fields in add entrepreneur dialog

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: post-review adjustments for coach dashboard UX"
```
