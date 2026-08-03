# Champ libre par option sur les questions à choix — Design

**Date** : 2026-08-03
**Branche** : `feat/champ-libre-option-formulaire`
**Origine** : demande Basecamp (Améliorations et Bugs tech). Cas type : question
« Quelle organisation vous a recommandé de postuler à cet appel à projets ? » →
permettre d'ajouter une précision libre sur « Autre » **et** « Non applicable »,
chaque option ayant son propre libellé d'invite.

## Problème

Les questions à choix du formulaire de candidature (`select` / `radio` /
`checkbox`) proposent des options figées. Si la bonne réponse n'y est pas, le
candidat ne peut rien saisir. On veut permettre, **sur des options choisies par
l'admin**, l'apparition d'un champ texte de précision, avec un **libellé
personnalisable par option** (ex. « Précisez… » vs « Non applicable – autre
source (préciser) »).

## Décisions validées

- **Mécanisme** : case « champ libre » **par option** dans le constructeur
  (pas un unique « Autre »), + un raccourci « + Ajouter une option "Autre" ».
- **Portée** : les **3 types** de questions à choix (select, radio, checkbox).
- **Libellé du champ de précision** : **personnalisable par option**, repli sur
  « Précisez… ».
- **Précision obligatoire** : oui **si le champ parent est requis** ET qu'une
  option à champ libre est sélectionnée ; sinon optionnelle.
- **Zéro régression** : fonctionnalité opt-in ; formulaires existants inchangés.

## Modèle de données

Un champ personnalisé passe de :
```ts
{ id, label, type: 'select'|'radio'|'checkbox'|'textarea'|'file', options: string[], required }
```
à (ajout d'**un seul** champ optionnel) :
```ts
freeTextOptions?: { [optionValue: string]: string }  // option → libellé d'invite ("" = défaut « Précisez… »)
```
Exemple :
```jsonc
{
  "label": "Quelle organisation vous a recommandé ?",
  "type": "select",
  "options": ["OVO", "Enabel", "Autre", "Non applicable"],
  "freeTextOptions": {
    "Autre": "Précisez…",
    "Non applicable": "Non applicable – autre source (préciser)"
  }
}
```
- `freeTextOptions` absent → comportement actuel strictement identique.
- On ne modifie NI `options` (les traductions `form_translations` restent
  valides), NI le type d'option (reste `string`). Vit dans le jsonb `form_fields`
  existant → **pas de migration DB**.

## Stockage des réponses (`form_data`)

La réponse principale ne change pas :
- select/radio : `form_data[key] = "Autre"` (string)
- checkbox : `form_data[key] = ["Autre", "…"]` (array)

Les précisions vont dans une **clé sœur** dédiée :
```
form_data["{key}__precisions"] = { "Autre": "texte saisi", "Non applicable": "…" }
```
Seules les options réellement sélectionnées ET à champ libre y figurent. Le
screening IA (qui sérialise `form_data` en entier) et le reporting/export voient
la précision sans adaptation spécifique.

## Comportement UI

### Admin — `FieldOptionsEditor.tsx` (page `/programmes/:id/form`)
- Chaque ligne d'option : case à cocher « champ libre ». Cochée → l'option entre
  dans `freeTextOptions`, et un `Input` apparaît pour saisir le libellé d'invite
  (placeholder « Précisez… »).
- Bouton « + Ajouter une option "Autre" » : ajoute `"Autre"` avec la case
  pré-cochée et le libellé « Précisez… ».
- Décocher / supprimer l'option → retire l'entrée de `freeTextOptions`.

### Candidat — `PublicCandidatureForm.tsx`
- select / radio : quand la valeur sélectionnée ∈ `freeTextOptions`, afficher un
  champ texte sous le contrôle, avec le libellé associé.
- checkbox : pour **chaque** option cochée qui ∈ `freeTextOptions`, afficher un
  champ texte (plusieurs précisions possibles).
- Changer de sélection qui n'a plus de champ libre → la précision est effacée de
  `__precisions`.

### Validation
- Si le champ parent est `required` et qu'une option à champ libre est
  sélectionnée avec précision vide → erreur « Merci de préciser ».

## i18n

- Placeholder par défaut « Précisez… » : clé i18n `candidature.public_precise`
  (FR/EN).
- Les **libellés d'invite** saisis par l'admin sont du contenu traduisible : ils
  rejoignent la surface `form_translations` au même titre que les libellés
  d'options (helper `form-i18n.ts`). En formulaire anglais, « Non applicable –
  autre source (préciser) » peut avoir sa version EN.

## Fichiers touchés

- `src/components/programme/FieldOptionsEditor.tsx` — case + libellé par option + bouton « Autre ».
- Type des champs personnalisés (là où `options` est déclaré) — ajout `freeTextOptions?`.
- `src/pages/PublicCandidatureForm.tsx` — rendu conditionnel du champ de précision (3 types), state, validation, écriture `__precisions`.
- `src/lib/form-i18n.ts` — inclure les libellés `freeTextOptions` dans le périmètre traduisible.
- `supabase/functions/get-programme-form/index.ts` — vérifier que `freeTextOptions` transite (l'EF renvoie `form_fields` tel quel ; a priori rien à changer, à confirmer).
- i18n FR/EN — clé `candidature.public_precise`.

## Tests (TDD)

- Admin : cocher une option ajoute/retire `freeTextOptions` + libellé ; bouton « Autre » ajoute l'option pré-cochée.
- Public select/radio : sélectionner une option à champ libre affiche le champ ; une option normale ne l'affiche pas ; la saisie va dans `__precisions`.
- Public checkbox : plusieurs précisions coexistent ; décocher efface la précision.
- Validation : champ requis + précision vide → erreur.
- Compat : champ sans `freeTextOptions` → rendu et stockage identiques à l'existant.

## Hors scope

- Pas de nouvelle table ni migration (tout dans `form_fields` jsonb).
- Pas de modification du screening / reporting (ils consomment `form_data` génériquement).
- Champs non-choix (`textarea`, `file`) : non concernés.
