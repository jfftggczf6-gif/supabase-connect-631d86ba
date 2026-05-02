import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import ScoreCircle from '@/components/dashboard/viewers/atoms/pe/ScoreCircle';
import ClassificationTag from '@/components/dashboard/viewers/atoms/pe/ClassificationTag';
import RedFlagItem from '@/components/dashboard/viewers/atoms/pe/RedFlagItem';

interface Props {
  dealId: string;
}

const SubHeading = ({ children, color }: { children: React.ReactNode; color?: string }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2" style={color ? { color } : undefined}>
    {children}
  </h4>
);

const HINT_COLOR: Record<string, string> = {
  ok: 'var(--pe-ok)',
  warning: 'var(--pe-warning)',
  danger: 'var(--pe-danger)',
  info: 'var(--pe-info)',
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  match:   { bg: 'var(--pe-bg-ok)',      color: 'var(--pe-ok)',      label: 'Match' },
  partial: { bg: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', label: 'Partiel' },
  no:      { bg: 'var(--pe-bg-danger)',  color: 'var(--pe-danger)',  label: 'No-match' },
};

const sevToRedFlag: Record<string, 'high' | 'medium' | 'low'> = {
  Critical: 'high', High: 'high', Medium: 'medium', Low: 'low',
  high: 'high', medium: 'medium', low: 'low',
};

const VERDICT_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  go_direct:       { bg: 'var(--pe-bg-ok)',      border: 'var(--pe-ok)',      color: 'var(--pe-ok)' },
  go_conditionnel: { bg: 'var(--pe-bg-ok)',      border: 'var(--pe-ok)',      color: 'var(--pe-ok)' },
  hold:            { bg: 'var(--pe-bg-warning)', border: 'var(--pe-warning)', color: 'var(--pe-warning)' },
  reject:          { bg: 'var(--pe-bg-danger)',  border: 'var(--pe-danger)',  color: 'var(--pe-danger)' },
};

const LEVEL_BG: Record<string, string> = {
  N0: 'var(--pe-bg-danger)',
  N1: 'var(--pe-bg-warning)',
  N2: 'var(--pe-bg-ok)',
};
const LEVEL_COLOR: Record<string, string> = {
  N0: 'var(--pe-danger)',
  N1: 'var(--pe-warning)',
  N2: 'var(--pe-ok)',
};

const STATUS_ICON_DOC: Record<string, string> = {
  ok: '✓', partial: '⚠', missing: '✗',
};

export default function PreScreening360Dashboard({ dealId }: Props) {
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<any>(null);
  const [sections, setSections] = useState<Record<string, any>>({});
  const [deal, setDeal] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: dealData } = await supabase
        .from('pe_deals')
        .select('id, deal_ref, source, enterprises(name, sector, country), ticket_demande, currency')
        .eq('id', dealId)
        .maybeSingle();
      if (cancelled) return;
      setDeal(dealData);

      const { data: memo } = await supabase
        .from('investment_memos')
        .select('id')
        .eq('deal_id', dealId)
        .maybeSingle();
      if (!memo) { setLoading(false); return; }

      const { data: versions } = await supabase
        .from('memo_versions')
        .select('*')
        .eq('memo_id', memo.id)
        .eq('stage', 'pre_screening')
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(1);
      const v = versions?.[0];
      if (!v) { setLoading(false); return; }
      setVersion(v);

      const { data: secs } = await supabase
        .from('memo_sections')
        .select('*')
        .eq('version_id', v.id);
      const map: Record<string, any> = {};
      (secs ?? []).forEach((s: any) => { map[s.section_code] = s; });
      if (cancelled) return;
      setSections(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> Chargement...</div>;
  }
  if (!version) {
    return <div className="p-8 text-muted-foreground">Aucune version pre_screening disponible. Drop des documents sur la carte du deal pour générer le pré-screening 360°.</div>;
  }

  // Extraction des données depuis les sections concernées
  const execCJ = sections.executive_summary?.content_json ?? {};
  const sharCJ = sections.shareholding_governance?.content_json ?? {};
  const mgmtCJ = sections.top_management?.content_json ?? {};
  const servCJ = sections.services?.content_json ?? {};
  const compCJ = sections.competition_market?.content_json ?? {};
  const pnlCJ = sections.financials_pnl?.content_json ?? {};
  const supCJ = sections.support_requested?.content_json ?? {};
  const thesCJ = sections.investment_thesis?.content_json ?? {};
  const esgCJ = sections.esg_risks?.content_json ?? {};
  const annCJ = sections.annexes?.content_json ?? {};

  // KPIs bandeau (5 premiers du résumé exécutif)
  const kpis: any[] = (execCJ.kpis_bandeau ?? []).slice(0, 5);

  // Activité
  const activite = servCJ.nature_activite ?? servCJ.activite;
  // Actionnariat (top 3)
  const capRows: any[] = sharCJ.cap_table?.rows ?? sharCJ.actionnariat?.items ?? [];
  // Management
  const mgmtRows: any[] = mgmtCJ.equipe_dirigeante?.rows ?? mgmtCJ.management?.items ?? [];

  // Snapshot 3y
  const snap = pnlCJ.pnl_3y ?? pnlCJ.snapshot_3y;
  // Use of proceeds
  const useOfProceeds = supCJ.use_of_proceeds_detailed ?? supCJ.use_of_proceeds;
  // Scenarios
  const scenarios = thesCJ.scenarios_returns;

  // Adéquation thèse
  const thesisMatch = thesCJ.thesis_match;
  // Red flags
  const redFlags: any[] = execCJ.red_flags_synthesis ?? esgCJ.red_flags ?? [];

  // Doc quality (depuis annexes ou legacy)
  const docQuality = annCJ.doc_quality ?? null;
  const inventaire = annCJ.inventaire_documentaire ?? null;

  // Synthèse IA
  const aiSynth = execCJ.ai_synthesis;
  // Benchmark (depuis competition_market ou legacy benchmark)
  const benchmark = compCJ.benchmark ?? compCJ.concurrents;
  // Recommandation
  const reco = execCJ.recommendation ?? thesCJ.recommendation;

  const enterpriseName = (deal?.enterprises as any)?.name ?? deal?.deal_ref;
  const sector = (deal?.enterprises as any)?.sector;
  const country = (deal?.enterprises as any)?.country;

  return (
    <div className="space-y-3 text-sm">
      {/* HEADER */}
      <Card>
        <CardContent className="p-4 flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Pré-screening 360° enrichi</span>
              <ClassificationTag classification={version.classification} />
            </div>
            <div className="text-lg font-medium">{enterpriseName}</div>
            <div className="text-muted-foreground text-xs">
              {sector ?? '—'} · {country ?? '—'}
              {deal?.deal_ref && <> · Deal ref. {deal.deal_ref}</>}
            </div>
          </div>
          <div className="flex gap-2 items-start shrink-0">
            {deal?.source && (
              <div className="text-center px-3 py-1.5 bg-muted rounded">
                <div className="text-[10px] text-muted-foreground">Source</div>
                <div className="text-sm font-medium">{deal.source}</div>
              </div>
            )}
            {version.overall_score != null && <ScoreCircle score={Number(version.overall_score)} />}
          </div>
        </CardContent>
      </Card>

      {/* BLOCS 1-3 : Contexte (3 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {activite && (
          <Card>
            <CardContent className="p-3">
              <SubHeading>Activité</SubHeading>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{activite}</p>
            </CardContent>
          </Card>
        )}
        {capRows.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <SubHeading>Actionnariat</SubHeading>
              <div className="space-y-0.5 text-[11px]">
                {capRows.slice(0, 3).map((it: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground truncate">{it.actionnaire ?? it.label}</span>
                    <span className="font-medium ml-2">{it.percent}%</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Structure {capRows[0]?.percent >= 50 ? 'familiale — pas d\'investisseur institutionnel' : ''}</p>
            </CardContent>
          </Card>
        )}
        {mgmtRows.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <SubHeading>Management clé</SubHeading>
              <div className="space-y-1 text-[11px]">
                {mgmtRows.slice(0, 2).map((m: any, i: number) => (
                  <div key={i}>
                    <span className="font-medium">{m.name}</span>
                    {(m.role || m.poste) && <span className="text-muted-foreground"> — {m.role ?? m.poste}</span>}
                    {m.exp && <span className="text-muted-foreground"> · {m.exp}</span>}
                  </div>
                ))}
              </div>
              {mgmtCJ.management?.items?.[0]?.note && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--pe-warning)' }}>{mgmtCJ.management.items[0].note}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* BLOC 4 : KPIs bandeau */}
      {kpis.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex gap-1.5 flex-wrap">
              {kpis.map((k: any, i: number) => (
                <div key={i} className="bg-muted rounded px-3 py-2 text-center flex-1 min-w-[120px]">
                  <div className="text-[9px] text-muted-foreground">{k.label}</div>
                  <div className="text-base font-medium" style={{ color: k.value_color ? HINT_COLOR[k.value_color] : undefined }}>{k.value}</div>
                  {k.hint && <div className="text-[9px]" style={{ color: k.hint_color ? HINT_COLOR[k.hint_color] : 'var(--muted-foreground)' }}>{k.hint}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOCS 5-6 : Snapshot + Use of proceeds + Scénarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Snapshot */}
        {snap?.rows?.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <SubHeading>Snapshot financier 3 ans</SubHeading>
              <div className="text-[11px]">
                <div className="grid border-b text-[9px] text-muted-foreground py-0.5" style={{ gridTemplateColumns: `1.8fr 1fr 1fr 1fr` }}>
                  <span></span>
                  {(snap.headers ?? ['2023', '2024', '2025']).map((h: string, i: number) => <span key={i} className="text-right">{h}</span>)}
                </div>
                {snap.rows.slice(0, 6).map((r: any, i: number) => (
                  <div key={i} className="grid py-0.5" style={{ gridTemplateColumns: `1.8fr 1fr 1fr 1fr`, fontWeight: r.bold ? 500 : undefined, color: r.highlight === 'warning' ? 'var(--pe-warning)' : r.highlight === 'ok' ? 'var(--pe-ok)' : undefined }}>
                    <span className={r.indent ? 'pl-2 text-muted-foreground italic' : 'text-muted-foreground'}>{r.label}</span>
                    {(r.values ?? []).map((v: any, j: number) => <span key={j} className="text-right">{v}</span>)}
                  </div>
                ))}
              </div>
              {snap.footnote && <p className="text-[9px] text-muted-foreground mt-1.5">{snap.footnote}</p>}
            </CardContent>
          </Card>
        )}
        <div className="space-y-2">
          {/* Use of proceeds */}
          {useOfProceeds && (Array.isArray(useOfProceeds) && useOfProceeds.length > 0) && (
            <Card>
              <CardContent className="p-3">
                <SubHeading>Utilisation des fonds</SubHeading>
                <div className="space-y-0.5 text-[11px]">
                  {useOfProceeds.map((u: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground truncate">{u.label}</span>
                      <span className="font-medium ml-2" style={{ color: 'var(--pe-purple)' }}>{u.percent}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">CAPEX productif majoritaire — profil mid-market industriel</p>
              </CardContent>
            </Card>
          )}
          {/* Scénarios */}
          {scenarios && (
            <Card>
              <CardContent className="p-3">
                <SubHeading>Scénarios retour (5 ans)</SubHeading>
                <div className="space-y-0.5 text-[11px]">
                  {scenarios.bear && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Bear</span><span style={{ color: 'var(--pe-warning)', fontWeight: 500 }}>{scenarios.bear.moic} · IRR {scenarios.bear.irr}</span></div>
                  )}
                  {scenarios.base && (
                    <div className="flex justify-between"><span style={{ color: 'var(--pe-info)' }}>Base</span><span style={{ color: 'var(--pe-info)', fontWeight: 500 }}>{scenarios.base.moic} · IRR {scenarios.base.irr}</span></div>
                  )}
                  {scenarios.bull && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Bull</span><span style={{ color: 'var(--pe-ok)', fontWeight: 500 }}>{scenarios.bull.moic} · IRR {scenarios.bull.irr}</span></div>
                  )}
                </div>
                {scenarios.pre_money_indicatif && <p className="text-[9px] text-muted-foreground mt-1">Pre-money indicatif : {scenarios.pre_money_indicatif}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* BLOCS 7-8 : Adéquation thèse + Red flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {thesisMatch && (
          <Card>
            <CardContent className="p-3">
              <SubHeading>Adéquation thèse du fonds</SubHeading>
              <div className="space-y-0.5 text-[11px]">
                {(thesisMatch.criteria ?? []).map((c: any, i: number) => {
                  const s = STATUS_STYLE[c.status] ?? STATUS_STYLE.no;
                  return (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
              {thesisMatch.match_count != null && (
                <p className="border-t mt-1.5 pt-1.5 text-[10px]">
                  {thesisMatch.match_count}/{thesisMatch.total} critères · Adéquation <strong style={{ color: 'var(--pe-ok)' }}>{thesisMatch.score_percent}%</strong>
                </p>
              )}
            </CardContent>
          </Card>
        )}
        {redFlags.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <SubHeading color="var(--pe-danger)">Red flags SYSCOHADA détectés</SubHeading>
              <div className="space-y-1">
                {redFlags.slice(0, 3).map((rf: any, i: number) => (
                  <RedFlagItem key={i} title={rf.title} severity={sevToRedFlag[rf.severity] ?? 'medium'} detail={rf.body ?? rf.detail ?? ''} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* BLOC 10 : Qualité dossier */}
      {(docQuality?.categories?.length > 0 || inventaire) && (
        <Card>
          <CardContent className="p-3">
            <SubHeading>Qualité du dossier documentaire</SubHeading>
            {docQuality?.categories?.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                {docQuality.categories.map((c: any, i: number) => (
                  <div key={i}>
                    <div className="font-medium mb-0.5 flex items-center gap-1.5">
                      <span>{c.name}</span>
                      <span className="px-1 py-0.5 rounded text-[8px]" style={{ background: LEVEL_BG[c.level], color: LEVEL_COLOR[c.level] }}>{c.level}</span>
                    </div>
                    {(c.checklist ?? []).slice(0, 4).map((item: any, j: number) => (
                      <div key={j} className="flex justify-between py-0.5">
                        <span className="text-muted-foreground truncate">{item.label}</span>
                        <span style={{ color: item.status === 'ok' ? 'var(--pe-ok)' : item.status === 'partial' ? 'var(--pe-warning)' : 'var(--pe-danger)' }}>{STATUS_ICON_DOC[item.status]}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : inventaire?.summary && (
              <p className="text-xs text-muted-foreground">{inventaire.summary}</p>
            )}
            {docQuality?.summary && (
              <div className="border-t mt-2 pt-2 text-[10px]">
                {docQuality.global_level && <span className="font-medium" style={{ color: 'var(--pe-warning)' }}>Score qualité global : {docQuality.global_level} </span>}
                <span className="text-muted-foreground">— {docQuality.summary}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BLOCS 11-12 : Synthèse IA + Benchmark */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {aiSynth?.paragraph && (
          <Card>
            <CardContent className="p-3">
              <SubHeading>Synthèse IA</SubHeading>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{aiSynth.paragraph}</p>
              <div className="flex gap-1 flex-wrap mt-2">
                {(aiSynth.strengths_tags ?? []).map((t: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px]" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>+ {t}</Badge>
                ))}
                {(aiSynth.weaknesses_tags ?? []).map((t: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px]" style={{ background: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', border: 'none' }}>- {t}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {benchmark?.headers?.length > 0 && benchmark?.rows?.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <SubHeading>Benchmark sectoriel</SubHeading>
              <div className="text-[11px]">
                <div className="grid grid-cols-4 border-b text-[9px] text-muted-foreground py-0.5">
                  <span>Ratio</span>
                  {benchmark.headers.slice(0, 3).map((h: string, i: number) => <span key={i} className="text-right">{h}</span>)}
                </div>
                {benchmark.rows.slice(0, 5).map((r: any, i: number) => (
                  <div key={i} className="grid grid-cols-4 py-0.5 border-b border-border/30">
                    <span className="text-muted-foreground">{r.ratio}</span>
                    <span className="text-right font-medium">{r.company}</span>
                    <span className="text-right">{r.median ?? r.medianValue}</span>
                    <span className="text-right" style={{ color: 'var(--pe-ok)' }}>{r.quartile}</span>
                  </div>
                ))}
              </div>
              {benchmark.source && <p className="text-[9px] text-muted-foreground mt-1">Source : {benchmark.source}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* BLOC 13 : Recommandation formelle */}
      {reco && (
        <Card style={{ borderColor: VERDICT_STYLE[reco.verdict?.toLowerCase()]?.border ?? 'var(--pe-ok)', borderWidth: 2 }}>
          <CardContent className="p-4 space-y-2">
            <SubHeading>Recommandation analyste</SubHeading>
            <div className="flex gap-3 items-start flex-wrap">
              <Badge style={{ background: VERDICT_STYLE[reco.verdict?.toLowerCase()]?.bg, color: VERDICT_STYLE[reco.verdict?.toLowerCase()]?.color, border: 'none', fontSize: '13px', padding: '4px 12px' }}>
                {reco.verdict_label ?? reco.verdict?.replace('_', ' ')}
              </Badge>
              {reco.summary && <p className="text-xs flex-1 leading-relaxed text-muted-foreground">{reco.summary}</p>}
            </div>
            {reco.conditions?.length > 0 && (
              <div className="space-y-0.5 mt-2">
                {reco.conditions_intro && <p className="text-[11px] font-medium">{reco.conditions_intro}</p>}
                {reco.conditions.map((c: any, i: number) => (
                  <div key={i} className="flex gap-2 items-start text-[11px]">
                    <Badge variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>Condition {c.n}</Badge>
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>
            )}
            {(reco.deal_breakers ?? []).length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                <span>Deal breakers potentiels : </span>
                {reco.deal_breakers.map((db: string, i: number) => (
                  <span key={i} style={{ color: 'var(--pe-danger)' }}>{i > 0 ? ' · ' : ''}{db}</span>
                ))}
              </p>
            )}
            {reco.conviction && (
              <p className="text-[11px]">
                <span className="text-muted-foreground">Niveau de conviction : </span>
                <span style={{ color: 'var(--pe-info)', fontWeight: 500 }}>{reco.conviction}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
