

# Diagnostic du bug "Entreprise introuvable"

## Cause probable

L'entreprise `gotche Sarl` (ID `e7cfb861-...`) existe bien en base avec `coach_id = ccca884f-...`. Le `CoachDashboard` la trouve correctement (les onglets "Vue entrepreneur" / "Coaching" s'affichent), mais ensuite `EntrepreneurDashboard` fait sa propre requête Supabase pour charger les données, et cette seconde requête échoue.

Cela arrive quand le token d'authentification est brièvement expiré entre les deux requêtes. Le client Supabase le rafraîchit automatiquement, mais il y a une fenêtre de temps où la requête retourne `null` à cause des politiques de sécurité (RLS).

## Correction proposée

**Fichier** : `src/components/dashboard/EntrepreneurDashboard.tsx`

Ajouter un mécanisme de retry dans `fetchData` quand on est en `coachMode` et que la requête retourne `null` : attendre 1 seconde puis réessayer une fois (le token sera rafraîchi entre-temps).

```typescript
// Dans fetchData, après la requête en coach mode :
if (enterpriseId) {
  const { data } = await supabase
    .from('enterprises').select('*').eq('id', enterpriseId).maybeSingle();
  ent = data;
  
  // Retry once if RLS blocked (token might be refreshing)
  if (!ent) {
    await new Promise(r => setTimeout(r, 1000));
    const { data: retry } = await supabase
      .from('enterprises').select('*').eq('id', enterpriseId).maybeSingle();
    ent = retry;
  }
}
```

Cela élimine le faux négatif sans changer le comportement normal.

