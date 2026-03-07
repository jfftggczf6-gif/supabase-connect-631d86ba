

## Plan : Masquer le module "Inputs Financiers" de l'UI

Le module reste actif dans la pipeline backend (ses données continuent d'alimenter les modules suivants), mais il disparaît visuellement partout.

### Fichiers à modifier

**1. `src/components/dashboard/EntrepreneurDashboard.tsx`**
- Retirer l'entrée `inputs` de `MODULE_CONFIG` (ligne 29)
- Retirer `inputs_data` de `DELIVERABLE_CONFIG` (ligne 39)
- Renuméroter les steps : framework→4, plan_ovo→5, business_plan→6, odd→7

**2. `src/components/dashboard/CoachDashboard.tsx`**
- Retirer les références visuelles à `inputs` / `inputs_data` dans les listes de modules et livrables

**3. `src/pages/Livrables.tsx`**
- Retirer la ligne `inputs_data` de la liste des livrables affichés

**4. `src/pages/Index.tsx`**
- Retirer l'étape "Inputs Financiers" de la section pipeline sur la landing page, renuméroter (7 étapes au lieu de 8)

**5. `src/components/dashboard/DeliverableViewer.tsx`**
- Retirer le case `inputs` du viewer (plus jamais affiché)

**6. `src/pages/modules/GenericModule.tsx`**
- Retirer l'entrée `inputs` de `MODULE_INFO`

Aucun changement backend. La pipeline `generate-deliverables` continue d'appeler `generate-inputs` normalement.

