

# Intégrer la Knowledge Base structurée dans les agents IA

## Constat

L'infrastructure KB est en place (tables, données, fichiers shared, UI), mais **aucun agent ne l'utilise** :

- `getKnowledgeForAgent` existe dans helpers_v5.ts mais n'est importee par aucune edge function
- `injectGuardrails` existe dans guardrails.ts mais n'est importee nulle part
- `detectRisks` / `buildRiskBlock` existent dans risk-detector.ts mais ne sont pas utilises
- Les agents utilisent uniquement l'ancien `buildRAGContext` (recherche semantique dans knowledge_base)

L'erreur de deploiement initiale a probablement empeche la suite de l'implementation.

## Plan d'integration

### Etape 1 — Integrer `injectGuardrails` dans les agents financiers

Fichiers concernes (6 agents financiers) :
- `generate-inputs/index.ts`
- `generate-framework/index.ts`
- `generate-business-plan/index.ts`
- `generate-plan-ovo/index.ts`
- `generate-valuation/index.ts`
- `generate-diagnostic/index.ts`

Pour chaque fichier :
1. Ajouter `import { injectGuardrails } from "../_shared/guardrails.ts"`
2. Envelopper le system prompt existant : `injectGuardrails(systemPrompt)` avant l'appel a `callAI`

### Etape 2 — Integrer `getKnowledgeForAgent` dans les agents cles

Memes 6 agents + `generate-pre-screening`, `generate-odd`, `generate-sic`, `generate-bmc` :
1. Importer `getKnowledgeForAgent` depuis helpers_v5.ts (deja exporte)
2. Appeler `getKnowledgeForAgent(ctx.supabase, ent.country, ent.sector, agentType)` 
3. Injecter le resultat dans le user prompt, a cote du `ragContext` existant

### Etape 3 — Integrer `detectRisks` dans les agents de diagnostic/screening

Fichiers : `generate-diagnostic/index.ts`, `generate-pre-screening/index.ts`, `generate-screening-report/index.ts`
1. Importer `detectRisks`, `buildRiskBlock` depuis risk-detector.ts
2. Charger les risk factors depuis la BDD
3. Executer `detectRisks(financialData, riskFactors)` avec les donnees extraites
4. Injecter `buildRiskBlock(flags)` dans le prompt

### Etape 4 — Verifier le deploiement

Deployer les fonctions modifiees et confirmer qu'il n'y a pas d'erreur d'import.

## Impact

- Aucun changement de schema DB
- Aucun changement cote frontend
- Les agents existants continuent de fonctionner — on ajoute du contexte supplementaire dans leurs prompts
- Le pipeline ne change pas de structure

