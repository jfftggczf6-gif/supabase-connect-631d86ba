// src/types/notes-ba.ts
// Types pour notes_rdv_ba (Ordre 8.5). Réutilise pe_deal_notes (DB existant).

export type NoteInputType = 'note' | 'rdv' | 'appel';

export interface BaDealNote {
  id: string;
  deal_id: string;
  organization_id: string;
  author_id: string;
  author_role: string | null;
  input_type: NoteInputType;
  titre: string | null;
  date_rdv: string | null;          // ISO
  raw_content: string;
  resume_ia: string | null;
  /** Corrections détectées par IA, ex: [{ section: '§8', text: 'CA est 2.3Mrd pas 1.8Mrd' }] */
  infos_extraites: NoteCorrection[] | null;
  /** IDs des corrections déjà appliquées : ['c-1', 'c-2'] */
  corrections_applied: string[] | null;
  created_at: string;
  author_name?: string | null;     // jointure profiles
}

export interface NoteCorrection {
  id: string;                       // stable, ex: 'c-{timestamp}-{rand}'
  /** Code section IM concernée : '§8', '§3', ... */
  section_code: string;
  section_title: string;
  /** Description courte de la correction proposée. */
  description: string;
}

export interface NewNoteInput {
  input_type: NoteInputType;
  titre: string;
  date_rdv: string | null;
  raw_content: string;
}

export const NOTE_TYPE_META: Record<NoteInputType, { label: string; icon: string; color: string }> = {
  note:  { label: 'Note',  icon: '📝', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  rdv:   { label: 'RDV',   icon: '🤝', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  appel: { label: 'Appel', icon: '📞', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};
