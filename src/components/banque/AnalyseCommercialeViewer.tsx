import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Globe, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AnalyseCommercialeData {
  intro_narratif?: string;
  portefeuille_clients?: Array<{ client: string; type_produit?: string | null; ca_annuel: number; pct_ca: number; anciennete: string; nature_relation: string }>;
  total_ca?: number;
  annee_reference?: string;
  kpis_concentration?: {
    top3_pct?: number; top3_clients?: string; top3_seuil?: string; top3_verdict?: string;
    top5_pct?: number;
    pct_sous_contrat_pluriannuel?: number; objectif_pct_sous_contrat?: number;
  };
  geographie?: { repartition_ca?: Array<{ zone: string; pct: number; commentaire?: string | null }>; narratif?: string };
  canaux_logistiques?: string[];
  saisonnalite?: {
    narratif?: string;
    table_periodes?: Array<{ periode: string; achats_matiere: number; ca_encaisse: number; solde_mensuel: number; bfr_cumule: number }>;
    bfr_max?: number; periode_bfr_max?: string;
    implication_credit?: string;
  };
  sensibilite_prix?: {
    narratif?: string;
    matiere_premiere?: string;
    stress_table?: Array<{ variation: string; ca_impact: number; ebe_impact: number; dscr: number; verdict: string }>;
    point_attention?: string;
  };
  plan_diversification?: { actions_engagees?: string[]; objectifs?: string[] };
  risques_commerciaux?: Array<{ risque: string; probabilite: string; impact: string; mitigation: string }>;
  synthese_comite?: { verdict?: string; narratif?: string };
  sources?: string[];
  metadata?: { devise?: string };
}

function fmt(n: number | null | undefined, devise = '') {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  let s: string;
  if (abs >= 1e9) s = `${(n / 1e9).toFixed(1)}Md`;
  else if (abs >= 1e6) s = `${(n / 1e6).toFixed(0)}M`;
  else if (abs >= 1e3) s = `${(n / 1e3).toFixed(0)}K`;
  else s = String(n);
  return devise ? `${s} ${devise}` : s;
}

function probaColor(p: string) {
  const k = (p || '').toLowerCase();
  if (k.startsWith('élev') || k.startsWith('elev')) return 'text-red-700 bg-red-50 border-red-200';
  if (k.startsWith('moy')) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-emerald-700 bg-emerald-50 border-emerald-200';
}

function verdictColor(v: string) {
  const k = (v || '').toLowerCase();
  if (k.includes('rupture') || k.includes('non rembour')) return 'text-red-700 bg-red-50 border-red-200';
  if (k.includes('sous seuil') || k.includes('tendu')) return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-emerald-700 bg-emerald-50 border-emerald-200';
}

export default function AnalyseCommercialeViewer({ data }: { data: AnalyseCommercialeData }) {
  const port = data.portefeuille_clients || [];
  const kpis = data.kpis_concentration || {};
  const geo = data.geographie;
  const canaux = data.canaux_logistiques || [];
  const sais = data.saisonnalite;
  const sens = data.sensibilite_prix;
  const div = data.plan_diversification;
  const risques = data.risques_commerciaux || [];
  const synth = data.synthese_comite || {};
  const devise = data.metadata?.devise || 'FCFA';

  return (
    <div className="space-y-4">
      {/* Intro narratif */}
      {data.intro_narratif && (
        <Card className="p-4 bg-muted/20">
          <p className="text-sm leading-relaxed">{data.intro_narratif}</p>
        </Card>
      )}

      {/* Portefeuille clients */}
      {port.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Portefeuille clients{data.annee_reference ? ` — exercice ${data.annee_reference}` : ''}</h3>
          <div className="rounded-md border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-[2fr_1fr_0.6fr_0.8fr_1.5fr] gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
              <span>Client</span>
              <span className="text-right">CA</span>
              <span className="text-right">% CA</span>
              <span>Ancien.</span>
              <span>Relation</span>
            </div>
            {port.map((c, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_0.6fr_0.8fr_1.5fr] gap-2 px-3 py-2 border-t">
                <span>
                  <span className="font-medium">{c.client}</span>
                  {c.type_produit && <span className="text-muted-foreground text-[10px]"> ({c.type_produit})</span>}
                </span>
                <span className="text-right">{fmt(c.ca_annuel, devise)}</span>
                <span className={`text-right font-semibold ${c.pct_ca > 25 ? 'text-amber-700' : ''}`}>{c.pct_ca}%</span>
                <span className="text-muted-foreground">{c.anciennete}</span>
                <span className="text-muted-foreground text-[10px] leading-snug">{c.nature_relation}</span>
              </div>
            ))}
            {data.total_ca !== undefined && (
              <div className="grid grid-cols-[2fr_1fr_0.6fr_0.8fr_1.5fr] gap-2 px-3 py-2 border-t bg-muted/30 font-semibold">
                <span>TOTAL CA {data.annee_reference}</span>
                <span className="text-right">{fmt(data.total_ca, devise)}</span>
                <span className="text-right">100%</span>
                <span></span><span></span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* KPIs concentration */}
      {(kpis.top3_pct !== undefined || kpis.top5_pct !== undefined) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Top 3 clients</div>
            <div className={`text-2xl font-bold ${kpis.top3_pct && kpis.top3_pct > 60 ? 'text-red-600' : kpis.top3_pct && kpis.top3_pct > 50 ? 'text-amber-600' : 'text-emerald-700'}`}>
              {kpis.top3_pct}%
            </div>
            {kpis.top3_clients && <div className="text-[10px] text-muted-foreground">{kpis.top3_clients}</div>}
            {kpis.top3_seuil && <div className="text-[10px] text-muted-foreground italic mt-0.5">Seuil NSIA : {kpis.top3_seuil}</div>}
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Top 5 clients</div>
            <div className="text-2xl font-bold">{kpis.top5_pct}%</div>
            {kpis.top3_verdict && <div className="text-[10px] text-muted-foreground">{kpis.top3_verdict}</div>}
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">% sous contrat pluriannuel</div>
            <div className={`text-2xl font-bold ${kpis.pct_sous_contrat_pluriannuel && kpis.objectif_pct_sous_contrat && kpis.pct_sous_contrat_pluriannuel < kpis.objectif_pct_sous_contrat ? 'text-amber-600' : 'text-emerald-700'}`}>
              {kpis.pct_sous_contrat_pluriannuel}%
            </div>
            {kpis.objectif_pct_sous_contrat && <div className="text-[10px] text-muted-foreground">objectif {kpis.objectif_pct_sous_contrat}%</div>}
          </Card>
        </div>
      )}

      {/* Géographie + canaux */}
      {(geo?.repartition_ca?.length || canaux.length) && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Géographie et canaux d'export
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {geo?.repartition_ca?.length ? (
              <div className="rounded-md bg-muted/30 p-3">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">Répartition du CA</div>
                <ul className="space-y-1.5 text-xs">
                  {geo.repartition_ca.map((r, i) => (
                    <li key={i} className="flex items-baseline gap-2">
                      <span className="font-semibold min-w-[40px]">{r.pct}%</span>
                      <span className="text-muted-foreground">{r.zone}</span>
                      {r.commentaire && <span className="text-[10px] text-muted-foreground italic ml-auto">{r.commentaire}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {canaux.length > 0 && (
              <div className="rounded-md bg-muted/30 p-3">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">Canaux logistiques</div>
                <ul className="space-y-1 text-xs">
                  {canaux.map((c, i) => (
                    <li key={i} className="flex gap-1.5"><span className="text-primary">•</span><span className="text-muted-foreground">{c}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {geo?.narratif && <p className="text-xs text-muted-foreground italic mt-3 leading-relaxed">{geo.narratif}</p>}
        </Card>
      )}

      {/* Saisonnalité */}
      {sais && (sais.narratif || sais.table_periodes?.length) && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Saisonnalité et impact trésorerie</h3>
          {sais.narratif && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{sais.narratif}</p>}
          {sais.table_periodes?.length ? (
            <div className="rounded-md border border-border overflow-hidden text-xs mb-3">
              <div className="grid grid-cols-5 gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
                <span>Période</span>
                <span className="text-right">Achats matière</span>
                <span className="text-right">CA encaissé</span>
                <span className="text-right">Solde</span>
                <span className="text-right">BFR cumulé</span>
              </div>
              {sais.table_periodes.map((row, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 px-3 py-2 border-t">
                  <span className="font-medium">{row.periode}</span>
                  <span className="text-right text-red-600">{fmt(-Math.abs(row.achats_matiere))}</span>
                  <span className="text-right text-emerald-700">+{fmt(row.ca_encaisse)}</span>
                  <span className={`text-right font-medium ${row.solde_mensuel < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {row.solde_mensuel >= 0 ? '+' : ''}{fmt(row.solde_mensuel)}
                  </span>
                  <span className={`text-right font-medium ${row.bfr_cumule < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {row.bfr_cumule >= 0 ? '+' : ''}{fmt(row.bfr_cumule)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {sais.implication_credit && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-2.5 text-xs text-blue-800">
              <span className="font-semibold">Implication crédit :</span> {sais.implication_credit}
            </div>
          )}
        </Card>
      )}

      {/* Sensibilité prix */}
      {sens && (sens.narratif || sens.stress_table?.length) && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Sensibilité au prix mondial{sens.matiere_premiere ? ` du ${sens.matiere_premiere}` : ''}</h3>
          {sens.narratif && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{sens.narratif}</p>}
          {sens.stress_table?.length ? (
            <div className="rounded-md border border-border overflow-hidden text-xs">
              <div className="grid grid-cols-5 gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
                <span>Variation prix</span>
                <span className="text-right">CA impact</span>
                <span className="text-right">EBE impact</span>
                <span className="text-right">DSCR</span>
                <span>Verdict</span>
              </div>
              {sens.stress_table.map((row, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 px-3 py-2 border-t">
                  <span className="font-medium">{row.variation}</span>
                  <span className={`text-right ${row.ca_impact < 0 ? 'text-red-600' : row.ca_impact > 0 ? 'text-emerald-600' : ''}`}>
                    {row.ca_impact >= 0 ? '+' : ''}{fmt(row.ca_impact)}
                  </span>
                  <span className={`text-right ${row.ebe_impact < 0 ? 'text-red-600' : row.ebe_impact > 0 ? 'text-emerald-600' : ''}`}>
                    {row.ebe_impact >= 0 ? '+' : ''}{fmt(row.ebe_impact)}
                  </span>
                  <span className={`text-right font-medium ${row.dscr < 1.2 ? 'text-red-700' : row.dscr < 1.5 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {row.dscr?.toFixed(2)}x
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${verdictColor(row.verdict)}`}>{row.verdict}</Badge>
                </div>
              ))}
            </div>
          ) : null}
          {sens.point_attention && (
            <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
              <span className="font-semibold">Point d'attention :</span> {sens.point_attention}
            </div>
          )}
        </Card>
      )}

      {/* Plan diversification */}
      {(div?.actions_engagees?.length || div?.objectifs?.length) && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Plan de diversification commerciale</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {div?.actions_engagees?.length ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="text-xs font-semibold text-emerald-700 mb-2">Actions déjà engagées</div>
                <ul className="space-y-1.5 text-xs">
                  {div.actions_engagees.map((a, i) => (
                    <li key={i} className="flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-700 mt-0.5 flex-shrink-0" /><span>{a}</span></li>
                  ))}
                </ul>
              </div>
            ) : null}
            {div?.objectifs?.length ? (
              <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3">
                <div className="text-xs font-semibold text-blue-700 mb-2">Objectifs 2026-2027</div>
                <ul className="space-y-1.5 text-xs">
                  {div.objectifs.map((a, i) => (
                    <li key={i} className="flex gap-1.5"><span className="text-blue-600">→</span><span>{a}</span></li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Card>
      )}

      {/* Risques commerciaux */}
      {risques.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Risques commerciaux et mitigation
          </h3>
          <div className="rounded-md border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-[2fr_1fr_1fr_3fr] gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
              <span>Risque</span>
              <span>Probabilité</span>
              <span>Impact</span>
              <span>Mitigation</span>
            </div>
            {risques.map((r, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_1fr_3fr] gap-2 px-3 py-2 border-t">
                <span className="font-medium">{r.risque}</span>
                <span><Badge variant="outline" className={`text-[10px] ${probaColor(r.probabilite)}`}>{r.probabilite}</Badge></span>
                <span><Badge variant="outline" className={`text-[10px] ${probaColor(r.impact)}`}>{r.impact}</Badge></span>
                <span className="text-muted-foreground leading-snug">{r.mitigation}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Synthèse */}
      {synth.narratif && (
        <Card className="p-5 border-l-4 border-l-amber-500 bg-amber-50/30">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-amber-700" />
            Synthèse pour le comité
          </h3>
          {synth.verdict && <div className="text-sm font-semibold mb-2">{synth.verdict}</div>}
          <p className="text-sm leading-relaxed">{synth.narratif}</p>
        </Card>
      )}

      {/* Sources */}
      {data.sources && data.sources.length > 0 && (
        <div className="text-[11px] text-muted-foreground border-t pt-3">
          <span className="font-semibold">Sources : </span>
          {data.sources.join(' · ')}
        </div>
      )}
    </div>
  );
}
