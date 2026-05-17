// src/types/upload-documents-ba.ts
// Types pour la feature upload_documents BA (Ordre 7).
// Checklist V1 hardcodée — la rendre configurable dans organization_presets
// est une évolution future (parametres_ba).

import type { DocumentCategory } from '@/lib/document-parser';

export type DocumentParseStatus = 'pending_upload' | 'uploading' | 'parsing' | 'parsed' | 'error';

/** Row pe_deal_documents enrichie pour l'UI BA. */
export interface BaDealDocument {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: DocumentCategory | null;
  /** Quality du parsing Railway (high/medium/low/failed). */
  parse_quality: 'high' | 'medium' | 'low' | 'failed' | null;
  /** Erreur si parsing failed. */
  parse_error: string | null;
  /** Caractères extraits (pour affichage compact). */
  chars_extracted: number | null;
  created_at: string;
}

/** Item de la checklist attendue. */
export interface ExpectedDocument {
  /** Identifiant stable, sert au match avec BaDealDocument. */
  code: string;
  label: string;
  /** Catégorie attendue (matching auto par doc.category). */
  expectedCategory: DocumentCategory;
  /** Optionnel : patterns regex sur le filename pour disambiguer (ex: N vs N-1). */
  filenamePatterns?: RegExp[];
  /** Required : compte dans le score qualité dossier. */
  required: boolean;
  /** Description courte affichée. */
  hint?: string;
}

/** Checklist V1 hardcodée — 7 documents requis pour un mandat BA standard. */
export const EXPECTED_DOCUMENTS_V1: ExpectedDocument[] = [
  {
    code: 'liasse_n',
    label: 'Liasses fiscales N',
    expectedCategory: 'etats_financiers',
    filenamePatterns: [/liasse.*[\s_-]?(20\d{2}|n[^\-])/i, /etats?.*financiers?.*(20\d{2}|n[^\-])/i],
    required: true,
    hint: 'Année courante',
  },
  {
    code: 'liasse_n1',
    label: 'Liasses fiscales N-1',
    expectedCategory: 'etats_financiers',
    filenamePatterns: [/liasse.*n[\-_]?1/i, /etats?.*financiers?.*n[\-_]?1/i],
    required: true,
    hint: 'Année précédente',
  },
  {
    code: 'liasse_n2',
    label: 'Liasses fiscales N-2',
    expectedCategory: 'etats_financiers',
    filenamePatterns: [/liasse.*n[\-_]?2/i, /etats?.*financiers?.*n[\-_]?2/i],
    required: true,
    hint: '2 ans avant',
  },
  {
    code: 'releves_bancaires',
    label: 'Relevés bancaires 12 mois',
    expectedCategory: 'releve_bancaire',
    required: true,
    hint: 'Sur les 12 derniers mois',
  },
  {
    code: 'statuts_rccm',
    label: 'Statuts + RCCM',
    expectedCategory: 'document_legal',
    filenamePatterns: [/statuts?/i, /rccm/i],
    required: true,
  },
  {
    code: 'quittances_fiscales',
    label: 'Quittances fiscales',
    expectedCategory: 'document_legal',
    filenamePatterns: [/quittance/i, /fisc/i, /(impot|dgi)/i],
    required: true,
  },
  {
    code: 'pitch_deck',
    label: 'Pitch deck + CV dirigeants',
    expectedCategory: 'business_plan',
    filenamePatterns: [/pitch/i, /presentation/i, /deck/i, /cv/i],
    required: true,
  },
];

/** Résultat du matching auto : chaque expectedDoc → liste de BaDealDocument matchés. */
export interface ChecklistMatch {
  expected: ExpectedDocument;
  matched: BaDealDocument[];
  /** received = matched.length > 0 */
  received: boolean;
}

/** Score qualité dossier (brief #9). */
export interface DossierQuality {
  received: number;
  expected: number;
  /** 0-100. */
  pct: number;
  /** Liste des docs manquants pour rappel mandant. */
  missing: ExpectedDocument[];
}

/** Calcule le matching checklist depuis la liste des docs uploadés. */
export function matchChecklist(
  docs: BaDealDocument[],
  expected: ExpectedDocument[] = EXPECTED_DOCUMENTS_V1,
): ChecklistMatch[] {
  return expected.map(exp => {
    const matched = docs.filter(d => {
      if (d.category !== exp.expectedCategory) return false;
      if (!exp.filenamePatterns?.length) return true;
      return exp.filenamePatterns.some(p => p.test(d.filename));
    });
    return { expected: exp, matched, received: matched.length > 0 };
  });
}

/** Calcule le score qualité dossier. */
export function computeQuality(checklist: ChecklistMatch[]): DossierQuality {
  const required = checklist.filter(c => c.expected.required);
  const received = required.filter(c => c.received).length;
  const expected = required.length;
  return {
    received,
    expected,
    pct: expected > 0 ? Math.round((received / expected) * 100) : 0,
    missing: required.filter(c => !c.received).map(c => c.expected),
  };
}
