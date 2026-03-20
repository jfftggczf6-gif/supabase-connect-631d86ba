

## Diagnostic : Pourquoi le Mémo d'Investissement a échoué

### Ce qui s'est passé

1. **Pass 1 a réussi** — les logs confirment : "Pass 1 completed, checkpoint saved. Returning 202."
2. **Mais le checkpoint n'a PAS été sauvegardé** — la table `enterprise_modules` est **vide** pour cette entreprise (aucune ligne, pas seulement pour investment_memo).
3. **Cause racine** : la fonction `updateMemoModuleState` fait un `UPDATE` sur une ligne qui n'existe pas. Un UPDATE sur 0 lignes = opération silencieuse sans erreur, sans insertion.
4. **Conséquence en cascade** : la connexion HTTP s'est fermée avant que le 202 n'arrive au client → le frontend n'a jamais reçu la réponse → pas de chaînage automatique de la Pass 2.

### Correction — `supabase/functions/generate-investment-memo/index.ts`

Remplacer `UPDATE` par un **UPSERT** dans `updateMemoModuleState` :

```typescript
async function updateMemoModuleState(
  enterpriseId: string,
  moduleData: Record<string, any>,
  progress: number,
  status: string,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);
  
  const mappedStatus = status === "completed" ? "completed" 
    : status === "not_started" ? "not_started" : "in_progress";

  await svc.from("enterprise_modules").upsert({
    enterprise_id: enterpriseId,
    module: "investment_memo",
    data: moduleData,
    progress,
    status: mappedStatus,
  }, { onConflict: "enterprise_id,module" });
}
```

### Pré-requis DB

Il faut ajouter une contrainte UNIQUE sur `(enterprise_id, module)` dans `enterprise_modules` pour que le `onConflict` fonctionne :

```sql
ALTER TABLE public.enterprise_modules 
ADD CONSTRAINT enterprise_modules_enterprise_module_unique 
UNIQUE (enterprise_id, module);
```

### Résumé des changements

| Fichier | Modification |
|---|---|
| Migration SQL | Ajouter contrainte UNIQUE `(enterprise_id, module)` |
| `generate-investment-memo/index.ts` | `update()` → `upsert()` avec `onConflict` |

Après ce fix, relancer la génération du mémo fonctionnera : le checkpoint sera sauvé, le 202 retourné, et le frontend chaînera automatiquement la Pass 2.

