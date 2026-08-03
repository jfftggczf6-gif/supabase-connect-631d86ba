# Champ libre par option — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de marquer certaines options d'une question à choix (select/radio/checkbox) comme « champ libre », avec un libellé d'invite personnalisable, pour que le candidat puisse préciser sa réponse.

**Architecture:** Un champ optionnel `freeTextOptions: Record<optionValue, promptLabel>` ajouté au modèle `FormField` (vit dans le jsonb `form_fields`, pas de migration). L'éditeur d'options (`FieldOptionsEditor`) le gère ; le formulaire public (`PublicCandidatureForm`) affiche un champ de précision sous l'option sélectionnée et stocke la saisie dans la clé sœur `form_data["{label}__precisions"]`. Les libellés d'invite entrent dans la surface traduisible i18n.

**Tech Stack:** React + TypeScript + Vite, shadcn/ui, i18next, vitest + @testing-library/react.

## Global Constraints

- Environnement **PRODUCTION** (Supabase `gszwotgppuinpfnyrjnu`, front Lovable). Rien de déployé sans validation.
- **Zéro régression** : `freeTextOptions` absent ⇒ comportement strictement identique à l'existant.
- Pas de migration DB, pas de nouvelle table, pas de modif du screening/reporting.
- `get-programme-form` renvoie déjà `form_fields` tel quel ⇒ **aucune modif edge function** (vérifié).
- `form_data` keyé par `field.label` ; réponse principale inchangée (string pour select/radio, array pour checkbox).
- Tests : vitest (`npm test`), tests dans `src/test/*.test.tsx` / `.test.ts`.
- Commits fréquents, un par tâche.

---

### Task 1: Type `FormField` + éditeur d'options avec « champ libre » par option

**Files:**
- Modify: `src/pages/ProgrammeFormPage.tsx:32-37` (interface `FormField` : ajouter `freeTextOptions?`)
- Modify: `src/components/programme/FieldOptionsEditor.tsx` (props + UI case/libellé + bouton « Ajouter Autre »)
- Test: `src/test/field-options-editor.test.tsx`

**Interfaces:**
- Produces: `FormField.freeTextOptions?: Record<string, string>` (clé = valeur d'option, valeur = libellé d'invite). Produces: `FieldOptionsEditor` props étendus `{ value: string[]; onChange: (o: string[]) => void; freeTextOptions?: Record<string,string>; onFreeTextChange?: (ft: Record<string,string>) => void }`.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `src/test/field-options-editor.test.tsx` :
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldOptionsEditor } from '@/components/programme/FieldOptionsEditor';

it('coche « champ libre » sur une option → onFreeTextChange reçoit l\'option', () => {
  const onChange = vi.fn();
  const onFreeTextChange = vi.fn();
  render(
    <FieldOptionsEditor
      value={['OVO', 'Autre']}
      onChange={onChange}
      freeTextOptions={{}}
      onFreeTextChange={onFreeTextChange}
    />,
  );
  // 2 options → 2 cases « champ libre »
  const checks = screen.getAllByLabelText(/champ libre/i);
  fireEvent.click(checks[1]); // coche « Autre »
  expect(onFreeTextChange).toHaveBeenCalledWith({ Autre: '' });
});

it('bouton « Ajouter une option Autre » ajoute l\'option + la pré-coche', () => {
  const onChange = vi.fn();
  const onFreeTextChange = vi.fn();
  render(
    <FieldOptionsEditor value={['OVO']} onChange={onChange} freeTextOptions={{}} onFreeTextChange={onFreeTextChange} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /ajouter une option .*autre/i }));
  expect(onChange).toHaveBeenCalledWith(['OVO', 'Autre']);
  expect(onFreeTextChange).toHaveBeenCalledWith({ Autre: '' });
});

it('renommer une option à champ libre migre la clé', () => {
  const onChange = vi.fn();
  const onFreeTextChange = vi.fn();
  render(
    <FieldOptionsEditor value={['Autre']} onChange={onChange} freeTextOptions={{ Autre: 'Précisez' }} onFreeTextChange={onFreeTextChange} />,
  );
  fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Autres' } });
  expect(onFreeTextChange).toHaveBeenCalledWith({ Autres: 'Précisez' });
});
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `npx vitest run src/test/field-options-editor.test.tsx`
Expected: FAIL (pas de case « champ libre », pas de bouton « Ajouter Autre »).

- [ ] **Step 3: Étendre le type `FormField`**

Dans `src/pages/ProgrammeFormPage.tsx`, interface `FormField` :
```ts
interface FormField {
  id: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'date' | 'file' | 'checkbox' | 'radio';
  label: string;
  required?: boolean;
  options?: string[];
  freeTextOptions?: Record<string, string>; // valeur d'option → libellé d'invite ("" = « Précisez… »)
}
```

- [ ] **Step 4: Réécrire `FieldOptionsEditor`**

Remplacer le contenu de `src/components/programme/FieldOptionsEditor.tsx` :
```tsx
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

export function FieldOptionsEditor({
  value,
  onChange,
  freeTextOptions,
  onFreeTextChange,
}: {
  value: string[];
  onChange: (options: string[]) => void;
  freeTextOptions?: Record<string, string>;
  onFreeTextChange?: (ft: Record<string, string>) => void;
}) {
  const opts = value.length ? value : [""];
  const ft = freeTextOptions || {};
  const showFreeText = typeof onFreeTextChange === "function";

  const update = (i: number, val: string) => {
    const old = opts[i];
    onChange(opts.map((o, idx) => (idx === i ? val : o)));
    // Migration de la clé freeText si l'option renommée en avait une.
    if (showFreeText && old in ft && old !== val) {
      const next = { ...ft };
      const label = next[old];
      delete next[old];
      if (val) next[val] = label;
      onFreeTextChange!(next);
    }
  };
  const add = () => onChange([...opts, ""]);
  const remove = (i: number) => {
    const removed = opts[i];
    onChange(opts.filter((_, idx) => idx !== i));
    if (showFreeText && removed in ft) {
      const next = { ...ft };
      delete next[removed];
      onFreeTextChange!(next);
    }
  };
  const toggleFreeText = (opt: string, on: boolean) => {
    if (!showFreeText) return;
    const next = { ...ft };
    if (on) next[opt] = next[opt] ?? "";
    else delete next[opt];
    onFreeTextChange!(next);
  };
  const setFreeTextLabel = (opt: string, label: string) => {
    if (!showFreeText) return;
    onFreeTextChange!({ ...ft, [opt]: label });
  };
  const addAutre = () => {
    onChange([...opts.filter(Boolean), "Autre"]);
    if (showFreeText) onFreeTextChange!({ ...ft, Autre: "" });
  };

  return (
    <div className="space-y-1.5">
      {opts.map((o, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-4 text-right">{i + 1}.</span>
            <Input
              value={o}
              onChange={(e) => update(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="h-8 text-sm flex-1"
              aria-label={`Option ${i + 1}`}
            />
            {showFreeText && (
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={o in ft}
                  onChange={(e) => toggleFreeText(o, e.target.checked)}
                  aria-label={`Champ libre pour l'option ${i + 1}`}
                />
                champ libre
              </label>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={opts.length <= 1}
              className="text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed p-1"
              aria-label={`Retirer l'option ${i + 1}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {showFreeText && o in ft && (
            <Input
              value={ft[o]}
              onChange={(e) => setFreeTextLabel(o, e.target.value)}
              placeholder="Précisez…"
              aria-label={`Libellé du champ libre pour l'option ${i + 1}`}
              className="h-7 text-xs ml-6"
            />
          )}
        </div>
      ))}
      <div className="flex items-center gap-4 ml-6">
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" /> Ajouter une option
        </button>
        {showFreeText && (
          <button type="button" onClick={addAutre} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> Ajouter une option « Autre »
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Lancer le test → passe**

Run: `npx vitest run src/test/field-options-editor.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/programme/FieldOptionsEditor.tsx src/pages/ProgrammeFormPage.tsx src/test/field-options-editor.test.tsx
git commit -m "feat(form-builder): case 'champ libre' + libellé par option dans FieldOptionsEditor"
```

---

### Task 2: Câbler `freeTextOptions` dans `ProgrammeFormPage` (state, nettoyage, sauvegarde)

**Files:**
- Modify: `src/pages/ProgrammeFormPage.tsx` (props passées à `FieldOptionsEditor` ~454-456 ; nettoyage ~193-196 ; payload de save ~216)
- Test: `src/test/programme-form-freetext.test.ts` (create — test unitaire de la fonction de nettoyage extraite)

**Interfaces:**
- Consumes: `FormField.freeTextOptions`, `FieldOptionsEditor` (Task 1).
- Produces: `cleanFreeTextOptions(field: FormField): Record<string,string> | undefined` (retire les entrées dont la clé n'est plus dans `options`, et undefined si vide).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/test/programme-form-freetext.test.ts` :
```ts
import { cleanFreeTextOptions } from '@/pages/ProgrammeFormPage';

it('retire les clés freeText qui ne sont plus des options', () => {
  const r = cleanFreeTextOptions({
    id: '1', type: 'select', label: 'Q', options: ['A', 'Autre'],
    freeTextOptions: { Autre: 'Précisez', Supprimée: 'x' },
  } as any);
  expect(r).toEqual({ Autre: 'Précisez' });
});

it('retourne undefined si aucune option freeText ne subsiste', () => {
  const r = cleanFreeTextOptions({
    id: '1', type: 'select', label: 'Q', options: ['A'], freeTextOptions: { Autre: 'x' },
  } as any);
  expect(r).toBeUndefined();
});
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `npx vitest run src/test/programme-form-freetext.test.ts`
Expected: FAIL (`cleanFreeTextOptions` non exporté).

- [ ] **Step 3: Ajouter `cleanFreeTextOptions` (export) dans `ProgrammeFormPage.tsx`**

```ts
export function cleanFreeTextOptions(f: FormField): Record<string, string> | undefined {
  const ft = f.freeTextOptions;
  if (!ft) return undefined;
  const opts = new Set((f.options || []).map((o) => o.trim()).filter(Boolean));
  const kept = Object.fromEntries(Object.entries(ft).filter(([k]) => opts.has(k.trim())));
  return Object.keys(kept).length ? kept : undefined;
}
```

- [ ] **Step 4: Brancher l'éditeur + le nettoyage + le payload**

Dans le rendu (~454) :
```tsx
<FieldOptionsEditor
  value={f.options || []}
  onChange={opts => setFormFields(fields => fields.map(ff => ff.id === f.id ? { ...ff, options: opts } : ff))}
  freeTextOptions={f.freeTextOptions || {}}
  onFreeTextChange={ft => setFormFields(fields => fields.map(ff => ff.id === f.id ? { ...ff, freeTextOptions: ft } : ff))}
/>
```
Dans le nettoyage avant save (~193-196), pour les champs à choix :
```ts
? { ...f, options: (f.options || []).map(o => o.trim()).filter(Boolean), freeTextOptions: cleanFreeTextOptions({ ...f, options: (f.options || []).map(o => o.trim()).filter(Boolean) }) }
```
Dans le payload `fields:` (~216), ajouter `freeTextOptions` :
```ts
fields: cleanedFields.map((f: FormField) => ({ id: f.id, label: f.label, type: f.type, options: f.options, freeTextOptions: f.freeTextOptions })),
```

- [ ] **Step 5: Lancer test + typecheck → passent**

Run: `npx vitest run src/test/programme-form-freetext.test.ts && npx tsc --noEmit`
Expected: PASS + 0 erreur TS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProgrammeFormPage.tsx src/test/programme-form-freetext.test.ts
git commit -m "feat(form-builder): persister freeTextOptions (nettoyage + payload save)"
```

---

### Task 3: Formulaire public — précision sous l'option (select + radio)

**Files:**
- Modify: `src/pages/PublicCandidatureForm.tsx` (helper `setPrecision`, rendu select ~431-435 et radio ~453-468, validation dans `handleSubmit` ~101)
- Test: `src/test/public-candidature-freetext.test.tsx` (create)

**Interfaces:**
- Consumes: `formData` (state), `setField(key, val)`, `field.freeTextOptions`.
- Produces: `setPrecision(key: string, opt: string, val: string)` ; stockage `formData["{label}__precisions"][opt]`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/test/public-candidature-freetext.test.tsx`. Tester un sous-composant pur extrait `FreeTextPrecision` (pour éviter de monter toute la page réseau) :
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FreeTextPrecision } from '@/pages/PublicCandidatureForm';

it('affiche un champ par option sélectionnée à champ libre, avec son libellé', () => {
  const onChange = vi.fn();
  render(
    <FreeTextPrecision
      field={{ label: 'Q', freeTextOptions: { Autre: 'Précisez', 'Non applicable': 'Autre source' } }}
      selected={['Autre']}
      precisions={{}}
      onChange={onChange}
    />,
  );
  expect(screen.getByPlaceholderText('Précisez')).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Autre source')).toBeNull(); // pas sélectionné
  fireEvent.change(screen.getByPlaceholderText('Précisez'), { target: { value: 'ONG X' } });
  expect(onChange).toHaveBeenCalledWith('Autre', 'ONG X');
});

it('n\'affiche rien si aucune option sélectionnée n\'est à champ libre', () => {
  const { container } = render(
    <FreeTextPrecision field={{ label: 'Q', freeTextOptions: { Autre: '' } }} selected={['OVO']} precisions={{}} onChange={vi.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `npx vitest run src/test/public-candidature-freetext.test.tsx`
Expected: FAIL (`FreeTextPrecision` non exporté).

- [ ] **Step 3: Ajouter le composant `FreeTextPrecision` (export) + `setPrecision`**

Dans `PublicCandidatureForm.tsx`, en haut de module :
```tsx
export function FreeTextPrecision({
  field, selected, precisions, onChange, defaultLabel = 'Précisez…',
}: {
  field: any;
  selected: string[];
  precisions: Record<string, string>;
  onChange: (opt: string, val: string) => void;
  defaultLabel?: string;
}) {
  const ft = field.freeTextOptions || {};
  const active = selected.filter((v) => v in ft);
  if (!active.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {active.map((opt) => (
        <Input
          key={opt}
          className="text-sm"
          placeholder={ft[opt] || defaultLabel}
          value={precisions[opt] || ''}
          onChange={(e) => onChange(opt, e.target.value)}
        />
      ))}
    </div>
  );
}
```
Dans le composant page, ajouter le helper :
```tsx
const setPrecision = (key: string, opt: string, val: string) =>
  setFormData(f => ({ ...f, [`${key}__precisions`]: { ...(f[`${key}__precisions`] || {}), [opt]: val } }));
```

- [ ] **Step 4: Brancher le rendu select + radio**

Après le bloc `Select` (select) ET après le bloc radio, insérer :
```tsx
<FreeTextPrecision
  field={field}
  selected={field.type === 'select' || field.type === 'radio' ? (formData[field.label] ? [formData[field.label]] : []) : []}
  precisions={formData[`${field.label}__precisions`] || {}}
  onChange={(opt, val) => setPrecision(field.label, opt, val)}
  defaultLabel={t('candidature.public_precise', { defaultValue: 'Précisez…' })}
/>
```
(placer l'appel dans le `<div key=...>` du champ, après le contrôle.)

- [ ] **Step 5: Validation dans `handleSubmit`**

Avant l'envoi, ajouter :
```tsx
const precisionMissing = (formFields || []).find((f: any) => {
  if (!f.required || !f.freeTextOptions) return false;
  const val = formData[f.label];
  const sel = Array.isArray(val) ? val : val ? [val] : [];
  const prec = formData[`${f.label}__precisions`] || {};
  return sel.some((o: string) => o in f.freeTextOptions && !String(prec[o] || '').trim());
});
if (precisionMissing) {
  setError(t('candidature.public_precision_required', { defaultValue: 'Merci de préciser votre réponse.' }));
  return;
}
```

- [ ] **Step 6: Lancer test + typecheck → passent**

Run: `npx vitest run src/test/public-candidature-freetext.test.tsx && npx tsc --noEmit`
Expected: PASS + 0 erreur TS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PublicCandidatureForm.tsx src/test/public-candidature-freetext.test.tsx
git commit -m "feat(form-public): champ de précision sous l'option (select/radio) + validation"
```

---

### Task 4: Formulaire public — précision pour les choix multiples (checkbox)

**Files:**
- Modify: `src/pages/PublicCandidatureForm.tsx` (bloc checkbox ~436-452 : brancher `FreeTextPrecision` avec la liste cochée)
- Test: `src/test/public-candidature-freetext.test.tsx` (ajouter un cas)

**Interfaces:**
- Consumes: `FreeTextPrecision` (Task 3), `setPrecision` (Task 3).

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter au fichier de test :
```tsx
it('checkbox : une précision par option cochée à champ libre', () => {
  const onChange = vi.fn();
  render(
    <FreeTextPrecision
      field={{ label: 'Q', freeTextOptions: { Autre: 'Précisez', 'Non applicable': 'Source' } }}
      selected={['Autre', 'Non applicable']}
      precisions={{ Autre: 'ONG' }}
      onChange={onChange}
    />,
  );
  expect(screen.getByPlaceholderText('Précisez')).toHaveValue('ONG');
  expect(screen.getByPlaceholderText('Source')).toBeInTheDocument();
});
```

- [ ] **Step 2: Lancer le test → échoue** (le rendu checkbox ne branche pas encore `FreeTextPrecision`)

Run: `npx vitest run src/test/public-candidature-freetext.test.tsx`
Expected: le nouveau cas isolé passe déjà (composant générique), MAIS l'intégration checkbox manque → vérifier par typecheck/manuel. Si le cas passe, passer à l'intégration Step 3 (le composant est déjà multi-option).

- [ ] **Step 3: Brancher `FreeTextPrecision` sous le bloc checkbox**

Après le `<div className="space-y-2 mt-1">` des checkboxes, insérer :
```tsx
<FreeTextPrecision
  field={field}
  selected={Array.isArray(formData[field.label]) ? formData[field.label] : []}
  precisions={formData[`${field.label}__precisions`] || {}}
  onChange={(opt, val) => setPrecision(field.label, opt, val)}
  defaultLabel={t('candidature.public_precise', { defaultValue: 'Précisez…' })}
/>
```

- [ ] **Step 4: Lancer test + typecheck → passent**

Run: `npx vitest run src/test/public-candidature-freetext.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PublicCandidatureForm.tsx src/test/public-candidature-freetext.test.tsx
git commit -m "feat(form-public): précisions multiples pour les questions à choix multiples"
```

---

### Task 5: i18n — libellés d'invite traduisibles + clés FR/EN

**Files:**
- Modify: `src/lib/form-i18n.ts` (`collectTranslatableSegments` ~162 : segments des libellés freeText ; ajouter `resolveFreeTextLabel`)
- Modify: fichiers i18n FR/EN (clés `candidature.public_precise`, `candidature.public_precision_required`)
- Test: `src/lib/form-i18n.test.ts`

**Interfaces:**
- Consumes: `TranslatableSurface` (champs avec `freeTextOptions`).
- Produces: descriptor `{ kind: 'field_freetext_label', id, value }` ; `resolveFreeTextLabel(field, optionValue, lang, baseLang, formTr): string`.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `src/lib/form-i18n.test.ts` :
```ts
it('collecte les libellés freeText comme segments traduisibles', () => {
  const segs = collectTranslatableSegments({
    presentation: '',
    fields: [{ id: 'f1', label: 'Q', options: ['Autre'], freeTextOptions: { Autre: 'Précisez la source' } }],
    defaultOverrides: {},
  } as any);
  expect(segs).toContainEqual(
    expect.objectContaining({ descriptor: { kind: 'field_freetext_label', id: 'f1', value: 'Autre' }, text: 'Précisez la source' }),
  );
});
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `npx vitest run src/lib/form-i18n.test.ts`
Expected: FAIL.

- [ ] **Step 3: Étendre `collectTranslatableSegments` + `TranslatableSurface`**

Dans le type `TranslatableSurface.fields[]`, ajouter `freeTextOptions?: Record<string,string>`. Dans la boucle `for (const f of surface.fields)`, après les options :
```ts
for (const [optVal, label] of Object.entries(f.freeTextOptions || {})) {
  if (norm(label)) segments.push({ descriptor: { kind: 'field_freetext_label', id: f.id, value: optVal }, text: label });
}
```
Ajouter le variant au type `TranslationSegment['descriptor']` : `| { kind: 'field_freetext_label'; id: string; value: string }`. Ajouter le resolver (miroir de `resolveOptionLabel`) :
```ts
export function resolveFreeTextLabel(field: any, optionValue: string, lang: string, baseLang: string, formTr: any): string {
  const base = (field.freeTextOptions || {})[optionValue] || '';
  if (lang === baseLang) return base;
  const tr = formTr?.[lang]?.fields?.[field.id]?.freeTextOptions?.[optionValue];
  return (tr && String(tr).trim()) || base;
}
```

- [ ] **Step 4: Ajouter les clés i18n FR/EN**

Dans le fichier FR : `candidature.public_precise = "Précisez…"`, `candidature.public_precision_required = "Merci de préciser votre réponse."`.
Dans le fichier EN : `candidature.public_precise = "Please specify…"`, `candidature.public_precision_required = "Please specify your answer."`.

- [ ] **Step 5: Utiliser `resolveFreeTextLabel` dans le rendu public**

Dans `FreeTextPrecision` (Task 3), remplacer `ft[opt] || defaultLabel` par un libellé résolu passé en prop `labelFor(opt)` depuis la page : `labelFor={(opt) => resolveFreeTextLabel(field, opt, effectiveLang, baseLang, formTr) || t('candidature.public_precise', { defaultValue: 'Précisez…' })}`. Adapter la signature de `FreeTextPrecision` pour accepter `labelFor?: (opt: string) => string` (repli sur `ft[opt] || defaultLabel`).

- [ ] **Step 6: Lancer tests + typecheck → passent**

Run: `npx vitest run src/lib/form-i18n.test.ts src/test/public-candidature-freetext.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/form-i18n.ts src/lib/form-i18n.test.ts src/i18n
git commit -m "feat(i18n): libellés freeText traduisibles + clés précision FR/EN"
```

---

### Task 6: Vérification bout-en-bout + build

**Files:** aucun code neuf (garde-fou).

- [ ] **Step 1: Suite complète**

Run: `npm test`
Expected: tous les tests verts (dont les existants — zéro régression).

- [ ] **Step 2: Build + typecheck**

Run: `npx tsc --noEmit && npm run build`
Expected: succès.

- [ ] **Step 3: Vérif manuelle (dev)**

Lancer `npm run dev`, créer une question select avec option « Autre » (champ libre coché, libellé « Précisez la source ») + « Non applicable » (libellé custom), ouvrir le formulaire public : sélectionner « Autre » → champ de précision apparaît ; remplir ; vérifier que `form_data["Q__precisions"] = { Autre: "…" }` part à la soumission (log réseau). Vérifier qu'un champ SANS freeTextOptions se comporte comme avant.

- [ ] **Step 4: Commit (si ajustements)**

```bash
git commit -am "test: vérification e2e champ libre par option"
```

## Notes d'exécution

- Repo : `supabase-connect-631d86ba`, branche `feat/champ-libre-option-formulaire`.
- Ne PAS merger sur `main` ni déployer sans validation user (front Lovable = prod).
- `get-programme-form` : aucune modif (renvoie `form_fields` tel quel — vérifié).
