

# Plan : Corriger l'extraction des contraintes Framework dans generate-plan-ovo

## Bug identifie

Le code cherche `l.libelle` (lignes 46-48) mais les donnees en base utilisent **`l.poste`** :
- Base : `{ poste: "CA Total", an1: 145000000, ... }`
- Code : `l.libelle?.toLowerCase().includes("ca")` → **toujours undefined** → aucune contrainte injectee

Resultat : Claude genere le Plan OVO **sans aucune contrainte du Framework**, d'ou l'incoherence des revenus.

De plus, les annees stockees sont encore `current_year: 2024` car le normalizer ne corrige que les **nouvelles** generations. Il faut regenerer.

## Correction

**Fichier** : `supabase/functions/generate-plan-ovo/index.ts`, lignes 44-61

1. Chercher `l.poste` en plus de `l.libelle` dans les `find()` :
   - CA : `(l.poste || l.libelle)?.toLowerCase()` matches "ca", "chiffre", "revenue"
   - EBITDA : matches "ebitda"
   - Resultat Net : matches "résultat net", "resultat net"
   - Marge Brute : ajouter extraction
   - Cash-Flow : ajouter extraction

2. Mapper explicitement an1→year2, an2→year3, etc. avec les valeurs numeriques :
   ```
   CONTRAINTES (OBLIGATOIRES - ces valeurs viennent du Plan Financier Intermediaire):
   - Revenue year2(2027) = 145 000 000, year3(2028) = 180 000 000, ...
   - EBITDA year2(2027) = 42 500 000, ...
   - Resultat Net year2(2027) = 29 800 000, ...
   - Cash-Flow year2(2027) = 32 600 000, ...
   ```

3. Extraire aussi les donnees historiques depuis `inputs_data.compte_resultat` pour contraindre `current_year` et les COGS.

## Impact
- Les revenus 2028-2031 seront alignes avec les projections du Framework (145M → 285M)
- Correction simple, un seul fichier, ~20 lignes changees
- Apres deploiement, il faut regenerer le module Plan OVO

