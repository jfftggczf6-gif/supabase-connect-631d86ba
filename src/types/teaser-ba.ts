// src/types/teaser-ba.ts
// Types pour la feature generate_teaser BA — wireframe wireframe_teaser_ba.html.
//
// Stockage : table deliverables (type='onepager', data jsonb) + validation_status.
// La structure 8 sections est conservée dans data.teaser_payload.

export type TeaserStatus = 'draft' | 'pending_validation' | 'validated';

export interface TeaserWarning {
  id: string;
  /** Type détecté : 'geographique' | 'client' | 'CA' | 'identite' | etc. */
  type: string;
  /** Texte court humanisé (ex: "Zone géographique trop précise") */
  label: string;
  /** Snippet original du teaser */
  detail: string;
  /** Suggestion de remplacement IA */
  suggestion: string;
  /** Section concernée (1-8). */
  section_num?: number;
}

/** 8 sections du teaser (wireframe wireframe_teaser_ba.html). */
export interface TeaserSection1Presentation {
  secteur: string;
  geographie: string;
  creation: string;       // ex: "2008 (18 ans)"
  effectifs: string;
  ticket: string;          // ex: "8 — 12 M USD"
  operation: string;       // ex: "Cession majoritaire"
}

export interface TeaserSection2Resume {
  paragraphs: string[];    // 1-3 paragraphes anonymisés avec hl markers
}

export interface TeaserSection3Marche {
  taille_marche: string;   // ex: "~5 Mrd USD"
  croissance: string;      // ex: "+8-10% / an"
  position: string;        // ex: "Top 3"
  narrative: string;       // texte explicatif
}

export interface TeaserSection4Equipe {
  dirigeant: string;       // anonymisé : "Fondateur, 15+ ans"
  direction: string;       // ex: "5 cadres clés"
  effectif: string;        // ex: "~250 pers."
  narrative: string;
}

export interface TeaserSection5Finances {
  ca_n: string;
  croissance_3y: string;
  marge_ebitda: string;
  ebitda_n: string;
  table: { label: string; values: string[]; delta?: string }[];
  years: string[];         // ex: ["2023", "2024", "2025", "Δ"]
}

export interface TeaserSection6EquityStory {
  /** 6 points équité avec icône check */
  points: { title: string; description: string }[];
}

export interface TeaserSection7ESG {
  items: { icon: string; label: string; description: string }[];
  odd_tags: string[];      // ex: ['ODD 3', 'ODD 8', 'ODD 9']
  has_ifc_ps: boolean;
}

export interface TeaserSection8Adequation {
  /** 6 critères avec status ok/warning */
  criteria: { label: string; value: string; status: 'ok' | 'warning' }[];
  /** Score 0-100 */
  score_pct: number;
  /** ex: "5/6 critères remplis" */
  score_label: string;
}

export interface TeaserPayload {
  code_name: string;        // ex: "PROJET BAOBAB"
  cover: {
    confidentiel: string;   // ex: "Confidentiel — Cissé Advisory"
    type: string;           // ex: "Teaser — Opportunité d'investissement"
    tags: string[];         // ex: ["Santé / Pharmaceutique", "Afrique de l'Ouest", "8 — 12 M USD", "Cession majoritaire"]
  };
  sections: {
    presentation: TeaserSection1Presentation;
    resume: TeaserSection2Resume;
    marche: TeaserSection3Marche;
    equipe: TeaserSection4Equipe;
    finances: TeaserSection5Finances;
    equity_story: TeaserSection6EquityStory;
    esg: TeaserSection7ESG;
    adequation: TeaserSection8Adequation;
  };
  warnings: TeaserWarning[];
  /** IDs des sections IM utilisées */
  source_section_codes: string[];
  /** Comparaison IM↔Teaser pour transparence */
  comparison: { im_original: string; teaser_anonymise: string }[];
  /** Watermark unique destinataire */
  watermark_id?: string;
}

export interface TeaserVersion {
  id: string;
  version_label: string;   // ex: "v2 — 16 mai"
  created_at: string;
  is_current: boolean;
}

export interface TeaserDistribution {
  fund_name: string;
  status: 'sent' | 'pending' | 'declined';
  sent_at: string | null;
}

export interface TeaserRow {
  id: string;
  enterprise_id: string;
  deal_id: string | null;
  payload: TeaserPayload | null;
  status: TeaserStatus;
  version_label: string;
  created_at: string;
  /** Versions précédentes (depuis deliverable_versions). */
  versions?: TeaserVersion[];
  /** Distribution par fonds (depuis pe_deal_history ou table custom). */
  distribution?: TeaserDistribution[];
}

/** 10 noms de code projet pour anonymisation. */
export const CODE_NAMES = [
  'ALPHA', 'BAOBAB', 'CARAVAN', 'DELTA', 'EBENE',
  'FIRENZA', 'GAÏA', 'HORIZON', 'IRIS', 'JALOUSIE',
] as const;

export function pickCodeName(): string {
  return `PROJET ${CODE_NAMES[Math.floor(Math.random() * CODE_NAMES.length)]}`;
}
