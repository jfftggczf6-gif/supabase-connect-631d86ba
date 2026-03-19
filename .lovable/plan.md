

## Diagnostic complet

### Parsing client-side : EN PLACE et fonctionnel

Le flow actuel quand l'utilisateur clique "Analyser" est correct :

```text
Step 1: Upload fichiers → Storage (lignes 98-107)
Step 2: parseFile() client-side via mammoth/xlsx-js-style (lignes 109-124)
Step 3: parse-vision-file serveur, 1 par 1, max 3 (lignes 126-164)
Step 4: buildDocumentContent() → save dans enterprises.document_content (lignes 166-179)
Step 5: reconstruct-from-traces lit le cache depuis la BDD (lignes 181-203)
Step 6: generate-pre-screening (lignes 215-230)
```

`verifyAndGetContext` est bien simplifié (38 lignes, lit `ent.document_content` depuis la BDD, aucun parsing).

### Probleme restant

`reconstruct-from-traces` injecte `ctx.documentContent` **sans cap** dans le prompt (ligne 121). Si le client a stocké 200k+ caractères, le prompt explose la mémoire Deno. De plus `buildRAGContext` peut crasher sans protection, et `helpers.ts` contient encore 110 lignes de dead code (`parseDocx`/`parseXlsx` serveur).

### Plan de correction (4 changements)

| # | Fichier | Action |
|---|---------|--------|
| 1 | `supabase/functions/reconstruct-from-traces/index.ts` | Capper `ctx.documentContent` a 80 000 caracteres avant injection dans le prompt |
| 2 | `supabase/functions/reconstruct-from-traces/index.ts` | Entourer `buildRAGContext` d'un try/catch avec fallback vide |
| 3 | `supabase/functions/_shared/helpers.ts` | Supprimer les fonctions `parseDocx` (lignes 24-61) et `parseXlsx` (lignes 63-135) — dead code jamais appele |
| 4 | Redeployer `reconstruct-from-traces` | Pour que les changements soient live |

### Details techniques

**Changement 1+2** dans `reconstruct-from-traces/index.ts` :
```typescript
// Après ctx = await verifyAndGetContext(req)
const MAX_PROMPT_CHARS = 80_000;
const docContent = ctx.documentContent.length > MAX_PROMPT_CHARS
  ? ctx.documentContent.substring(0, MAX_PROMPT_CHARS) + "\n[... contenu tronqué à 80K caractères]"
  : ctx.documentContent;

// RAG protégé
let ragContext = "";
try {
  ragContext = await buildRAGContext(
    ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"], "inputs_data"
  );
} catch (e) {
  console.warn("[reconstruct] RAG context failed, continuing without:", e);
}

// Utiliser docContent (cappé) au lieu de ctx.documentContent dans le prompt
```

**Changement 3** dans `helpers.ts` : supprimer lignes 24-135 (parseDocx + parseXlsx + import JSZip inutile).

