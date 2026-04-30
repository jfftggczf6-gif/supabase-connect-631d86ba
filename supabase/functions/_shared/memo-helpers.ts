// _shared/memo-helpers.ts
// Helpers pour manipuler le living document PE (investment_memos, memo_versions, memo_sections).
// Utilisé par generate-pe-pre-screening et generate-ic1-memo.

export type MemoSectionCode =
  | 'executive_summary'
  | 'shareholding_governance'
  | 'top_management'
  | 'services'
  | 'competition_market'
  | 'unit_economics'
  | 'financials_pnl'
  | 'financials_balance'
  | 'investment_thesis'
  | 'support_requested'
  | 'esg_risks'
  | 'annexes';

export type MemoVersionStatus = 'generating' | 'ready' | 'validated' | 'rejected';

export interface MemoVersionRow {
  id: string;
  memo_id: string;
  parent_version_id: string | null;
  label: string;
  stage: string;
  status: MemoVersionStatus;
  overall_score: number | null;
  classification: string | null;
  error_message: string | null;
  generated_by_agent: string | null;
  generated_by_user_id: string | null;
  generated_at: string | null;
  created_at: string;
}

export interface MemoSectionRow {
  id: string;
  version_id: string;
  section_code: MemoSectionCode;
  title: string | null;
  content_md: string | null;
  content_json: any;
  source_doc_ids: string[];
  position: number;
  created_at: string;
  updated_at: string;
}

// Ordre canonique des 12 sections (correspond au mockup)
export const SECTION_ORDER: MemoSectionCode[] = [
  'executive_summary',
  'shareholding_governance',
  'top_management',
  'services',
  'competition_market',
  'unit_economics',
  'financials_pnl',
  'financials_balance',
  'investment_thesis',
  'support_requested',
  'esg_risks',
  'annexes',
];

/** Crée un investment_memos pour un deal (idempotent : retourne l'id existant si déjà créé). */
export async function ensureInvestmentMemo(
  supabase: any,
  dealId: string,
  userId: string,
): Promise<string> {
  const existing = await supabase
    .from('investment_memos')
    .select('id')
    .eq('deal_id', dealId)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id;

  const { data, error } = await supabase
    .from('investment_memos')
    .insert({ deal_id: dealId, created_by: userId })
    .select('id')
    .single();
  if (error) throw new Error(`ensureInvestmentMemo failed: ${error.message}`);
  return data.id;
}

/** Crée une nouvelle memo_versions row. */
export async function createMemoVersion(
  supabase: any,
  args: {
    memo_id: string;
    label: string;
    parent_version_id?: string | null;
    stage: string;
    status?: MemoVersionStatus;
    overall_score?: number | null;
    classification?: string | null;
    generated_by_agent: string;
    generated_by_user_id?: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from('memo_versions')
    .insert({
      memo_id: args.memo_id,
      label: args.label,
      parent_version_id: args.parent_version_id ?? null,
      stage: args.stage,
      status: args.status ?? 'generating',
      overall_score: args.overall_score ?? null,
      classification: args.classification ?? null,
      generated_by_agent: args.generated_by_agent,
      generated_by_user_id: args.generated_by_user_id ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`createMemoVersion failed: ${error.message}`);
  return data.id;
}

/** Patch d'une version (status, scores, error_message, generated_at). */
export async function updateMemoVersion(
  supabase: any,
  versionId: string,
  patch: Partial<{
    status: MemoVersionStatus;
    overall_score: number | null;
    classification: string | null;
    error_message: string | null;
    generated_at: string;
  }>,
): Promise<void> {
  const { error } = await supabase
    .from('memo_versions')
    .update(patch)
    .eq('id', versionId);
  if (error) throw new Error(`updateMemoVersion failed: ${error.message}`);
}

/** Insère 12 sections d'un coup à partir d'un map {section_code → contenu}. */
export async function insertMemoSections(
  supabase: any,
  versionId: string,
  sections: Partial<Record<MemoSectionCode, {
    content_md?: string | null;
    content_json?: any;
    source_doc_ids?: string[];
    title?: string | null;
  }>>,
): Promise<void> {
  const rows = SECTION_ORDER.map((code, index) => ({
    version_id: versionId,
    section_code: code,
    title: sections[code]?.title ?? null,
    content_md: sections[code]?.content_md ?? null,
    content_json: sections[code]?.content_json ?? null,
    source_doc_ids: sections[code]?.source_doc_ids ?? [],
    position: index,
  }));
  const { error } = await supabase.from('memo_sections').insert(rows);
  if (error) throw new Error(`insertMemoSections failed: ${error.message}`);
}

/** Récupère la dernière version pour un deal sur un stage donné, optionnellement filtrée par status. */
export async function getLatestVersion(
  supabase: any,
  dealId: string,
  stage: string,
  status?: MemoVersionStatus,
): Promise<MemoVersionRow | null> {
  let query = supabase
    .from('memo_versions')
    .select('*, investment_memos!inner(deal_id)')
    .eq('investment_memos.deal_id', dealId)
    .eq('stage', stage)
    .order('created_at', { ascending: false })
    .limit(1);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(`getLatestVersion failed: ${error.message}`);
  return data?.[0] ?? null;
}

/** Récupère les 12 sections d'une version. */
export async function fetchSections(
  supabase: any,
  versionId: string,
): Promise<MemoSectionRow[]> {
  const { data, error } = await supabase
    .from('memo_sections')
    .select('*')
    .eq('version_id', versionId)
    .order('position');
  if (error) throw new Error(`fetchSections failed: ${error.message}`);
  return data ?? [];
}

/** Récupère les documents uploadés d'un deal. */
export async function fetchDealDocuments(
  supabase: any,
  dealId: string,
): Promise<Array<{ id: string; filename: string; storage_path: string; mime_type: string | null }>> {
  const { data, error } = await supabase
    .from('pe_deal_documents')
    .select('id, filename, storage_path, mime_type')
    .eq('deal_id', dealId)
    .order('created_at');
  if (error) throw new Error(`fetchDealDocuments failed: ${error.message}`);
  return data ?? [];
}

/** Détermine le label de version suivant (pre_screening_v1, v2...). */
export async function nextVersionLabel(
  supabase: any,
  memoId: string,
  stage: string,
): Promise<{ label: string; parent_id: string | null }> {
  const { data, error } = await supabase
    .from('memo_versions')
    .select('id, label')
    .eq('memo_id', memoId)
    .eq('stage', stage)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`nextVersionLabel failed: ${error.message}`);
  const count = (data ?? []).length;
  return {
    label: `${stage}_v${count + 1}`,
    parent_id: data?.[0]?.id ?? null,
  };
}
