import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface DeliverableViewerProps {
  moduleCode: string;
  data: any;
}

export default function DeliverableViewer({ moduleCode, data }: DeliverableViewerProps) {
  if (!data || typeof data !== 'object') return null;

  switch (moduleCode) {
    case 'sic': return <SicViewer data={data} />;
    case 'inputs': return <InputsViewer data={data} />;
    case 'framework': return <FrameworkViewer data={data} />;
    case 'diagnostic': return <DiagnosticViewer data={data} />;
    case 'plan_ovo': return <PlanOvoViewer data={data} />;
    case 'business_plan': return <BusinessPlanViewer data={data} />;
    case 'odd': return <OddViewer data={data} />;
    default: return <GenericJsonViewer data={data} />;
  }
}

// ===== SIC VIEWER =====
function SicViewer({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <ScoreHeader title="Social Impact Canvas" score={data.score} subtitle={data.mission_sociale} />
      
      {data.probleme_social && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-1">🎯 Problème social adressé</h4>
          <p className="text-sm text-muted-foreground">{data.probleme_social}</p>
        </CardContent></Card>
      )}

      {data.theorie_changement && (
        <Card><CardContent className="py-4 space-y-3">
          <h4 className="text-xs font-bold text-primary">🔄 Théorie du changement</h4>
          {['inputs', 'activites', 'outputs', 'outcomes', 'impact'].map(key => (
            <div key={key}>
              <p className="text-[11px] font-semibold capitalize text-muted-foreground">{key}</p>
              <ul className="text-xs space-y-0.5">
                {(data.theorie_changement[key] || []).map((item: string, i: number) => (
                  <li key={i} className="flex gap-1.5"><span className="text-primary">→</span>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent></Card>
      )}

      {data.odd_alignment?.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">🌍 Alignement ODD</h4>
          <div className="grid grid-cols-2 gap-2">
            {data.odd_alignment.map((odd: any, i: number) => (
              <div key={i} className="p-2 rounded-lg bg-muted/50 text-xs">
                <span className="font-bold">ODD {odd.odd_number}</span> — {odd.odd_name}
                <Badge variant="outline" className="ml-1 text-[9px]">{odd.level}</Badge>
                <p className="text-muted-foreground mt-0.5">{odd.contribution}</p>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      <RecommendationsList items={data.recommandations} />
    </div>
  );
}

// ===== INPUTS VIEWER =====
function InputsViewer({ data }: { data: any }) {
  const cr = data.compte_resultat || {};
  const bilan = data.bilan || {};

  const formatAmount = (n: number) => {
    if (!n && n !== 0) return '—';
    return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
  };

  return (
    <div className="space-y-4">
      <ScoreHeader title="Données Financières" score={data.score} subtitle={`Période: ${data.periode || 'N/A'} • Fiabilité: ${data.fiabilite || 'N/A'}`} />

      <Card><CardContent className="py-4">
        <h4 className="text-xs font-bold text-primary mb-2">📊 Compte de résultat</h4>
        <div className="space-y-1">
          {Object.entries(cr).map(([key, val]) => (
            <div key={key} className="flex justify-between text-xs py-0.5 border-b border-border/50">
              <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
              <span className="font-medium">{formatAmount(val as number)}</span>
            </div>
          ))}
        </div>
      </CardContent></Card>

      {bilan.actif && (
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="py-4">
            <h4 className="text-xs font-bold text-primary mb-2">Actif</h4>
            {Object.entries(bilan.actif).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[11px] py-0.5">
                <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                <span className="font-medium">{formatAmount(v as number)}</span>
              </div>
            ))}
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <h4 className="text-xs font-bold text-primary mb-2">Passif</h4>
            {Object.entries(bilan.passif || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[11px] py-0.5">
                <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                <span className="font-medium">{formatAmount(v as number)}</span>
              </div>
            ))}
          </CardContent></Card>
        </div>
      )}

      {data.hypotheses?.length > 0 && (
        <Card className="border-warning/20 bg-warning/5"><CardContent className="py-3">
          <p className="text-[11px] font-bold text-warning mb-1">⚠️ Hypothèses</p>
          <ul className="text-[11px] text-muted-foreground space-y-0.5">
            {data.hypotheses.map((h: string, i: number) => <li key={i}>• {h}</li>)}
          </ul>
        </CardContent></Card>
      )}
    </div>
  );
}

// ===== FRAMEWORK VIEWER =====
function FrameworkViewer({ data }: { data: any }) {
  const ratios = data.ratios || {};

  return (
    <div className="space-y-4">
      <ScoreHeader title="Framework Analyse Financière" score={data.score} subtitle={data.capacite_investissement} />

      {Object.entries(ratios).map(([category, ratioGroup]: [string, any]) => (
        <Card key={category}><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2 capitalize">{category.replace(/_/g, ' ')}</h4>
          <div className="space-y-2">
            {Object.entries(ratioGroup).map(([key, val]: [string, any]) => (
              <div key={key} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{val?.valeur || val}</span>
                  {val?.verdict && (
                    <Badge variant="outline" className={`text-[9px] ${
                      val.verdict === 'Bon' ? 'text-success border-success/30' :
                      val.verdict === 'Faible' ? 'text-destructive border-destructive/30' :
                      'text-warning border-warning/30'
                    }`}>{val.verdict}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      ))}

      <StrengthsWeaknesses strengths={data.points_forts} weaknesses={data.points_faibles} />
      <RecommendationsList items={data.recommandations} />
    </div>
  );
}

// ===== DIAGNOSTIC VIEWER =====
function DiagnosticViewer({ data }: { data: any }) {
  const dimensions = data.diagnostic_par_dimension || {};

  return (
    <div className="space-y-4">
      <ScoreHeader title="Diagnostic Expert" score={data.score} subtitle={data.synthese_executive} badge={data.niveau_maturite} />

      {Object.keys(dimensions).length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-3">📊 Scores par dimension</h4>
          <div className="space-y-2">
            {Object.entries(dimensions).map(([key, dim]: [string, any]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className={`font-bold ${dim.score >= 70 ? 'text-success' : dim.score >= 50 ? 'text-warning' : 'text-destructive'}`}>
                    {dim.score}%
                  </span>
                </div>
                <Progress value={dim.score} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground">{dim.analyse}</p>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {data.swot && (
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">🧭 SWOT</h4>
          <div className="grid grid-cols-2 gap-2">
            <SwotBox title="Forces" items={data.swot.forces} className="bg-success/5 border-success/20" />
            <SwotBox title="Faiblesses" items={data.swot.faiblesses} className="bg-destructive/5 border-destructive/20" />
            <SwotBox title="Opportunités" items={data.swot.opportunites} className="bg-info/5 border-info/20" />
            <SwotBox title="Menaces" items={data.swot.menaces} className="bg-warning/5 border-warning/20" />
          </div>
        </div>
      )}

      {data.risques_critiques?.length > 0 && (
        <Card className="border-destructive/20"><CardContent className="py-4">
          <h4 className="text-xs font-bold text-destructive mb-2">🚨 Risques critiques</h4>
          {data.risques_critiques.map((r: any, i: number) => (
            <div key={i} className="p-2 rounded bg-destructive/5 mb-1 text-xs">
              <span className="font-medium">{r.risque}</span>
              <Badge variant="outline" className="ml-1 text-[9px]">{r.severite}</Badge>
              <p className="text-muted-foreground mt-0.5">→ {r.mitigation}</p>
            </div>
          ))}
        </CardContent></Card>
      )}

      <p className="text-sm font-medium text-primary italic">{data.verdict}</p>
    </div>
  );
}

// ===== PLAN OVO VIEWER =====
function PlanOvoViewer({ data }: { data: any }) {
  const scenarios = data.scenarios || {};
  const formatAmount = (n: number) => n ? new Intl.NumberFormat('fr-FR').format(n) : '—';

  return (
    <div className="space-y-4">
      <ScoreHeader title="Plan Financier OVO" score={data.score} />

      {data.hypotheses_base && (
        <Card><CardContent className="py-3">
          <h4 className="text-xs font-bold text-primary mb-1">📐 Hypothèses de base</h4>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {Object.entries(data.hypotheses_base).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span><span className="font-medium">{v as string}</span></div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {['optimiste', 'realiste', 'pessimiste'].map(scenario => {
        const s = scenarios[scenario];
        if (!s) return null;
        const colors: Record<string, string> = { optimiste: 'text-success', realiste: 'text-primary', pessimiste: 'text-warning' };
        return (
          <Card key={scenario}><CardContent className="py-4">
            <h4 className={`text-xs font-bold ${colors[scenario]} mb-2 uppercase`}>
              {scenario === 'optimiste' ? '🚀' : scenario === 'realiste' ? '📊' : '⚠️'} Scénario {scenario}
            </h4>
            <p className="text-[11px] text-muted-foreground mb-2">{s.hypotheses}</p>
            <p className="text-[11px] mb-2">Croissance: <span className="font-bold">{s.taux_croissance_ca}</span></p>
            {s.projections?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr className="border-b">
                    <th className="text-left py-1">Année</th><th className="text-right py-1">CA</th><th className="text-right py-1">Résultat</th><th className="text-right py-1">Trésorerie</th>
                  </tr></thead>
                  <tbody>
                    {s.projections.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-1 font-medium">{p.annee}</td>
                        <td className="text-right">{formatAmount(p.ca)}</td>
                        <td className="text-right">{formatAmount(p.resultat_net)}</td>
                        <td className="text-right">{formatAmount(p.tresorerie)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent></Card>
        );
      })}

      {data.indicateurs_cles && (
        <Card><CardContent className="py-3">
          <h4 className="text-xs font-bold text-primary mb-2">📈 Indicateurs clés</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(data.indicateurs_cles).map(([k, v]) => (
              <div key={k} className="p-2 rounded bg-muted/50">
                <span className="text-muted-foreground uppercase text-[10px]">{k}</span>
                <p className="font-bold">{v as string}</p>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}

// ===== BUSINESS PLAN VIEWER =====
function BusinessPlanViewer({ data }: { data: any }) {
  const re = data.resume_executif || {};

  return (
    <div className="space-y-4">
      <ScoreHeader title="Business Plan" score={data.score} subtitle={re.accroche} />

      {re.probleme && (
        <Card><CardContent className="py-4 space-y-3">
          <h4 className="text-xs font-bold text-primary">📋 Résumé Exécutif</h4>
          {['probleme', 'solution', 'marche', 'modele_economique', 'equipe', 'besoin_financement', 'vision'].map(key => (
            re[key] ? (
              <div key={key}>
                <p className="text-[11px] font-semibold capitalize text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                <p className="text-xs">{re[key]}</p>
              </div>
            ) : null
          ))}
        </CardContent></Card>
      )}

      {data.analyse_marche && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">📊 Analyse de marché</h4>
          <p className="text-xs mb-2">Taille: <span className="font-medium">{data.analyse_marche.taille_marche}</span></p>
          <p className="text-xs mb-1">Positionnement: <span className="font-medium">{data.analyse_marche.positionnement}</span></p>
          {data.analyse_marche.tendances?.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold">Tendances:</p>
              <ul className="text-[11px] text-muted-foreground">{data.analyse_marche.tendances.map((t: string, i: number) => <li key={i}>• {t}</li>)}</ul>
            </div>
          )}
        </CardContent></Card>
      )}

      {data.plan_financier_resume?.utilisation_fonds?.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">💰 Utilisation des fonds</h4>
          {data.plan_financier_resume.utilisation_fonds.map((f: any, i: number) => (
            <div key={i} className="flex justify-between text-xs py-1 border-b border-border/30">
              <span>{f.poste}</span>
              <span className="font-medium">{f.montant} ({f.pourcentage}%)</span>
            </div>
          ))}
        </CardContent></Card>
      )}

      {data.risques_et_mitigations?.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">⚠️ Risques</h4>
          {data.risques_et_mitigations.map((r: any, i: number) => (
            <div key={i} className="p-2 rounded bg-muted/30 mb-1 text-xs">
              <span className="font-medium">{r.risque}</span>
              <Badge variant="outline" className="ml-1 text-[9px]">{r.probabilite}</Badge>
              <p className="text-muted-foreground mt-0.5">→ {r.mitigation}</p>
            </div>
          ))}
        </CardContent></Card>
      )}

      {data.conclusion && (
        <Card className="bg-primary/5 border-primary/20"><CardContent className="py-4">
          <p className="text-sm italic text-primary">{data.conclusion}</p>
        </CardContent></Card>
      )}
    </div>
  );
}

// ===== ODD VIEWER =====
function OddViewer({ data }: { data: any }) {
  const statusIcon = (s: string) => {
    if (s === 'pass') return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    if (s === 'fail') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
  };

  return (
    <div className="space-y-4">
      <ScoreHeader title="Due Diligence ODD" score={data.score} subtitle={data.synthese} badge={data.readiness_level} />

      {data.scores_par_categorie && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-3">📊 Scores par catégorie</h4>
          <div className="space-y-2">
            {Object.entries(data.scores_par_categorie).map(([key, cat]: [string, any]) => (
              <div key={key}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="capitalize font-medium">{key}</span>
                  <span className={`font-bold ${cat.score >= 70 ? 'text-success' : cat.score >= 50 ? 'text-warning' : 'text-destructive'}`}>
                    {cat.score}% ({cat.items_pass}/{cat.items_total})
                  </span>
                </div>
                <Progress value={cat.score} className="h-1.5" />
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {data.checklist?.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">✅ Checklist</h4>
          <div className="space-y-1">
            {data.checklist.map((item: any, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/30 text-xs">
                {statusIcon(item.status)}
                <div className="flex-1">
                  <span className="font-medium">{item.critere}</span>
                  <Badge variant="outline" className="ml-1 text-[9px]">{item.categorie}</Badge>
                  <p className="text-muted-foreground mt-0.5">{item.commentaire}</p>
                  {item.status !== 'pass' && item.action_requise && (
                    <p className="text-primary mt-0.5 font-medium">→ {item.action_requise}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {data.red_flags?.length > 0 && (
        <Card className="border-destructive/20"><CardContent className="py-3">
          <h4 className="text-xs font-bold text-destructive mb-1">🚩 Red Flags</h4>
          <ul className="text-xs text-destructive/80 space-y-0.5">{data.red_flags.map((r: string, i: number) => <li key={i}>• {r}</li>)}</ul>
        </CardContent></Card>
      )}

      {data.actions_prioritaires?.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">🎯 Actions prioritaires</h4>
          {data.actions_prioritaires.map((a: any, i: number) => (
            <div key={i} className="p-2 rounded bg-muted/30 mb-1 text-xs">
              <span className="font-medium">{a.action}</span>
              <div className="flex gap-1 mt-0.5">
                <Badge variant="outline" className="text-[9px]">{a.priorite}</Badge>
                <Badge variant="outline" className="text-[9px]">{a.delai}</Badge>
              </div>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}

// ===== GENERIC FALLBACK =====
function GenericJsonViewer({ data }: { data: any }) {
  return (
    <Card><CardContent className="py-4">
      <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-[600px] text-muted-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </CardContent></Card>
  );
}

// ===== SHARED COMPONENTS =====
function ScoreHeader({ title, score, subtitle, badge }: { title: string; score?: number; subtitle?: string; badge?: string }) {
  return (
    <Card className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(222,47%,25%)] text-primary-foreground border-0">
      <CardContent className="py-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-display font-bold">{title}</h2>
            {subtitle && <p className="mt-1.5 text-sm opacity-80">{subtitle}</p>}
            {badge && <Badge className="mt-2 bg-white/20 text-primary-foreground border-0 text-[10px]">{badge}</Badge>}
          </div>
          {score !== undefined && (
            <div className="text-center ml-4">
              <p className="text-4xl font-display font-black">{score}</p>
              <p className="text-[10px] opacity-60">/100</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SwotBox({ title, items, className = '' }: { title: string; items?: any[]; className?: string }) {
  return (
    <div className={`rounded-lg border p-3 ${className}`}>
      <h4 className="text-xs font-bold mb-1.5">{title}</h4>
      <ul className="space-y-0.5">
        {(items || []).map((item: any, i: number) => (
          <li key={i} className="text-[11px]">• {typeof item === 'string' ? item : item.item || item.description}</li>
        ))}
      </ul>
    </div>
  );
}

function StrengthsWeaknesses({ strengths, weaknesses }: { strengths?: string[]; weaknesses?: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="border-success/20 bg-success/5"><CardContent className="py-3">
        <h4 className="text-xs font-bold text-success mb-1">✅ Points forts</h4>
        <ul className="text-[11px] space-y-0.5">{(strengths || []).map((s, i) => <li key={i}>• {s}</li>)}</ul>
      </CardContent></Card>
      <Card className="border-destructive/20 bg-destructive/5"><CardContent className="py-3">
        <h4 className="text-xs font-bold text-destructive mb-1">⚠️ Points faibles</h4>
        <ul className="text-[11px] space-y-0.5">{(weaknesses || []).map((w, i) => <li key={i}>• {w}</li>)}</ul>
      </CardContent></Card>
    </div>
  );
}

function RecommendationsList({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <Card><CardContent className="py-4">
      <h4 className="text-xs font-bold text-primary mb-2">🎯 Recommandations</h4>
      <ul className="space-y-1">
        {items.map((r, i) => (
          <li key={i} className="text-xs flex gap-1.5"><span className="text-primary">→</span>{r}</li>
        ))}
      </ul>
    </CardContent></Card>
  );
}
