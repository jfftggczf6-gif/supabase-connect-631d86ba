

# Plan: Deduplicate and reorganize PlanFinancierViewer tabs

## Problem

The 2459-line viewer has significant content duplication and misplacement across its 9 tabs. Here is the audit:

### Duplicates found

| Content | Currently in | Should be in |
|---|---|---|
| Structure des coûts (variables/fixes) | Situation + Marges | Marges only |
| CAPEX table | Hypothèses + Projections + Investissement | Investissement only |
| Loans/Financement cards | Hypothèses + Projections + Investissement | Investissement only |
| BFR metrics | Projections + Investissement | Investissement only |
| Produits detail (prix, coût, marge, volume) | Hypothèses + Marges + Produits & RH | Marges (margin table), Produits & RH (cards) |
| Services detail | Hypothèses + Produits & RH | Produits & RH only |
| Staff/RH table | Hypothèses + Produits & RH | Produits & RH only |
| OPEX evolution pluriannuelle | Produits & RH | Projections |
| Financing sources | Produits & RH + Investissement | Investissement only |
| Avis IA text | Twice in Synthèse (card + score block) | Once |

### Misplacements

- OPEX tables are in "Produits & RH" but belong in "Projections"
- Financing data shown in "Produits & RH" belongs in "Investissement"
- Hypothèses tab repeats almost everything from other tabs instead of focusing on assumptions/rates

## Reorganized tab assignments

### Synthèse (unchanged)
Score, Avis IA, KPIs, Hier/Demain, Indicateurs, Graphique, Risques, Scénarios, Conditions. Remove duplicate avis in score block.

### Situation (lighter)
KPIs, Compte résultat réel, Santé financière ratios. **Remove** structure_couts.

### Marges (enriched)
KPIs marges, Cascade, Marges par produit table, Marges par service table, Evolution marges pluriannuelle, **Add** structure coûts (from Situation), Seuil rentabilité, Benchmarks, Cohérence BMC.

### Hypotheses (simplified - rates only)
Hypothèses croissance globales (taux CA, prix, OPEX, salaires, inflation), Paramètres fiscaux/macro, Sensitivity analysis. **Remove** per-product/service/RH/CAPEX/financement tables (all shown elsewhere).

### Projections (enriched)
Graphique CA/EBITDA/RN, P&L prévisionnel complet, Décomposition CA par activité, **Add** OPEX evolution (from Produits & RH), Cash-flow table. **Remove** CAPEX table, financement cards, BFR.

### Produits & RH (focused)
Produits cards + contribution table + projection CA. Services cards. Staff cards + evolution. Channels, ranges. **Remove** OPEX section, financing, opex_detail.

### Investissement (unchanged - canonical location)
CAPEX + amortissements. Financement + sources. BFR + trésorerie. Echéancier DSCR.

### Analyse & Audit (unchanged)

## Technical approach

Single file edit: `src/components/dashboard/PlanFinancierViewer.tsx`

1. Remove `structure_couts` block from Situation tab (~L465-485)
2. Remove produit/service/RH/CAPEX/financement sections from Hypothèses tab (~L932-1130), keep only global rates + sensitivity
3. Remove CAPEX table from Projections tab (~L1352-1388)
4. Remove financement cards from Projections tab (~L1390-1421)
5. Remove BFR from Projections tab (~L1423-1437)
6. Move OPEX evolution + opex_detail + opex_categories from Produits & RH tab to Projections tab
7. Remove channels/financing from Produits & RH if financing, keep channels/ranges
8. Remove duplicate `avis` line in score block (L414)
9. Add structure_couts block to Marges tab

No backend changes. No other files modified.

