// Mandat360Section — Vue 360° compacte du mandat BA (brief #32).
// Résume en 1 page : pré-screening + IM + valorisation + teaser + pipeline + timeline.
// Inspiré de PeOverviewHub mais simplifié pour le métier BA.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, FileSearch, FileText, Calculator, Eye, Send,
  TrendingUp, Clock, ArrowRight, CheckCircle2, AlertCircle,
} from 'lucide-react';

interface Props {
  dealId: string;
  onSelectItem?: (section: string) => void;
}

interface Snapshot {
  preScreening: { score: number | null; classification: string | null; redFlags: number; generatedAt: string | null } | null;
  memo: { filled: number; total: number; validated: number; lastUpdate: string | null; financials: { ca: any; ebitda: any; margin: any } | null } | null;
  valuation: { weighted_ev: any; pre_money: any; methods: string[]; currency: string | null } | null;
  teaser: { code_name: string | null; warnings: number; distribution: number } | null;
  funnel: { matched: number; teaser_sent: number; interested: number; nda: number; ioi: number; loi: number };
  bestIoi: { fund_name: string | null; amount: any; currency: string | null; structure: string | null } | null;
  timeline: { kind: 'history' | 'note' | 'outreach'; label: string; date: string }[];
  stage: string | null;
}

const STAGE_BADGES: Record<string, { label: string; cls: string }> = {
  recus:    { label: 'Reçus',       cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  im:       { label: 'IM produit',  cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  interets: { label: 'Intérêts',    cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  nego:     { label: 'Négociation', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  close:    { label: 'Closé',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  lost:     { label: 'Perdu',       cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

function fmtNum(n: any, currency = ''): string {
  if (n == null || isNaN(Number(n))) return '—';
  const num = Number(n);
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M ${currency}`.trim();
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(0)}K ${currency}`.trim();
  return `${num.toLocaleString('fr-FR')} ${currency}`.trim();
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d === 0) return "aujourd'hui";
  if (d === 1) return 'hier';
  if (d < 30) return `il y a ${d}j`;
  if (d < 365) return `il y a ${Math.floor(d / 30)}m`;
  return `il y a ${Math.floor(d / 365)}a`;
}

export default function Mandat360Section({ dealId, onSelectItem }: Props) {
  const [loading, setLoading] = useState(true);
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Parallèle : deal + memo + valuation + teaser + outreach + history
      const [dealR, memoR, valR, teaserR, outR, histR] = await Promise.all([
        supabase.from('pe_deals').select('stage').eq('id', dealId).maybeSingle(),
        supabase.from('investment_memos').select('id').eq('deal_id', dealId).maybeSingle(),
        supabase.from('pe_valuation').select('synthesis, currency, status').eq('deal_id', dealId).maybeSingle(),
        supabase.from('deliverables').select('data, updated_at').eq('enterprise_id', '00000000-0000-0000-0000-000000000000').eq('type', 'teaser_anonymise').maybeSingle(), // placeholder
        supabase.from('pe_fund_outreach').select('status, ioi_amount, ioi_currency, ioi_structure, funding_program_id').eq('deal_id', dealId),
        supabase.from('pe_deal_history').select('to_stage, from_stage, created_at').eq('deal_id', dealId).order('created_at', { ascending: false }).limit(10),
      ]);

      const stage = (dealR.data as any)?.stage ?? null;

      // Memo snapshot
      let memo: Snapshot['memo'] = null;
      if (memoR.data) {
        const { data: vers } = await supabase
          .from('memo_versions')
          .select('id, overall_score, classification, memo_sections(content_md, content_json, status, section_code, updated_at)')
          .eq('memo_id', (memoR.data as any).id)
          .neq('status', 'rejected')
          .order('created_at', { ascending: false })
          .limit(1);
        const latest = vers?.[0] as any;
        if (latest?.memo_sections) {
          const sections = latest.memo_sections as any[];
          const filled = sections.filter(s => s.content_md || (s.content_json && Object.keys(s.content_json).length > 0)).length;
          const validated = sections.filter(s => s.status === 'validated').length;
          // Financials extract depuis section financials_pnl
          const pnl = sections.find(s => s.section_code === 'financials_pnl');
          const cj = pnl?.content_json ?? {};
          const ca = cj.ca?.value ?? cj.chiffre_affaires ?? null;
          const ebitda = cj.ebitda?.value ?? cj.ebitda ?? null;
          const margin = cj.marge_ebitda?.value ?? cj.marge_ebitda_pct ?? null;
          const lastUpdate = sections.reduce((max: string | null, s: any) => {
            if (!s.updated_at) return max;
            return !max || s.updated_at > max ? s.updated_at : max;
          }, null as string | null);
          memo = { filled, total: sections.length || 12, validated, lastUpdate, financials: { ca, ebitda, margin } };
        }
      }

      // PréScreening (lit la version stage='pre_screening')
      let preScreening: Snapshot['preScreening'] = null;
      if (memoR.data) {
        const { data: psVers } = await supabase
          .from('memo_versions')
          .select('overall_score, classification, generated_at, memo_sections(content_json)')
          .eq('memo_id', (memoR.data as any).id)
          .eq('stage', 'pre_screening')
          .order('created_at', { ascending: false })
          .limit(1);
        const ps = psVers?.[0] as any;
        if (ps) {
          // Count red flags depuis memo_sections (varie selon agent)
          const sections = ps.memo_sections as any[];
          let redFlags = 0;
          sections.forEach(s => {
            const cj = s.content_json ?? {};
            const flags = cj.red_flags ?? cj.flags ?? cj.alerts ?? [];
            if (Array.isArray(flags)) redFlags += flags.length;
          });
          preScreening = {
            score: ps.overall_score ?? null,
            classification: ps.classification ?? null,
            redFlags,
            generatedAt: ps.generated_at ?? null,
          };
        }
      }

      // Valuation
      let valuation: Snapshot['valuation'] = null;
      const v = (valR.data as any);
      if (v?.status === 'ready' || v?.status === 'validated') {
        const syn = v.synthesis ?? {};
        const weights = syn.weights ?? {};
        const methods: string[] = [];
        if (weights.dcf > 0) methods.push('DCF');
        if (weights.multiples > 0) methods.push('Multiples');
        if (weights.ancc > 0) methods.push('ANCC');
        valuation = {
          weighted_ev: syn.weighted_ev,
          pre_money: syn.pre_money_recommended,
          methods,
          currency: v.currency,
        };
      }

      // Teaser depuis deliverables (jointure via enterprise_id du deal — refetch)
      let teaserData: Snapshot['teaser'] = null;
      const { data: dealFull } = await supabase
        .from('pe_deals').select('enterprise_id').eq('id', dealId).maybeSingle();
      const entId = (dealFull as any)?.enterprise_id;
      if (entId) {
        const { data: td } = await supabase
          .from('deliverables')
          .select('data')
          .eq('enterprise_id', entId)
          .eq('type', 'teaser_anonymise')
          .maybeSingle();
        const payload = (td as any)?.data ?? null;
        if (payload) {
          teaserData = {
            code_name: payload.code_name ?? null,
            warnings: Array.isArray(payload.warnings) ? payload.warnings.length : 0,
            distribution: 0, // sera enrichi par funnel
          };
        }
      }

      // Funnel + best IOI
      const outreach = (outR.data ?? []) as any[];
      const funnel = {
        matched: outreach.filter(o => ['matched','teaser_sent','interested','nda_pending','nda_signed','im_shared','meeting_held','ioi_received','loi_signed','closed'].includes(o.status)).length,
        teaser_sent: outreach.filter(o => ['teaser_sent','interested','nda_pending','nda_signed','im_shared','meeting_held','ioi_received','loi_signed','closed'].includes(o.status)).length,
        interested: outreach.filter(o => ['interested','nda_pending','nda_signed','im_shared','meeting_held','ioi_received','loi_signed','closed'].includes(o.status)).length,
        nda: outreach.filter(o => ['nda_signed','im_shared','meeting_held','ioi_received','loi_signed','closed'].includes(o.status)).length,
        ioi: outreach.filter(o => ['ioi_received','loi_signed','closed'].includes(o.status)).length,
        loi: outreach.filter(o => ['loi_signed','closed'].includes(o.status)).length,
      };
      if (teaserData) teaserData.distribution = funnel.teaser_sent;

      // Best IOI
      let bestIoi: Snapshot['bestIoi'] = null;
      const iois = outreach.filter(o => o.ioi_amount).sort((a, b) => Number(b.ioi_amount) - Number(a.ioi_amount));
      if (iois.length > 0) {
        const top = iois[0];
        const { data: fund } = await supabase
          .from('funding_programs').select('name').eq('id', top.funding_program_id).maybeSingle();
        bestIoi = {
          fund_name: (fund as any)?.name ?? null,
          amount: top.ioi_amount,
          currency: top.ioi_currency ?? 'USD',
          structure: top.ioi_structure ?? null,
        };
      }

      // Timeline depuis pe_deal_history
      const timeline: Snapshot['timeline'] = ((histR.data ?? []) as any[]).map(h => ({
        kind: 'history' as const,
        label: `Transition ${h.from_stage ?? '—'} → ${h.to_stage}`,
        date: h.created_at,
      }));

      if (!cancelled) {
        setSnap({ preScreening, memo, valuation, teaser: teaserData, funnel, bestIoi, timeline, stage });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!snap) return null;

  const stageMeta = snap.stage ? STAGE_BADGES[snap.stage] : null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header — stage + score global */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Vue 360° du mandat</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Tout le mandat en un coup d'œil</p>
        </div>
        {stageMeta && (
          <Badge variant="outline" className={`text-xs ${stageMeta.cls}`}>
            Stage : {stageMeta.label}
          </Badge>
        )}
      </div>

      {/* 5 Cards en grille 2x3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* PRÉ-SCREENING */}
        <Card className="hover:shadow-md transition cursor-pointer" onClick={() => onSelectItem?.('pre_screening')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-blue-100 flex items-center justify-center">
                  <FileSearch className="h-4 w-4 text-blue-700" />
                </div>
                <h3 className="text-sm font-semibold">Pré-screening</h3>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {snap.preScreening ? (
              <div className="space-y-1">
                {snap.preScreening.score != null && (
                  <div className="text-2xl font-bold text-blue-700">{snap.preScreening.score}/100</div>
                )}
                {snap.preScreening.classification && (
                  <Badge variant="outline" className="text-[10px]">{snap.preScreening.classification.replace('_', ' ')}</Badge>
                )}
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  {snap.preScreening.redFlags > 0 && (
                    <span className="flex items-center gap-1 text-rose-600">
                      <AlertCircle className="h-3 w-3" />
                      {snap.preScreening.redFlags} red flag{snap.preScreening.redFlags > 1 ? 's' : ''}
                    </span>
                  )}
                  <span>{timeAgo(snap.preScreening.generatedAt)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Non généré</p>
            )}
          </CardContent>
        </Card>

        {/* MEMO IM */}
        <Card className="hover:shadow-md transition cursor-pointer" onClick={() => onSelectItem?.('memo')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-violet-100 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-violet-700" />
                </div>
                <h3 className="text-sm font-semibold">Memo IM</h3>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {snap.memo ? (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-violet-700">
                  {snap.memo.filled}/{snap.memo.total}
                  <span className="text-xs font-normal text-muted-foreground ml-1">sections</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  {snap.memo.validated > 0 && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {snap.memo.validated} validées
                    </span>
                  )}
                  <span className="text-muted-foreground">{timeAgo(snap.memo.lastUpdate)}</span>
                </div>
                {snap.memo.financials?.ca && (
                  <div className="text-[10px] text-muted-foreground mt-1 pt-1 border-t">
                    CA {fmtNum(snap.memo.financials.ca)} {snap.memo.financials.margin ? `· marge ${snap.memo.financials.margin}%` : ''}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Non généré</p>
            )}
          </CardContent>
        </Card>

        {/* VALORISATION */}
        <Card className="hover:shadow-md transition cursor-pointer" onClick={() => onSelectItem?.('valuation')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-emerald-100 flex items-center justify-center">
                  <Calculator className="h-4 w-4 text-emerald-700" />
                </div>
                <h3 className="text-sm font-semibold">Valorisation</h3>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {snap.valuation ? (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-emerald-700">
                  {fmtNum(snap.valuation.weighted_ev, snap.valuation.currency ?? '')}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Pre-money : {fmtNum(snap.valuation.pre_money, snap.valuation.currency ?? '')}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {snap.valuation.methods.map(m => (
                    <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Non générée</p>
            )}
          </CardContent>
        </Card>

        {/* TEASER */}
        <Card className="hover:shadow-md transition cursor-pointer" onClick={() => onSelectItem?.('teaser')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-amber-100 flex items-center justify-center">
                  <Eye className="h-4 w-4 text-amber-700" />
                </div>
                <h3 className="text-sm font-semibold">Teaser</h3>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {snap.teaser ? (
              <div className="space-y-1">
                {snap.teaser.code_name && (
                  <div className="text-base font-bold text-amber-700 tracking-wider">{snap.teaser.code_name}</div>
                )}
                <div className="flex items-center gap-3 text-[11px]">
                  {snap.teaser.warnings > 0 ? (
                    <span className="text-rose-600">{snap.teaser.warnings} warnings</span>
                  ) : (
                    <span className="text-emerald-600">0 warning</span>
                  )}
                  <span className="text-muted-foreground">
                    <Send className="h-3 w-3 inline mr-0.5" />
                    {snap.teaser.distribution} envois
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Non généré</p>
            )}
          </CardContent>
        </Card>

        {/* PIPELINE INVESTISSEURS — funnel mini */}
        <Card className="hover:shadow-md transition cursor-pointer md:col-span-2" onClick={() => onSelectItem?.('fund_matching')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-violet-100 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-violet-700" />
                </div>
                <h3 className="text-sm font-semibold">Pipeline investisseurs</h3>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {([
                ['Matchés', snap.funnel.matched, 'bg-violet-50 text-violet-700 border-violet-200'],
                ['Teaser', snap.funnel.teaser_sent, 'bg-blue-50 text-blue-700 border-blue-200'],
                ['Intéressés', snap.funnel.interested, 'bg-amber-50 text-amber-700 border-amber-200'],
                ['NDA', snap.funnel.nda, 'bg-emerald-50 text-emerald-700 border-emerald-200'],
                ['IOI', snap.funnel.ioi, 'bg-orange-50 text-orange-700 border-orange-200'],
                ['LOI', snap.funnel.loi, 'bg-rose-50 text-rose-700 border-rose-200'],
              ] as [string, number, string][]).map(([label, count, cls]) => (
                <div key={label} className={`rounded-md p-2 text-center border ${cls}`}>
                  <div className="text-xl font-bold">{count}</div>
                  <div className="text-[9px] uppercase tracking-wider mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {snap.bestIoi && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Meilleure offre :</span>
                <span className="font-semibold">
                  {snap.bestIoi.fund_name ?? '—'} · {fmtNum(snap.bestIoi.amount, snap.bestIoi.currency ?? '')}
                  {snap.bestIoi.structure && <span className="text-muted-foreground ml-2">({snap.bestIoi.structure})</span>}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TIMELINE — événements clés du mandat */}
      {snap.timeline.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Timeline événements</h3>
              <Badge variant="outline" className="text-[10px]">{snap.timeline.length} dernier{snap.timeline.length > 1 ? 's' : ''}</Badge>
            </div>
            <div className="space-y-1.5">
              {snap.timeline.slice(0, 8).map((event, i) => (
                <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-violet-200 pl-3 py-1">
                  <div className="flex-1">
                    <div className="text-foreground">{event.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(event.date).toLocaleDateString('fr-FR')} · {timeAgo(event.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state si tout vide */}
      {!snap.preScreening && !snap.memo && !snap.valuation && !snap.teaser && snap.funnel.matched === 0 && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <Eye className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-sm font-semibold mb-1">Mandat à initialiser</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Uploadez des documents et lancez les générations IA pour voir la Vue 360°.
            </p>
            <Button size="sm" onClick={() => onSelectItem?.('upload_documents')}>
              Aller à Upload documents
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
