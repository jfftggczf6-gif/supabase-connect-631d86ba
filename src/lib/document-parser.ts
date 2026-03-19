import mammoth from 'mammoth';
import * as XLSX from 'xlsx-js-style';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
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
  method: 'client_docx' | 'client_xlsx' | 'client_csv' | 'client_txt' | 'client_pdf_text' | 'client_pptx' | 'needs_vision';
  sizeBytes: number;
  pagesOrSheets?: number;
  extractionQuality: 'high' | 'medium' | 'low' | 'failed';
  summary: string;
  category: DocumentCategory;
}

export interface ParsingReport {
  parsed_at: string;
  total_files: number;
  files_parsed_ok: number;
  files_need_vision: number;
  files_failed: number;
  total_chars_extracted: number;
  files: {
    fileName: string;
    sizeBytes: number;
    method: string;
    category: DocumentCategory;
    extractionQuality: string;
    charsExtracted: number;
    pagesOrSheets?: number;
    summary: string;
  }[];
}

const MAX_CHARS_PER_FILE = 40_000;

// ═══════════════════════════════════════════════════════════════
// CLASSIFICATION AUTOMATIQUE
// ═══════════════════════════════════════════════════════════════
function classifyDocument(fileName: string, content: string): DocumentCategory {
  const name = fileName.toLowerCase();
  const text = content.toLowerCase().substring(0, 3000);

  // Par nom de fichier
  if (/bilan|compte.?r[eé]sultat|[eé]tats?.financ|syscohada|annexe.?compt/i.test(name)) return 'etats_financiers';
  if (/relev[eé]|bancaire|banque|bni|sgbci|ecobank|bceao/i.test(name)) return 'releve_bancaire';
  if (/facture|invoice|devis|bon.?commande/i.test(name)) return 'facture';
  if (/budget|pr[eé]vision|tr[eé]sorerie|forecast|plan.?financ/i.test(name)) return 'budget_previsionnel';
  if (/business.?plan|bp|plan.?affaire|[eé]tude.?march/i.test(name)) return 'business_plan';
  if (/statut|rccm|registre|commerce|attestation|fiscal|immatricul/i.test(name)) return 'document_legal';
  if (/rapport|activit[eé]|annual|annuel/i.test(name)) return 'rapport_activite';
  if (/organi|rh|personnel|emploi|poste/i.test(name)) return 'organigramme_rh';

  // Par contenu
  if (/total.?actif|total.?passif|capitaux.?propres|immobilisation|fonds.?propres/i.test(text)) return 'etats_financiers';
  if (/solde|d[eé]bit|cr[eé]dit|virement|pr[eé]l[eè]vement|ch[eè]que/i.test(text)) return 'releve_bancaire';
  if (/montant.?ht|montant.?ttc|tva|facture.?n|bon.?de/i.test(text)) return 'facture';
  if (/pr[eé]visionnel|projection|hypoth[eè]se|sc[eé]nario|optimiste|pessimiste/i.test(text)) return 'budget_previsionnel';
  if (/proposition.?valeur|segment|canvas|march[eé].?cible|concurrent/i.test(text)) return 'business_plan';
  if (/article|associ[eé]|g[eé]rant|capital.?social|si[eè]ge.?social/i.test(text)) return 'document_legal';

  // Par extension pour les images
  if (/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(name)) return 'photo_installation';

  return 'autre';
}

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

// ═══════════════════════════════════════════════════════════════
// PDF — Extraction avec fallback en cascade
// ═══════════════════════════════════════════════════════════════
async function parsePdf(file: File): Promise<{ text: string; pages: number; method: string } | null> {
  // MÉTHODE 1 : PDF.js (texte structuré)
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const totalPages = pdf.numPages;
    let fullText = '';
    const maxPages = Math.min(totalPages, 50);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as any[];
      let pageText = '';
      let lastY = -1;

      for (const item of items) {
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 3) {
          pageText += '\n';
        }
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) < 2 && item.transform[4] > 50) {
          pageText += ' | ';
        }
        pageText += item.str;
        if (item.hasEOL) pageText += '\n';
        lastY = item.transform[5];
      }

      fullText += `\n--- Page ${i}/${totalPages} ---\n${pageText.trim()}\n`;
    }

    if (maxPages < totalPages) {
      fullText += `\n[... ${totalPages - maxPages} pages supplémentaires non lues]\n`;
    }

    const cleanText = fullText.replace(/\s+/g, ' ').trim();
    if (cleanText.length > 100) {
      return { text: fullText.substring(0, MAX_CHARS_PER_FILE), pages: totalPages, method: 'pdfjs' };
    }
  } catch (err) {
    console.warn('[PDF] PDF.js failed for', file.name, '— trying fallback');
  }

  // MÉTHODE 2 : Lecture brute (PDFs simples non compressés)
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 512 * 1024));

    let text = '';
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder('iso-8859-1').decode(bytes);
    }

    const readable = text
      .replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, ' ')
      .replace(/\s{3,}/g, '\n')
      .trim();

    if (readable.length > 300) {
      return { text: readable.substring(0, MAX_CHARS_PER_FILE), pages: 0, method: 'raw_text' };
    }
  } catch (err) {
    console.warn('[PDF] Raw text fallback failed for', file.name);
  }

  // MÉTHODE 3 : Rien n'a marché → Vision requise
  return null;
}

// ═══════════════════════════════════════════════════════════════
// DOCX — Extraction avec mammoth (texte + tableaux en HTML)
// ═══════════════════════════════════════════════════════════════
async function parseDocx(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const html = htmlResult.value;

    let text = html
      .replace(/<table[^>]*>/gi, '\n┌─── TABLEAU ───\n')
      .replace(/<\/table>/gi, '\n└─── FIN TABLEAU ───\n')
      .replace(/<tr[^>]*>/gi, '│ ')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<th[^>]*>(.*?)<\/th>/gi, '[$1] | ')
      .replace(/<td[^>]*>(.*?)<\/td>/gi, '$1 | ')
      .replace(/<li[^>]*>/gi, '  • ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n═══ $1 ═══\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n── $1 ──\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n─ $1 ─\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '_$1_')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/  +/g, ' ')
      .trim();

    if (text.length < 50) {
      const rawResult = await mammoth.extractRawText({ arrayBuffer: buffer });
      text = rawResult.value;
    }

    return text.substring(0, MAX_CHARS_PER_FILE);
  } catch (err) {
    console.warn('DOCX parsing failed for', file.name, ':', err);
    return `[Erreur de lecture du document Word: ${file.name}]`;
  }
}

// ═══════════════════════════════════════════════════════════════
// XLSX — Extraction avancée (cellules mergées, feuilles cachées, 300 lignes)
// ═══════════════════════════════════════════════════════════════
async function parseXlsx(file: File): Promise<{ text: string; sheets: number }> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      cellFormula: false,
      cellStyles: false,
      sheetStubs: true,
    });

    let text = '';
    const sheetCount = workbook.SheetNames.length;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet['!ref']) {
        text += `\n[Feuille "${sheetName}": vide]\n`;
        continue;
      }

      const range = XLSX.utils.decode_range(sheet['!ref']);
      const rows = range.e.r - range.s.r + 1;
      const cols = range.e.c - range.s.c + 1;

      const sheetInfo = (workbook as any).Workbook?.Sheets?.find((s: any) => s.name === sheetName);
      const isHidden = sheetInfo?.Hidden === 1 || sheetInfo?.Hidden === 2;
      const hiddenLabel = isHidden ? ' [CACHÉE]' : '';

      text += `\n┌═══ Feuille: "${sheetName}"${hiddenLabel} (${rows}×${cols}) ═══\n`;

      const merges = sheet['!merges'] || [];
      if (merges.length > 0) {
        text += `│ [${merges.length} cellules fusionnées]\n`;
      }

      const jsonData = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
        rawNumbers: false,
      }) as any[][];

      let prevWasEmpty = false;
      for (let r = 0; r < Math.min(jsonData.length, 300); r++) {
        const row = jsonData[r];
        if (!row) continue;

        const isEmpty = row.every((c: any) => c === '' || c === null || c === undefined);
        if (isEmpty) {
          if (!prevWasEmpty) text += '│\n';
          prevWasEmpty = true;
          continue;
        }
        prevWasEmpty = false;

        const cells = row.map((cell: any) => {
          if (cell === null || cell === undefined || cell === '') return '—';
          if (cell instanceof Date) return cell.toLocaleDateString('fr-FR');
          if (typeof cell === 'number') {
            return new Intl.NumberFormat('fr-FR', {
              maximumFractionDigits: 2,
              minimumFractionDigits: cell % 1 !== 0 ? 2 : 0,
            }).format(cell);
          }
          return String(cell).trim().substring(0, 200);
        });

        if (r === 0) {
          text += `│ [${cells.join('] | [')}]\n`;
          text += `│ ${'─'.repeat(Math.min(cells.join(' | ').length, 80))}\n`;
        } else {
          text += `│ ${cells.join(' | ')}\n`;
        }
      }

      if (jsonData.length > 300) {
        text += `│ [... ${jsonData.length - 300} lignes supplémentaires]\n`;
      }

      text += `└═══ Fin "${sheetName}" ═══\n`;
    }

    return { text: text.substring(0, MAX_CHARS_PER_FILE), sheets: sheetCount };
  } catch (err) {
    console.error('XLSX parsing error:', err);
    return { text: `[Erreur Excel: ${file.name} — ${err instanceof Error ? err.message : 'format non reconnu'}]`, sheets: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// CSV/TSV — Détection d'encodage (Windows-1252 pour SAGE/SAARI)
// ═══════════════════════════════════════════════════════════════
async function parseCsv(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    let text = '';
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      try {
        text = new TextDecoder('windows-1252').decode(buffer);
      } catch {
        text = new TextDecoder('iso-8859-1').decode(buffer);
      }
    }

    const firstLines = text.split('\n').slice(0, 5).join('\n');
    const semicolons = (firstLines.match(/;/g) || []).length;
    const commas = (firstLines.match(/,/g) || []).length;
    const tabs = (firstLines.match(/\t/g) || []).length;

    let sep = ',';
    if (semicolons > commas && semicolons > tabs) sep = ';';
    if (tabs > commas && tabs > semicolons) sep = '\t';

    const lines = text.split('\n').filter(l => l.trim());
    let formatted = `[Séparateur: "${sep === ';' ? 'point-virgule' : sep === '\t' ? 'tabulation' : 'virgule'}"]\n`;

    for (let i = 0; i < Math.min(lines.length, 500); i++) {
      const cells = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
      if (i === 0) {
        formatted += `[${cells.join('] | [')}]\n${'─'.repeat(60)}\n`;
      } else {
        formatted += `${cells.join(' | ')}\n`;
      }
    }

    if (lines.length > 500) {
      formatted += `\n[... ${lines.length - 500} lignes supplémentaires]\n`;
    }

    return formatted.substring(0, MAX_CHARS_PER_FILE);
  } catch (err) {
    return `[Erreur de lecture CSV: ${file.name} — ${err}]`;
  }
}

// ═══════════════════════════════════════════════════════════════
// TXT/MD — Détection d'encodage
// ═══════════════════════════════════════════════════════════════
async function parseText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    try {
      text = new TextDecoder('windows-1252').decode(buffer);
    } catch {
      text = new TextDecoder('iso-8859-1').decode(buffer);
    }
  }
  return text.substring(0, MAX_CHARS_PER_FILE);
}

// ═══════════════════════════════════════════════════════════════
// FUNCTION PRINCIPALE — Parse un fichier et retourne le résultat
// ═══════════════════════════════════════════════════════════════
export async function parseFile(file: File): Promise<ParsedDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const base = { fileName: file.name, sizeBytes: file.size };

  try {
    // ── PDF ──
    if (ext === 'pdf') {
      const result = await parsePdf(file);
      if (result && result.text.trim().length > 100) {
        const quality = result.text.length > 1000 ? 'high' : 'medium';
        const category = classifyDocument(file.name, result.text);
        return {
          ...base, content: result.text, method: 'client_pdf_text',
          pagesOrSheets: result.pages, extractionQuality: quality, category,
          summary: `PDF ${result.pages > 0 ? `${result.pages} pages` : ''} (${result.method}) — ${result.text.length} car.`
        };
      }
      return {
        ...base, content: '', method: 'needs_vision',
        extractionQuality: 'low', category: classifyDocument(file.name, ''),
        summary: 'PDF scanné — OCR Vision requis'
      };
    }

    // ── DOCX ──
    if (ext === 'docx' || ext === 'doc') {
      const content = await parseDocx(file);
      const quality = content.length > 500 ? 'high' : content.length > 100 ? 'medium' : 'low';
      const category = classifyDocument(file.name, content);
      return {
        ...base, content, method: 'client_docx',
        extractionQuality: quality, category,
        summary: `Word — ${content.length} car., ${content.includes('TABLEAU') ? 'tableaux détectés' : 'texte'}`
      };
    }

    // ── XLSX ──
    if (ext === 'xlsx' || ext === 'xls') {
      const result = await parseXlsx(file);
      const quality = result.text.length > 500 ? 'high' : result.text.length > 100 ? 'medium' : 'low';
      const category = classifyDocument(file.name, result.text);
      return {
        ...base, content: result.text, method: 'client_xlsx',
        pagesOrSheets: result.sheets, extractionQuality: quality, category,
        summary: `Excel ${result.sheets} feuilles — ${result.text.length} car.`
      };
    }

    // ── CSV/TSV ──
    if (ext === 'csv' || ext === 'tsv') {
      const content = await parseCsv(file);
      const category = classifyDocument(file.name, content);
      return {
        ...base, content, method: 'client_csv',
        extractionQuality: content.length > 100 ? 'high' : 'low', category,
        summary: `CSV — ${content.split('\n').length} lignes`
      };
    }

    // ── TXT/MD ──
    if (ext === 'txt' || ext === 'md') {
      const content = await parseText(file);
      const category = classifyDocument(file.name, content);
      return {
        ...base, content, method: 'client_txt',
        extractionQuality: content.length > 50 ? 'high' : 'low', category,
        summary: `Texte — ${content.length} car.`
      };
    }

    // ── Images ──
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'].includes(ext)) {
      return {
        ...base, content: '', method: 'needs_vision',
        extractionQuality: 'low', category: classifyDocument(file.name, ''),
        summary: 'Image — OCR Vision requis'
      };
    }

    // ── PPTX ──
    if (ext === 'pptx' || ext === 'ppt') {
      return {
        ...base, content: '', method: 'needs_vision',
        extractionQuality: 'low', category: 'autre',
        summary: 'PowerPoint — OCR Vision requis'
      };
    }

    // ── Format non supporté ──
    return {
      ...base, content: `[Format non supporté: .${ext}]`, method: 'client_txt',
      extractionQuality: 'failed', category: 'autre',
      summary: `Format .${ext} non supporté`
    };

  } catch (err) {
    console.error(`Erreur parsing ${file.name}:`, err);
    return {
      ...base, content: `[Erreur de lecture: ${file.name}]`, method: 'client_txt',
      extractionQuality: 'failed', category: 'autre',
      summary: `Erreur: ${err instanceof Error ? err.message : 'inconnu'}`
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// CONSTRUIRE LE DOCUMENT CONTENT FINAL (trié par catégorie)
// ═══════════════════════════════════════════════════════════════
export function buildDocumentContent(docs: ParsedDocument[]): string {
  const MAX_TOTAL = 150_000;

  const categoryOrder: DocumentCategory[] = [
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
    const qualOrder = { high: 0, medium: 1, low: 2, failed: 3 };
    return (qualOrder[a.extractionQuality] || 3) - (qualOrder[b.extractionQuality] || 3);
  });

  let content = '';
  for (const doc of sorted) {
    if (content.length >= MAX_TOTAL) break;
    if (!doc.content || doc.content.length < 10) continue;

    const catLabel = doc.category ? ` [${doc.category.toUpperCase()}]` : '';
    const header = `\n\n══════ ${doc.fileName}${catLabel} (${doc.method}) ══════\n`;
    const remaining = MAX_TOTAL - content.length - header.length;
    if (remaining <= 0) break;
    content += header + doc.content.substring(0, remaining);
  }

  return content;
}

// ═══════════════════════════════════════════════════════════════
// CONSTRUIRE LE RAPPORT DE PARSING
// ═══════════════════════════════════════════════════════════════
export function buildParsingReport(docs: ParsedDocument[], totalChars: number): ParsingReport {
  return {
    parsed_at: new Date().toISOString(),
    total_files: docs.length,
    files_parsed_ok: docs.filter(d => d.extractionQuality !== 'failed' && d.method !== 'needs_vision').length,
    files_need_vision: docs.filter(d => d.method === 'needs_vision').length,
    files_failed: docs.filter(d => d.extractionQuality === 'failed').length,
    total_chars_extracted: totalChars,
    files: docs.map(d => ({
      fileName: d.fileName,
      sizeBytes: d.sizeBytes,
      method: d.method,
      category: d.category,
      extractionQuality: d.extractionQuality,
      charsExtracted: d.content.length,
      pagesOrSheets: d.pagesOrSheets,
      summary: d.summary,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════
// FILE TO BASE64 (pour l'envoi au Vision)
// ═══════════════════════════════════════════════════════════════
export function fileToBase64(file: File, maxBytes = 5 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const slice = file.slice(0, maxBytes);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(slice);
  });
}
