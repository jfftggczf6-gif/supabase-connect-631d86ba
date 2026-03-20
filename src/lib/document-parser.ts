/**
 * ESONO Document Parser — Client module
 * Sends files to the Python parsing micro-service.
 * No client-side parsing — everything is handled server-side
 * with pymupdf, openpyxl, python-docx, python-pptx, Tesseract.
 */

export type DocumentCategory =
  | 'etats_financiers'
  | 'releve_bancaire'
  | 'facture'
  | 'budget_previsionnel'
  | 'business_plan'
  | 'document_legal'
  | 'rapport_activite'
  | 'organigramme_rh'
  | 'photo_installation'
  | 'autre';

export interface ParsedDocument {
  fileName: string;
  content: string;
  method: string;
  category: DocumentCategory;
  quality: 'high' | 'medium' | 'low' | 'failed';
  summary: string;
  sizeBytes: number;
  pages?: number;
  sheets?: number;
  slides?: number;
  tablesFound?: number;
  charsExtracted: number;
}

export interface ParsingReport {
  parsed_at: string;
  total_files: number;
  files_parsed_ok: number;
  files_failed: number;
  total_chars_extracted: number;
  files: {
    fileName: string;
    sizeBytes: number;
    method: string;
    category: DocumentCategory;
    quality: string;
    charsExtracted: number;
    pages?: number;
    sheets?: number;
    slides?: number;
    tablesFound?: number;
    summary: string;
  }[];
}

const PARSER_URL = import.meta.env.VITE_PARSER_URL || 'http://localhost:8000';
const PARSER_API_KEY = import.meta.env.VITE_PARSER_API_KEY || 'esono-parser-dev-key';

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  etats_financiers: 'États financiers',
  releve_bancaire: 'Relevé bancaire',
  facture: 'Facture',
  budget_previsionnel: 'Budget prévisionnel',
  business_plan: 'Business plan',
  document_legal: 'Document légal',
  rapport_activite: "Rapport d'activité",
  organigramme_rh: 'Organigramme / RH',
  photo_installation: 'Photo / Installation',
  autre: 'Autre',
};

export { CATEGORY_LABELS };

/**
 * Parse a single file by sending it to the Python micro-service.
 * Each call takes 1-15 seconds depending on file size and type.
 */
export async function parseFile(file: File): Promise<ParsedDocument> {
  const base: Partial<ParsedDocument> = {
    fileName: file.name,
    sizeBytes: file.size,
  };

  try {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000); // 2 min timeout per file

    const response = await fetch(`${PARSER_URL}/parse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PARSER_API_KEY}`,
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Erreur serveur' }));
      throw new Error(err.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      ...base,
      content: data.content || '',
      method: data.method || 'unknown',
      category: (data.category || 'autre') as DocumentCategory,
      quality: data.quality || 'failed',
      summary: data.summary || 'Erreur',
      pages: data.pages,
      sheets: data.sheets,
      slides: data.slides,
      tablesFound: data.tables_found,
      charsExtracted: data.chars_extracted || 0,
    } as ParsedDocument;

  } catch (err: any) {
    console.error(`[parser] Error parsing ${file.name}:`, err);

    const isTimeout = err.name === 'AbortError';
    return {
      ...base,
      content: `[Erreur: ${isTimeout ? 'Timeout' : err.message}]`,
      method: 'error',
      category: 'autre' as DocumentCategory,
      quality: 'failed',
      summary: isTimeout ? 'Timeout — fichier trop lourd ou serveur indisponible' : `Erreur: ${err.message}`,
      charsExtracted: 0,
    } as ParsedDocument;
  }
}

/**
 * Build the combined document content from all parsed files.
 * Sorts by category priority (financial docs first) then by quality.
 */
export function buildDocumentContent(docs: ParsedDocument[]): string {
  const MAX_TOTAL = 300_000;

  const categoryOrder: string[] = [
    'etats_financiers',
    'releve_bancaire',
    'budget_previsionnel',
    'facture',
    'business_plan',
    'rapport_activite',
    'document_legal',
    'organigramme_rh',
    'photo_installation',
    'autre',
  ];

  const sorted = [...docs].sort((a, b) => {
    const idxA = categoryOrder.indexOf(a.category || 'autre');
    const idxB = categoryOrder.indexOf(b.category || 'autre');
    if (idxA !== idxB) return idxA - idxB;
    const qualOrder: Record<string, number> = { high: 0, medium: 1, low: 2, failed: 3 };
    return (qualOrder[a.quality] || 3) - (qualOrder[b.quality] || 3);
  });

  let content = '';
  for (const doc of sorted) {
    if (content.length >= MAX_TOTAL) break;
    if (!doc.content || doc.content.length < 10) continue;

    const catLabel = doc.category !== 'autre' ? ` [${doc.category.toUpperCase()}]` : '';
    const header = `\n\n══════ ${doc.fileName}${catLabel} (${doc.method}) ══════\n`;
    const remaining = MAX_TOTAL - content.length - header.length;
    if (remaining <= 0) break;
    content += header + doc.content.substring(0, remaining);
  }

  return content;
}

/**
 * Build a parsing report for persistence and UI display.
 */
export function buildParsingReport(docs: ParsedDocument[], totalChars: number): ParsingReport {
  return {
    parsed_at: new Date().toISOString(),
    total_files: docs.length,
    files_parsed_ok: docs.filter(d => d.quality !== 'failed').length,
    files_failed: docs.filter(d => d.quality === 'failed').length,
    total_chars_extracted: totalChars,
    files: docs.map(d => ({
      fileName: d.fileName,
      sizeBytes: d.sizeBytes,
      method: d.method,
      category: d.category,
      quality: d.quality,
      charsExtracted: d.charsExtracted,
      pages: d.pages,
      sheets: d.sheets,
      slides: d.slides,
      tablesFound: d.tablesFound,
      summary: d.summary,
    })),
  };
}
