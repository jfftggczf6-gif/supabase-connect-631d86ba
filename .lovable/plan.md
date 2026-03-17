

## Le rapport est tronqué à cause de `max_tokens: 8192`

### Diagnostic
Le rapport HTML complet avec 12 sections narratives en français dépasse largement 8192 tokens. Claude s'arrête net quand la limite est atteinte, d'où le texte coupé au milieu d'une phrase. Ce n'est pas un problème d'affichage preview vs téléchargement — le contenu est identique, il est simplement incomplet.

### Solution
Augmenter `max_tokens` dans l'appel Anthropic pour permettre la génération complète du rapport.

**Fichier : `supabase/functions/generate-coach-report/index.ts`**

- Passer `max_tokens` de `8192` à `16384` (Claude Sonnet 4 supporte jusqu'à 64K tokens en sortie)
- Le timeout de 120s est déjà en place, ce qui devrait suffire pour cette taille

Modification minime : une seule ligne à changer.

