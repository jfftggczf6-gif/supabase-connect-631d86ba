

## Plan : Corriger la liaison Coach ↔ Entrepreneur (solution definitive)

### Diagnostic confirme

Le SELECT du coach sur `enterprises WHERE contact_email = 'philippeyace@hotmail.fr' AND coach_id IS NULL` retourne `[]` (vide) car :
1. **RLS bloque** : le coach ne peut voir que les enterprises ou `coach_id = son id` -- l'entreprise originale a `coach_id = NULL` donc invisible
2. **contact_email est NULL** sur l'entreprise originale `695f16bd` -- meme sans RLS, le match echouerait

Resultat : un doublon `214957c6` est cree a chaque tentative.

### A propos du "Dossier Investisseur"

Dans l'onglet "Parcours Rapide", la Phase 3 "Dossier Investisseur" est simplement une carte informative indiquant que le Business Plan et l'ODD sont auto-generes a partir des phases 1 et 2. Ce n'est pas une fonctionnalite manquante -- c'est un indicateur visuel. Aucun changement necessaire.

---

### Corrections a appliquer

#### 1. Migration SQL : Fonction SECURITY DEFINER pour lier par email

Creer `link_enterprise_to_coach_by_email(enterprise_email TEXT)` qui :
- Verifie que l'appelant est coach via `has_role`
- Cherche l'entreprise par `enterprises.contact_email` (normalise)
- Fallback : cherche via `profiles.email` lie a `enterprises.user_id`
- Si trouvee et `coach_id IS NULL` → assigne `coach_id = auth.uid()`, retourne `'linked'`
- Si trouvee et deja assignee → retourne `'already_assigned'`
- Si non trouvee → retourne `'not_found'`

```sql
CREATE OR REPLACE FUNCTION public.link_enterprise_to_coach_by_email(enterprise_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ ... $$;
```

#### 2. Nettoyage des donnees (via insert tool, pas migration)
- `DELETE FROM enterprises WHERE id = '214957c6-8f2e-415b-8b58-f10894543fbf'`
- `UPDATE enterprises SET coach_id = 'd5943002-beca-4fcd-a5ad-f1b5f5d062d9', contact_email = 'philippeyace@hotmail.fr' WHERE id = '695f16bd-ca8e-4699-961d-78fe9aa723c8'`

#### 3. Modifier `CoachDashboard.tsx` — handleAddEntrepreneur
Remplacer le SELECT direct par :
```typescript
const { data: status } = await supabase.rpc('link_enterprise_to_coach_by_email', {
  enterprise_email: addForm.contact_email.trim()
});

if (status === 'linked') {
  toast.success('Entreprise liee avec succes !');
} else if (status === 'already_assigned') {
  toast.error('Cette entreprise est deja suivie par un autre coach');
} else {
  // not_found → creer un lead coach-owned comme avant
}
```

#### 4. Modifier `EntrepreneurDashboard.tsx` — createEnterprise
Ajouter `contact_email` et `contact_name` a la creation :
```typescript
contact_email: profile?.email || user?.email || null,
contact_name: profile?.full_name || null,
```

### Fichiers modifies
- **Nouvelle migration SQL** : fonction `link_enterprise_to_coach_by_email` + GRANT
- **Donnees** : suppression doublon + liaison originale (insert tool)
- **`src/components/dashboard/CoachDashboard.tsx`** : remplacer lookup direct par RPC
- **`src/components/dashboard/EntrepreneurDashboard.tsx`** : pre-remplir contact_email/contact_name

### Resultat attendu
- Coach ajoute par email → liaison sans doublon, voit les 12 livrables et 8 modules
- Entrepreneur → rien ne change de son cote
- Vue Miroir (Espace partage) → le coach voit exactement ce que l'entrepreneur voit
- Suppression → detachement (pas perte de donnees entrepreneur)

