// src/types/candidature-ba.ts
// Types pour la feature candidature_ba (Partner only).
//
// Back 100% existant : tables programmes + candidatures + 9 EFs Programme.
// Spécificité BA : programmes.type = 'banque_affaires' (vs 'programme').
//
// EFs réutilisées : manage-programme, get-programme-form, submit-candidature,
//                   list-candidatures, screen-candidatures, get-candidature-detail,
//                   update-candidature, extract-form-fields, extract-programme-criteria.

// ─── Form config (programmes.form_fields jsonb) ─────────────────────
export type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'select' | 'date';

export interface FormField {
  /** id local (Date.now() pour les nouveaux champs ajoutés côté UI). */
  id: string | number;
  label: string;
  type: FieldType;
  required: boolean;
  /** Si type='select' : liste des options. */
  options?: string[];
}

export interface FormConfig {
  title: string;
  description: string;
  startDate: string | null;     // ISO
  endDate: string | null;
  fields: FormField[];
}

// ─── Programme BA (sous-ensemble row programmes) ─────────────────────
export type ProgrammeRunStatus = 'draft' | 'in_progress' | 'paused' | 'completed' | 'lost';

export interface BaProgramme {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  /** Slug URL public : /candidature/{form_slug} */
  form_slug: string;
  form_fields: FormField[];
  start_date: string | null;
  end_date: string | null;
  status: ProgrammeRunStatus;
  /** Discriminant BA. */
  type: 'banque_affaires';
}

// ─── Candidature (vue UI Partner) ─────────────────────────────────
/** Statuts UI alignés brief. Mapping DB via DB_TO_UI_STATUS. */
export type CandidatureStatus = 'new' | 'reviewing' | 'accepted' | 'rejected' | 'converted';

export interface CandidatureRow {
  id: string;
  programme_id: string;
  organization_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  /** Réponses brutes au formulaire (clés = field.label ou field.id). */
  form_data: Record<string, unknown>;
  status: CandidatureStatus;
  /** 0-100, calculé par screen-candidatures (IA). */
  screening_score: number | null;
  screening_data: ScreeningData | null;
  created_at: string;
  // Champs dérivés de form_data (extraction côté UI pour affichage tableau).
  sector: string | null;
  country: string | null;
  ticket: string | null;
}

// ─── Pré-screening IA (5 critères du wireframe) ────────────────────
export interface ScreeningCriterion {
  label: string;
  ok: boolean;
}

export interface ScreeningData {
  score: number;
  criteria: ScreeningCriterion[];
  /** Optionnel : classification globale renvoyée par l'EF. */
  classification?: string;
}

// ─── KPI header (4 compteurs brief #9) ─────────────────────────────
export interface CandidatureCounts {
  new: number;
  reviewing: number;
  accepted: number;
  rejected: number;
}

// ─── Bodies EFs Programme réutilisées ──────────────────────────────
export interface SubmitCandidatureInput {
  programme_slug: string;
  company_name: string;
  contact_name?: string;
  contact_email: string;
  contact_phone?: string;
  form_data: Record<string, unknown>;
}

/** Statut DB tel que stocké dans candidatures.status. */
export type CandidatureStatusDb =
  | 'received'
  | 'pre_selected'
  | 'selected'
  | 'rejected'
  | 'converted';

export interface ListCandidaturesInput {
  programme_id: string;
  status?: CandidatureStatusDb;
  search?: string;
}

export interface UpdateCandidatureInput {
  candidature_id: string;
  status: CandidatureStatusDb;
}

// ─── Mapping bidirectionnel statut DB ↔ UI ────────────────────────
export const DB_TO_UI_STATUS: Record<CandidatureStatusDb, CandidatureStatus> = {
  received: 'new',
  pre_selected: 'reviewing',
  selected: 'accepted',
  rejected: 'rejected',
  converted: 'converted',
};

export const UI_TO_DB_STATUS: Record<CandidatureStatus, CandidatureStatusDb> = {
  new: 'received',
  reviewing: 'pre_selected',
  accepted: 'selected',
  rejected: 'rejected',
  converted: 'converted',
};

// ─── Labels d'affichage ───────────────────────────────────────────
export const STATUS_LABEL: Record<CandidatureStatus, string> = {
  new: 'Nouvelle',
  reviewing: 'En revue',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  converted: 'Convertie',
};

/** 10 champs par défaut (brief #5) — seedés à la création d'un programme BA. */
export const DEFAULT_FORM_FIELDS: FormField[] = [
  { id: 1, label: 'Raison sociale', type: 'text', required: true },
  { id: 2, label: "Pays d'opération", type: 'select', required: true,
    options: ["Côte d'Ivoire", 'Sénégal', 'Burkina Faso', 'Togo', 'Mali', 'Guinée', 'Bénin', 'Niger'] },
  { id: 3, label: "Secteur d'activité", type: 'select', required: true,
    options: ['Pharma', 'Agro', 'Énergie', 'Transport', 'FinTech', 'Diagnostic', 'EdTech', 'Food', 'IT', 'Santé'] },
  { id: 4, label: "Description de l'activité", type: 'textarea', required: true },
  { id: 5, label: 'Année de création', type: 'number', required: true },
  { id: 6, label: "Chiffre d'affaires 2025 (USD)", type: 'number', required: true },
  { id: 7, label: 'Ticket recherché (M USD)', type: 'text', required: true },
  { id: 8, label: 'Référent / Contact', type: 'text', required: true },
  { id: 9, label: 'Email de contact', type: 'email', required: true },
  { id: 10, label: 'Téléphone', type: 'text', required: false },
];
