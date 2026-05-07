import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

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

  const legacySynth = cj.ai_synthesis;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Résumé exécutif</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPIs bandeau — fond gris neutre */}
        {kpis.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {kpis.map((k: any, i: number) => (
              <div key={i} className="bg-muted rounded px-2 py-1.5 text-center flex-1 min-w-[110px]">
                <div className="text-[9px] text-muted-foreground">{k.label}</div>
                <div className="text-base font-medium">{k.value}</div>
                {k.hint && <div className="text-[9px] text-muted-foreground">{k.hint}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Présentation — encadré gris narratif */}
        {presentation?.paragraphs?.length > 0 && (
          <NarrativeBlock title={presentation.heading ?? 'Présentation de la cible'}>
            <div className="space-y-2">
              {presentation.paragraphs.map((p: string, i: number) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {/* Thèse en 5 points */}
        {thesis?.items?.length > 0 && (
          <NarrativeBlock title={thesis.heading ?? "Thèse d'investissement en 5 points"}>
            <div className="space-y-2">
              {thesis.items.map((t: any, i: number) => (
                <p key={i}>
                  <strong>{t.n}. {t.lead}</strong> {t.body}
                </p>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {/* Recommandation formelle — verdict mis en avant en haut */}
        {reco && (
          <NarrativeBlock title={reco.heading ?? 'Recommandation formelle'}>
            <p className="font-semibold mb-2">
              {reco.verdict_label ?? reco.verdict?.replace('_', ' ')}
            </p>
            {reco.summary && <p className="text-muted-foreground">{reco.summary}</p>}
            {reco.score_section && <p className="text-muted-foreground mt-1">{reco.score_section}</p>}
            {reco.score_esono != null && (
              <p className="text-muted-foreground mt-1">
                Score ESONO : <strong className="text-foreground">{reco.score_esono}/100</strong>
                {reco.score_threshold != null && ` (seuil mid-market : ${reco.score_threshold})`}
                {reco.score_brut != null && ` · Score avant pénalités : ${reco.score_brut}/100`}
              </p>
            )}
            {reco.conditions?.length > 0 && (
              <div className="space-y-1 mt-3 pt-2 border-t border-dashed border-border">
                {reco.conditions_intro && <p className="font-medium">{reco.conditions_intro}</p>}
                {reco.conditions.map((c: any, i: number) => (
                  <p key={i} className="text-muted-foreground">
                    <span className="font-medium text-foreground">({c.n})</span> {c.text}
                  </p>
                ))}
              </div>
            )}
          </NarrativeBlock>
        )}

        {/* Red flags actifs — encadré narratif avec ❌ inline */}
        {redFlags.length > 0 && (
          <NarrativeBlock title={`${redFlags.length} red flag${redFlags.length > 1 ? 's' : ''} actif${redFlags.length > 1 ? 's' : ''}`}>
            <div className="space-y-3">
              {redFlags.map((rf: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-500 font-bold mt-0.5 shrink-0">✕</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{rf.title}{rf.severity ? ` — sévérité ${rf.severity}` : ''}</p>
                    {(rf.body || rf.detail) && (
                      <p className="text-muted-foreground mt-0.5">{rf.body ?? rf.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {/* Points à monitorer */}
        {monitoring.length > 0 && (
          <NarrativeBlock title={`${monitoring.length} point${monitoring.length > 1 ? 's' : ''} à monitorer`}>
            <div className="space-y-1 text-muted-foreground">
              {monitoring.map((m: string, i: number) => (
                <p key={i}>· {m}</p>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {/* Deal breakers */}
        {dealBreakers?.items?.length > 0 && (
          <NarrativeBlock title={dealBreakers.intro ?? 'Deal breakers identifiés'}>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              {dealBreakers.items.map((d: string, i: number) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
            {dealBreakers.conclusion && (
              <p className="italic mt-2 text-muted-foreground">{dealBreakers.conclusion}</p>
            )}
          </NarrativeBlock>
        )}

        {/* Legacy fallback : ai_synthesis si pas de presentation/thesis structurés */}
        {!presentation && !thesis && legacySynth?.paragraph && (
          <NarrativeBlock title="Synthèse">
            <p>{legacySynth.paragraph}</p>
            {((legacySynth.strengths_tags ?? []).length > 0 || (legacySynth.weaknesses_tags ?? []).length > 0) && (
              <div className="mt-2 space-y-1">
                {(legacySynth.strengths_tags ?? []).length > 0 && (
                  <p><span className="font-medium">Forces :</span> {(legacySynth.strengths_tags ?? []).join(' · ')}</p>
                )}
                {(legacySynth.weaknesses_tags ?? []).length > 0 && (
                  <p><span className="font-medium">Faiblesses :</span> {(legacySynth.weaknesses_tags ?? []).join(' · ')}</p>
                )}
              </div>
            )}
          </NarrativeBlock>
        )}

        {/* Markdown libre */}
        {section.content_md && (
          <NarrativeBlock title="Notes complémentaires">
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown>{section.content_md}</ReactMarkdown>
            </div>
          </NarrativeBlock>
        )}

        {/* Métadonnées process en bas — sobre */}
        <SectionMetadataFooter meta={meta} footer={footer} />
      </CardContent>
    </Card>
  );
}
