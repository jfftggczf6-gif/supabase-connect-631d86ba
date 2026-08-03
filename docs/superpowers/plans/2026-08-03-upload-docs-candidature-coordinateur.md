# Upload docs candidature (coordinateur) + re-diagnostic auto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use `- [ ]`.

**Goal:** Permettre à un admin/chef/manager d'ajouter des documents à une candidature depuis la fiche (kanban), avec extraction du texte et re-diagnostic automatique.

**Architecture:** On réutilise les briques existantes de `submit-candidature` (signed upload URL vers `candidature-documents`, merge `documents`, dispatch re-screen worker), mais derrière une **nouvelle edge function authentifiée et role-gated** (`add-candidature-documents`) car `submit-candidature` est publique. Le dispatcher de screening est extrait dans `_shared/` pour être partagé. Côté front, une zone d'upload dans `CandidatureDetailDrawer` (section Documents), + traçabilité « ajouté par X le Y ».

**Tech Stack:** Supabase Edge Functions (Deno), React/TS (vitest pour le pur front), bucket `candidature-documents`, worker Railway `screen-candidatures`.

## Global Constraints

- **PROD** (`gszwotgppuinpfnyrjnu`, front Lovable). Rien déployé sans validation.
- **Zéro régression** sur la soumission entreprise et l'upload existant (`submit-candidature` inchangé fonctionnellement).
- Rôles autorisés = `canManageProgrammeCandidatures` (admin/owner/manager/chef) — `_shared/candidature-permissions.ts:53`.
- Bucket existant `candidature-documents`, chemin `${candidature_id}/${ts}_${safeName}`. Pas de nouveau bucket.
- Merge des docs = **dédup par `file_name`**, jamais écraser les docs existants.
- Re-screen = 1 seul dispatch après tous les uploads, `prefer_vision: true` (ajout manuel = haute fidélité), async worker + `ai_jobs`.
- EF Deno testées par curl (pas vitest) ; composants/purs front en vitest TDD.
- Traçabilité : entrées doc ajoutées portent `source: 'coordinator'`, `added_by_name`, `added_by_id`, `added_at`.

---

### Task 1: Extraire `dispatchScreening` dans `_shared/dispatch-screening.ts`

**Files:**
- Create: `supabase/functions/_shared/dispatch-screening.ts`
- Modify: `supabase/functions/submit-candidature/index.ts` (importer depuis le shared, retirer la copie locale)

**Interfaces:**
- Produces: `dispatchScreening(supabase, { programmeId: string; candidatureIds: string[]; organizationId?: string|null; preferVision?: boolean }): Promise<boolean>` et `markScreeningError(supabase, candidatureId, reason)`.

- [ ] **Step 1: Créer le module partagé** — copier verbatim `dispatchScreening` + `markScreeningError` (submit-candidature:30-88) dans `_shared/dispatch-screening.ts`, en `export`. Garder la lecture de `RAILWAY_AI_URL`/`RAILWAY_AI_KEY` via `Deno.env`.
- [ ] **Step 2: Rewire submit-candidature** — remplacer les définitions locales par `import { dispatchScreening, markScreeningError } from "../_shared/dispatch-screening.ts";`. Aucun changement de comportement.
- [ ] **Step 3: Vérifier (Deno check)** — `deno check supabase/functions/submit-candidature/index.ts supabase/functions/_shared/dispatch-screening.ts`. Expected: OK.
- [ ] **Step 4: Commit** — `git commit -m "refactor(edge): extraire dispatch-screening dans _shared (réutilisable)"`

---

### Task 2: Edge function `add-candidature-documents` (authentifiée, role-gated)

**Files:**
- Create: `supabase/functions/add-candidature-documents/index.ts`

**Interfaces:**
- HTTP POST, header `Authorization: Bearer <jwt>`. Deux actions :
  - `{ action: 'get_upload_url', candidature_id, filename }` → `{ signed_url, path, storage_path }`
  - `{ action: 'attach', candidature_id, documents: NewDoc[] }` → `{ ok: true, screening_dispatched: boolean }`
  où `NewDoc = { field_label?, file_name, file_size, storage_path }`.

- [ ] **Step 1: Squelette + auth + role check** — CORS ; `getUser()` via anonClient (Authorization) → 401 si absent ; charger membership `organization_members` (role, organization_id) + `user_roles` (super_admin/chef_programme) ; charger la candidature `select("*, programmes:programme_id(id, name, chef_programme_id, organization_id)")` ; appeler `canManageProgrammeCandidatures(ctx, programme)` → 403 sinon. Service-role client pour storage/DB.
- [ ] **Step 2: action `get_upload_url`** — sanitize filename, `storagePath = ${cand.id}/${Date.now()}_${safe}`, `createSignedUploadUrl('candidature-documents', storagePath)`, renvoyer `{ signed_url, path, storage_path: 'candidature-documents/'+storagePath }`. Autoriser status ∈ ['received','pre_selected','in_review','selected'] (plus permissif que le public).
- [ ] **Step 3: action `attach`** — charger `documents` actuels ; **merge dédup par `file_name`** : garder les existants, ajouter/remplacer les nouveaux marqués `{ ...doc, source: 'coordinator', added_by_id: user.id, added_by_name: <profil>, added_at: now }` ; `update candidatures set documents = merged` ; puis `dispatchScreening(supabase, { programmeId: programme.id, candidatureIds:[cand.id], organizationId: programme.organization_id, preferVision: true })` ; renvoyer `{ ok:true, screening_dispatched: ok }`. Échec dispatch non bloquant (doc attachés quand même) → `markScreeningError` si false.
- [ ] **Step 4: Déployer en staging/local + curl** — déployer sur un projet de test OU tester en local `supabase functions serve`. Curl `get_upload_url` (JWT admin) → 200 + signed_url ; PUT un petit PDF ; curl `attach` → 200 + `screening_dispatched:true` ; vérifier en base `documents` mergé + `source:'coordinator'` + `ai_jobs` créé. Curl sans JWT / rôle insuffisant → 401/403.
- [ ] **Step 5: Commit** — `git commit -m "feat(edge): add-candidature-documents (auth + role-gated + re-screen)"`

---

### Task 3: Composant front `CandidatureDocumentsUploader` (logique pure testable)

**Files:**
- Create: `src/lib/candidature-docs.ts` (helpers purs : `mergeDocuments`, `buildCoordinatorDoc`)
- Create: `src/components/programmes/CandidatureDocumentsUploader.tsx`
- Test: `src/test/candidature-docs.test.ts`

**Interfaces:**
- Produces: `mergeDocuments(existing: Doc[], added: Doc[]): Doc[]` (dédup par file_name, added écrase existant de même nom) ; `buildCoordinatorDoc(f: {file_name,file_size,storage_path,field_label?}, by: {id,name}, atISO: string): Doc`.

- [ ] **Step 1: Test qui échoue** (`candidature-docs.test.ts`) :
```ts
import { describe, it, expect } from 'vitest';
import { mergeDocuments, buildCoordinatorDoc } from '@/lib/candidature-docs';

it('merge dédup par file_name (added écrase existant homonyme)', () => {
  const r = mergeDocuments(
    [{ file_name: 'a.pdf', storage_path: 'x' }],
    [{ file_name: 'a.pdf', storage_path: 'y' }, { file_name: 'b.pdf', storage_path: 'z' }],
  );
  expect(r).toHaveLength(2);
  expect(r.find(d => d.file_name === 'a.pdf')!.storage_path).toBe('y');
});

it('buildCoordinatorDoc marque la traçabilité', () => {
  const d = buildCoordinatorDoc(
    { file_name: 'x.pdf', file_size: 10, storage_path: 'candidature-documents/1_x.pdf' },
    { id: 'u1', name: 'Nathalie' }, '2026-08-03T10:00:00Z',
  );
  expect(d).toMatchObject({ file_name: 'x.pdf', source: 'coordinator', added_by_id: 'u1', added_by_name: 'Nathalie', added_at: '2026-08-03T10:00:00Z' });
});
```
- [ ] **Step 2: Run → FAIL** — `npx vitest run src/test/candidature-docs.test.ts`
- [ ] **Step 3: Implémenter `src/lib/candidature-docs.ts`** :
```ts
export interface Doc { field_label?: string; file_name: string; file_size?: number; storage_path: string; source?: string; added_by_id?: string; added_by_name?: string; added_at?: string; }
export function mergeDocuments(existing: Doc[], added: Doc[]): Doc[] {
  const byName = new Map<string, Doc>();
  for (const d of existing || []) byName.set(d.file_name, d);
  for (const d of added || []) byName.set(d.file_name, d);
  return Array.from(byName.values());
}
export function buildCoordinatorDoc(
  f: { file_name: string; file_size?: number; storage_path: string; field_label?: string },
  by: { id: string; name: string }, atISO: string,
): Doc {
  return { field_label: f.field_label || 'Ajouté par le coordinateur', file_name: f.file_name, file_size: f.file_size, storage_path: f.storage_path, source: 'coordinator', added_by_id: by.id, added_by_name: by.name, added_at: atISO };
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Composant `CandidatureDocumentsUploader.tsx`** — zone drag-drop + input multiple (formats du formulaire), pour chaque fichier : `supabase.functions.invoke('add-candidature-documents', { body: { action:'get_upload_url', candidature_id, filename }})` → `PUT signed_url` → `buildCoordinatorDoc`. À la fin : `mergeDocuments(existing, added)` puis `invoke('add-candidature-documents', { body:{ action:'attach', candidature_id, documents: merged }})`. États : idle/uploading/parsing, toast `sonner` (« Documents ajoutés — diagnostic en cours de recalcul »), erreurs par fichier non bloquantes, `onDone()` callback. Props `{ candidatureId, existingDocuments, onDone }`.
- [ ] **Step 6: tsc** — `npx tsc --noEmit`
- [ ] **Step 7: Commit** — `git commit -m "feat(front): CandidatureDocumentsUploader + helpers docs (dédup, traçabilité)"`

---

### Task 4: Intégrer dans `CandidatureDetailDrawer` + badge traçabilité

**Files:**
- Modify: `src/components/programmes/CandidatureDetailDrawer.tsx` (carte Documents ~680-720)

- [ ] **Step 1: Garde de rôle côté UI** — n'afficher l'uploader que si l'utilisateur peut gérer (déjà le cas : le drawer est admin-only). Ajouter `<CandidatureDocumentsUploader candidatureId={candidatureId} existingDocuments={detail.documents||[]} onDone={onUpdated} />` sous la liste des documents.
- [ ] **Step 2: Badge traçabilité** — dans la liste des documents, si `doc.source === 'coordinator'`, afficher un petit badge « ajouté par {doc.added_by_name} le {date} ».
- [ ] **Step 3: Rafraîchissement** — `onDone` appelle `onUpdated()` (déjà propagé) pour recharger le détail ; le re-screen tourne en async (worker) → la fiche se met à jour au prochain refresh / via le toast AiJobs existant.
- [ ] **Step 4: tsc + build** — `npx tsc --noEmit && npm run build`
- [ ] **Step 5: Commit** — `git commit -m "feat(front): uploader docs + badge traçabilité dans la fiche candidature"`

---

### Task 5: Vérification e2e + déploiement

- [ ] **Step 1: Suite front** — `npm test` (zéro régression).
- [ ] **Step 2: Déployer l'EF** — `supabase functions deploy add-candidature-documents --project-ref gszwotgppuinpfnyrjnu --no-verify-jwt` (la fonction fait son propre getUser) + redeploy `submit-candidature` (refacto Task 1). **Après validation user uniquement.**
- [ ] **Step 3: Essai réel** — sur une candidature de test : ajouter un PDF via la fiche → vérifier attache + `source:'coordinator'` + badge + `ai_jobs` créé + diagnostic mis à jour.
- [ ] **Step 4: Notion** — cocher les 10 critères, statut → `terminé` puis `publié`.

## Notes
- Branche `feat/upload-docs-candidature`. Ne pas merger/déployer sans validation user.
- `submit-candidature` reste public et inchangé fonctionnellement (juste import partagé).
