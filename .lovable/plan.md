

## Repasser le rapport coach sur Anthropic avec timeout augmenté

### Problème
La fonction `generate-coach-report` utilise actuellement le Lovable AI Gateway (Gemini 2.5 Flash) qui retourne une erreur 402 (crédits insuffisants). L'utilisateur souhaite revenir sur l'API Anthropic directe (clé `ANTHROPIC_API_KEY` déjà configurée) et augmenter le timeout.

### Modifications

**Fichier : `supabase/functions/generate-coach-report/index.ts`** (lignes 190-230)

Remplacer l'appel Lovable AI Gateway par un appel direct à `https://api.anthropic.com/v1/messages` :
- Modèle : `claude-sonnet-4-20250514` (cohérent avec la stratégie existante)
- `max_tokens: 8192`
- Timeout : `AbortSignal.timeout(120000)` (120 secondes au lieu de 50)
- Headers Anthropic : `x-api-key`, `anthropic-version: 2023-06-01`
- Adapter le parsing de la réponse au format Anthropic (`content[0].text` au lieu de `choices[0].message.content`)
- Conserver la gestion d'erreurs 429/402 existante

Aucune autre modification nécessaire — la clé `ANTHROPIC_API_KEY` est déjà en place dans les secrets.

