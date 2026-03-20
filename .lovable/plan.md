

## Plan : Correction timeout Investment Memo — reprise 2 temps + Sonnet + timeouts max

### Résumé
Découper la génération en 2 appels HTTP avec checkpoint persisté dans `enterprise_modules.data`. Remplacer Opus par Sonnet. Maximiser les timeouts frontend par passe.

---

### Fichier 1 : `supabase/functions/generate-investment-memo/index.ts`

**Changements :**

1. **Modèle** : remplacer `claude-opus-4-20250514` par `claude-sonnet-4-20250514`

2. **Fonction utilitaire locale** `updateMemoModuleState(supabase, enterpriseId, data, progress, status)` — update sur `enterprise_modules` filtré par `enterprise_id` + `module = 'investment_memo'`

3. **Logique principale** (après `verifyAndGetContext`) :
   - Lire `ctx.moduleMap["investment_memo"]` (ligne 169-171 de helpers_v5)
   - Générer `requestId` (crypto.randomUUID) et `startedAt`
   - Déclarer `let part1` en scope du try

   **Cas A — Reprise passe 2** : si moduleMap contient `status === "processing"` ET `phase === "part1_completed"` ET `part1` existant :
   - Recharger `part1` depuis checkpoint
   - Update module state : `phase: "part2"`, `status: "processing"`
   - Construire contexte (deliverables, knowledge, RAG — même code existant)
   - Exécuter uniquement passe 2 (prompt2 + callAI avec Sonnet)
   - Fusionner `{ ...part1, ...part2 }` + `.score`
   - `saveDeliverable(...)`
   - Update module state : `status: "completed"`, `progress: 100`
   - Retourner `jsonResponse` HTTP 200

   **Cas B — Premier appel** :
   - Update module state : `phase: "part1"`, `status: "processing"`
   - Construire contexte (code existant inchangé)
   - Exécuter passe 1 uniquement
   - Sauvegarder checkpoint : `phase: "part1_completed"`, `part1`, `score`, `progress: 50`
   - Retourner HTTP 202 : `{ success: true, processing: true, phase: "part1_completed", score, request_id }`

4. **Gestion d'erreur** : si `part1` existe, conserver checkpoint (`status: "processing"`, `phase: "part1_completed"`), stocker `error`, `failed_at`. Sinon état d'échec simple.

**Conservés intacts** : `MEMO_SYSTEM_PROMPT`, `MEMO_SCHEMA_PART1/2`, tous les `substring(...)`, fusion `{ ...part1, ...part2 }` + `.score`, `saveDeliverable(...)`, prompts, contextBlock.

---

### Fichier 2 : `src/components/dashboard/EntrepreneurDashboard.tsx`

**Changement dans `handleGenerateModule` (lignes 342-378) :**

1. Extraire la logique fetch dans `runSingleAttempt(functionName, token, enterpriseId, timeoutMs)` → retourne JSON

2. **Timeouts maximaux par passe** :
   - `investment_memo` : **360000ms (6 min) par passe** — chaque passe est un appel indépendant, on donne le maximum à chacune
   - `business_plan` : 300000ms (inchangé)
   - Autres : 120000ms (inchangé)

3. Pour `moduleCode === 'investment_memo'` :
   - Appel 1 via `runSingleAttempt` avec timeout 360s
   - Si `result.processing === true` → toast info "Mémo d'investissement — passe 1 terminée, finalisation en cours..." → appel 2 avec timeout 360s
   - Flow normal ensuite

4. Autres modules : comportement inchangé

---

### Fichier 3 : `src/lib/pipeline-runner.ts`

**Changement mineur (ligne 163-164) :**
- Garder le timeout `veryLongSteps` à 360000ms pour `generate-investment-memo` — c'est le timeout par appel, et le pipeline fait 2 appels séquentiels si nécessaire
- Ajouter la même logique de détection `result.processing === true` + relance automatique dans la boucle du pipeline runner, pour que le pipeline complet fonctionne aussi

---

### Fichier non modifié
`src/components/dashboard/InvestmentMemoViewer.tsx` — structure JSON finale identique.

