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
  /** Discriminant BA. ATTENTION : DB default = 'appel_candidatures',
   *  donc on doit passer explicitement type='banque_affaires' au create. */
  type: 'banque_affaires';
  // Note pause : submit-candidature refuse les status 'completed' et 'lost'.
  // Pour V1, "pause" mappe vers status='lost' (réversible via toggle UI).
}

// ─── Candidature (vue UI Partner) ─────────────────────────────────
/** Statuts UI alignés brief. Mapping DB via DB_TO_UI_STATUS.
 *  Note : 'converted' (brief) n'existe PAS en DB — on track la conversion
 *  via la présence d'un pe_deals lié à la candidature (jointure côté UI). */
export type CandidatureStatus = 'new' | 'reviewing' | 'accepted' | 'rejected';

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

/** Statut DB tel que stocké dans candidatures.status.
 *  CHECK constraint : received | in_review | pre_selected | rejected | selected | waitlisted */
export type CandidatureStatusDb =
  | 'received'
  | 'in_review'
  | 'pre_selected'
  | 'rejected'
  | 'selected'
  | 'waitlisted';

export interface ListCandidaturesInput {
  programme_id: string;
  status?: CandidatureStatusDb;
  search?: string;
}

/** Body update-candidature (action='change_status'). L'EF supporte aussi
 *  l'action 'bulk_status' via candidature_ids[] + new_status. */
export interface UpdateCandidatureInput {
  candidature_id: string;
  action: 'change_status';
  new_status: CandidatureStatusDb;
}

// ─── Mapping bidirectionnel statut DB ↔ UI ────────────────────────
export const DB_TO_UI_STATUS: Record<CandidatureStatusDb, CandidatureStatus> = {
  received: 'new',
  in_review: 'reviewing',
  pre_selected: 'reviewing',  // sémantique proche, brief n'utilise pas la nuance
  waitlisted: 'reviewing',
  selected: 'accepted',
  rejected: 'rejected',
};

export const UI_TO_DB_STATUS: Record<CandidatureStatus, CandidatureStatusDb> = {
  new: 'received',
  reviewing: 'in_review',
  accepted: 'selected',
  rejected: 'rejected',
};

// ─── Labels d'affichage ───────────────────────────────────────────
export const STATUS_LABEL: Record<CandidatureStatus, string> = {
  new: 'Nouvelle',
  reviewing: 'En revue',
  accepted: 'Acceptée',
  rejected: 'Refusée',
};

/** Badge optionnel à afficher quand un mandat a déjà été créé à partir
 *  de la candidature (jointure pe_deals.candidature_id côté UI). */
export const CONVERTED_BADGE_LABEL = 'Convertie';

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
