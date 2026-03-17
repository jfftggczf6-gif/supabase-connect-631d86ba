

## Fix: Plan Financier Final HTML incomplet

### Problème
La fonction `planOvoHTML` (ligne 1011-1111 de `download-deliverable/index.ts`) s'arrête après les sections Staff/Effectifs. Les données suivantes existent en base mais ne sont jamais rendues en HTML :

- **Scenarios** (pessimiste, réaliste, optimiste) avec VAN, TRI, revenue Year 5
- **Key assumptions** (7 hypothèses de croissance)
- **Recommandations** (7 recommandations stratégiques)
- **Products** (3 produits avec canaux et gammes)
- **Funding need** (40M FCFA) et **Break-even year** (2025)

### Modification — `supabase/functions/download-deliverable/index.ts`

**Avant la ligne `return htmlShell(...)` (ligne 1110)**, ajouter 5 nouvelles sections HTML :

1. **Scénarios** — Tableau comparatif pessimiste/réaliste/optimiste avec colonnes : Hypothèses, CA Year 5, EBITDA %, Résultat net Year 5, VAN, TRI

2. **Produits & Services** — Tableau avec nom, gamme, canal pour chaque produit/service

3. **Besoin de financement & Seuil de rentabilité** — Deux métriques côte à côte (funding_need formaté + break_even_year)

4. **Hypothèses clés** — Liste à puces des key_assumptions

5. **Recommandations** — Liste à puces des recommandations avec icône flèche

Cela complète le rendu HTML pour qu'il corresponde à la totalité des données générées par le pipeline.

