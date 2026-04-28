// ProjectionsViewer — affichage du livrable "Projections financières" (CR_2).
// Structure : hypothèses (2 blocs) → compte de résultat central détaillé →
// service dette + DSCR → 3 scénarios alternatifs → sensibilité 4D → synthèse → sources.

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CRLine {
  label: string;
  values?: (number | null)[];
  type?: 'produit' | 'charge' | 'calc' | 'sub';
  bold?: boolean;
  with_pct?: boolean;
  highlight?: 'green' | null;
}

interface Scenario {
  label: string;
  hypotheses: string[];
  ca_2026: number;
  ca_variation_pct?: number;
  ebe_2026: number;
  ebe_marge_pct?: number;
  dscr_2026: number;
  verdict: string;
}

interface ProjectionsData {
  objectif?: string;
  horizon?: { duree_mois?: number; annee_debut?: string; annee_fin?: string; buffer_apres?: string };
  hypotheses?: {
    croissance_ca?: Array<{ annee: string; pct: number; commentaire?: string }>;
    marge?: Array<{ label: string; valeur: string }>;
  };
  compte_resultat_central?: { annees: string[]; lignes: CRLine[] };
  service_dette?: {
    annees: string[];
    service_existant?: number[];
    service_nouveau?: number[];
    differe_commentaire?: string | null;
    service_total?: number[];
    dscr_projete?: number[];
    dscr_base_caf?: number[];
    seuil_dscr?: number;
  };
  scenarios?: { stress?: Scenario; realiste?: Scenario; optimiste?: Scenario };
  sensibilite_dscr?: {
    annee_reference?: string;
    colonnes?: string[];
    dimensions?: Array<{ label: string; valeurs: number[]; sens_inverse?: boolean }>;
  };
  synthese_comite?: { narratif?: string; variable_plus_sensible?: string };
  sources?: string[];
  metadata?: { devise?: string };
}

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}Md`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return Math.round(n).toString();
}

function fmtSigned(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  const s = fmt(Math.abs(n));
  return n < 0 ? `-${s}` : s;
}

// Couleur DSCR selon seuil 1.2x
function dscrColor(v: number, seuil = 1.2) {
  if (v < seuil) return 'text-red-700 font-semibold';
  if (v < seuil * 1.25) return 'text-amber-700';
  return 'text-emerald-700';
}

export default function ProjectionsViewer({ data }: { data: ProjectionsData }) {
  const hyp = data.hypotheses;
  const cr = data.compte_resultat_central;
  const sd = data.service_dette;
  const sc = data.scenarios;
  const sens = data.sensibilite_dscr;
  const synth = data.synthese_comite;
  const sources = data.sources || [];
  const seuil = sd?.seuil_dscr ?? 1.2;

  return (
    <div className="space-y-4">
      {/* Objectif + horizon */}
      {(data.objectif || data.horizon) && (
        <Card className="p-4 bg-muted/20">
          {data.objectif && <p className="text-sm leading-relaxed mb-1"><span className="font-semibold">Objectif :</span> {data.objectif}</p>}
          {data.horizon && (
            <p className="text-xs text-muted-foreground">
              Horizon : {data.horizon.annee_debut}–{data.horizon.annee_fin}
              {data.horizon.duree_mois && ` (${data.horizon.duree_mois} mois)`}
              {data.horizon.buffer_apres && ` · ${data.horizon.buffer_apres}`}
            </p>
          )}
        </Card>
      )}

      {/* Hypothèses (2 blocs côte à côte) */}
      {hyp && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Hypothèses de projection</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {/* Hypothèses croissance CA */}
            {hyp.croissance_ca?.length ? (
              <div className="rounded-md bg-muted/30 p-3">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">Hypothèses de croissance CA</div>
                <ul className="space-y-1.5 text-xs">
                  {hyp.croissance_ca.map((row, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <div className="flex-1">
                        <span className="font-medium">{row.annee} : </span>
                        <span className="font-semibold">{row.pct >= 0 ? '+' : ''}{row.pct}%</span>
                        {row.commentaire && <span className="text-muted-foreground"> ({row.commentaire})</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Hypothèses marge */}
            {hyp.marge?.length ? (
              <div className="rounded-md bg-muted/30 p-3">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">Hypothèses de marge</div>
                <ul className="space-y-1.5 text-xs">
                  {hyp.marge.map((row, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <div className="flex-1">
                        <span className="font-medium">{row.label} : </span>
                        <span className="text-muted-foreground">{row.valeur}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Card>
      )}

      {/* Compte de résultat projeté — scénario central */}
      {cr && cr.lignes?.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Compte de résultat projeté — scénario central</h3>
          <div className="rounded-md bg-muted/30 p-3 overflow-x-auto">
            <PnLTable annees={cr.annees} lignes={cr.lignes} />
          </div>
        </Card>
      )}

      {/* Service de la dette + DSCR */}
      {sd && sd.annees?.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Service de la dette et calcul DSCR</h3>
          <div className="rounded-md bg-muted/30 p-3 overflow-x-auto">
            <DebtTable sd={sd} seuil={seuil} />
          </div>
        </Card>
      )}

      {/* 3 scénarios alternatifs */}
      {sc && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Scénarios alternatifs et stress test</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {sc.stress    && <ScenarioCard scen={sc.stress}    tone="stress" />}
            {sc.realiste  && <ScenarioCard scen={sc.realiste}  tone="realiste" />}
            {sc.optimiste && <ScenarioCard scen={sc.optimiste} tone="optimiste" />}
          </div>
        </Card>
      )}

      {/* Sensibilité DSCR — 4 dimensions × 5 colonnes */}
      {sens && sens.dimensions?.length ? (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">
            Sensibilité du DSCR aux variables critiques
            {sens.annee_reference && <span className="text-xs text-muted-foreground font-normal ml-2">(année {sens.annee_reference})</span>}
          </h3>
          <div className="rounded-md border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-[2fr_repeat(5,1fr)] gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
              <span>Sensibilité (DSCR {sens.annee_reference})</span>
              {(sens.colonnes || ['-20%', '-10%', 'Base', '+10%', '+20%']).map((c, i) => (
                <span key={i} className="text-right">{c}</span>
              ))}
            </div>
            {sens.dimensions.map((dim, i) => (
              <div key={i} className="grid grid-cols-[2fr_repeat(5,1fr)] gap-2 px-3 py-2 border-t">
                <span className="font-medium">{dim.label}</span>
                {dim.valeurs.map((v, j) => (
                  <span key={j} className={`text-right ${dscrColor(v, seuil)}`}>{v?.toFixed(2)}x</span>
                ))}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground italic mt-2">
            Les variables marquées "sens inverse" (coût matière, taux d'intérêt) voient le DSCR baisser quand la variable augmente.
          </p>
        </Card>
      ) : null}

      {/* Synthèse comité */}
      {synth?.narratif && (
        <Card className="p-5 border-l-4 border-l-emerald-500 bg-emerald-50/30">
          <h3 className="text-sm font-semibold mb-2">Synthèse pour le comité</h3>
          <p className="text-sm leading-relaxed">{synth.narratif}</p>
          {synth.variable_plus_sensible && (
            <p className="text-xs text-emerald-800 italic mt-2">
              Variable la plus sensible : <span className="font-semibold">{synth.variable_plus_sensible}</span>
            </p>
          )}
        </Card>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="text-[11px] text-muted-foreground border-t pt-3">
          <span className="font-semibold">Sources : </span>
          {sources.join(' · ')}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function PnLTable({ annees, lignes }: { annees: string[]; lignes: CRLine[] }) {
  // Pour les lignes avec with_pct, calcule % du CA (ligne dont type === 'produit')
  const ca = lignes.find(l => l.type === 'produit' && !l.label.toLowerCase().startsWith('dont'))?.values || [];

  return (
    <div>
      <div className="grid grid-cols-[2.4fr_repeat(5,1fr)] gap-2 text-[10px] font-semibold text-muted-foreground border-b pb-2 mb-1">
        <span>M</span>
        {annees.map((y, i) => (
          <span key={i} className="text-right">{y}</span>
        ))}
      </div>
      {lignes.map((row, i) => {
        const isSub = row.type === 'sub';
        const isCharge = row.type === 'charge';
        const isCalc = row.type === 'calc';
        const isHighlight = row.highlight === 'green';
        return (
          <div
            key={i}
            className={`grid grid-cols-[2.4fr_repeat(5,1fr)] gap-2 py-1 text-xs ${
              isCalc ? `border-t mt-0.5 pt-1.5 ${row.bold ? 'font-semibold' : ''}` : ''
            } ${isHighlight ? 'text-emerald-700 font-semibold' : ''}`}
          >
            <span className={`${isSub ? 'pl-4 italic text-muted-foreground' : ''} ${isCharge ? 'text-foreground' : ''}`}>
              {isCharge ? '(-) ' : ''}{row.label.replace(/^dont /, '. dont ')}
            </span>
            {(row.values || []).map((v, idx) => {
              if (v === null || v === undefined) return <span key={idx} className="text-right text-muted-foreground">—</span>;
              const display = isCharge && v > 0 ? -v : v;
              const pct = row.with_pct && ca[idx] && ca[idx]! > 0 ? ` (${Math.round((v / ca[idx]!) * 100)}%)` : '';
              return (
                <span key={idx} className={`text-right ${isCharge ? 'text-foreground/80' : ''}`}>
                  {fmt(display)}{pct}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function DebtTable({ sd, seuil }: { sd: NonNullable<ProjectionsData['service_dette']>; seuil: number }) {
  const annees = sd.annees;
  const Row = ({ label, values, italic, signed, bold, highlight }: {
    label: string;
    values?: number[];
    italic?: boolean;
    signed?: boolean;
    bold?: boolean;
    highlight?: 'green';
  }) => (
    <div className={`grid grid-cols-[2.4fr_repeat(5,1fr)] gap-2 py-1 text-xs ${
      bold ? 'border-t pt-1.5 mt-0.5 font-semibold' : ''
    } ${highlight === 'green' ? 'text-emerald-700' : ''}`}>
      <span className={italic ? 'italic text-muted-foreground pl-4' : ''}>{label}</span>
      {annees.map((_, i) => {
        const v = values?.[i];
        if (v === null || v === undefined) return <span key={i} className="text-right text-muted-foreground">—</span>;
        if (label.toLowerCase().includes('dscr')) {
          return <span key={i} className={`text-right ${dscrColor(v, seuil)}`}>{v.toFixed(2)}x</span>;
        }
        return <span key={i} className="text-right">{signed ? fmtSigned(v < 0 ? v : -v) : fmt(v)}</span>;
      })}
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-[2.4fr_repeat(5,1fr)] gap-2 text-[10px] font-semibold text-muted-foreground border-b pb-2 mb-1">
        <span>M</span>
        {annees.map((y, i) => <span key={i} className="text-right">{y}</span>)}
      </div>
      <Row label="Service crédit existant (capital + intérêts)" values={sd.service_existant} signed />
      <Row label="Service NOUVEAU crédit" values={sd.service_nouveau} signed />
      {sd.differe_commentaire && (
        <div className="text-[11px] italic text-muted-foreground pl-4 mb-1">. {sd.differe_commentaire}</div>
      )}
      <Row label="Service total dette annuel" values={sd.service_total} signed bold />
      <Row label="DSCR projeté (EBE / Service total)" values={sd.dscr_projete} bold highlight="green" />
      {sd.dscr_base_caf?.length ? (
        <Row label="DSCR base CAF (plus conservateur)" values={sd.dscr_base_caf} italic />
      ) : null}
    </div>
  );
}

function ScenarioCard({ scen, tone }: { scen: Scenario; tone: 'stress' | 'realiste' | 'optimiste' }) {
  const tones = {
    stress:    { border: 'border-red-200',     bg: 'bg-red-50/50',     accent: 'text-red-700',     verdict: 'text-red-700' },
    realiste:  { border: 'border-amber-200',   bg: 'bg-amber-50/40',   accent: 'text-amber-800',   verdict: 'text-amber-800' },
    optimiste: { border: 'border-emerald-200', bg: 'bg-emerald-50/40', accent: 'text-emerald-700', verdict: 'text-emerald-700' },
  };
  const t = tones[tone];

  return (
    <div className={`rounded-md border-2 ${t.border} ${t.bg} p-3`}>
      <div className={`text-xs font-semibold mb-2 ${t.accent}`}>{scen.label}</div>
      <ul className="space-y-1 text-xs mb-3">
        {scen.hypotheses?.map((h, i) => (
          <li key={i} className="flex gap-1.5"><span className="text-muted-foreground">•</span><span className="text-foreground/90 leading-snug">{h}</span></li>
        ))}
      </ul>
      <div className="border-t pt-2 space-y-0.5 text-xs">
        <div>
          <span className="font-semibold">CA 2026 : </span>
          {fmt(scen.ca_2026)}
          {scen.ca_variation_pct !== undefined && (
            <span className={`ml-1 ${scen.ca_variation_pct < 0 ? 'text-red-600' : scen.ca_variation_pct > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              ({scen.ca_variation_pct >= 0 ? '+' : ''}{scen.ca_variation_pct}%)
            </span>
          )}
        </div>
        <div>
          <span className="font-semibold">EBE 2026 : </span>
          {fmt(scen.ebe_2026)}
          {scen.ebe_marge_pct !== undefined && (
            <span className="text-muted-foreground"> ({scen.ebe_marge_pct}% marge)</span>
          )}
        </div>
        <div>
          <span className="font-semibold">DSCR 2026 : </span>
          <span className={t.verdict + ' font-semibold'}>{scen.dscr_2026?.toFixed(2)}x</span>
          {scen.verdict && <Badge variant="outline" className={`text-[10px] ml-2 ${t.accent}`}>{scen.verdict}</Badge>}
        </div>
      </div>
    </div>
  );
}
