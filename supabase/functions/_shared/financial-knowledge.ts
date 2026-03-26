// supabase/functions/_shared/financial-knowledge.ts
// Base de connaissances financière — Agent IA PME Afrique SYSCOHADA
// Version 1.0 — Mars 2026
//
// Usage :
//   import { getFinancialKnowledgePrompt, getExtractionKnowledgePrompt } from "../_shared/financial-knowledge.ts";
//   systemPrompt += getFinancialKnowledgePrompt(country, sector);

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export type Country =
  | "cote_d_ivoire"
  | "senegal"
  | "burkina_faso"
  | "rdc"
  | "congo_rdc"
  | "togo"
  | "benin"
  | "cameroun"
  | "mali"
  | "niger"
  | string;

export type Sector =
  | "restauration"
  | "agro_industrie"
  | "commerce_alimentaire"
  | "services_b2b"
  | "imprimerie"
  | "energie"
  | "tic"
  | "sante"
  | "btp"
  | "agriculture"
  | "aviculture"
  | "agriculture_rente"
  | "industrie_manufacturiere"
  | "commerce_detail"
  | string;

// ─────────────────────────────────────────────────────────────────
// SECTION 1 — INVARIANTS COMPTABLES SYSCOHADA
// ─────────────────────────────────────────────────────────────────

const SYSCOHADA_INVARIANTS = `
## INVARIANTS COMPTABLES SYSCOHADA (RÈGLES ABSOLUES — NE JAMAIS VIOLER)

### Chaîne de résultats obligatoire
- Marge Brute       = CA - Coût des Ventes          → JAMAIS > CA, JAMAIS < 0 si CA > 0
- EBITDA            = Marge Brute - Total OPEX        → JAMAIS > Marge Brute
- EBIT              = EBITDA - Amortissements          → peut être négatif (amorçage)
- Résultat av. IS   = EBIT - Charges financières       → —
- Résultat Net      = Résultat av. IS × (1 - Taux IS) → JAMAIS > EBITDA
- Cashflow opé.     ≈ Résultat Net + Amortissements - ΔBFR
- Total Actif       = Total Passif                     → TOUJOURS égal (bilan)

### Taux IS par pays (à appliquer strictement)
| Pays              | Taux IS  |
|-------------------|----------|
| Côte d'Ivoire     | 25 %     |
| Sénégal           | 30 %     |
| Burkina Faso      | 27.5 %   |
| RDC (Congo)       | 35 %     |
| Togo              | 27 %     |
| Bénin             | 30 %     |
| Cameroun          | 33 %     |
| Mali              | 30 %     |
| Niger             | 30 %     |

### Charges sociales patronales
| Pays              | Patronal | Salarial | Base        |
|-------------------|----------|----------|-------------|
| Côte d'Ivoire     | ~18 %    | ~6.3 %   | Salaire brut|
| Sénégal           | ~18 %    | ~7 %     | Salaire brut|
| Burkina Faso      | ~16 %    | ~5.5 %   | Salaire brut|
| RDC               | ~5.5 %   | ~5 %     | Salaire brut|
| Bénin             | ~15.4 %  | ~3.6 %   | Salaire brut|

### Devise par zone monétaire
- UEMOA  (CI, SN, BF, TG, BJ, ML, NE) → XOF (FCFA)  |  1 USD ≈ 600 XOF  |  1 EUR = 655.957 XOF
- RDC                                  → USD (économie dollarisée de fait)
- CEMAC  (CM, GA, CG, TD, CF, GQ)     → XAF (FCFA CEMAC)
⚠️ Ne JAMAIS mélanger USD et XOF dans le même tableau sans conversion explicite.

### Paramètres bancaires BCEAO/BEAC
| Paramètre                    | Valeur typique           |
|------------------------------|--------------------------|
| Taux bancaire PME            | 8-14 % (moyenne 10-12 %) |
| Taux d'usure BCEAO           | ~15 %                    |
| SMIG Côte d'Ivoire           | 75 000 XOF/mois          |
| SMIG Sénégal                 | 58 900 XOF/mois          |
| SMIG Burkina Faso            | 34 664 XOF/mois          |
| TVA standard UEMOA           | 18 %                     |
`;

// ─────────────────────────────────────────────────────────────────
// SECTION 2 — FORMULES DE PROJECTION & MÉTRIQUES D'INVESTISSEMENT
// ─────────────────────────────────────────────────────────────────

const PROJECTION_FORMULAS = `
## FORMULES DE PROJECTION ET MÉTRIQUES D'INVESTISSEMENT

### CAGR (Compound Annual Growth Rate)
  CAGR = (V_final / V_initial)^(1/n) - 1
  ⚠️ INVALIDE si V_initial ≤ 0 ou V_final ≤ 0
  ⚠️ CAGR > 40 %/an sur 5+ ans → signaler comme très optimiste

### VAN (Valeur Actuelle Nette)
  VAN = Σ_{t=1}^{n}(CF_t / (1+r)^t) - I₀
  Defaults : r = 12 % | n = 5 ans | I₀ = Σ CAPEX + BFR initial
  VAN > 0 → créateur de valeur  |  VAN < 0 → à restructurer

### TRI (Taux de Rentabilité Interne)
  Taux r tel que VAN(r) = 0  [Newton-Raphson ou bisection]
  TRI > 15 % → Excellent  |  10-15 % → Acceptable  |  < 10 % → Risqué

### ROI (Return on Investment)
  ROI = Σ(Résultats Nets Y1..Y5) / Investissement total
  Doit être cohérent avec le signe de VAN (ROI > 0 ↔ VAN tendanciellement > 0)

### DSCR (Debt Service Coverage Ratio)
  DSCR = EBITDA / Service de la dette annuel
  ⚠️ Utiliser l'EBITDA de la 1ère année de REMBOURSEMENT EFFECTIF (post-différé)
  ≥ 1.5 → Confortable  |  1.2-1.5 → Acceptable  |  < 1.2 → Risque de défaut

### Payback (Retour sur investissement)
  Payback = première année t où Σ_{k=1}^{t}(CF_k) ≥ I₀
  < 3 ans → Excellent  |  3-5 ans → Acceptable  |  > 5 ans → Justifier

### BFR (Besoin en Fonds de Roulement)
  BFR = (DSO + Jours_Stock - DPO) × CA_mensuel
  Valeurs par défaut : DSO = 30 j | DPO = 45 j | Stock = 30 j

### Multiple EBITDA
  Multiple = Valorisation / EBITDA (4-8x selon secteur PME Afrique)
`;

// ─────────────────────────────────────────────────────────────────
// SECTION 3 — BENCHMARKS SECTORIELS PME AFRIQUE
// ─────────────────────────────────────────────────────────────────

interface SectorBenchmark {
  margeBrute: string;
  margeEbitda: string;
  croissanceCA: string;
  payback: string;
  alerte: string;
}

const SECTOR_BENCHMARKS: Record<string, SectorBenchmark> = {
  restauration: {
    margeBrute: "35-50 %",
    margeEbitda: "8-15 %",
    croissanceCA: "5-15 %/an",
    payback: "2-4 ans",
    alerte: "EBITDA < 8 % ou CA en baisse 2 ans consécutifs",
  },
  agro_industrie: {
    margeBrute: "30-50 %",
    margeEbitda: "10-20 %",
    croissanceCA: "15-35 %/an",
    payback: "3-5 ans",
    alerte: "Marge brute < 20 % ou rupture d'approvisionnement",
  },
  commerce_alimentaire: {
    margeBrute: "15-25 %",
    margeEbitda: "3-8 %",
    croissanceCA: "5-20 %/an",
    payback: "1-3 ans",
    alerte: "Marge < 10 % ou BFR > 60 jours",
  },
  services_b2b: {
    margeBrute: "55-70 %",
    margeEbitda: "15-30 %",
    croissanceCA: "10-25 %/an",
    payback: "1-3 ans",
    alerte: "EBITDA < 15 % ou concentration client > 50 % CA",
  },
  imprimerie: {
    margeBrute: "30-45 %",
    margeEbitda: "10-18 %",
    croissanceCA: "10-20 %/an",
    payback: "3-5 ans",
    alerte: "Marge brute < 25 % ou équipements > 5 ans sans renouvellement",
  },
  energie: {
    margeBrute: "40-60 %",
    margeEbitda: "20-35 %",
    croissanceCA: "20-40 %/an",
    payback: "4-7 ans",
    alerte: "DSCR < 1.3 ou payback > 7 ans",
  },
  tic: {
    margeBrute: "60-80 %",
    margeEbitda: "15-35 %",
    croissanceCA: "20-50 %/an",
    payback: "2-4 ans",
    alerte: "Burn rate > 6 mois CA ou churn > 20 %",
  },
  sante: {
    margeBrute: "35-55 %",
    margeEbitda: "12-25 %",
    croissanceCA: "10-20 %/an",
    payback: "2-4 ans",
    alerte: "Marge < 20 % ou rupture médicaments clés",
  },
  btp: {
    margeBrute: "20-35 %",
    margeEbitda: "5-12 %",
    croissanceCA: "5-20 %/an",
    payback: "2-4 ans",
    alerte: "Marge < 15 % ou BFR négatif",
  },
  agriculture: {
    margeBrute: "25-45 %",
    margeEbitda: "8-18 %",
    croissanceCA: "10-25 %/an",
    payback: "4-7 ans",
    alerte: "Saisonnalité ±40 % non provisionnée ou DSCR < 1.2",
  },
  // Secteurs ajoutés depuis Sources Bailleurs document
  aviculture: {
    margeBrute: "35-50 %",
    margeEbitda: "10-20 %",
    croissanceCA: "15-30 %/an",
    payback: "2-4 ans",
    alerte: "Coût aliment > 65-70 % du coût total ou mortalité > 5 %",
  },
  agriculture_rente: {
    margeBrute: "30-45 %",
    margeEbitda: "15-30 %",
    croissanceCA: "10-20 %/an",
    payback: "5-8 ans",
    alerte: "Cycle long non provisionné ou dépendance cours mondiaux > 80 % CA",
  },
  commerce_detail: {
    margeBrute: "15-25 %",
    margeEbitda: "3-8 %",
    croissanceCA: "5-15 %/an",
    payback: "1-3 ans",
    alerte: "Marge < 10 % ou rotation stocks < 6x/an",
  },
  industrie_manufacturiere: {
    margeBrute: "25-35 %",
    margeEbitda: "8-15 %",
    croissanceCA: "10-20 %/an",
    payback: "3-6 ans",
    alerte: "Taux d'utilisation capacité < 60 % ou marge brute < 20 %",
  },
  services_it: {
    margeBrute: "40-60 %",
    margeEbitda: "15-30 %",
    croissanceCA: "15-40 %/an",
    payback: "1-3 ans",
    alerte: "Churn > 15 % ou dépendance un client > 40 % CA",
  },
  transport_logistique: {
    margeBrute: "20-35 %",
    margeEbitda: "8-15 %",
    croissanceCA: "5-15 %/an",
    payback: "3-5 ans",
    alerte: "Carburant > 45 % CA ou véhicules > 7 ans sans renouvellement",
  },
  education_formation: {
    margeBrute: "35-55 %",
    margeEbitda: "12-25 %",
    croissanceCA: "10-20 %/an",
    payback: "2-4 ans",
    alerte: "Effectif enseignant > 55 % CA ou taux d'occupation < 60 %",
  },
  immobilier: {
    margeBrute: "30-50 %",
    margeEbitda: "20-35 %",
    croissanceCA: "10-20 %/an",
    payback: "5-10 ans",
    alerte: "Cycle vente > 24 mois ou endettement > 70 %",
  },
  textile_mode: {
    margeBrute: "35-55 %",
    margeEbitda: "10-20 %",
    croissanceCA: "10-25 %/an",
    payback: "2-4 ans",
    alerte: "Dépendance import tissu > 80 % ou stocks > 90 jours",
  },
  mines_extraction: {
    margeBrute: "30-50 %",
    margeEbitda: "20-40 %",
    croissanceCA: "5-15 %/an",
    payback: "5-10 ans",
    alerte: "Permis non renouvelé ou cours matière < seuil de rentabilité",
  },
};

const GLOBAL_ALERT_RATIOS = `
### Ratios d'alerte globaux (tous secteurs)
- Marge brute < 20 %            → vérifier structure de coûts
- DSCR < 1.2                    → risque de défaut sur dette
- Endettement / Total Passif > 60 % → sur-endettement
- BFR > 90 jours de CA          → tension de trésorerie critique
- Trésorerie < 0 deux années    → plan de redressement obligatoire
- Masse salariale > 40 % CA     → sur-effectif ou sous-activité
`;

function buildSectorBlock(sector: string): string {
  const key = sector.toLowerCase().replace(/[\s\-\/]/g, "_");
  const bench: SectorBenchmark =
    SECTOR_BENCHMARKS[key] ?? SECTOR_BENCHMARKS["services_b2b"];

  return `
## BENCHMARKS SECTORIELS — ${sector.toUpperCase()}
| Indicateur              | Valeur typique PME Afrique |
|-------------------------|---------------------------|
| Marge Brute             | ${bench.margeBrute}        |
| Marge EBITDA            | ${bench.margeEbitda}       |
| Croissance CA annuelle  | ${bench.croissanceCA}      |
| Payback investissement  | ${bench.payback}           |
| Signaux d'alerte clés   | ${bench.alerte}            |
${GLOBAL_ALERT_RATIOS}`;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 4 — VALIDATION CROISÉE
// ─────────────────────────────────────────────────────────────────

const CROSS_VALIDATION_RULES = `
## RÈGLES DE VALIDATION CROISÉE

### ❌ Erreurs fatales — bloquer ou corriger la génération
| Condition détectée                              | Type d'erreur             | Action                          |
|-------------------------------------------------|---------------------------|---------------------------------|
| CAGR < 1 % mais Revenue Y5 > 2× Revenue Y0     | ERREUR MATHÉMATIQUE       | Recalculer CAGR                 |
| TRI < 0 % mais VAN > 0                          | INCOHÉRENCE FATALE        | Vérifier les flux CF            |
| ROI > 0 mais VAN < 0 sur 5 ans                  | INCOHÉRENCE               | Vérifier l'horizon              |
| Marge Brute > CA                                | IMPOSSIBLE                | Revoir Coût des Ventes          |
| Résultat Net > EBITDA                           | IMPOSSIBLE                | Revoir amortissements + IS      |
| Total Actif ≠ Total Passif                      | ERREUR BILAN              | Rééquilibrer                    |
| DSCR calculé sur mauvaise année                 | ERREUR MÉTHODOLOGIQUE     | Utiliser année 1 remboursement  |
| IS non conforme au pays déclaré                 | ERREUR PARAMÈTRE          | Appliquer taux pays correct     |

### ⚠️ Alertes — warning, non bloquant
| Condition                                        | Message à afficher                              |
|--------------------------------------------------|-------------------------------------------------|
| Marge EBITDA > benchmark + 15 pts                | "Hypothèses optimistes — justifier"            |
| Croissance CA > 30 %/an sur 3+ années            | "Croissance agressive — détailler hypothèses"  |
| Payback > 5 ans                                  | "Retour long — vérifier viabilité investisseur"|
| Salaires < SMIG local                            | "Risque non-conformité droit du travail"        |
| Trésorerie initiale = 0 et prêts importants      | "Vérifier trésorerie de départ"                 |

### 🔁 Cohérence historique (années Y-2, Y-1, Y0)
- Taux de croissance CA(Y-1→Y0) DOIT être distinct de (Y-2→Y-1) — calcul inverse séparé
- Ne PAS appliquer le même CAGR projeté aux années historiques passées
- Si CA en baisse 2+ années consécutives → identifier cause structurelle avant projections
- Si résultats négatifs sur 2+ années → signaler besoin de plan de redressement
`;

// ─────────────────────────────────────────────────────────────────
// SECTION 5 — DÉRIVATION ET FALLBACKS
// ─────────────────────────────────────────────────────────────────

const DERIVATION_FALLBACKS = `
## RÈGLES DE DÉRIVATION ET FALLBACKS

### Données manquantes → calcul automatique
| Donnée manquante                        | Fallback / Dérivation                                        |
|-----------------------------------------|--------------------------------------------------------------|
| funding_need = 0 ET CAPEX existent      | funding_need = Σ CAPEX                                      |
| Cashflow absent                         | Cashflow ≈ EBITDA × (1 − Taux IS pays)                      |
| Marge brute absente                     | Marge brute = CA − Coûts variables directs                   |
| Amortissements absents                  | Amortissements ≈ Σ CAPEX / durée_vie_moyenne_pondérée        |
| Charges sociales non renseignées        | Charges = Salaires bruts × taux_patronal_pays                |
| Service de la dette absent              | Service = Principal/Durée + Intérêts annuels                 |
| BFR absent                              | BFR = (DSO + Stock − DPO) × CA_mensuel                      |
| DSCR absent                             | DSCR = EBITDA_Y1_remboursement / Service_dette_annuel        |
| V_initial ≤ 0 pour CAGR                 | Utiliser CA à la place (jamais négatif)                      |
| Taux IS non fourni                      | Appliquer taux du pays déclaré (table Section 1)             |

### Valeurs par défaut universelles
| Paramètre              | Valeur par défaut                                  |
|------------------------|----------------------------------------------------|
| DSO                    | 30 jours                                           |
| DPO                    | 45 jours                                           |
| Stock                  | 30 jours                                           |
| Taux d'actualisation r | 12 %                                               |
| Horizon projection     | 5 ans                                              |
| Inflation              | 5-8 % selon pays (utiliser 6 % si inconnu)         |
| Croissance prix        | 3-5 %/an                                           |
`;

// ─────────────────────────────────────────────────────────────────
// SECTION 6 — CRITÈRES BAILLEURS DE FONDS
// ─────────────────────────────────────────────────────────────────

const DONOR_CRITERIA = `
## CRITÈRES BAILLEURS DE FONDS — ENTREPRENEURIAT AFRIQUE

### Enabel (Coopération belge)
- Ticket moyen : 10 000 – 50 000 EUR (subvention + assistance technique)
- Secteurs prioritaires : agro-alimentaire, énergie renouvelable, TIC, formation professionnelle
- Critères clés : impact emploi local, inclusion genre (min 30 % femmes), durabilité environnementale
- Format attendu : plan d'affaires + cadre logique + budget détaillé
- KPIs d'impact : emplois créés, emplois femmes/jeunes, CA additionnel, tonnes CO2 évitées

### GIZ (Coopération allemande)
- Ticket moyen : 20 000 – 100 000 EUR (assistance technique, rarement subvention directe)
- Secteurs prioritaires : formation professionnelle, économie verte, digitalisation, agriculture durable
- Critères clés : scalabilité, transfert de compétences, partenariat public-privé
- Format attendu : concept note + theory of change + indicateurs SMART
- KPIs d'impact : personnes formées, entreprises accompagnées, revenus additionnels

### BAD (Banque Africaine de Développement)
- Ticket moyen : 500 000 – 5 000 000 USD (prêt concessionnaire + garantie)
- Secteurs prioritaires : infrastructures, énergie, agro-industrie, industrie manufacturière
- Critères clés : rentabilité financière (TRI > 12 %), impact développement, gouvernance
- Format attendu : étude de faisabilité complète + modèle financier 10 ans + analyse E&S
- KPIs d'impact : TRI économique, emplois, accès services (eau, électricité, route)

### AFD / Proparco
- Ticket moyen : 1 000 000 – 10 000 000 EUR (prêt, prise de participation, garantie)
- Secteurs prioritaires : climat, biodiversité, égalité genre, santé, éducation
- Critères clés : alignement Accord de Paris, due diligence ESG complète, DSCR > 1.3
- Format attendu : business plan détaillé + modèle financier + plan ESG + plan genre
- KPIs d'impact : ODD alignés, empreinte carbone, parité H/F management

### IFC (Société Financière Internationale / Banque Mondiale)
- Ticket moyen : 2 000 000 – 20 000 000 USD (equity, quasi-equity, prêt senior)
- Secteurs prioritaires : secteur privé tous secteurs, focus PME via fonds intermédiaires
- Critères clés : performance financière (ROE > 15 %), gouvernance, standards IFC PS 1-8
- Format attendu : information memorandum + modèle financier audité + due diligence complète
- KPIs d'impact : REACH (personnes touchées), emplois, revenus fiscaux, inclusion financière

### Matching bailleur ↔ profil entreprise
| Profil entreprise                        | Bailleur recommandé              |
|------------------------------------------|----------------------------------|
| Micro-entreprise / startup (< 50 M XOF) | Enabel, GIZ (AT + subvention)   |
| PME en croissance (50-500 M XOF)        | Enabel, BAD (ligne PME), AFD    |
| ETI / Scale-up (> 500 M XOF)            | Proparco, IFC, BAD              |
| Projet à fort impact social             | Enabel, GIZ, AFD (C2D)          |
| Projet infrastructure / énergie         | BAD, Proparco, IFC              |
`;

// ─────────────────────────────────────────────────────────────────
// EXEMPLES ENTREPRISES DE RÉFÉRENCE (contexte pour l'IA)
// ─────────────────────────────────────────────────────────────────

const REFERENCE_COMPANIES = `
## EXEMPLES ENTREPRISES DE RÉFÉRENCE (PME AFRIQUE FICTIVES)

### 1. BISCUITS WAOUH! SARL — Burkina Faso 🔴 (crise totale)
- Secteur: Agro-alimentaire (biscuits céréales locales)  |  Devise: XOF
- CA 2022: 145 M XOF → 2023: 78 M XOF → 2024: 22 M XOF  (−85 % en 3 ans)
- Résultat net 2024: −42 M XOF  |  Trésorerie: −8.2 M XOF
- Produits en marge NÉGATIVE: Biscuit Sorgho-Vanille 200g (prix 200 XOF, coût 310 XOF → −55 %)
- Cause: crise sécuritaire BF 2022-2024, hausse coûts intrants +40 %, perte canaux distribution
- Enseignement: sur-investissement CAPEX non amorti, dépendance imports, structure de coûts rigide

### 2. PRESTIGE TRAITEUR ABIDJAN SARL — Côte d'Ivoire 🟠 (déclin modéré)
- Secteur: Restauration événementielle  |  Devise: XOF
- CA 2022: 68 M XOF → 2023: 62 M XOF → 2024: 54 M XOF  (−21 % en 2 ans)
- Résultat net 2024: −6 M XOF  |  Trésorerie: −1.5 M XOF
- Marge location matériel: 73 % 🟢  |  Menu entreprise: 17 % 🔴
- Cause: perte contrat Total CI (−30 % CA), fourgon frigorifique en panne, prêt SGBCI 14 % en retard
- Enseignement: concentration client dangereuse, coûts fixes non ajustés à la baisse d'activité

### 3. IMPRIMERIE MODERNE DAKAR (IMD) SARL — Sénégal 🟢 (stable/croissance)
- Secteur: Imprimerie  |  Devise: XOF
- CA 2022: 82 M XOF → 2023: 95 M XOF → 2024: 108 M XOF  (+15 %/an)
- Résultat net 2024: +13.2 M XOF  |  Trésorerie: +15.5 M XOF
- Meilleure marge: Conception Graphique 65.7 %  |  Plus faible: Offset 33.9 %
- Financement sain: prêt BHS 25 M XOF @9 % + CNCAS 10 M XOF @11 %
- Enseignement: diversification services, trésorerie positive, endettement maîtrisé

### 4. FUTUKA AGRO SARL — RDC (Kinshasa) 🟢 (forte croissance)
- Secteur: Agro-industrie (manioc, huile de palme)  |  Devise: USD ⚠️ (PAS XOF)
- CA 2022: $88 000 → 2023: $135 000 → 2024: $192 000  (+54 % puis +42 %)
- Résultat net 2024: +$47 856 (~25 % marge)  |  Trésorerie: +$8 500
- Produits: farine manioc 25 kg = $22 (marge 36 %), fufu 1 kg = $1.50 (marge 43 %)
- Défis RDC: coupures SNEL → groupe électrogène $450/mois, volatilité USD/CDF, routes dégradées
- IS RDC = 35 %  |  Charges sociales patronales = 5.5 %  (très différent UEMOA)
- Financement: RAWBANK $20k @18 % (36 mois) + subvention FONA/PNUD $10k
`;

// ─────────────────────────────────────────────────────────────────
// SECTION 8 — MULTIPLES DE VALORISATION PME AFRIQUE
// ─────────────────────────────────────────────────────────────────

const VALUATION_BENCHMARKS = `
## MULTIPLES DE VALORISATION — PME AFRIQUE SUBSAHARIENNE

### Multiples EBITDA par secteur (transactions 2020-2025, PME 100M-5B FCFA CA)
| Secteur | Multiple EBITDA | Multiple CA | Sources |
|---------|----------------|-------------|---------|
| Agro-industrie | 5-7× | 0.8-1.2× | I&P IPAE, Adenia Partners, Phatisa |
| Tech/SaaS B2B | 8-12× | 2-5× | Partech, TLcom, CRE Venture Capital |
| Fintech | 6-10× | 3-6× | Partech, Quona Capital |
| Commerce/Distribution | 3-5× | 0.3-0.7× | Amethis, Helios, AfricInvest |
| Services B2B | 5-8× | 1-2× | I&P, Investisseurs & Partenaires |
| Santé/Pharma | 6-9× | 1-2× | I&P, AfricInvest, LeapFrog |
| BTP/Construction | 3-5× | 0.3-0.6× | Rares transactions PE |
| Énergie renouvelable | 7-10× | 1.5-3× | Meridiam, Actis, responsAbility |
| Éducation | 5-7× | 1-2× | I&P, Emerging Capital Partners |
| Agriculture | 4-6× | 0.5-1× | Phatisa, Pearl Capital, Injaro |
| Transport/Logistique | 4-6× | 0.5-1× | AfricInvest, Development Partners |
| Industrie manufacturière | 4-6× | 0.5-0.8× | Amethis, Adenia |

### WACC typiques par zone
| Zone | Risk-Free | ERP Afrique | Size Premium | Illiquidity | WACC typique PME |
|------|-----------|-------------|--------------|-------------|------------------|
| UEMOA (CI, SN, BF...) | 3.0% | 8-10% | 3-5% | 2-4% | 16-22% |
| CEMAC (CM, GA...) | 3.0% | 9-12% | 3-5% | 3-5% | 18-25% |
| RDC | 3.0% | 12-15% | 4-6% | 4-6% | 23-30% |
| Afrique Est (KE, TZ) | 3.0% | 7-9% | 3-4% | 2-3% | 15-19% |

### Décotes standard
| Type | Fourchette | Application |
|------|-----------|-------------|
| Illiquidité | 20-30% | Toutes PME non cotées |
| Taille (micro) | 15-25% | CA < 200M FCFA |
| Taille (petite) | 10-15% | CA 200M-1B FCFA |
| Gouvernance | 5-15% | Pas d'audit, pas de PV AG, confusion patrimoine |
| Prime croissance | +10-25% | CAGR > 20% sur 3+ ans |
| Risque pays | 0-20% | Instabilité politique/sécuritaire |
`;

// ─────────────────────────────────────────────────────────────────
// SECTION 9 — SECTOR GUARDRAILS (bornes anti-hallucination)
// ─────────────────────────────────────────────────────────────────

export interface SectorGuardrail {
  marge_brute_min: number; marge_brute_max: number;
  marge_ebitda_min: number; marge_ebitda_max: number;
  ratio_personnel_ca_min: number; ratio_personnel_ca_max: number;
  croissance_max_annuelle: number;
  source: string;
}

export const SECTOR_GUARDRAILS: Record<string, SectorGuardrail> = {
  agro_industrie:          { marge_brute_min: 25, marge_brute_max: 55, marge_ebitda_min: 5, marge_ebitda_max: 30, ratio_personnel_ca_min: 8, ratio_personnel_ca_max: 35, croissance_max_annuelle: 40, source: "I&P IPAE + Adenia Partners + Phatisa (2023)" },
  aviculture:              { marge_brute_min: 20, marge_brute_max: 50, marge_ebitda_min: 5, marge_ebitda_max: 25, ratio_personnel_ca_min: 10, ratio_personnel_ca_max: 30, croissance_max_annuelle: 35, source: "FIRCA CIV + Banque Mondiale Livestock (2024)" },
  agriculture:             { marge_brute_min: 20, marge_brute_max: 50, marge_ebitda_min: 5, marge_ebitda_max: 25, ratio_personnel_ca_min: 8, ratio_personnel_ca_max: 35, croissance_max_annuelle: 35, source: "FAO + Banque Mondiale Agriculture (2023)" },
  agriculture_rente:       { marge_brute_min: 25, marge_brute_max: 50, marge_ebitda_min: 10, marge_ebitda_max: 35, ratio_personnel_ca_min: 8, ratio_personnel_ca_max: 30, croissance_max_annuelle: 25, source: "CCC/BCEAO + AFD (2023)" },
  commerce_detail:         { marge_brute_min: 10, marge_brute_max: 30, marge_ebitda_min: 2, marge_ebitda_max: 15, ratio_personnel_ca_min: 5, ratio_personnel_ca_max: 20, croissance_max_annuelle: 30, source: "IFC Enterprise Finance Gap (2023)" },
  commerce_alimentaire:    { marge_brute_min: 10, marge_brute_max: 30, marge_ebitda_min: 2, marge_ebitda_max: 12, ratio_personnel_ca_min: 5, ratio_personnel_ca_max: 20, croissance_max_annuelle: 25, source: "IFC + Proparco Distribution Afrique (2023)" },
  restauration:            { marge_brute_min: 30, marge_brute_max: 60, marge_ebitda_min: 5, marge_ebitda_max: 20, ratio_personnel_ca_min: 15, ratio_personnel_ca_max: 45, croissance_max_annuelle: 25, source: "Proparco + I&P Restauration (2023)" },
  services_b2b:            { marge_brute_min: 40, marge_brute_max: 75, marge_ebitda_min: 10, marge_ebitda_max: 40, ratio_personnel_ca_min: 25, ratio_personnel_ca_max: 60, croissance_max_annuelle: 50, source: "AfDB SME Survey (2023)" },
  tic:                     { marge_brute_min: 50, marge_brute_max: 85, marge_ebitda_min: 15, marge_ebitda_max: 50, ratio_personnel_ca_min: 30, ratio_personnel_ca_max: 65, croissance_max_annuelle: 60, source: "Partech Africa + GSMA (2024)" },
  services_it:             { marge_brute_min: 40, marge_brute_max: 80, marge_ebitda_min: 10, marge_ebitda_max: 40, ratio_personnel_ca_min: 25, ratio_personnel_ca_max: 60, croissance_max_annuelle: 50, source: "Partech Africa (2024)" },
  imprimerie:              { marge_brute_min: 25, marge_brute_max: 50, marge_ebitda_min: 8, marge_ebitda_max: 22, ratio_personnel_ca_min: 15, ratio_personnel_ca_max: 40, croissance_max_annuelle: 25, source: "INS CIV + benchmarks sectoriels (2023)" },
  energie:                 { marge_brute_min: 35, marge_brute_max: 65, marge_ebitda_min: 15, marge_ebitda_max: 40, ratio_personnel_ca_min: 5, ratio_personnel_ca_max: 25, croissance_max_annuelle: 45, source: "IRENA + IFC Energy (2024)" },
  sante:                   { marge_brute_min: 30, marge_brute_max: 60, marge_ebitda_min: 10, marge_ebitda_max: 30, ratio_personnel_ca_min: 20, ratio_personnel_ca_max: 50, croissance_max_annuelle: 30, source: "OMS + AfDB Health Sector (2023)" },
  btp:                     { marge_brute_min: 15, marge_brute_max: 40, marge_ebitda_min: 3, marge_ebitda_max: 15, ratio_personnel_ca_min: 10, ratio_personnel_ca_max: 35, croissance_max_annuelle: 30, source: "AfDB Infrastructure (2023)" },
  industrie_manufacturiere:{ marge_brute_min: 20, marge_brute_max: 45, marge_ebitda_min: 5, marge_ebitda_max: 20, ratio_personnel_ca_min: 10, ratio_personnel_ca_max: 35, croissance_max_annuelle: 25, source: "ONUDI + IFC Manufacturing (2023)" },
  transport_logistique:    { marge_brute_min: 15, marge_brute_max: 40, marge_ebitda_min: 5, marge_ebitda_max: 18, ratio_personnel_ca_min: 10, ratio_personnel_ca_max: 35, croissance_max_annuelle: 25, source: "Banque Mondiale Logistics (2023)" },
  education_formation:     { marge_brute_min: 30, marge_brute_max: 60, marge_ebitda_min: 10, marge_ebitda_max: 30, ratio_personnel_ca_min: 30, ratio_personnel_ca_max: 60, croissance_max_annuelle: 25, source: "UNESCO + AfDB Education (2023)" },
  immobilier:              { marge_brute_min: 25, marge_brute_max: 55, marge_ebitda_min: 15, marge_ebitda_max: 40, ratio_personnel_ca_min: 5, ratio_personnel_ca_max: 20, croissance_max_annuelle: 25, source: "Knight Frank Africa (2024)" },
  textile_mode:            { marge_brute_min: 30, marge_brute_max: 60, marge_ebitda_min: 8, marge_ebitda_max: 25, ratio_personnel_ca_min: 15, ratio_personnel_ca_max: 40, croissance_max_annuelle: 30, source: "ONUDI Textile Afrique (2023)" },
  mines_extraction:        { marge_brute_min: 25, marge_brute_max: 55, marge_ebitda_min: 15, marge_ebitda_max: 45, ratio_personnel_ca_min: 8, ratio_personnel_ca_max: 25, croissance_max_annuelle: 20, source: "Africa Mining IQ + Banque Mondiale (2024)" },
};

export function getSectorGuardrails(sector: string): SectorGuardrail {
  const key = sector.toLowerCase().replace(/[\s\-\/]/g, "_");
  return SECTOR_GUARDRAILS[key] || SECTOR_GUARDRAILS['services_b2b'];
}

// ─────────────────────────────────────────────────────────────────
// EXPORTS PUBLICS
// ─────────────────────────────────────────────────────────────────

/**
 * Retourne le bloc de connaissances COMPLET pour injection dans
 * `generate-plan-ovo` et `generate-framework`.
 *
 * @param country  Pays de l'entreprise (ex: "cote_d_ivoire", "rdc", "senegal")
 * @param sector   Secteur d'activité (ex: "agro_industrie", "restauration")
 * @param includeExamples  Inclure les fiches entreprises de référence (défaut: true)
 */
export function getFinancialKnowledgePrompt(
  country: Country = "cote_d_ivoire",
  sector: Sector = "services_b2b",
  includeExamples = true
): string {
  const blocks: string[] = [
    "# BASE DE CONNAISSANCES FINANCIÈRE — AGENT IA PME AFRIQUE (SYSCOHADA v1.0)",
    SYSCOHADA_INVARIANTS,
    PROJECTION_FORMULAS,
    buildSectorBlock(sector),
    CROSS_VALIDATION_RULES,
    DERIVATION_FALLBACKS,
    DONOR_CRITERIA,
  ];
  if (includeExamples) blocks.push(REFERENCE_COMPANIES);
  return blocks.join("\n\n---\n\n");
}

/**
 * Retourne uniquement les invariants comptables + fallbacks pour injection dans
 * `generate-inputs` (extraction seulement, pas de projections ni benchmarks).
 */
export function getExtractionKnowledgePrompt(): string {
  return [
    "# INVARIANTS COMPTABLES — EXTRACTION & NORMALISATION DES DONNÉES",
    SYSCOHADA_INVARIANTS,
    DERIVATION_FALLBACKS,
  ].join("\n\n---\n\n");
}

/**
 * Retourne uniquement les benchmarks sectoriels pour un usage ciblé.
 */
export function getSectorKnowledgePrompt(sector: Sector): string {
  return buildSectorBlock(sector);
}

/**
 * Retourne uniquement les règles de validation croisée.
 */
export function getValidationRulesPrompt(): string {
  return CROSS_VALIDATION_RULES;
}

/**
 * Retourne uniquement les critères bailleurs de fonds.
 */
export function getDonorCriteriaPrompt(): string {
  return DONOR_CRITERIA;
}

/**
 * Retourne les multiples de valorisation PME Afrique.
 */
export function getValuationBenchmarksPrompt(): string {
  return VALUATION_BENCHMARKS;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 10 — BENCHMARKS CONTEXTUELS (pays + secteur + sources)
// ─────────────────────────────────────────────────────────────────

// Ajustements par zone géographique (appliqués aux benchmarks sectoriels)
const ZONE_ADJUSTMENTS: Record<string, { label: string; cost_factor: number; growth_factor: number; bfr_dso: number; bfr_dpo: number; bfr_stock: number; smig_mensuel: number; loyer_bureau_min: number; loyer_bureau_max: number; electricite_min: number; electricite_max: number; source: string }> = {
  uemoa: {
    label: "UEMOA (XOF)", cost_factor: 1.0, growth_factor: 1.0,
    bfr_dso: 30, bfr_dpo: 45, bfr_stock: 30,
    smig_mensuel: 60000, loyer_bureau_min: 100000, loyer_bureau_max: 500000,
    electricite_min: 50000, electricite_max: 200000,
    source: "BCEAO Rapport Annuel 2024 + INS pays UEMOA"
  },
  cemac: {
    label: "CEMAC (XAF)", cost_factor: 1.15, growth_factor: 0.9,
    bfr_dso: 45, bfr_dpo: 60, bfr_stock: 35,
    smig_mensuel: 41875, loyer_bureau_min: 80000, loyer_bureau_max: 400000,
    electricite_min: 40000, electricite_max: 180000,
    source: "BEAC Rapport 2024 + INS Cameroun"
  },
  rdc: {
    label: "RDC (USD)", cost_factor: 1.3, growth_factor: 0.8,
    bfr_dso: 60, bfr_dpo: 45, bfr_stock: 45,
    smig_mensuel: 7080, loyer_bureau_min: 200, loyer_bureau_max: 1500,
    electricite_min: 50, electricite_max: 300,
    source: "BCC Rapport Monétaire 2024 + Banque Mondiale RDC"
  },
  east_africa: {
    label: "Afrique de l'Est (KES/UGX/RWF)", cost_factor: 1.1, growth_factor: 1.1,
    bfr_dso: 30, bfr_dpo: 30, bfr_stock: 25,
    smig_mensuel: 15000, loyer_bureau_min: 15000, loyer_bureau_max: 80000,
    electricite_min: 5000, electricite_max: 30000,
    source: "EAC Economic Report 2024"
  },
};

function getZone(country: string): string {
  const c = (country || '').toLowerCase();
  if (c.includes('rdc') || c.includes('congo') && !c.includes('brazza')) return 'rdc';
  if (c.includes('cameroun') || c.includes('gabon') || c.includes('tchad') || c.includes('centrafri') || c.includes('congo') || c.includes('guinée équ')) return 'cemac';
  if (c.includes('kenya') || c.includes('rwanda') || c.includes('ouganda') || c.includes('tanzanie')) return 'east_africa';
  return 'uemoa';
}

/**
 * Retourne les benchmarks contextualisés (pays + secteur) avec sources.
 * Utilisé par tous les agents pour les estimations et validations.
 */
export function getContextualBenchmarks(country: string, sector: string): string {
  const zone = getZone(country);
  const za = ZONE_ADJUSTMENTS[zone] || ZONE_ADJUSTMENTS.uemoa;
  const sg = getSectorGuardrails(sector);

  // Ajuster les benchmarks sectoriels selon la zone
  const adjMargeBruteMin = Math.round(sg.marge_brute_min * (za.cost_factor > 1 ? 0.9 : 1));
  const adjMargeBruteMax = Math.round(sg.marge_brute_max * (za.cost_factor > 1 ? 0.95 : 1));

  return `═══ BENCHMARKS CONTEXTUELS : ${sector.toUpperCase()} en ${country} (${za.label}) ═══

MARGES SECTORIELLES (source: ${sg.source}) :
  - Marge brute : ${adjMargeBruteMin}-${adjMargeBruteMax}%
  - Marge EBITDA : ${sg.marge_ebitda_min}-${sg.marge_ebitda_max}%
  - Ratio personnel/CA : ${sg.ratio_personnel_ca_min}-${sg.ratio_personnel_ca_max}%
  - Croissance max réaliste : ${Math.round(sg.croissance_max_annuelle * za.growth_factor)}%/an

COÛTS FIXES ESTIMÉS (source: ${za.source}) :
  - SMIG : ${za.smig_mensuel.toLocaleString()} ${zone === 'rdc' ? 'USD' : 'FCFA'}/mois
  - Loyer bureau : ${za.loyer_bureau_min.toLocaleString()}-${za.loyer_bureau_max.toLocaleString()} ${zone === 'rdc' ? 'USD' : 'FCFA'}/mois
  - Électricité/eau : ${za.electricite_min.toLocaleString()}-${za.electricite_max.toLocaleString()} ${zone === 'rdc' ? 'USD' : 'FCFA'}/mois
  - Télécom/internet : ${Math.round(za.electricite_min * 0.6).toLocaleString()}-${Math.round(za.electricite_max * 0.5).toLocaleString()} ${zone === 'rdc' ? 'USD' : 'FCFA'}/mois

BFR PAR DÉFAUT (source: ${za.source}) :
  - Délai clients (DSO) : ${za.bfr_dso} jours
  - Délai fournisseurs (DPO) : ${za.bfr_dpo} jours
  - Rotation stock : ${za.bfr_stock} jours

ESTIMATION DES COÛTS VARIABLES PAR SECTEUR (source: ${sg.source}) :
  - Coûts variables ≈ ${100 - adjMargeBruteMax}-${100 - adjMargeBruteMin}% du CA
  - Coûts fixes ≈ ${sg.ratio_personnel_ca_min + 5}-${sg.ratio_personnel_ca_max + 10}% du CA (personnel + loyer + utilities)

⚠️ RÈGLE : Quand tu utilises un benchmark, CITE LA SOURCE entre parenthèses.
  Ex: "Marge brute estimée à 35% (source: ${sg.source})"
  Ex: "Loyer estimé à 300K FCFA/mois (source: ${za.source})"
`;
}
