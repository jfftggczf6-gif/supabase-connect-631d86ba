// usePeGenerationStatus — Hook de suivi live des générations IA d'un deal PE.
//
// S'abonne en Realtime aux 3 tables qui changent pendant les générations :
//   - memo_versions  → status (generating | ready | rejected) + error_message
//   - memo_sections  → content_md / content_json se remplissent au fur et à mesure
//   - pe_valuation   → status (generating | ready | error)
//
// Avec un fallback polling toutes les 4 secondes pour le cas où Realtime
// échoue silencieusement (CORS, quota, etc.).
//
// Retourne un état consolidé pour piloter l'UI :
//   - currentStep        : étape de génération en cours (ou null)
//   - sectionsFilled     : sections du memo dont content_md est non vide
//   - sectionsTotal      : total des sections attendues (12 pour memo IC)
//   - errorMessage       : message d'erreur si la génération a échoué
//   - lastUpdated        : timestamp de la dernière update reçue

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SECTION_ORDER = [
  'executive_summary', 'shareholding_governance', 'top_management', 'services',
  'competition_market', 'unit_economics', 'financials_pnl', 'financials_balance',
  'investment_thesis', 'support_requested', 'esg_risks', 'annexes',
];

export type GenerationStep =
  | 'pre_screening'
  | 'memo_ic1'
  | 'memo_ic_finale'
  | 'valuation'
  | 'idle';

export interface PeGenerationStatus {
  isGenerating: boolean;
  currentStep: GenerationStep;
  /** Sections remplies (content_md ou content_json non vide). */
  sectionsFilled: Set<string>;
  /** Sections totales attendues (= 12 pour le memo). */
  sectionsTotal: number;
  /** Pourcentage de progression (0-100). */
  progressPct: number;
  /** Stage de la version active (pre_screening / note_ic1 / note_ic_finale). */
  versionStage: string | null;
  /** Status valuation (generating / ready / error / null). */
  valuationStatus: string | null;
  /** Message d'erreur si génération échouée. */
  errorMessage: string | null;
  /** Timestamp de la dernière update (ms). */
  lastUpdated: number;
  /** Force un refresh immédiat depuis la DB (utile au bouton "Régénérer"). */
  refresh: () => void;
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_DURATION_MS = 15 * 60 * 1000; // 15 min de polling max

export function usePeGenerationStatus(dealId: string | null): PeGenerationStatus {
  const [memoVersion, setMemoVersion] = useState<any>(null);
  const [sectionsFilled, setSectionsFilled] = useState<Set<string>>(new Set());
  const [valuation, setValuation] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const memoIdRef = useRef<string | null>(null);

  // ─── Fetch initial state + reload helper ─────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!dealId) return;
    // 1) Memo + dernière version
    const { data: memo } = await supabase
      .from('investment_memos').select('id').eq('deal_id', dealId).maybeSingle();
    memoIdRef.current = memo?.id ?? null;

    if (memo?.id) {
      const { data: vers } = await supabase
        .from('memo_versions')
        .select('id, stage, status, error_message, created_at')
        .eq('memo_id', memo.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const v = vers?.[0] ?? null;
      setMemoVersion(v);

      // Sections de cette version
      if (v?.id) {
        const { data: secs } = await supabase
          .from('memo_sections')
          .select('section_code, content_md, content_json')
          .eq('version_id', v.id);
        const filled = new Set<string>();
        (secs ?? []).forEach((s: any) => {
          const hasMd = s.content_md && String(s.content_md).trim().length > 0;
          const hasJson = s.content_json && Object.keys(s.content_json).length > 0;
          if (hasMd || hasJson) filled.add(s.section_code);
        });
        setSectionsFilled(filled);
      }
    } else {
      setMemoVersion(null);
      setSectionsFilled(new Set());
    }

    // 2) Valuation
    const { data: val } = await supabase
      .from('pe_valuation')
      .select('status, generated_at')
      .eq('deal_id', dealId)
      .maybeSingle();
    setValuation(val);

    setLastUpdated(Date.now());
  }, [dealId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Realtime subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (!dealId) return;

    const channel = supabase
      .channel(`pe-gen-${dealId}`)
      // memo_versions filtré par memo_id (résolu dynamiquement après fetch)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'memo_versions',
      }, (payload) => {
        const row = payload.new as any;
        // On ne s'intéresse qu'aux changements de notre memo
        if (memoIdRef.current && row?.memo_id === memoIdRef.current) {
          setMemoVersion((prev: any) =>
            prev?.id === row.id || !prev || row.created_at > prev.created_at ? row : prev
          );
          setLastUpdated(Date.now());
        }
      })
      // memo_sections : on filtre côté client par version_id
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'memo_sections',
      }, (payload) => {
        const row = payload.new as any;
        if (memoVersion?.id && row?.version_id === memoVersion.id) {
          setSectionsFilled((prev) => {
            const next = new Set(prev);
            const hasMd = row.content_md && String(row.content_md).trim().length > 0;
            const hasJson = row.content_json && Object.keys(row.content_json).length > 0;
            if (hasMd || hasJson) next.add(row.section_code);
            else next.delete(row.section_code);
            return next;
          });
          setLastUpdated(Date.now());
        }
      })
      // pe_valuation
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'pe_valuation',
        filter: `deal_id=eq.${dealId}`,
      }, (payload) => {
        const row = payload.new as any;
        setValuation(row);
        setLastUpdated(Date.now());
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, memoVersion?.id]);

  // ─── Fallback polling pendant les générations ────────────────────────────
  useEffect(() => {
    if (!dealId) return;
    const memoGenerating = memoVersion?.status === 'generating';
    const valGenerating = valuation?.status === 'generating';
    if (!memoGenerating && !valGenerating) return;

    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
        clearInterval(interval);
        return;
      }
      fetchAll();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [dealId, memoVersion?.status, valuation?.status, fetchAll]);

  // ─── État dérivé ─────────────────────────────────────────────────────────
  const memoStatus = memoVersion?.status ?? null;
  const versionStage = memoVersion?.stage ?? null;
  const valuationStatus = valuation?.status ?? null;
  const isGenerating = memoStatus === 'generating' || valuationStatus === 'generating';

  let currentStep: GenerationStep = 'idle';
  if (valuationStatus === 'generating') {
    currentStep = 'valuation';
  } else if (memoStatus === 'generating') {
    if (versionStage === 'pre_screening') currentStep = 'pre_screening';
    else if (versionStage === 'note_ic1') currentStep = 'memo_ic1';
    else if (versionStage === 'note_ic_finale') currentStep = 'memo_ic_finale';
    else currentStep = 'memo_ic1';
  }

  const sectionsTotal = SECTION_ORDER.length;
  const progressPct = sectionsTotal > 0 ? Math.round((sectionsFilled.size / sectionsTotal) * 100) : 0;
  const errorMessage = memoVersion?.status === 'rejected' ? (memoVersion?.error_message ?? null) : null;

  return {
    isGenerating,
    currentStep,
    sectionsFilled,
    sectionsTotal,
    progressPct,
    versionStage,
    valuationStatus,
    errorMessage,
    lastUpdated,
    refresh: fetchAll,
  };
}
