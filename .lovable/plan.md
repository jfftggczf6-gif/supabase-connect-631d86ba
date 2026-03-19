

## Diagnostic

L'erreur "new row violates row-level security policy" vient de l'**upload de fichiers vers le bucket storage `documents`**. Les requêtes réseau montrent clairement que le `Bearer token` envoyé est la **clé anon** au lieu du JWT de l'utilisateur authentifié. Le storage exige le rôle `authenticated` pour les insertions.

**Cause probable** : la session Supabase côté client est expirée ou perdue au moment de l'upload. Le dashboard s'affiche car `useAuth` utilise une session cachée, mais le client Supabase n'a plus de token valide pour les requêtes storage.

## Plan de correction

### Fichier : `src/components/dashboard/ReconstructionUploader.tsx`

Avant de lancer les uploads, forcer un rafraîchissement de session pour s'assurer que le client Supabase a un JWT valide :

```typescript
// Au début de handleReconstruct, avant la boucle d'upload
const { data: { session: currentSession } } = await supabase.auth.getSession();
if (!currentSession) {
  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  if (!refreshed) {
    toast.error('Session expirée — veuillez vous reconnecter');
    navigate('/login');
    return;
  }
}
```

### Fichier : `src/components/dashboard/EntrepreneurDashboard.tsx`

Appliquer la même protection dans `handleFileUpload` (même pattern de storage upload) pour éviter la même erreur dans l'upload classique.

### Résultat attendu

| Avant | Après |
|-------|-------|
| Upload envoie la clé anon → RLS bloque | Session rafraîchie → JWT valide envoyé |
| Erreur 403 silencieuse | Upload réussit ou redirige vers /login |

