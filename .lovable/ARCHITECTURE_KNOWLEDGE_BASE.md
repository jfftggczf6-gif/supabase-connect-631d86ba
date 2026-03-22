# Architecture Knowledge Base ESONO — Structure, sources et métadonnées

## PRINCIPES (issus du document SOURCES_RAG_FINANCE_PE_AFRIQUE)

1. **Toute donnée chiffrée doit avoir : source + année + pays + périmètre.** Sinon l'agent IA répond "non documenté dans la base".
2. **Ne jamais fusionner des moyennes de pays différents sans le dire.**
3. **WACC et multiples = hypothèses, pas des faits.** Toujours présenter avec sensibilités.
4. **SYSCOHADA : ne pas confondre résultat comptable, EBITDA retraité et trésorerie.**
5. **Les risques terrain sont des checklists, pas des statistiques.** Ne pas inventer de taux de fraude.

## 4 COUCHES

```
COUCHE 1 — CODE (stable, change rarement)
  Formules, invariants comptables, logique de calcul, guardrails IA
  
COUCHE 2 — BDD GLOBALE (mise à jour 1-2x/an par ESONO)
  Benchmarks sectoriels, paramètres WACC, données pays, risques terrain
  
COUCHE 3 — BDD WORKSPACE (configurable par le client)
  Critères programme, multiples propriétaires, seuils spécifiques
  
COUCHE 4 — BDD AUTO-ENRICHIE (agrégée automatiquement)
  Benchmarks dérivés des entreprises traitées par ESONO (anonymisé)
```

---

## COUCHE 1 — CODE

### Fichiers existants à garder

| Fichier | Contenu | Source |
|---|---|---|
| `financial-knowledge.ts` | Invariants SYSCOHADA, formules projections, cross-validation, fallbacks dérivation | OHADA actes uniformes |
| `valuation-engine.ts` | Formules DCF, multiples, décotes, synthèse | Damodaran, Vernimmen |
| `post-validator.ts` | 9 invariants mathématiques | SYSCOHADA + logique comptable |

### Nouveau fichier à créer

| Fichier | Contenu |
|---|---|
| `risk-detector.ts` | Logique de détection des risk flags (patterns). Les seuils viennent de la couche 2 |
| `guardrails.ts` | Règles anti-hallucination pour les agents IA |

### Guardrails anti-hallucination (`guardrails.ts`)

```typescript
export const AI_GUARDRAILS = `
RÈGLES ABSOLUES POUR L'AGENT IA :

1. CHIFFRES DE MARCHÉ : Ne JAMAIS inventer un chiffre de taille de marché, de croissance sectorielle, ou de part de marché. Si la donnée n'est pas dans la base de connaissances → répondre "Non documenté — à vérifier avec des sources locales (INS, chambre de commerce)".

2. MULTIPLES : Ne JAMAIS inventer un multiple de valorisation. Utiliser UNIQUEMENT les fourchettes fournies dans la base (sourcées AVCA/I&P/Damodaran). Si le secteur n'est pas couvert → utiliser le fallback "services_b2b" et le signaler.

3. WACC : Ne JAMAIS inventer un WACC. Le WACC est CALCULÉ par le valuation-engine (pas par l'IA). L'IA ne fait que justifier les paramètres.

4. BENCHMARKS : Chaque benchmark cité doit avoir sa source. Pas "la marge brute moyenne du secteur est de 40%" mais "la marge brute médiane agro-industrie UEMOA est de 35-45% (source: I&P IPAE portfolio 2023-2024)".

5. PAYS : Ne pas mélanger les données de pays différents. Les marges au Sénégal ne sont pas celles de la RDC. Si la donnée spécifique pays n'existe pas → utiliser la zone (UEMOA/CEMAC) et le signaler.

6. RISQUES : Les risques terrain sont des SIGNAUX À VÉRIFIER, pas des certitudes. "Possible cash non tracé" pas "l'entreprise fait de la fraude".

7. SOURCES : Pour chaque affirmation financière, citer la source si disponible dans la base. Format : "(source: [nom], [année])".
`;
```

---

## COUCHE 2 — BDD GLOBALE

### Schéma de métadonnées (pour CHAQUE entrée)

Chaque donnée dans la knowledge base suit ce schéma :

```
theme | type | source | url | date_document | pays | secteur | langue | perimetre_temporel
```

Types : `loi` | `donnee` | `methodo` | `opinion` | `benchmark` | `risque`

### Table `knowledge_benchmarks` — Benchmarks sectoriels

```sql
CREATE TABLE knowledge_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secteur TEXT NOT NULL,
  pays TEXT DEFAULT 'all',
  zone TEXT DEFAULT 'uemoa',
  
  -- Marges
  marge_brute_min NUMERIC, marge_brute_max NUMERIC, marge_brute_mediane NUMERIC,
  marge_ebitda_min NUMERIC, marge_ebitda_max NUMERIC,
  marge_nette_min NUMERIC, marge_nette_max NUMERIC,
  
  -- Ratios
  ratio_personnel_ca_min NUMERIC, ratio_personnel_ca_max NUMERIC,
  ratio_charges_fixes_ca_min NUMERIC, ratio_charges_fixes_ca_max NUMERIC,
  croissance_ca_max NUMERIC,
  
  -- Valorisation
  multiple_ebitda_min NUMERIC, multiple_ebitda_max NUMERIC,
  multiple_ca_min NUMERIC, multiple_ca_max NUMERIC,
  
  -- Métadonnées (schéma RAG)
  source TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT DEFAULT 'benchmark', -- loi | donnee | benchmark
  date_source DATE,
  perimetre TEXT,                       -- '2022-2024', 'Q1 2025'
  notes TEXT,
  date_mise_a_jour TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(secteur, pays)
);
```

Sources pour alimenter cette table :
- **I&P IPAE portfolio reports** → marges par secteur, multiples observés
- **AVCA Annual Report 2024** → deal multiples, deal sizes
- **AVCA Francophone Africa report** → spécificités régionales
- **Damodaran sector data** → marges par secteur global (à ajuster pour Afrique)

### Table `knowledge_risk_params` — Paramètres WACC par pays

```sql
CREATE TABLE knowledge_risk_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pays TEXT NOT NULL UNIQUE,
  zone TEXT NOT NULL,
  
  -- WACC (Damodaran)
  risk_free_rate NUMERIC NOT NULL,
  equity_risk_premium NUMERIC NOT NULL, -- ERP mature market (Damodaran implied)
  country_risk_premium NUMERIC,          -- CRP spécifique pays (Damodaran)
  default_spread NUMERIC,
  
  -- Primes PME
  size_premium_micro NUMERIC, size_premium_small NUMERIC, size_premium_medium NUMERIC,
  illiquidity_premium_min NUMERIC, illiquidity_premium_max NUMERIC,
  
  -- Taux
  cost_of_debt NUMERIC,
  tax_rate NUMERIC,
  taux_directeur NUMERIC,
  
  -- Décotes standard
  decote_illiquidite NUMERIC DEFAULT 25,
  decote_taille_micro NUMERIC DEFAULT 20,
  decote_taille_small NUMERIC DEFAULT 10,
  decote_gouvernance_no_audit NUMERIC DEFAULT 5,
  decote_gouvernance_no_board NUMERIC DEFAULT 8,
  
  -- Risque pays
  risque_pays_label TEXT,
  risque_pays_prime NUMERIC,
  
  -- Métadonnées
  source TEXT NOT NULL,
  source_url TEXT,
  date_source DATE,
  date_mise_a_jour TIMESTAMPTZ DEFAULT now()
);
```

Sources :
- **Damodaran country risk premiums** (Jul 2025) → `pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ctryprem.html`
- **BCEAO** → taux directeur UEMOA
- **BEAC** → taux directeur CEMAC
- **DGI par pays** → taux IS, TVA

### Table `knowledge_country_data` — Données macro par pays

```sql
CREATE TABLE knowledge_country_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pays TEXT NOT NULL UNIQUE,
  
  -- Macro
  pib_usd_millions NUMERIC,
  croissance_pib_pct NUMERIC,
  inflation_pct NUMERIC,
  population_millions NUMERIC,
  
  -- Réglementaire
  cadre_comptable TEXT DEFAULT 'SYSCOHADA',
  devise TEXT DEFAULT 'XOF',
  taux_is NUMERIC,
  taux_tva NUMERIC,
  cotisations_sociales_pct NUMERIC,
  salaire_minimum NUMERIC,
  salaire_dirigeant_pme_min NUMERIC,  -- Pour détecter fondateur sans salaire
  salaire_dirigeant_pme_max NUMERIC,
  
  -- Environnement affaires
  corruption_index NUMERIC,
  risque_politique TEXT,
  
  -- Financement
  taux_emprunt_pme NUMERIC,
  acces_credit_pme_pct NUMERIC,
  
  -- Métadonnées
  source TEXT,
  date_mise_a_jour TIMESTAMPTZ DEFAULT now()
);
```

Sources :
- **Banque Mondiale** → PIB, croissance, population
- **FMI WEO** → projections, inflation
- **Transparency International** → CPI
- **BCEAO/BEAC** → données monétaires
- **DGI/Code du travail** → fiscalité, SMIG

### Table `knowledge_risk_factors` — Risques terrain

```sql
CREATE TABLE knowledge_risk_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  categorie TEXT NOT NULL, -- 'financier', 'gouvernance', 'operationnel', 'legal', 'commercial'
  
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  signaux JSONB NOT NULL,  -- conditions de détection
  correction TEXT,          -- action recommandée
  
  secteurs_concernes TEXT[], -- NULL = tous
  pays_concernes TEXT[],     -- NULL = tous
  severity TEXT DEFAULT 'medium',
  
  source TEXT,
  is_active BOOLEAN DEFAULT true
);
```

**12 risques terrain à intégrer :**

| Code | Catégorie | Sévérité | Source |
|---|---|---|---|
| `ebitda_no_salary` | financier | high | I&P "15 ans de leçons" |
| `ebitda_perso_charges` | financier | medium | Terrain PE |
| `cash_invisible` | financier | high | AVCA Francophone + terrain |
| `dette_cachee_fournisseurs` | financier | high | I&P + terrain |
| `dette_informelle` | financier | medium | I&P "Formalisation PME ASS" |
| `concentration_client` | commercial | high | PE best practices |
| `croissance_artificielle` | commercial | medium | PE best practices |
| `homme_cle` | gouvernance | high | PE due diligence |
| `gouvernance_faible` | gouvernance | critical | I&P + Enabel readiness |
| `arrieres_fiscaux` | legal | high | DGI + terrain |
| `sous_capitalisation` | legal | medium | OHADA |
| `risque_pays` | pays | varies | Damodaran + Mo Ibrahim |

### Table `knowledge_sources` — Index de toutes les sources

```sql
CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  nom TEXT NOT NULL,                    -- 'Damodaran Country Risk Premiums'
  organisme TEXT NOT NULL,              -- 'NYU Stern'
  type_source TEXT NOT NULL,            -- 'dataset' | 'rapport' | 'base_legale' | 'etude' | 'methodologie'
  
  -- Accès
  url TEXT,
  acces TEXT DEFAULT 'public',         -- 'public' | 'inscription' | 'payant' | 'partenariat'
  
  -- Contenu
  themes TEXT[],                        -- ['wacc', 'erp', 'country_risk']
  pays_couverts TEXT[],                -- ['all'] ou ['cote_d_ivoire', 'senegal']
  secteurs_couverts TEXT[],            -- ['all'] ou ['agro_industrie']
  
  -- Temporalité
  date_publication DATE,
  frequence_mise_a_jour TEXT,          -- 'semestriel', 'annuel', 'ponctuel'
  perimetre_temporel TEXT,              -- '2020-2024'
  
  -- Usage dans ESONO
  utilise_dans TEXT[],                  -- ['valuation-engine', 'knowledge_benchmarks', 'risk_params']
  priorite INTEGER DEFAULT 5,          -- 1 = source primaire, 10 = complémentaire
  
  notes TEXT
);
```

**Sources à indexer :**

```sql
INSERT INTO knowledge_sources (nom, organisme, type_source, url, themes, frequence_mise_a_jour, priorite) VALUES
('Country Risk Premiums', 'Damodaran / NYU Stern', 'dataset', 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ctryprem.html', '{"wacc","erp","country_risk"}', 'semestriel', 1),
('ERP Edition 2025', 'Damodaran', 'etude', 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5168609', '{"erp","methodology"}', 'annuel', 1),
('2024 African Private Capital Activity Report', 'AVCA', 'rapport', 'https://avca.africa/data-intelligence/research-publications/2024-african-private-capital-activity-report/', '{"deals","multiples","exits","fundraising"}', 'annuel', 1),
('Regional Spotlight: Francophone Africa', 'AVCA', 'rapport', 'https://avca.africa', '{"deals","francophone","west_africa"}', 'ponctuel', 2),
('2024 Venture Capital in Africa Report', 'AVCA', 'rapport', 'https://avca.africa/data-intelligence/research-publications/2024-venture-capital-in-africa-report/', '{"vc","startups","deals"}', 'annuel', 2),
('Rapport Impact Annuel', 'I&P', 'rapport', 'https://ietp.com/fr/content/ressources', '{"impact","portfolio","benchmarks","pme"}', 'annuel', 1),
('Formalisation des PME en ASS', 'I&P', 'etude', 'https://ietp.com/fr/content/ressources', '{"formalisation","risques","terrain"}', 'ponctuel', 2),
('15 ans de leçons d investissement PME', 'I&P', 'etude', 'https://ietp.com/fr/content/ressources', '{"lessons","risques","pe","pme"}', 'ponctuel', 1),
('ESG & Impact Report IPDEV 2', 'I&P', 'rapport', 'https://ietp.com/fr/content/rapport-esg-impact-ipdev-2024', '{"esg","impact","ipdev"}', 'annuel', 2),
('Rapport d activités 2024-2025', 'Enabel', 'rapport', 'https://www.enabel.be/app/uploads/2025/05/Enabel_Rapport_dActivites_2024_25.pdf', '{"entrepreneuriat","accompagnement","pme"}', 'annuel', 3),
('Choose Africa 2 (2023-2027)', 'AFD / Proparco', 'rapport', 'https://www.afd.fr/fr/actualites/choose-africa-2-le-soutien-lentrepreneuriat-africain-monte-en-regime', '{"financement","pme","tpme","afrique"}', 'ponctuel', 3),
('Rapport développement économique Afrique 2024', 'UNCTAD', 'rapport', 'https://unctad.org/fr/publication/rapport-2024-sur-le-developpement-economique-en-afrique', '{"macro","risques","pme","commerce"}', 'annuel', 2),
('IRIS+ Catalog', 'GIIN', 'methodologie', 'https://iris.thegiin.org', '{"impact","indicateurs","methodologie"}', 'continu', 2),
('OHADA Actes Uniformes', 'OHADA', 'base_legale', 'https://www.ohada.org', '{"droit","comptabilite","syscohada"}', 'ponctuel', 1),
('World Development Indicators', 'Banque Mondiale', 'dataset', 'https://data.worldbank.org', '{"macro","pib","inflation","population"}', 'annuel', 1),
('World Economic Outlook', 'FMI', 'dataset', 'https://www.imf.org/en/Publications/WEO', '{"macro","projections","inflation"}', 'semestriel', 1),
('Corruption Perceptions Index', 'Transparency International', 'dataset', 'https://www.transparency.org/cpi', '{"corruption","gouvernance","pays"}', 'annuel', 2),
('Ibrahim Index of African Governance', 'Mo Ibrahim Foundation', 'dataset', 'https://mo.ibrahim.foundation', '{"gouvernance","pays","classement"}', 'annuel', 2),
('Partech Africa Tech VC Report', 'Partech', 'rapport', 'https://partechpartners.com', '{"vc","tech","startups","afrique"}', 'annuel', 3),
('Statistiques monétaires UEMOA', 'BCEAO', 'dataset', 'https://www.bceao.int', '{"taux","monetaire","uemoa"}', 'mensuel', 1),
('Statistiques monétaires CEMAC', 'BEAC', 'dataset', 'https://www.beac.int', '{"taux","monetaire","cemac"}', 'mensuel', 1)
;
```

---

## COUCHE 3 — BDD WORKSPACE

### Table `workspace_knowledge` — Données propriétaires du client

```sql
CREATE TABLE workspace_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  
  type TEXT NOT NULL,               -- 'multiples' | 'criteres' | 'benchmarks' | 'seuils'
  cle TEXT NOT NULL,                 -- 'multiple_ebitda_agro', 'seuil_ca_minimum', etc.
  valeur JSONB NOT NULL,            -- {"min": 4, "max": 6, "source": "Portfolio interne 2024"}
  
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(workspace_id, type, cle)
);

-- RLS
ALTER TABLE workspace_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members" ON workspace_knowledge FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);
```

Utilisation : un fonds comme I&P configure ses propres multiples :
```sql
INSERT INTO workspace_knowledge (workspace_id, type, cle, valeur) VALUES
('...', 'multiples', 'multiple_ebitda_agro', '{"min": 5.5, "max": 7, "source": "IPAE II portfolio 2024"}'),
('...', 'seuils', 'ca_minimum', '{"valeur": 100000000, "devise": "XOF"}'),
('...', 'criteres', 'gouvernance_requise', '{"audit_externe": true, "pv_ag": true}');
```

---

## COUCHE 4 — BDD AUTO-ENRICHIE

### Table `aggregated_benchmarks` — Benchmarks dérivés d'ESONO

```sql
CREATE TABLE aggregated_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  secteur TEXT NOT NULL,
  pays TEXT NOT NULL,
  
  -- Agrégats anonymisés
  nb_entreprises INTEGER DEFAULT 0,
  marge_brute_p25 NUMERIC,  -- 25ème percentile
  marge_brute_mediane NUMERIC,
  marge_brute_p75 NUMERIC,
  marge_ebitda_mediane NUMERIC,
  ca_mediane NUMERIC,
  effectifs_mediane INTEGER,
  
  -- Dernière mise à jour
  derniere_agregation TIMESTAMPTZ,
  
  UNIQUE(secteur, pays)
);
```

Alimentée automatiquement par un cron job qui agrège les données des entreprises traitées (anonymisées). Après 20+ entreprises par secteur/pays, ces benchmarks deviennent plus fiables que les sources externes.

---

## COMMENT LES AGENTS UTILISENT LA KB

### Fonction `getKnowledgeForAgent` dans `helpers_v5.ts`

```typescript
export async function getKnowledgeForAgent(
  supabase: any,
  pays: string,
  secteur: string,
  agentType: 'valuation' | 'diagnostic' | 'framework' | 'pre_screening' | 'business_plan',
  workspaceId?: string
): Promise<string> {
  
  // 1. Benchmarks sectoriels (couche 2)
  const { data: benchmarks } = await supabase
    .from('knowledge_benchmarks')
    .select('*')
    .or(`pays.eq.${pays},pays.eq.all`)
    .eq('secteur', secteur)
    .order('pays', { ascending: false }) // pays spécifique d'abord
    .limit(1);

  // 2. Paramètres risque pays (couche 2)
  const { data: riskParams } = await supabase
    .from('knowledge_risk_params')
    .select('*')
    .eq('pays', pays)
    .single();

  // 3. Données macro pays (couche 2)
  const { data: countryData } = await supabase
    .from('knowledge_country_data')
    .select('*')
    .eq('pays', pays)
    .single();

  // 4. Risk factors applicables (couche 2)
  const { data: riskFactors } = await supabase
    .from('knowledge_risk_factors')
    .select('*')
    .eq('is_active', true)
    .or(`secteurs_concernes.is.null,secteurs_concernes.cs.{${secteur}}`);

  // 5. Données propriétaires workspace (couche 3)
  let workspaceData = null;
  if (workspaceId) {
    const { data } = await supabase
      .from('workspace_knowledge')
      .select('*')
      .eq('workspace_id', workspaceId);
    workspaceData = data;
  }

  // 6. Benchmarks auto-enrichis (couche 4)
  const { data: aggBenchmarks } = await supabase
    .from('aggregated_benchmarks')
    .select('*')
    .eq('secteur', secteur)
    .eq('pays', pays)
    .single();

  // Compiler en texte pour le prompt IA
  return buildKnowledgePrompt({
    benchmarks: benchmarks?.[0],
    riskParams,
    countryData,
    riskFactors,
    workspaceData,
    aggBenchmarks: aggBenchmarks?.nb_entreprises >= 10 ? aggBenchmarks : null, // seuil minimum 10 entreprises
    agentType,
  });
}
```

---

## PLAN DE MISE EN ŒUVRE

| Phase | Action | Priorité |
|---|---|---|
| 1 | Créer les 6 tables SQL (migration) | Haute |
| 2 | Alimenter `knowledge_benchmarks` avec les 16 secteurs existants (depuis financial-knowledge.ts) | Haute |
| 3 | Alimenter `knowledge_risk_params` pour les 13 pays (depuis Damodaran Jul 2025) | Haute |
| 4 | Alimenter `knowledge_risk_factors` avec les 12 risques terrain | Haute |
| 5 | Alimenter `knowledge_sources` avec les 20+ sources indexées | Moyenne |
| 6 | Créer `getKnowledgeForAgent` et l'intégrer dans les edge functions | Haute |
| 7 | Créer `guardrails.ts` et l'injecter dans tous les agents | Haute |
| 8 | Créer `risk-detector.ts` qui lit les risk factors de la BDD | Moyenne |
| 9 | Alimenter `knowledge_country_data` (Banque Mondiale, FMI) | Moyenne |
| 10 | Mettre en place le cron d'agrégation pour `aggregated_benchmarks` | Basse |
| 11 | Interface super_admin pour `workspace_knowledge` | Basse |
