/**
 * OVO Knowledge Base — Structured intelligence from 60 projects analysis
 * Source: Stumbling Blocks Report 2023-2024, Compliance Reports, Impact Framework v1.2
 * Used by: generate-pre-screening, generate-diagnostic, generate-compliance-report, generate-odd
 */

// ═══════════════════════════════════════════════════════════════
// RED FLAGS — Stumbling blocks with frequencies from 60 OVO projects
// ═══════════════════════════════════════════════════════════════

export const OVO_RED_FLAGS = [
  // Operational (20% des projets)
  {
    id: "technical_issues",
    category: "operational",
    pattern: "Problèmes techniques de production",
    frequency: 9,
    total: 60,
    pct: 15,
    severity: "high",
    detection: [
      "Vérifier la capacité de production vs projections",
      "Vérifier l'accès à l'expertise technique (maintenance, ingénierie)",
      "Évaluer les risques liés aux pannes électriques et logistiques",
    ],
    mitigation: "OVO a introduit une Expertise Cell et collabore avec Humasol, Engineers Without Borders",
  },
  {
    id: "licensing_issues",
    category: "operational",
    pattern: "Problèmes de licences et permis sectoriels",
    frequency: 2,
    total: 60,
    pct: 3,
    severity: "critical",
    detection: [
      "Vérifier les permis spécifiques au secteur (trade license, HACCP, permis sanitaire)",
      "Vérifier la conformité du champ d'activité dans les documents administratifs",
      "Exemples critiques : santé (Rwanda), agroalimentaire (Ouganda)",
    ],
    mitigation: "Compliance guidelines renforcées, focus pendant le coaching",
  },
  {
    id: "no_accounting",
    category: "operational",
    pattern: "Absence de système comptable",
    frequency: 9,
    total: 60,
    pct: 15,
    severity: "high",
    detection: [
      "Vérifier si l'entreprise utilise un logiciel comptable (ODOO, QuickBooks, etc.)",
      "Vérifier si les états financiers sont audités",
      "Vérifier la traçabilité des revenus et dépenses",
    ],
    mitigation: "Partenariat ODOO, formations financières, sessions de train-the-trainer",
  },
  {
    id: "insufficient_sales",
    category: "operational",
    pattern: "Revenus insuffisants ou concentration clients",
    frequency: 16,
    total: 60,
    pct: 27,
    severity: "high",
    detection: [
      "Vérifier la diversification du portefeuille clients",
      "Vérifier l'existence de contrats récurrents vs ventes ponctuelles",
      "Vérifier la stratégie commerciale et marketing",
      "Vérifier les difficultés de recouvrement",
    ],
    mitigation: "Assistance juridique pour le recouvrement, focus sur la stratégie commerciale pendant le coaching",
  },
  {
    id: "seasonal_dependence",
    category: "operational",
    pattern: "Forte dépendance saisonnière",
    frequency: 10,
    total: 60,
    pct: 17,
    severity: "medium",
    detection: [
      "Vérifier la répartition du CA par mois/saison",
      "Vérifier le plan de trésorerie inter-saison",
      "Évaluer les sources de revenus alternatives en basse saison",
    ],
    mitigation: "Diversification des revenus, gestion de trésorerie adaptée",
  },
  // Managerial (40% des projets)
  {
    id: "one_man_show",
    category: "managerial",
    pattern: "Entreprise dépendante d'une seule personne",
    frequency: 24,
    total: 60,
    pct: 40,
    severity: "critical",
    detection: [
      "Vérifier le nombre de co-fondateurs et co-gérants",
      "Évaluer l'organigramme et la délégation de responsabilités",
      "Vérifier si la continuité est assurée en cas d'absence du dirigeant",
      "Problèmes de santé de l'entrepreneur = risque direct sur le projet",
    ],
    mitigation: "Élargir le focus au management team, évaluer les compétences de leadership, encourager les co-fondateurs",
  },
  {
    id: "weak_management",
    category: "managerial",
    pattern: "Compétences managériales insuffisantes",
    frequency: 10,
    total: 60,
    pct: 17,
    severity: "high",
    detection: [
      "Évaluer les compétences en gestion financière",
      "Vérifier la connaissance du marché",
      "Évaluer les pratiques de gouvernance",
    ],
    mitigation: "Support RH et management organisationnel, assessment entrepreneurial",
  },
  {
    id: "poor_governance",
    category: "managerial",
    pattern: "Pratiques de gouvernance faibles",
    frequency: 9,
    total: 60,
    pct: 15,
    severity: "high",
    detection: [
      "Vérifier la répartition des tâches et responsabilités",
      "Vérifier l'existence d'un conseil d'administration ou comité consultatif",
      "Évaluer la transparence des décisions",
    ],
    mitigation: "Renforcer la gouvernance, éventuellement via comité consultatif externe",
  },
  {
    id: "entrepreneur_attitude",
    category: "managerial",
    pattern: "Manque d'esprit entrepreneurial ou attitude non-collaborative",
    frequency: 12,
    total: 60,
    pct: 20,
    severity: "high",
    detection: [
      "Évaluer l'engagement et l'implication de l'entrepreneur",
      "Vérifier la réactivité aux demandes d'information",
      "Évaluer la stabilité du focus (pas de changement fréquent de direction)",
    ],
    mitigation: "Pre-assessment entrepreneurial, charte de coopération avant le coaching",
  },
  // Communication (50% des projets)
  {
    id: "non_transparent_communication",
    category: "communication",
    pattern: "Communication non-transparente",
    frequency: 26,
    total: 60,
    pct: 43,
    severity: "critical",
    detection: [
      "Vérifier la fréquence et qualité des rapports",
      "Vérifier la cohérence entre les différents documents fournis",
      "Évaluer si les chiffres du BP, plan financier et rapport coach concordent",
    ],
    mitigation: "Équipes locales de suivi, protocoles de communication, visites terrain",
  },
  {
    id: "poor_reporting",
    category: "communication",
    pattern: "Pratiques de reporting insuffisantes",
    frequency: 9,
    total: 60,
    pct: 15,
    severity: "medium",
    detection: [
      "Vérifier si des rapports financiers réguliers sont produits",
      "Vérifier l'utilisation d'outils de reporting structurés",
    ],
    mitigation: "Renforcer les protocoles de reporting, accountability",
  },
  // Business model (27% des projets)
  {
    id: "startup_risk",
    category: "business_model",
    pattern: "Start-up sans historique (<2 ans)",
    frequency: 16,
    total: 60,
    pct: 27,
    severity: "high",
    detection: [
      "Vérifier la date de création de l'entreprise",
      "OVO exige désormais minimum 2 ans d'existence",
      "Évaluer la maturité du business model",
    ],
    mitigation: "Critères de sélection renforcés : entreprise opérationnelle depuis au moins 2 ans",
  },
  {
    id: "contract_dependence",
    category: "business_model",
    pattern: "Dépendance à quelques gros contrats ou subventions",
    frequency: 15,
    total: 60,
    pct: 25,
    severity: "medium",
    detection: [
      "Vérifier la part des 3 plus gros clients dans le CA",
      "Vérifier la dépendance aux subventions/grants",
      "Évaluer la diversification des sources de revenus",
    ],
    mitigation: "Diversification des revenus, alliances stratégiques",
  },
  // External
  {
    id: "currency_risk",
    category: "external",
    pattern: "Risque de change (prêt EUR, revenus en monnaie locale)",
    frequency: null,
    total: 60,
    pct: null,
    severity: "medium",
    detection: [
      "Vérifier la devise du prêt vs la devise opérationnelle",
      "Exemple : Franc rwandais déprécié de >20% depuis juin 2020",
      "Évaluer l'impact de la fluctuation sur la capacité de remboursement",
    ],
    mitigation: "OVO explore la possibilité de prêts en monnaie locale",
  },
  // Coach-related
  {
    id: "coach_disengagement",
    category: "coaching",
    pattern: "Coach désengagé ou au contraire trop impliqué",
    frequency: 16,
    total: 60,
    pct: 27,
    severity: "medium",
    detection: [
      "Vérifier la fréquence des notes de coaching",
      "Vérifier la date du dernier contact coach-entrepreneur",
      "20% des projets : coach a arrêté son implication",
      "Certains coaches imposent leur vision au lieu de guider",
    ],
    mitigation: "Description de rôle claire, Onboarding Facilitator, charte de coopération",
  },
];

// ═══════════════════════════════════════════════════════════════
// COMPLIANCE CHECKLIST — Template OVO (7 sections)
// ═══════════════════════════════════════════════════════════════

export const OVO_COMPLIANCE_SECTIONS = [
  {
    id: "project_description",
    title: "Project Description",
    checks: [
      "Cohérence du plan d'affaires avec la mission et la vision",
      "Qualité du rapport du coach d'affaires (risques internes/externes, mesures d'atténuation)",
      "Justification de l'utilisation du prêt (actifs productifs vs non-productifs)",
      "Alignement entre le montant demandé et les investissements prévus",
    ],
  },
  {
    id: "financial_documentation",
    title: "Financial Documentation",
    checks: [
      "États financiers N-1 fournis et vérifiés",
      "Cohérence des chiffres entre BP, plan financier et rapport coach",
      "Salaires réalistes avec indexation à l'inflation (norme nationale)",
      "Cotisations employeur conformes à la norme nationale (~12% RDC, ~13% Rwanda)",
      "Coûts d'assurance, maintenance, carburant, déplacement inclus",
      "Hypothèses de croissance CA justifiées (contrats, lettres d'intention)",
      "Plan d'investissement détaillé avec devis fournisseurs finaux",
      "Cohérence entre compte de résultat, bilan et plan d'investissement",
      "Rentabilité réaliste (point mort, timeline)",
      "Projections de trésorerie (cash flow forecast)",
    ],
  },
  {
    id: "legal_documentation",
    title: "Legal Documentation",
    checks: [
      "Enregistrement entreprise valide (statuts OHADA ou équivalent)",
      "Nom de l'entreprise cohérent dans tous les documents",
      "Champ d'activité officiel correspond aux activités réelles",
      "Contrats clients et/ou lettres d'intention signés",
      "Contrats fournisseurs principaux",
      "Structure actionnariale documentée et transparente",
      "Permis sectoriels requis (trade license, HACCP, permis sanitaire, permis d'eau)",
      "Pas de prêts existants avec clause de nantissement sur les actifs OVO",
    ],
  },
  {
    id: "intellectual_property",
    title: "Intellectual Property",
    checks: [
      "Brevets, marques ou certifications pertinentes",
      "Licences de production ou de distribution",
    ],
  },
  {
    id: "social_environmental",
    title: "Social & Environmental",
    checks: [
      "Évaluation ODD réalisée avec le canevas OVO actuel",
      "Indicateurs ODD avec baseline et cibles mesurables (SMART)",
      "Preuves documentées pour chaque contribution ODD positive",
      "Salaires >= salaire minimum légal du pays",
      "Plan HACCP avec calendrier de certification (si agroalimentaire)",
      "Protocoles de sécurité au travail (formation, équipements)",
      "Gestion des déchets, de l'eau et de l'énergie documentée",
      "Indicateurs quantitatifs cohérents avec les données financières",
    ],
  },
  {
    id: "hr",
    title: "HR & Other",
    checks: [
      "Plan de développement RH incluant création d'emplois",
      "Indexation annuelle des salaires prévue",
      "Politique de formation et progression professionnelle",
      "Politique RH soutient les objectifs d'emploi décent d'OVO",
    ],
  },
  {
    id: "insurance",
    title: "Insurance Policies",
    checks: [
      "Assurance opérationnelle (équipement, bâtiments)",
      "Assurance responsabilité civile",
      "Plan de risk management documenté",
      "Couverture des investissements financés par OVO",
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// OVO IMPACT FRAMEWORK — 6 focus KPIs + definitions
// Source: OVO Impact Framework v1.2 (March 2026)
// Based on Impact Frontiers / Impact Performance Reporting Norms v1
// ═══════════════════════════════════════════════════════════════

export const OVO_FOCUS_SDGS = [
  { sdg: 1, goal: "No Poverty", ovo_goal: "A Prosperous Africa, based on Inclusive Growth and Sustainable Development" },
  { sdg: 8, goal: "Decent Work and Economic Growth", ovo_goal: "Transformed Economies and Job Creation" },
  { sdg: 12, goal: "Responsible Consumption and Production", ovo_goal: "Environmentally Sustainable and Climate-Resilient Economies" },
  { sdg: 17, goal: "Partnership for the Goals", ovo_goal: "A Strong, United, Resilient, and Influential Global Player and Partner" },
];

export const OVO_IMPACT_KPIS = [
  {
    sdg: 1,
    kpi_code: "decent_jobs_total",
    kpi_name: "Emplois décents créés",
    metric_collected: "Total number of existing decent jobs within each project",
    how_calculated: "Year-on-year comparison to determine absolute job creation and average % increase",
    unit: "emplois",
    category: "emploi",
  },
  {
    sdg: 8,
    kpi_code: "decent_jobs_women",
    kpi_name: "Emplois décents femmes",
    metric_collected: "Total number of existing decent jobs held by women",
    how_calculated: "Year-on-year comparison to track job creation for women and calculate average % increase",
    unit: "emplois",
    category: "genre",
  },
  {
    sdg: 8,
    kpi_code: "decent_jobs_youth",
    kpi_name: "Emplois décents jeunes (16-35 ans)",
    metric_collected: "Total number of existing decent jobs held by youth",
    how_calculated: "Year-on-year comparison to track job creation for youth and calculate average % increase",
    unit: "emplois",
    category: "genre",
  },
  {
    sdg: 8,
    kpi_code: "gross_margin_per_employee",
    kpi_name: "Marge brute par employé",
    metric_collected: "Annual gross margin + total number of existing decent jobs",
    how_calculated: "Annual gross margin ÷ total decent jobs. Compared to national GNP growth rate to assess value creation efficiency",
    unit: "EUR",
    category: "financier",
  },
  {
    sdg: 12,
    kpi_code: "waste_reduction",
    kpi_name: "Déchets éliminés par tonne/service",
    metric_collected: "Annual measure of waste eliminated per kg of product or service",
    how_calculated: "Compare waste elimination ratios year-on-year to show improvements in resource efficiency",
    unit: "kg/tonne",
    category: "environnement",
  },
  {
    sdg: 17,
    kpi_code: "partnerships_taxes",
    kpi_name: "Partenariats + impôts + cotisations sociales",
    metric_collected: "Active partnerships via OVO network + annual corporate income taxes + social contributions",
    how_calculated: "Compare baseline to current: net growth in partnerships + total contribution to public revenue",
    unit: "EUR",
    category: "gouvernance",
  },
];

// Overall KPI: Sustainable growth post-financing
export const OVO_OVERALL_KPI = {
  kpi_code: "sustainable_growth_post_financing",
  kpi_name: "% des PME avec croissance durable post-financement",
  description: "Percentage of SMEs sustaining growth more than 2 years post-financing",
  how_measured: "Year-on-year growth of total decent jobs + year-on-year growth of gross margin per employed person",
  qualification_criteria: "SME qualifies if, for both years post-financing, (1) the job growth rate exceeds the national GNP growth rate, AND (2) the gross margin per employee growth rate exceeds the national GNP growth rate",
  formula: "(Number of SMEs meeting compliance criteria ÷ Total SMEs financed) × 100",
};

// ILO Decent Job definition used by OVO
export const DECENT_JOB_DEFINITION = {
  source: "ILO (International Labour Organization)",
  criteria: [
    "Employment is formally recognized and productive",
    "Provides a fair income consistent with ILO standards",
    "Wages allow workers to support themselves and their families",
    "Ensures social security coverage and legal contributions",
    "Offers safe and healthy working conditions",
    "Respects fundamental rights at work (freedom of association, non-discrimination)",
  ],
};

// Minimum wages by country (for compliance checking)
export const MINIMUM_WAGES_BY_COUNTRY: Record<string, { currency: string; monthly: number; source: string }> = {
  "Uganda": { currency: "UGX", monthly: 130000, source: "No official minimum wage, de facto ~130,000 UGX" },
  "Rwanda": { currency: "RWF", monthly: 100, source: "~100 RWF/day for agriculture (de facto)" },
  "Sénégal": { currency: "XOF", monthly: 58900, source: "SMIG 2024" },
  "Bénin": { currency: "XOF", monthly: 52000, source: "SMIG 2024" },
  "RDC": { currency: "CDF", monthly: 7075, source: "~7,075 CDF/jour (SMIG 2024)" },
  "Côte d'Ivoire": { currency: "XOF", monthly: 75000, source: "SMIG 2024" },
  "Cameroun": { currency: "XAF", monthly: 41875, source: "SMIG 2024" },
  "Mali": { currency: "XOF", monthly: 40000, source: "SMIG 2024" },
  "Burkina Faso": { currency: "XOF", monthly: 34664, source: "SMIG 2024" },
};

// ═══════════════════════════════════════════════════════════════
// IR SCORE DECOMPOSITION — 6 categories (OVO Stumbling Blocks)
// ═══════════════════════════════════════════════════════════════

export const IR_SCORE_CATEGORIES = [
  {
    id: "operational",
    label: "Opérationnel",
    description: "Production, logistique, comptabilité, ventes",
    weight: 20,
    checks: ["technical_issues", "no_accounting", "insufficient_sales", "seasonal_dependence", "licensing_issues"],
  },
  {
    id: "managerial",
    label: "Management",
    description: "Gouvernance, leadership, esprit entrepreneurial",
    weight: 20,
    checks: ["one_man_show", "weak_management", "poor_governance", "entrepreneur_attitude"],
  },
  {
    id: "communication",
    label: "Communication",
    description: "Transparence, reporting, cohérence des documents",
    weight: 10,
    checks: ["non_transparent_communication", "poor_reporting"],
  },
  {
    id: "market",
    label: "Marché",
    description: "Concurrence, régulation, segment",
    weight: 15,
    checks: ["contract_dependence", "startup_risk"],
  },
  {
    id: "financial",
    label: "Financier",
    description: "Rentabilité, trésorerie, structure financière",
    weight: 25,
    checks: [],
  },
  {
    id: "compliance",
    label: "Compliance",
    description: "Conformité légale, ODD, assurances",
    weight: 10,
    checks: [],
  },
];

// ═══════════════════════════════════════════════════════════════
// HELPER: Build prompt context for AI from OVO knowledge
// ═══════════════════════════════════════════════════════════════

export function buildOvoRedFlagsPromptContext(): string {
  const lines = OVO_RED_FLAGS.map(rf =>
    `- ${rf.pattern} (${rf.pct ? rf.pct + '% des projets OVO' : 'risque identifié'}, sévérité: ${rf.severity})\n  Détection: ${rf.detection.join('; ')}`
  );
  return `
=== RED FLAGS OVO (basé sur l'analyse de 60 projets, 2023-2024) ===
${lines.join('\n')}
===
Si tu détectes un de ces patterns dans les données de l'entreprise, signale-le clairement avec le pourcentage de fréquence observée.
`;
}

export function buildOvoCompliancePromptContext(): string {
  const lines = OVO_COMPLIANCE_SECTIONS.map(s =>
    `${s.title}:\n${s.checks.map(c => `  - ${c}`).join('\n')}`
  );
  return `
=== CHECKLIST COMPLIANCE OVO ===
Pour chaque section, vérifie si les données de l'entreprise répondent aux exigences :
${lines.join('\n\n')}
===
Signale les points manquants ou non conformes.
`;
}

export function buildOvoImpactPromptContext(): string {
  const kpiLines = OVO_IMPACT_KPIS.map(k =>
    `- ODD ${k.sdg}: ${k.kpi_name} — Métrique: ${k.metric_collected}`
  );
  return `
=== IMPACT FRAMEWORK OVO (Impact Frontiers) ===
KPIs prioritaires à évaluer :
${kpiLines.join('\n')}

Définition "emploi décent" (ILO) : ${DECENT_JOB_DEFINITION.criteria.join('; ')}

KPI global : ${OVO_OVERALL_KPI.kpi_name}
${OVO_OVERALL_KPI.description}
===
`;
}
