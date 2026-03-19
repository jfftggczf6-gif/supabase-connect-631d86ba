import mammoth from 'mammoth';
import * as XLSX from 'xlsx-js-style';

export interface ParsedDocument {
  fileName: string;
  content: string;
  method: 'client_docx' | 'client_xlsx' | 'client_csv' | 'client_txt' | 'client_pdf_text' | 'needs_vision';
  sizeBytes: number;
}

const MAX_CHARS_PER_FILE = 25_000;

async function parseDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.substring(0, MAX_CHARS_PER_FILE);
}

async function parseXlsx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  let text = '';
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' });
    text += `\n[Feuille: ${sheetName}]\n${csv}\n`;
  }
  return text.substring(0, MAX_CHARS_PER_FILE);
}

async function parseText(file: File): Promise<string> {
  const text = await file.text();
  return text.substring(0, MAX_CHARS_PER_FILE);
}

async function tryParsePdfText(file: File): Promise<string | null> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 256 * 1024));
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

  const readable = text.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim();
  const ratio = readable.length / Math.max(text.length, 1);

  if (readable.length > 500 && ratio > 0.15) {
    return readable.substring(0, MAX_CHARS_PER_FILE);
  }

  return null;
}

export async function parseFile(file: File): Promise<ParsedDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const base: Omit<ParsedDocument, 'content' | 'method'> = {
    fileName: file.name,
    sizeBytes: file.size,
  };

  try {
    if (ext === 'docx' || ext === 'doc') {
      const content = await parseDocx(file);
      return { ...base, content, method: 'client_docx' };
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const content = await parseXlsx(file);
      return { ...base, content, method: 'client_xlsx' };
    }

    if (ext === 'csv' || ext === 'tsv') {
      const content = await parseText(file);
      return { ...base, content, method: 'client_csv' };
    }

    if (ext === 'txt' || ext === 'md') {
      const content = await parseText(file);
      return { ...base, content, method: 'client_txt' };
    }

    if (ext === 'pdf') {
      const pdfText = await tryParsePdfText(file);
      if (pdfText) {
        return { ...base, content: pdfText, method: 'client_pdf_text' };
      }
      return { ...base, content: '', method: 'needs_vision' };
    }

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'].includes(ext)) {
      return { ...base, content: '', method: 'needs_vision' };
    }

    return { ...base, content: `[Format non supporté: ${ext}]`, method: 'client_txt' };
  } catch (err) {
    console.warn(`Erreur parsing ${file.name}:`, err);
    return { ...base, content: `[Erreur de lecture: ${file.name}]`, method: 'client_txt' };
  }
}

export function buildDocumentContent(docs: ParsedDocument[]): string {
  const MAX_TOTAL = 120_000;
  let content = '';

  for (const doc of docs) {
    if (content.length >= MAX_TOTAL) break;
    if (!doc.content || doc.content.length < 10) continue;

    const header = `\n\n--- ${doc.fileName} (${doc.method}) ---\n`;
    const remaining = MAX_TOTAL - content.length - header.length;
    if (remaining <= 0) break;

    content += header + doc.content.substring(0, remaining);
  }

  return content;
}

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
