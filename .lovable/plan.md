

## Correction : modèle OCR PDF trop lent

**Problème confirmé** : Ligne 226 de `helpers.ts`, l'extraction PDF vision utilise `claude-sonnet-4-20250514` (lent, ~45s/appel) alors que les images utilisent déjà Haiku.

**Correction** : Un seul changement — remplacer le modèle PDF par `claude-3-haiku-20240307`.

### Fichier modifié

| Fichier | Ligne | Changement |
|---------|-------|------------|
| `supabase/functions/_shared/helpers.ts` | 226 | `claude-sonnet-4-20250514` → `claude-3-haiku-20240307` |

### Impact

- 5 appels vision PDF : ~225s → ~20-30s
- Combiné avec le timeout client de 180s, la reconstruction passera largement dans les limites

