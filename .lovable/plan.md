

## Plan : Injecter toutes les données disponibles dans le Plan OVO

### Problème
Le frontend cherche `bmcData.products` / `bmcData.services` — champs inexistants dans la structure BMC (qui utilise `canvas.flux_revenus`, `canvas.proposition_valeur`, etc.). Le prompt reçoit "Exactement 0 produits actifs" → fichier vide. De plus, seuls BMC et inputs sont transmis — framework, SIC, diagnostic et plan_ovo JSON sont ignorés.

### Modifications

#### 1. Frontend — `src/components/dashboard/EntrepreneurDashboard.tsx`

Dans `handleGenerateOvoPlan` (lignes 273-293), remplacer l'extraction actuelle par :

- Récupérer **tous les livrables** : `bmc_analysis`, `inputs_data`, `framework_data`, `sic_analysis`, `plan_ovo`, `diagnostic_data`
- Extraire produits/services par **cascade de priorités** :
  1. `plan_ovo.data.products/services` (génération précédente)
  2. BMC `canvas.flux_revenus` (produit principal, sources de revenus)
  3. BMC `canvas.proposition_valeur` (énoncé, avantages, produits)
  4. BMC `canvas.structure_couts.postes` et `canvas.partenaires_cles.items` (fallback)
  5. **Dernier recours** : transformer `canvas.activites_cles.items` en produits/services avec flag `deduit_du_bmc: true`
- Normaliser chaque entrée en `{ name, description, price?, deduit_du_bmc? }`
- Enrichir le payload avec `inputs_data`, `framework_data`, `sic_data`, `plan_ovo_data` complets
- Extraire les KPIs financiers depuis inputs (CA, charges, résultat net) et framework (ratios, projections)

#### 2. Edge Function — `supabase/functions/generate-ovo-plan/index.ts`

- **Élargir `EntrepreneurData`** : ajouter `inputs_data`, `framework_data`, `sic_data`, `plan_ovo_data` (tous `Record<string, unknown>`)
- **Modifier `buildUserPrompt`** :
  - Injecter un bloc `DONNÉES FINANCIÈRES INPUTS` avec compte de résultat, bilan, CA historique
  - Injecter un bloc `PROJECTIONS FRAMEWORK` avec ratios, projection 5 ans, BFR, trésorerie, KPIs
  - Injecter un bloc `IMPACT SOCIAL (SIC)` avec ODD, parties prenantes, théorie du changement
  - Injecter un bloc `PLAN FINANCIER PRÉCÉDENT` si plan_ovo_data existe (pour cohérence)
  - Remplacer la ligne 372 `Exactement ${Math.min(data.products.length, 5)}` par une logique intelligente : si produits fournis, les utiliser ; sinon dire "Déduis au moins 1 produit et 1 service depuis les données BMC/inputs/framework — ne laisse JAMAIS les produits vides"
  - Signaler les éléments `deduit_du_bmc: true` pour que l'IA les enrichisse
- **Validation post-IA** : après parsing JSON, vérifier que `products` contient au moins 1 élément actif quand des données source existent ; sinon rejeter avec erreur claire

#### 3. Redéployer la Edge Function

