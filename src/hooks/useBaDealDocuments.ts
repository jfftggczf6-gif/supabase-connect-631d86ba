// src/hooks/useBaDealDocuments.ts
// Charge les documents d'un mandat BA + parse helper + matching checklist.
// Réutilise la table pe_deal_documents (partagée PE/BA).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseFile, type DocumentCategory } from '@/lib/document-parser';
import {
  matchChecklist, computeQuality,
  type BaDealDocument, type ChecklistMatch, type DossierQuality,
  type ExpectedDocument,
} from '@/types/upload-documents-ba';

interface State {
  documents: BaDealDocument[];
  checklist: ChecklistMatch[];
  quality: DossierQuality;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBaDealDocuments(
  dealId: string | undefined,
  expectedRequirements?: ExpectedDocument[],
): State {
  const [documents, setDocuments] = useState<BaDealDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('pe_deal_documents')
        .select('id, filename, storage_path, mime_type, size_bytes, category, parse_quality, parse_error, chars_extracted, created_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (qErr) throw qErr;
      setDocuments(((data || []) as any[]).map(d => ({
        id: d.id,
        filename: d.filename,
        storage_path: d.storage_path,
        mime_type: d.mime_type ?? null,
        size_bytes: d.size_bytes ?? null,
        category: (d.category ?? null) as DocumentCategory | null,
        parse_quality: d.parse_quality ?? null,
        parse_error: d.parse_error ?? null,
        chars_extracted: d.chars_extracted ?? null,
        created_at: d.created_at,
      })));
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement documents');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const checklist = matchChecklist(documents, expectedRequirements);
  const quality = computeQuality(checklist);

  return { documents, checklist, quality, loading, error, reload: load };
}

/**
 * Nettoie le texte extrait avant insertion en base.
 * PostgreSQL ne peut PAS stocker l'octet nul (erreur « unsupported Unicode
 * escape sequence »), fréquent dans le texte extrait de certains PDF. On retire le
 * NUL et les autres caractères de contrôle C0, en gardant tabulation/retours ligne.
 */
function sanitizeExtractedText(txt: string | null | undefined): string | null {
  if (txt == null) return null;
  // eslint-disable-next-line no-control-regex
  return txt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/** Upload + parse + insert un fichier. Retourne le row inséré ou throw. */
export async function uploadAndParseBaDocument(
  file: File,
  dealId: string,
  organizationId: string,
): Promise<BaDealDocument> {
  // 1. Upload Storage
  const path = `${organizationId}/${dealId}/${Date.now()}_${file.name}`;
  const { error: upErr } = await supabase.storage
    .from('pe_deal_docs')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw new Error(`Upload échoué : ${upErr.message}`);

  // 2. Parse Railway (catégorie + qualité auto)
  let parsed: Awaited<ReturnType<typeof parseFile>> | null = null;
  let parseError: string | null = null;
  try {
    parsed = await parseFile(file);
  } catch (e: any) {
    parseError = e?.message ?? 'Parsing échoué';
  }

  // 3. Insert pe_deal_documents
  const { data: row, error: insErr } = await supabase
    .from('pe_deal_documents')
    .insert({
      deal_id: dealId,
      organization_id: organizationId,
      filename: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      category: parsed?.category ?? 'autre',
      parse_quality: parsed?.quality ?? (parseError ? 'failed' : null),
      parse_error: parseError,
      chars_extracted: parsed?.charsExtracted ?? null,
      content_extracted: sanitizeExtractedText(parsed?.content),
    })
    .select('id, filename, storage_path, mime_type, size_bytes, category, parse_quality, parse_error, chars_extracted, created_at')
    .single();
  if (insErr) throw new Error(`Insert DB échoué : ${insErr.message}`);

  return {
    id: (row as any).id,
    filename: (row as any).filename,
    storage_path: (row as any).storage_path,
    mime_type: (row as any).mime_type ?? null,
    size_bytes: (row as any).size_bytes ?? null,
    category: (row as any).category ?? null,
    parse_quality: (row as any).parse_quality ?? null,
    parse_error: (row as any).parse_error ?? null,
    chars_extracted: (row as any).chars_extracted ?? null,
    created_at: (row as any).created_at,
  };
}
