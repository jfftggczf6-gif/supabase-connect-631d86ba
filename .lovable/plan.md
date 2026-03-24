

# Plan: Distribute analysis blocks into their relevant tabs

## Current state

All 6 analysis blocks are grouped in a single "Analyse" tab:
- `analyse_investisseur` → investor thesis, red flags, catalysts
- `analyse_coaching` → quick wins, 30-90 day priorities, action plans
- `analyse_marges` → margin leaks, improvement levers
- `analyse_rh` → payroll adequacy, recruitment plan
- `analyse_investissement` → CAPEX rationality, sequencing, risks
- `analyse_financement` → debt sustainability, negotiation points

## Proposed redistribution

| Analysis block | Move to tab | Rationale |
|---|---|---|
| `analyse_investisseur` | **Synthèse** | Investor thesis is the top-level strategic read |
| `analyse_coaching` | **Synthèse** | Quick wins and priorities are decision-oriented |
| `analyse_marges` | **Marges** | Margin analysis belongs with margin data |
| `analyse_rh` | **Produits & RH** | HR analysis belongs with HR data |
| `analyse_investissement` | **Investissement** | CAPEX analysis belongs with CAPEX data |
| `analyse_financement` | **Investissement** | Debt/financing analysis belongs with financing data |

## Changes

### 1. Remove the "Analyse" tab entirely
- Remove the `TabsTrigger` for "analyse"
- Remove the `TabsContent value="analyse"` block
- Remove `hasAnalyseTab` logic

### 2. Add to Synthèse tab (at the bottom)
- `analyse_investisseur` — investor thesis, strengths, weaknesses, red flags, catalysts
- `analyse_coaching` — quick wins, priorities, structural actions

### 3. Add to Marges tab (at the bottom)
- `analyse_marges` — margin leaks, improvement levers, per-product/service analysis

### 4. Add to Produits & RH tab (at the bottom)
- `analyse_rh` — payroll adequacy, recruitment plan, social charges alerts

### 5. Add to Investissement tab (at the bottom)
- `analyse_investissement` — CAPEX rationality, sequencing, execution risks
- `analyse_financement` — debt sustainability, treasury pressure, negotiation points

### File modified
- `src/components/dashboard/PlanFinancierViewer.tsx` only

Each `AnalysisSection` will be placed at the end of its target tab, maintaining the same rendering logic and `Tracabilite` integration. No backend changes.

