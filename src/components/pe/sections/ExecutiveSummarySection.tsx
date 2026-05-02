import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import RedFlagItem from '@/components/dashboard/viewers/atoms/pe/RedFlagItem';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const HINT_COLOR: Record<string, string> = {
  ok: 'var(--pe-ok)',
  warning: 'var(--pe-warning)',
  danger: 'var(--pe-danger)',
  info: 'var(--pe-info)',
};

const VERDICT_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  go_direct:       { bg: 'var(--pe-bg-ok)',      border: 'var(--pe-ok)',      color: 'var(--pe-ok)' },
  go_conditionnel: { bg: 'var(--pe-bg-ok)',      border: 'var(--pe-ok)',      color: 'var(--pe-ok)' },
  hold:            { bg: 'var(--pe-bg-warning)', border: 'var(--pe-warning)', color: 'var(--pe-warning)' },
  reject:          { bg: 'var(--pe-bg-danger)',  border: 'var(--pe-danger)',  color: 'var(--pe-danger)' },
};

const sevToRedFlag: Record<string, 'high' | 'medium' | 'low'> = {
  Critical: 'high',
  High:     'high',
  Medium:   'medium',
  Low:      'low',
  high:     'high',
  medium:   'medium',
  low:      'low',
};

export default function ExecutiveSummarySection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const kpis: any[] = cj.kpis_bandeau ?? [];
  const presentation = cj.presentation;
  const thesis = cj.thesis_5_points;
  const reco = cj.recommendation;
  const redFlags: any[] = cj.red_flags_synthesis ?? [];
  const monitoring: any[] = cj.monitoring_points ?? [];
  const dealBreakers = cj.deal_breakers;
  const footer = cj.footer;

  // Backward compat : legacy ai_synthesis utilisé si rien d'autre
  const legacySynth = cj.ai_synthesis;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">Résumé exécutif</CardTitle>

        {/* Auteurs */}
        {meta && (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {meta.redige_par && (
              <Badge variant="outline" style={{ background: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', border: 'none' }}>
                Rédigé : {meta.redige_par}
              </Badge>
            )}
            {meta.data_par && (
              <Badge variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>
                Data : {meta.data_par}
              </Badge>
            )}
            {meta.review_par && (
              <Badge variant="outline" style={{ background: 'var(--pe-bg-purple)', color: 'var(--pe-purple)', border: 'none' }}>
                Review : {meta.review_par}
              </Badge>
            )}
          </div>
        )}

        {/* Bandeau version */}
        {meta?.version_note && (
          <div className="rounded px-3 py-1.5 text-[11px] leading-relaxed" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>
            <strong>Version {meta.version_label ?? 'IC1 (draft)'}</strong> — {meta.version_note}
          </div>
        )}

        {/* Note auto-génération */}
        {meta?.auto_gen_note && (
          <p className="text-[10px]" style={{ color: 'var(--pe-purple)' }}>
            {meta.auto_gen_note}
            {meta.last_generated_at && ` Dernière génération : ${meta.last_generated_at}.`}
            {meta.score_memo != null && ` Score memo : ${meta.score_memo}/100`}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPIs bandeau (7 items max) */}
        {kpis.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {kpis.map((k: any, i: number) => (
              <div key={i} className="bg-muted rounded px-2 py-1.5 text-center flex-1 min-w-[110px]">
                <div className="text-[9px] text-muted-foreground">{k.label}</div>
                <div className="text-base font-medium" style={{ color: k.value_color ? HINT_COLOR[k.value_color] : undefined }}>
                  {k.value}
                </div>
                {k.hint && (
                  <div className="text-[9px]" style={{ color: k.hint_color ? HINT_COLOR[k.hint_color] : 'var(--pe-text-secondary)' }}>
                    {k.hint}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Présentation de la cible */}
        {presentation?.paragraphs?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-1.5">{presentation.heading ?? 'Présentation de la cible'}</h4>
            <div className="space-y-2 text-sm leading-relaxed">
              {presentation.paragraphs.map((p: string, i: number) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        )}

        {/* Thèse en 5 points */}
        {thesis?.items?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-1.5">{thesis.heading ?? "Thèse d'investissement en 5 points"}</h4>
            <div className="space-y-2 text-sm leading-relaxed">
              {thesis.items.map((t: any, i: number) => (
                <p key={i}>
                  <strong>{t.n}. {t.lead}</strong> {t.body}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Recommandation formelle (verdict box) */}
        {reco && (
          <div>
            <h4 className="text-sm font-semibold mb-1.5">{reco.heading ?? 'Recommandation formelle'}</h4>
            <div
              className="rounded p-4 space-y-2"
              style={{
                background: VERDICT_STYLE[reco.verdict?.toLowerCase()]?.bg ?? 'var(--pe-bg-ok)',
                borderLeft: `3px solid ${VERDICT_STYLE[reco.verdict?.toLowerCase()]?.border ?? 'var(--pe-ok)'}`,
              }}
            >
              <p className="font-semibold text-sm" style={{ color: VERDICT_STYLE[reco.verdict?.toLowerCase()]?.color }}>
                {reco.verdict_label ?? reco.verdict?.replace('_', ' ')}
              </p>
              {reco.summary && <p className="text-xs leading-relaxed">{reco.summary}</p>}
              {reco.score_section && <p className="text-xs leading-relaxed">{reco.score_section}</p>}
              {reco.score_esono != null && (
                <p className="text-xs">
                  Score ESONO : <strong>{reco.score_esono}/100</strong>
                  {reco.score_threshold != null && ` (seuil mid-market : ${reco.score_threshold})`}
                  {reco.score_brut != null && ` · Score avant pénalités : ${reco.score_brut}/100`}
                </p>
              )}
              {reco.conditions?.length > 0 && (
                <div className="space-y-1">
                  {reco.conditions_intro && <p className="text-xs font-medium">{reco.conditions_intro}</p>}
                  {reco.conditions.map((c: any, i: number) => (
                    <p key={i} className="text-xs">
                      <span className="font-medium">({c.n})</span> {c.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Red flags actifs */}
        {redFlags.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--pe-danger)' }}>
              {redFlags.length} red flag{redFlags.length > 1 ? 's' : ''} actif{redFlags.length > 1 ? 's' : ''}
            </h4>
            <div className="space-y-1.5">
              {redFlags.map((rf: any, i: number) => (
                <RedFlagItem
                  key={i}
                  title={rf.title + (rf.severity ? ` — sévérité ${rf.severity}` : '')}
                  severity={sevToRedFlag[rf.severity] ?? 'medium'}
                  detail={rf.body ?? rf.detail ?? ''}
                />
              ))}
            </div>
          </div>
        )}

        {/* Points à monitorer */}
        {monitoring.length > 0 && (
          <div className="rounded px-3 py-2 text-sm space-y-1" style={{ background: 'var(--pe-bg-warning)', borderLeft: '3px solid var(--pe-warning)' }}>
            <p className="font-medium" style={{ color: 'var(--pe-warning)' }}>
              {monitoring.length} point{monitoring.length > 1 ? 's' : ''} à monitorer
            </p>
            {monitoring.map((m: string, i: number) => (
              <p key={i} className="text-xs leading-relaxed">· {m}</p>
            ))}
          </div>
        )}

        {/* Deal breakers */}
        {dealBreakers?.items?.length > 0 && (
          <div className="rounded px-3 py-2 text-sm space-y-1" style={{ background: 'var(--pe-bg-danger)', borderLeft: '3px solid var(--pe-danger)' }}>
            <p className="font-semibold" style={{ color: 'var(--pe-danger)' }}>
              {dealBreakers.intro ?? 'Deal breakers identifiés :'}
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              {dealBreakers.items.map((d: string, i: number) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
            {dealBreakers.conclusion && (
              <p className="text-xs italic mt-1" style={{ color: 'var(--pe-danger)' }}>{dealBreakers.conclusion}</p>
            )}
          </div>
        )}

        {/* Legacy fallback : ai_synthesis si pas de presentation/thesis structurés */}
        {!presentation && !thesis && legacySynth?.paragraph && (
          <div className="text-sm leading-relaxed text-muted-foreground border-t pt-2">
            <p>{legacySynth.paragraph}</p>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {(legacySynth.strengths_tags ?? []).map((t: string, i: number) => (
                <Badge key={i} variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>+ {t}</Badge>
              ))}
              {(legacySynth.weaknesses_tags ?? []).map((t: string, i: number) => (
                <Badge key={i} variant="outline" style={{ background: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', border: 'none' }}>- {t}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Markdown libre (si présent en complément) */}
        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground border-t pt-2">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}

        {/* Footer auto-gen */}
        {footer && (
          <div className="rounded px-3 py-2 text-[11px]" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>
            {footer.auto_gen_summary}
            {footer.last_generated_at && <> · Dernière génération : {footer.last_generated_at}</>}
            {footer.sections_redigees != null && footer.sections_total != null && <> · Sections rédigées : {footer.sections_redigees}/{footer.sections_total}</>}
            {footer.validations_im != null && <> · Validées IM : {footer.validations_im}/{footer.sections_total ?? 12}</>}
            {footer.validations_md != null && <> · Validées MD : {footer.validations_md}/{footer.sections_total ?? 12}</>}
            {footer.score_memo != null && <> · Score memo : {footer.score_memo}/100</>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
