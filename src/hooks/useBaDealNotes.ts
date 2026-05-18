// src/hooks/useBaDealNotes.ts
// Load + create + analyze notes RDV d'un mandat BA.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  BaDealNote, NewNoteInput, NoteCorrection,
} from '@/types/notes-ba';

interface State {
  notes: BaDealNote[];
  loading: boolean;
  creating: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createNote: (input: NewNoteInput) => Promise<BaDealNote | null>;
  markCorrectionApplied: (noteId: string, correctionId: string) => Promise<boolean>;
}

function normalizeCorrections(raw: unknown): NoteCorrection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c, i) => ({
    id: (c as any).id || `c-${Date.now()}-${i}`,
    section_code: (c as any).section_code || (c as any).section || `§${i + 1}`,
    section_title: (c as any).section_title || 'Section IM',
    description: (c as any).description || (c as any).text || (typeof c === 'string' ? c : 'Correction'),
  }));
}

export function useBaDealNotes(
  dealId: string | undefined,
  organizationId: string | undefined,
  currentUserId: string | undefined,
): State {
  const [notes, setNotes] = useState<BaDealNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('pe_deal_notes')
        .select('id, deal_id, organization_id, author_id, author_role, input_type, titre, date_rdv, raw_content, resume_ia, infos_extraites, corrections_applied, created_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (qErr) throw qErr;

      // Jointure profiles best effort
      const authorIds = [...new Set(((data || []) as any[]).map(n => n.author_id).filter(Boolean))];
      const authorMap = new Map<string, string>();
      if (authorIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', authorIds);
        for (const p of (profs || []) as any[]) {
          if (p.full_name) authorMap.set(p.user_id, p.full_name);
        }
      }

      setNotes(((data || []) as any[]).map(n => ({
        id: n.id,
        deal_id: n.deal_id,
        organization_id: n.organization_id,
        author_id: n.author_id,
        author_role: n.author_role ?? null,
        input_type: (n.input_type as any) || 'note',
        titre: n.titre ?? null,
        date_rdv: n.date_rdv ?? null,
        raw_content: n.raw_content,
        resume_ia: n.resume_ia ?? null,
        infos_extraites: normalizeCorrections(n.infos_extraites),
        corrections_applied: Array.isArray(n.corrections_applied) ? n.corrections_applied : [],
        created_at: n.created_at,
        author_name: authorMap.get(n.author_id) ?? null,
      })));
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement notes');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const createNote: State['createNote'] = useCallback(async (input) => {
    if (!dealId || !organizationId || !currentUserId) return null;
    if (input.raw_content.trim().length < 10) {
      setError('Contenu trop court (10 caractères minimum)');
      return null;
    }
    setCreating(true);
    setError(null);
    try {
      // 1. Insert
      const { data: created, error: insErr } = await supabase
        .from('pe_deal_notes')
        .insert({
          deal_id: dealId,
          organization_id: organizationId,
          author_id: currentUserId,
          input_type: input.input_type,
          titre: input.titre || null,
          date_rdv: input.date_rdv || null,
          raw_content: input.raw_content,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      const noteId = (created as any).id;

      // 2. Analyse IA (best effort - on remplit infos_extraites)
      try {
        const { data: ai, error: aiErr } = await supabase.functions.invoke('analyze-pe-deal-note', {
          body: {
            raw_content: input.raw_content,
            date_rdv: input.date_rdv,
            deal_id: dealId,
            tone: 'ba', // hook BA → ton vendeur (mandant à séduire)
          },
        });
        if (!aiErr && ai && !(ai as any).error) {
          const corrections = normalizeCorrections((ai as any).corrections);
          await supabase
            .from('pe_deal_notes')
            .update({
              resume_ia: (ai as any).resume ?? null,
              titre: input.titre || (ai as any).titre || null,
              infos_extraites: corrections,
            })
            .eq('id', noteId);
        }
      } catch (e) {
        // Analyse échouée → on garde la note brute, pas d'erreur fatale
        console.warn('[notes-ba] analyse IA échouée', e);
      }

      await load();
      return notes.find(n => n.id === noteId) ?? null;
    } catch (e: any) {
      setError(e?.message ?? 'Erreur création note');
      return null;
    } finally {
      setCreating(false);
    }
  }, [dealId, organizationId, currentUserId, load, notes]);

  const markCorrectionApplied: State['markCorrectionApplied'] = useCallback(async (noteId, correctionId) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return false;
    const applied = note.corrections_applied ?? [];
    if (applied.includes(correctionId)) return true;
    const next = [...applied, correctionId];
    const { error: upErr } = await supabase
      .from('pe_deal_notes')
      .update({ corrections_applied: next })
      .eq('id', noteId);
    if (upErr) {
      setError(upErr.message);
      return false;
    }
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, corrections_applied: next } : n));
    return true;
  }, [notes]);

  return { notes, loading, creating, error, reload: load, createNote, markCorrectionApplied };
}
