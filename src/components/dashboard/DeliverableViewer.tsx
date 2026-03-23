import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle } from 'lucide-react';
import FrameworkViewerComponent from './FrameworkViewer';
import PlanOvoViewerComponent from './PlanOvoViewer';
import { OddViewer as OddViewerComponent } from './OddViewer';

interface DeliverableViewerProps {
  moduleCode: string;
  data: any;
  allDeliverables?: any[];
  onRegenerate?: () => void;
}

export default function DeliverableViewer({ moduleCode, data, allDeliverables, onRegenerate }: DeliverableViewerProps) {
  if (!data || typeof data !== 'object') return null;

  const regenerateButton = onRegenerate ? (
    <div className="flex justify-end mb-3">
      <button onClick={onRegenerate} className="text-xs text-muted-foreground hover:text-foreground underline">
        Regénérer
      </button>
    </div>
  ) : null;

  const wrapWithRegenerate = (viewer: React.ReactNode) => (
    <>
      {regenerateButton}
      {viewer}
    </>
  );

  switch (moduleCode) {
    case 'sic': return wrapWithRegenerate(<SicViewer data={data} />);
    case 'inputs': return wrapWithRegenerate(<InputsViewer data={data} />);
    case 'framework': return wrapWithRegenerate(<FrameworkViewerComponent data={data} />);
    case 'diagnostic': return wrapWithRegenerate(<DiagnosticViewer data={data} />);
    case 'plan_ovo': {
      const frameworkDel = allDeliverables?.find((d: any) => d.type === 'framework_data');
      const planOvoDel = allDeliverables?.find((d: any) => d.type === 'plan_ovo');
      const staleness = frameworkDel && planOvoDel ? {
        frameworkUpdatedAt: frameworkDel.updated_at,
        planOvoUpdatedAt: planOvoDel.updated_at,
      } : undefined;
      return wrapWithRegenerate(<PlanOvoViewerComponent data={data} staleness={staleness} />);
    }
    case 'business_plan': return wrapWithRegenerate(<BusinessPlanViewer data={data} />);
    case 'odd': return wrapWithRegenerate(<OddViewerComponent data={data} />);
    default: return wrapWithRegenerate(<GenericJsonViewer data={data} />);
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
          <p className="text-sm text-foreground">{data.probleme_social}</p>
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
export function InputsViewer({ data }: { data: any }) {
  const cr = data.compte_resultat || {};
  const bilan = data.bilan || {};
  const kpis = data.kpis || {};
  const alertes = data.alertes || [];
  const croisements = data.croisements_bmc_fin || [];
  const tresBfr = data.tresorerie_bfr || {};
  const sante = data.sante_financiere || {};
  const marge = data.analyse_marge || {};
  const proj = data.projection_5ans || {};
  const seuil = data.seuil_rentabilite || {};
  const scenarios = data.scenarios || {};
  const planAction = data.plan_action || [];
  const risques = data.risques_cles || [];
  const bailleurs = data.bailleurs_potentiels || [];
  const croisBmc = data.croisement_bmc_financiers || {};
  const manquantes = data.donnees_manquantes || [];

  const deviseVal = data?.devise || data?.metadata?.devise || 'FCFA';
  const formatAmount = (n: number) => {
    if (!n && n !== 0) return '—';
    return new Intl.NumberFormat('fr-FR').format(n) + ' ' + deviseVal;
  };

  return (
    <div className="space-y-4">
      <ScoreHeader
        title="Framework d'Analyse Financière"
        score={data.score}
        subtitle={`${data.periode || ''} • Fiabilité: ${data.fiabilite || 'N/A'}`}
      />

      {/* KPIs Bar */}
      {kpis.ca_annee_n && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Marge EBITDA', value: kpis.marge_ebitda },
            { label: 'CA Année N', value: formatAmount(kpis.ca_annee_n) },
            { label: 'EBITDA', value: formatAmount(kpis.ebitda) },
            { label: 'CA An 5 projeté', value: formatAmount(kpis.ca_an5_projete) },
          ].map((k, i) => (
            <Card key={i}><CardContent className="py-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className="text-sm font-bold mt-0.5">{k.value}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      {/* Alertes */}
      {alertes.length > 0 && (
        <Card className="border-warning/30 bg-warning/5"><CardContent className="py-3">
          <h4 className="text-xs font-bold text-warning mb-2">⚠️ Alertes & Points de vigilance</h4>
          <ul className="space-y-1">
            {alertes.map((a: any, i: number) => (
              <li key={i} className="text-xs text-warning/80">• {typeof a === 'string' ? a : a.message} {a.detail && <span className="text-muted-foreground">— {a.detail}</span>}</li>
            ))}
          </ul>
        </CardContent></Card>
      )}

      {/* Croisements BMC ↔ Fin */}
      {croisements.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">🔗 Croisement BMC ↔ Financiers</h4>
          <div className="space-y-2">
            {croisements.map((c: any, i: number) => (
              <div key={i} className="p-2 rounded-lg bg-muted/30 text-xs">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="outline" className="text-[9px]">{c.bloc_bmc}</Badge>
                  <span className="font-semibold">{c.titre}</span>
                </div>
                <p className="text-muted-foreground">{c.recommandation}</p>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Compte de résultat */}
      {Object.keys(cr).length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">📊 Compte de résultat</h4>
          <div className="space-y-1">
            {Object.entries(cr).map(([key, val]) => (
              <div key={key} className={`flex justify-between text-xs py-0.5 border-b border-border/50 ${key.includes('resultat') ? 'font-bold' : ''}`}>
                <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                <span className="font-medium">{formatAmount(val as number)}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Indicateurs Clés + Verdict */}
      {data.indicateurs_cles && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">📈 Indicateurs Clés</h4>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {Object.entries(data.indicateurs_cles).map(([k, v]) => (
              <div key={k} className="p-2 rounded bg-muted/50 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">{k.replace(/_/g, ' ')}</p>
                <p className="text-lg font-bold">{v as string}</p>
              </div>
            ))}
          </div>
          {data.verdict_indicateurs && (
            <p className="text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-3">{data.verdict_indicateurs}</p>
          )}
        </CardContent></Card>
      )}

      {/* Ratios historiques */}
      {data.ratios_historiques?.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">📊 Ratios Historiques</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead><tr className="border-b">
                <th className="text-left py-1">Ratio</th><th className="text-right py-1">N-2</th><th className="text-right py-1">N-1</th><th className="text-right py-1">N</th><th className="text-right py-1">Benchmark</th>
              </tr></thead>
              <tbody>
                {data.ratios_historiques.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1 font-medium">{r.ratio}</td>
                    <td className="text-right">{r.n_moins_2}</td>
                    <td className="text-right">{r.n_moins_1}</td>
                    <td className="text-right font-bold">{r.n}</td>
                    <td className="text-right text-muted-foreground">{r.benchmark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      )}

      {/* Trésorerie & BFR */}
      {(tresBfr.tresorerie_nette || tresBfr.composantes?.length) && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">💧 Trésorerie & BFR</h4>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { l: 'Trésorerie nette', v: formatAmount(tresBfr.tresorerie_nette) },
              { l: 'Cash-flow opérationnel', v: formatAmount(tresBfr.cashflow_operationnel) },
              { l: 'CAF', v: formatAmount(tresBfr.caf) },
              { l: 'DSCR', v: tresBfr.dscr || '—' },
            ].map((m, i) => (
              <div key={i} className="p-2 rounded bg-muted/50 text-center">
                <p className="text-[9px] text-muted-foreground uppercase">{m.l}</p>
                <p className="text-xs font-bold">{m.v}</p>
              </div>
            ))}
          </div>
          {tresBfr.composantes?.length > 0 && (
            <div className="space-y-1">
              {tresBfr.composantes.map((c: any, i: number) => (
                <div key={i} className="flex justify-between text-xs py-0.5 border-b border-border/30">
                  <span className="text-muted-foreground">{c.indicateur}</span>
                  <div className="flex gap-4">
                    <span className="font-bold">{c.valeur}</span>
                    <span className="text-muted-foreground text-[10px]">Benchmark: {c.benchmark}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tresBfr.verdict && (
            <p className="text-xs italic text-muted-foreground mt-2 border-l-2 border-primary/30 pl-3">{tresBfr.verdict}</p>
          )}
        </CardContent></Card>
      )}

      {/* Bilan */}
      {bilan.actif && (
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="py-4">
            <h4 className="text-xs font-bold text-primary mb-2">Actif</h4>
            {Object.entries(bilan.actif).map(([k, v]) => (
              <div key={k} className={`flex justify-between text-[11px] py-0.5 ${k.includes('total') ? 'font-bold border-t border-border' : ''}`}>
                <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                <span className="font-medium">{formatAmount(v as number)}</span>
              </div>
            ))}
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <h4 className="text-xs font-bold text-primary mb-2">Passif</h4>
            {Object.entries(bilan.passif || {}).map(([k, v]) => (
              <div key={k} className={`flex justify-between text-[11px] py-0.5 ${k.includes('total') ? 'font-bold border-t border-border' : ''}`}>
                <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                <span className="font-medium">{formatAmount(v as number)}</span>
              </div>
            ))}
          </CardContent></Card>
        </div>
      )}

      {/* État de santé financière - Forces / Faiblesses */}
      {(sante.forces?.length > 0 || sante.faiblesses?.length > 0) && (
        <>
          {sante.resume_chiffres?.length > 0 && (
            <Card><CardContent className="py-3">
              <h4 className="text-xs font-bold text-primary mb-1">📊 État de santé financière</h4>
              <div className="flex flex-wrap gap-2">
                {sante.resume_chiffres.map((c: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>
                ))}
              </div>
            </CardContent></Card>
          )}
          <StrengthsWeaknesses strengths={sante.forces} weaknesses={sante.faiblesses} />
        </>
      )}

      {/* Analyse de la marge */}
      {marge.activites?.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">💰 Où se crée la marge</h4>
          {marge.verdict && <p className="text-xs italic text-muted-foreground mb-3 border-l-2 border-primary/30 pl-3">{marge.verdict}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead><tr className="border-b">
                <th className="text-left py-1">Activité</th><th className="text-right py-1">CA</th><th className="text-right py-1">Marge</th><th className="text-right py-1">%</th><th className="py-1">Action</th>
              </tr></thead>
              <tbody>
                {marge.activites.map((a: any, i: number) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1">{a.nom}</td>
                    <td className="text-right">{formatAmount(a.ca)}</td>
                    <td className="text-right">{formatAmount(a.marge_brute)}</td>
                    <td className="text-right font-bold">{a.marge_pct}</td>
                    <td><Badge variant="outline" className={`text-[9px] ${a.classification === 'RENFORCER' ? 'text-success border-success/30' : a.classification === 'RESTRUCTURER' ? 'text-destructive border-destructive/30' : 'text-warning border-warning/30'}`}>{a.classification}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {marge.message_cle && <p className="text-xs font-medium mt-2 text-primary">{marge.message_cle}</p>}
        </CardContent></Card>
      )}

      {/* Projection 5 ans */}
      {proj.lignes?.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">📈 Projection Financière 5 Ans</h4>
          {proj.verdict && <p className="text-xs italic text-muted-foreground mb-3 border-l-2 border-primary/30 pl-3">{proj.verdict}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead><tr className="border-b">
                <th className="text-left py-1">Poste</th><th className="text-right py-1">An 1</th><th className="text-right py-1">An 2</th><th className="text-right py-1">An 3</th><th className="text-right py-1">An 4</th><th className="text-right py-1">An 5</th><th className="text-right py-1">CAGR</th>
              </tr></thead>
              <tbody>
                {proj.lignes.map((l: any, i: number) => (
                  <tr key={i} className={`border-b border-border/30 ${l.poste.includes('CA') ? 'font-bold' : ''}`}>
                    <td className="py-1">{l.poste}</td>
                    <td className="text-right">{new Intl.NumberFormat('fr-FR').format(l.an1)}</td>
                    <td className="text-right">{new Intl.NumberFormat('fr-FR').format(l.an2)}</td>
                    <td className="text-right">{new Intl.NumberFormat('fr-FR').format(l.an3)}</td>
                    <td className="text-right">{new Intl.NumberFormat('fr-FR').format(l.an4)}</td>
                    <td className="text-right">{new Intl.NumberFormat('fr-FR').format(l.an5)}</td>
                    <td className="text-right text-primary font-bold">{l.cagr || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      )}

      {/* Seuil de rentabilité */}
      {seuil.ca_point_mort && (
        <Card><CardContent className="py-3">
          <h4 className="text-xs font-bold text-primary mb-1">🎯 Seuil de Rentabilité (Année 1)</h4>
          <p className="text-sm">CA au point mort = <span className="font-bold">{formatAmount(seuil.ca_point_mort)}</span> · Atteint en <span className="font-bold">{seuil.atteint_en}</span></p>
          {seuil.verdict && <p className="text-xs text-muted-foreground mt-1 italic">{seuil.verdict}</p>}
        </CardContent></Card>
      )}

      {/* Scénarios */}
      {scenarios.tableau?.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">🔄 Analyse par Scénarios (Année 5)</h4>
          {scenarios.verdict && <p className="text-xs italic text-muted-foreground mb-3 border-l-2 border-primary/30 pl-3">{scenarios.verdict}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead><tr className="border-b">
                <th className="text-left py-1">Indicateur</th>
                <th className="text-right py-1 text-warning">⚠️ Prudent</th>
                <th className="text-right py-1 text-primary">📊 Central</th>
                <th className="text-right py-1 text-success">🚀 Ambitieux</th>
              </tr></thead>
              <tbody>
                {scenarios.tableau.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1 font-medium">{r.indicateur}</td>
                    <td className="text-right">{r.prudent}</td>
                    <td className="text-right font-bold">{r.central}</td>
                    <td className="text-right">{r.ambitieux}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {scenarios.sensibilite?.length > 0 && (
            <div className="mt-3 p-2 rounded bg-muted/30">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Sensibilité (±10%)</p>
              <ul className="text-[11px] space-y-0.5">
                {scenarios.sensibilite.map((s: string, i: number) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          )}
          {scenarios.recommandation_scenario && (
            <p className="text-xs font-medium mt-2 text-primary">📌 {scenarios.recommandation_scenario}</p>
          )}
        </CardContent></Card>
      )}

      {/* Plan d'action */}
      {planAction.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">🎯 Plan d'Action & Trajectoire</h4>
          <div className="space-y-1.5">
            {planAction.map((a: any, i: number) => (
              <div key={i} className={`p-2 rounded-lg border-l-4 text-xs ${
                a.horizon === 'COURT' ? 'border-l-success bg-success/5' :
                a.horizon === 'MOYEN' ? 'border-l-primary bg-primary/5' :
                'border-l-purple-500 bg-purple-50'
              }`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="outline" className="text-[9px]">{a.horizon}</Badge>
                  <span className="font-semibold">{a.action}</span>
                </div>
                <div className="flex gap-4 text-muted-foreground">
                  {a.cout && <span>💰 {a.cout}</span>}
                  {a.impact && <span>→ {a.impact}</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Impact attendu + Besoins financiers */}
      {(data.impact_attendu || data.besoins_financiers) && (
        <div className="grid grid-cols-2 gap-3">
          {data.impact_attendu && (
            <Card className="bg-success/5 border-success/20"><CardContent className="py-3">
              <h4 className="text-xs font-bold text-success mb-1">📈 Impact attendu</h4>
              {Object.entries(data.impact_attendu).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-0.5">
                  <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                  <span className="font-bold">{v as string}</span>
                </div>
              ))}
            </CardContent></Card>
          )}
          {data.besoins_financiers && (
            <Card className="bg-primary/5 border-primary/20"><CardContent className="py-3">
              <h4 className="text-xs font-bold text-primary mb-1">💰 Besoins financiers</h4>
              <p className="text-xs">CAPEX total: <span className="font-bold">{data.besoins_financiers.capex_total}</span></p>
              <p className="text-xs text-muted-foreground">Timing: {data.besoins_financiers.timing}</p>
            </CardContent></Card>
          )}
        </div>
      )}

      {/* Synthèse expert */}
      {data.synthese_expert && (
        <Card className="bg-gradient-to-br from-muted/50 to-muted/20"><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">🧠 Synthèse Expert</h4>
          <p className="text-xs leading-relaxed text-muted-foreground">{data.synthese_expert}</p>
        </CardContent></Card>
      )}

      {/* Risques clés */}
      {risques.length > 0 && (
        <Card className="border-destructive/20"><CardContent className="py-4">
          <h4 className="text-xs font-bold text-destructive mb-2">🚨 Risques Clés</h4>
          {risques.map((r: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-border/30">
              <Badge variant="outline" className={`text-[9px] flex-none ${r.severite === 'HAUTE' ? 'text-destructive border-destructive/30' : r.severite === 'CRITIQUE' ? 'text-destructive border-destructive' : 'text-warning border-warning/30'}`}>{r.severite}</Badge>
              <span>{r.risque}</span>
            </div>
          ))}
        </CardContent></Card>
      )}

      {/* Bailleurs potentiels */}
      {bailleurs.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">🏦 Bailleurs Potentiels</h4>
          {bailleurs.map((b: any, i: number) => (
            <div key={i} className="p-2 rounded bg-muted/30 mb-1 text-xs">
              <span className="font-bold">{b.nom}</span>
              <p className="text-muted-foreground mt-0.5">{b.raison}</p>
            </div>
          ))}
        </CardContent></Card>
      )}

      {/* Incohérences BMC ↔ Financiers */}
      {croisBmc.incoherences?.length > 0 && (
        <Card className="border-warning/20"><CardContent className="py-4">
          <h4 className="text-xs font-bold text-warning mb-2">⚠️ Incohérences BMC ↔ Financiers</h4>
          {croisBmc.synthese && <p className="text-xs text-muted-foreground mb-2">{croisBmc.synthese}</p>}
          {croisBmc.incoherences.map((inc: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-border/30">
              <Badge variant="outline" className={`text-[9px] flex-none ${inc.severite === 'CRITIQUE' ? 'text-destructive border-destructive' : inc.severite === 'HAUTE' ? 'text-destructive border-destructive/30' : 'text-warning border-warning/30'}`}>{inc.severite}</Badge>
              <span>{inc.description}</span>
            </div>
          ))}
        </CardContent></Card>
      )}

      {/* Données manquantes */}
      {manquantes.length > 0 && (
        <Card className="border-muted"><CardContent className="py-3">
          <h4 className="text-xs font-bold text-muted-foreground mb-1">📋 Données manquantes détectées</h4>
          <ul className="text-[11px] text-muted-foreground space-y-0.5">
            {manquantes.map((d: string, i: number) => <li key={i}>• {d}</li>)}
          </ul>
        </CardContent></Card>
      )}

      {/* Hypothèses */}
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

// ===== FRAMEWORK VIEWER (now in separate file: FrameworkViewer.tsx) =====

// ===== BILAN DE PROGRESSION VIEWER (6 zones) =====
function DiagnosticViewer({ data }: { data: any }) {
  // Support both old format and new "Bilan de progression" format
  const isNewFormat = !!(data.verdict_readiness || data.problemes || data.points_forts);

  // Compatibilité ancien format
  if (!isNewFormat) {
    return <LegacyDiagnosticViewer data={data} />;
  }

  const verdict = data.verdict_readiness || {};
  const progression = data.progression || {};
  const problemes = data.problemes || [];
  const questions = data.questions_entrepreneur || [];
  const pointsForts = data.points_forts || [];
  const benchmarks = data.benchmarks || {};
  const verdictFinal = data.verdict_final || {};

  const verdictColor = (score: number) =>
    score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-destructive';

  return (
    <div className="space-y-4">
      {/* ═══ ZONE 1 — Où en est-on ? ═══ */}
      <Card className="bg-card border shadow-sm">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white ${verdictColor(verdict.score || 0)}`}>
              {verdict.score || '—'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold">{data.metadata?.nom_entreprise}</span>
                {verdict.label && <Badge>{verdict.label}</Badge>}
                <Badge className={verdict.pret_pour_bailleur ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-foreground border-warning/20'}>
                  {verdict.pret_pour_bailleur ? 'Dossier prêt' : 'Pas encore prêt'}
                </Badge>
              </div>
              <p className="text-xs text-foreground mt-1 leading-relaxed">{verdict.resume}</p>
            </div>
          </div>

          {progression.score_initial != null && (
            <div className="mt-4 pt-4 border-t space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{progression.score_initial}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-sm font-semibold">{progression.score_actuel}</span>
                {progression.score_actuel != null && progression.score_initial != null && (
                  <Badge className={(progression.score_actuel - progression.score_initial) > 0 ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}>
                    {(progression.score_actuel - progression.score_initial) > 0 ? '+' : ''}{progression.score_actuel - progression.score_initial} pts
                  </Badge>
                )}
              </div>
              {progression.bloquants_leves?.map((b: string, i: number) => (
                <p key={i} className="text-xs text-success flex items-center gap-1.5"><CheckCircle className="h-3 w-3" />{b}</p>
              ))}
              {progression.bloquants_restants?.map((b: string, i: number) => (
                <p key={i} className="text-xs text-destructive flex items-center gap-1.5"><AlertCircle className="h-3 w-3" />{b}</p>
              ))}
              {progression.commentaire && (
                <p className="text-xs text-foreground italic">{progression.commentaire}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ ZONE 2 — Ce qui va coincer ═══ */}
      {problemes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Ce qui va coincer</h3>
          {problemes.map((p: any, i: number) => (
            <div
              key={i}
              className={`p-3 rounded-r-lg bg-card border border-l-4 shadow-sm ${
                p.urgence === 'bloquant'
                  ? 'border-l-destructive'
                  : p.urgence === 'important'
                  ? 'border-l-warning'
                  : 'border-l-info'
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[9px] ${
                  p.urgence === 'bloquant'
                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : p.urgence === 'important'
                    ? 'bg-warning/10 text-foreground border-warning/20'
                    : 'bg-info/10 text-info border-info/20'
                }`}>{p.urgence}</Badge>
                <span className="text-xs font-medium text-foreground">{p.titre}</span>
              </div>
              <p className="text-xs text-foreground mt-2 leading-relaxed">{p.constat}</p>
              <p className="text-xs text-primary mt-2 font-medium">→ {p.piste}</p>
              {p.source && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{p.source}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ ZONE 3 — Questions pour l'entrepreneur ═══ */}
      {questions.length > 0 && (
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="py-4">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Questions pour le prochain RDV</h4>
            <div className="space-y-2">
              {questions.map((q: string, i: number) => (
                <div key={i} className="flex gap-2 p-2.5 bg-card rounded-lg border shadow-sm">
                  <span className="text-xs font-bold text-primary mt-0.5">{i + 1}.</span>
                  <p className="text-xs text-foreground leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ ZONE 4 — Ce qui est solide ═══ */}
      {pointsForts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Ce qui est solide</h3>
          {pointsForts.map((pf: any, i: number) => (
            <div key={i} className="p-3 rounded-r-lg bg-card border border-l-4 border-l-success shadow-sm">
              <p className="text-xs font-medium text-foreground">{pf.titre}</p>
              <p className="text-xs text-foreground mt-1 leading-relaxed">{pf.constat}</p>
              <p className="text-xs text-success mt-2 font-medium">Argument bailleur : {pf.argument_bailleur}</p>
              {pf.source && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{pf.source}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ ZONE 5 — Benchmarks sectoriels ═══ */}
      {Object.keys(benchmarks).length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h4 className="text-xs font-bold text-primary mb-3">📊 Benchmarks sectoriels</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-1.5 font-semibold">Indicateur</th>
                  <th className="text-right py-1.5 font-semibold">Entreprise</th>
                  <th className="text-right py-1.5 font-semibold">Secteur</th>
                  <th className="py-1.5 font-semibold">Verdict</th>
                </tr></thead>
                <tbody>
                  {Object.entries(benchmarks).map(([key, bench]: [string, any]) => (
                    <tr key={key} className="border-b border-border/30">
                      <td className="py-1.5 font-medium capitalize">{key.replace(/_/g, ' ')}</td>
                      <td className="text-right">{bench.entreprise != null ? `${bench.entreprise}%` : '—'}</td>
                      <td className="text-right text-muted-foreground">{bench.secteur_min}–{bench.secteur_max}%</td>
                      <td className="pl-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                          bench.verdict === 'au_dessus' ? 'bg-success/10 text-success border-success/20' :
                          bench.verdict === 'dans_norme' ? 'bg-info/10 text-info border-info/20' :
                          'bg-destructive/10 text-destructive border-destructive/20'
                        }`}>{bench.verdict?.replace(/_/g, ' ') || '—'}</span>
                      </td>
                      <td className="pl-2">
                        {bench.source && (
                          <span className="text-[9px] text-muted-foreground/60 italic">{bench.source}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ ZONE 6 — Verdict final + prochaines étapes ═══ */}
      {(verdictFinal.synthese || verdictFinal.prochaines_etapes?.length > 0) && (
        <Card className="bg-card border shadow-sm">
          <CardContent className="py-4">
            <h4 className="text-xs font-bold text-primary mb-2">Verdict final</h4>
            <p className="text-xs text-foreground leading-relaxed">{verdictFinal.synthese}</p>
            {verdictFinal.delai_estime && (
              <Badge className="mt-3" variant="outline">
                {verdictFinal.delai_estime}
              </Badge>
            )}
            {verdictFinal.prochaines_etapes?.length > 0 && (
              <div className="mt-4 pt-3 border-t space-y-1">
                {verdictFinal.prochaines_etapes.map((e: string, i: number) => (
                  <p key={i} className="text-xs text-foreground">{e}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== LEGACY DIAGNOSTIC VIEWER (ancien format) =====
function LegacyDiagnosticViewer({ data }: { data: any }) {
  const [activeTab, setActiveTab] = useState('resume');

  const score = data.score_global || data.score || 0;
  const label = data.label || 'En construction';
  const couleur = data.couleur || '🟠';
  const scoresDims = data.scores_dimensions || {};
  const forces = data.forces || [];
  const opportunites = data.opportunites_amelioration || [];
  const pointsVigilance = data.points_vigilance || [];
  const incoherences = data.incoherences || [];
  const recommandations = data.recommandations || [];
  const benchmarks = data.benchmarks || {};
  const avisLivrables = data.avis_par_livrable || {};
  const synthese = data.synthese_globale || {};
  const pointsAttention = data.points_attention_prioritaires || [];

  const isOldFormat = !!(data.swot || data.diagnostic_par_dimension) && !data.scores_dimensions?.coherence?.analyse_detaillee;

  const scoreColor = (s: number) =>
    s >= 75 ? 'text-green-600' : s >= 55 ? 'text-yellow-600' : s >= 35 ? 'text-orange-500' : 'text-red-500';
  const scoreBarColor = (s: number) =>
    s >= 75 ? 'bg-green-500' : s >= 55 ? 'bg-yellow-400' : s >= 35 ? 'bg-orange-400' : 'bg-red-400';
  const niveauColor = (n: string) =>
    n === 'eleve' || n === 'Critique' || n === 'Élevé' ? 'text-red-500 bg-red-50 border-red-200' :
    n === 'moyen' || n === 'Moyen' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
    'text-green-600 bg-green-50 border-green-200';
  const qualiteColor = (q: string) =>
    q === 'excellent' ? 'bg-green-100 text-green-700' :
    q === 'bon' ? 'bg-blue-100 text-blue-700' :
    q === 'moyen' ? 'bg-yellow-100 text-yellow-700' :
    'bg-orange-100 text-orange-700';

  if (isOldFormat) {
    const dimensions = data.diagnostic_par_dimension || {};
    return (
      <div className="space-y-4">
        <ScoreHeader title="Bilan de progression" score={score} subtitle={data.synthese_executive} badge={data.niveau_maturite} />
        {Object.keys(dimensions).length > 0 && (
          <Card><CardContent className="py-4">
            <h4 className="text-xs font-bold text-primary mb-3">📊 Scores par dimension</h4>
            <div className="space-y-2">
              {Object.entries(dimensions).map(([key, dim]: [string, any]) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className={`font-bold ${scoreColor(dim.score)}`}>{dim.score}%</span>
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
              <SwotBox title="Forces" items={data.swot.forces} className="bg-green-50 border-green-200" />
              <SwotBox title="Faiblesses" items={data.swot.faiblesses} className="bg-red-50 border-red-200" />
              <SwotBox title="Opportunités" items={data.swot.opportunites} className="bg-blue-50 border-blue-200" />
              <SwotBox title="Menaces" items={data.swot.menaces} className="bg-yellow-50 border-yellow-200" />
            </div>
          </div>
        )}
        {data.risques_critiques?.length > 0 && (
          <Card className="border-red-200"><CardContent className="py-4">
            <h4 className="text-xs font-bold text-red-600 mb-2">🚨 Risques critiques</h4>
            {data.risques_critiques.map((r: any, i: number) => (
              <div key={i} className="p-2 rounded bg-red-50 mb-1 text-xs">
                <span className="font-medium">{r.risque}</span>
                <Badge variant="outline" className="ml-1 text-[9px]">{r.severite}</Badge>
                <p className="text-muted-foreground mt-0.5">→ {r.mitigation}</p>
              </div>
            ))}
          </CardContent></Card>
        )}
        {data.verdict && <p className="text-sm font-medium text-primary italic">{data.verdict}</p>}
      </div>
    );
  }

  const tabs = [
    { key: 'resume',      label: 'Résumé',         emoji: '📋' },
    { key: 'dimensions',  label: 'Dimensions',      emoji: '📊' },
    { key: 'livrables',   label: 'Livrables',       emoji: '📁' },
    { key: 'recommandations', label: "Plan d'action", emoji: '🎯' },
    { key: 'synthese',    label: 'Synthèse',        emoji: '💡' },
  ];

  return (
    <div className="space-y-4">
      {!data.metadata?.donnees_completes && (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-500 flex-none mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-blue-800">Diagnostic partiel</p>
            <p className="text-xs text-blue-600 mt-0.5">
              {data.message_incomplet || "Pour un diagnostic complet, complétez les modules manquants."}
            </p>
          </div>
        </div>
      )}

      <Card className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(222,47%,25%)] text-primary-foreground border-0">
        <CardContent className="py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Bilan de progression</p>
              <h2 className="text-xl font-display font-bold">{data.metadata?.nom_entreprise || 'Votre entreprise'}</h2>
              <p className="text-sm opacity-75 mt-1 leading-relaxed">
                {data.resume_executif
                  ? data.resume_executif.slice(0, 200) + (data.resume_executif.length > 200 ? '...' : '')
                  : 'Résumé en cours de génération...'}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {(data.metadata?.livrables_analyses || []).map((l: string) => (
                  <span key={l} className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 font-medium">{l}</span>
                ))}
              </div>
            </div>
            <div className="text-center flex-none">
              <p className="text-3xl font-display font-black">{score}</p>
              <p className="text-[10px] opacity-60">/100</p>
              <p className="text-[11px] mt-1 opacity-80">{couleur} {label}</p>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-white/60 transition-all" style={{ width: `${score}%` }} />
          </div>
        </CardContent>
      </Card>

      {pointsAttention.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-3 px-4">
            <p className="text-xs font-bold text-orange-700 mb-2">⚠️ Points d'attention prioritaires</p>
            <ul className="space-y-1">
              {pointsAttention.map((p: any, i: number) => (
                <li key={i} className="text-xs text-orange-700 flex gap-2">
                  <span className="font-bold flex-none">{i + 1}.</span>
                  <span>{typeof p === 'string' ? p : p.titre || JSON.stringify(p)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-0.5 overflow-x-auto border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'resume' && (
        <div className="space-y-4">
          <Card><CardContent className="py-4">
            <h4 className="text-xs font-bold text-primary mb-3">📋 Résumé exécutif</h4>
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
              {data.resume_executif || 'En cours de génération...'}
            </div>
          </CardContent></Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="py-3 px-4">
                <h4 className="text-xs font-bold text-green-700 mb-2">✅ Forces</h4>
                <div className="space-y-2">
                  {forces.map((f: any, i: number) => (
                    <div key={i} className="text-xs">
                      <p className="font-semibold text-green-800">{typeof f === 'string' ? f : f.titre || f.item}</p>
                      {f.justification && <p className="text-green-600 mt-0.5">{f.justification}</p>}
                      {f.livrable_source && <span className="text-[10px] text-green-500">← {f.livrable_source}</span>}
                    </div>
                  ))}
                  {forces.length === 0 && <p className="text-xs text-green-600 italic">En cours d'analyse...</p>}
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-3 px-4">
                <h4 className="text-xs font-bold text-amber-700 mb-2">💡 Opportunités d'amélioration</h4>
                <div className="space-y-2">
                  {opportunites.map((o: any, i: number) => (
                    <div key={i} className="text-xs">
                      <p className="font-semibold text-amber-800">{typeof o === 'string' ? o : o.titre || o.item}</p>
                      {o.justification && <p className="text-amber-600 mt-0.5">{o.justification}</p>}
                      {o.priorite && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium mt-1 inline-block ${
                          o.priorite === 'elevee' ? 'bg-red-100 text-red-600' : o.priorite === 'moyenne' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                        }`}>{o.priorite}</span>
                      )}
                    </div>
                  ))}
                  {opportunites.length === 0 && <p className="text-xs text-amber-600 italic">En cours d'analyse...</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {Object.keys(benchmarks).length > 0 && (
            <Card><CardContent className="py-4">
              <h4 className="text-xs font-bold text-primary mb-3">📊 Benchmarks sectoriels ({data.metadata?.pays})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-1.5 font-semibold">Indicateur</th>
                    <th className="text-right py-1.5 font-semibold">Entreprise</th>
                    <th className="text-right py-1.5 font-semibold">Secteur</th>
                    <th className="text-right py-1.5 font-semibold">Écart</th>
                    <th className="py-1.5 font-semibold">Verdict</th>
                  </tr></thead>
                  <tbody>
                    {Object.entries(benchmarks).map(([key, bench]: [string, any]) => (
                      <tr key={key} className="border-b border-border/30">
                        <td className="py-1.5 font-medium capitalize">{key.replace(/_/g, ' ')}</td>
                        <td className="text-right">{bench.entreprise != null ? `${bench.entreprise}%` : '—'}</td>
                        <td className="text-right text-muted-foreground">{bench.secteur_min}–{bench.secteur_max}%</td>
                        <td className="text-right">{bench.ecart || '—'}</td>
                        <td className="pl-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            bench.verdict === 'ok' ? 'bg-green-100 text-green-700' :
                            bench.verdict === 'moyen' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>{bench.verdict || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {benchmarks.marge_brute?.source && (
                <p className="text-[10px] text-muted-foreground mt-2">Source: {benchmarks.marge_brute.source}</p>
              )}
            </CardContent></Card>
          )}
        </div>
      )}

      {activeTab === 'dimensions' && (
        <div className="space-y-3">
          {Object.entries(scoresDims).map(([key, dim]: [string, any]) => (
            <Card key={key}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold">{dim.label || key.replace(/_/g, ' ')}</h4>
                    <p className="text-[10px] text-muted-foreground">Poids: {dim.poids || 0}% du score global</p>
                  </div>
                  <span className={`text-2xl font-black ${scoreColor(dim.score)}`}>{dim.score}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all ${scoreBarColor(dim.score)}`} style={{ width: `${dim.score}%` }} />
                </div>
                {dim.commentaire && <p className="text-xs text-muted-foreground mb-2">{dim.commentaire}</p>}
                {dim.analyse_detaillee && (
                  <div className="p-2 rounded bg-muted/30 text-xs text-foreground">{dim.analyse_detaillee}</div>
                )}
                {key === 'viabilite' && (dim.seuil_rentabilite_mois || dim.dscr || dim.cash_flow_positif_mois) && (
                  <div className="flex gap-3 mt-3 flex-wrap">
                    {dim.seuil_rentabilite_mois != null && (
                      <div className="p-2 rounded bg-muted/50 text-center text-xs">
                        <p className="text-muted-foreground">Seuil rentabilité</p>
                        <p className="font-bold">{dim.seuil_rentabilite_mois} mois</p>
                      </div>
                    )}
                    {dim.dscr != null && (
                      <div className="p-2 rounded bg-muted/50 text-center text-xs">
                        <p className="text-muted-foreground">DSCR</p>
                        <p className={`font-bold ${dim.dscr >= 1.3 ? 'text-green-600' : 'text-red-500'}`}>{Number(dim.dscr).toFixed(2)}</p>
                      </div>
                    )}
                    {dim.cash_flow_positif_mois != null && (
                      <div className="p-2 rounded bg-muted/50 text-center text-xs">
                        <p className="text-muted-foreground">Cash-flow positif</p>
                        <p className="font-bold">mois {dim.cash_flow_positif_mois}</p>
                      </div>
                    )}
                  </div>
                )}
                {key === 'realisme' && dim.red_flags?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] font-semibold text-orange-600">Points d'attention :</p>
                    {dim.red_flags.map((flag: string, i: number) => (
                      <p key={i} className="text-[11px] text-orange-600 flex gap-1.5">
                        <span>⚠</span>{flag}
                      </p>
                    ))}
                  </div>
                )}
                {key === 'completude_couts' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {dim.postes_presents?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-green-600 mb-1">✅ Coûts présents</p>
                        {dim.postes_presents.map((p: string, i: number) => (
                          <p key={i} className="text-[11px] text-green-700">• {p}</p>
                        ))}
                      </div>
                    )}
                    {dim.postes_manquants?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-amber-600 mb-1">💡 À compléter</p>
                        {dim.postes_manquants.map((p: string, i: number) => (
                          <p key={i} className="text-[11px] text-amber-700">• {p}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {dim.incoherences_detectees?.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-orange-600">🔗 Incohérences détectées :</p>
                    {dim.incoherences_detectees.map((inc: any, i: number) => (
                      <div key={i} className="p-2 rounded bg-orange-50 border border-orange-100 text-xs">
                        <span className="font-medium text-orange-700">{inc.type} • {inc.champ}</span>
                        <p className="text-orange-600 mt-0.5">{inc.explication}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {incoherences.length > 0 && (
            <Card className="border-orange-200">
              <CardContent className="py-4">
                <h4 className="text-xs font-bold text-orange-600 mb-3">🔗 Incohérences entre livrables</h4>
                <div className="space-y-2">
                  {incoherences.map((inc: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-orange-50 border border-orange-100 text-xs">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-semibold text-orange-800">{inc.type?.replace(/_/g, ' ↔ ')} — {inc.champ}</span>
                      </div>
                      <p className="text-orange-600 mb-1">
                        {inc.valeur_livrable_1} <span className="font-bold">≠</span> {inc.valeur_livrable_2}
                        {inc.ecart && <span className="ml-1 text-orange-500">(écart: {inc.ecart})</span>}
                      </p>
                      <p className="text-muted-foreground">{inc.explication}</p>
                      {inc.action_corrective && (
                        <p className="text-primary mt-1 font-medium">💡 {inc.action_corrective}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {pointsVigilance.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <h4 className="text-xs font-bold text-primary mb-3">⚠️ Points de vigilance</h4>
                <div className="space-y-2">
                  {pointsVigilance.map((pv: any, i: number) => {
                    const niv = typeof pv === 'string' ? 'moyen' : (pv.niveau || pv.severite || 'moyen');
                    const titre = typeof pv === 'string' ? pv : pv.titre || pv.risque || pv.item || '';
                    return (
                      <div key={i} className="p-3 rounded-lg border text-xs">
                        <div className="flex items-start gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-none ${niveauColor(niv)}`}>
                            {niv}
                          </span>
                          <p className="font-semibold">{titre}</p>
                        </div>
                        {pv.description && <p className="text-muted-foreground mb-1">{pv.description}</p>}
                        {pv.impact_financier && <p className="text-orange-600 text-[10px]">Impact: {pv.impact_financier}</p>}
                        {pv.action_recommandee && <p className="text-primary mt-1">→ {pv.action_recommandee}</p>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'livrables' && (
        <div className="space-y-3">
          {Object.entries(avisLivrables).length === 0 && (
            <Card><CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Aucun avis par livrable disponible.</p>
              <p className="text-xs text-muted-foreground mt-1">Régénérez le diagnostic avec plus de livrables complétés.</p>
            </CardContent></Card>
          )}
          {Object.entries(avisLivrables).map(([livrable, avis]: [string, any]) => {
            if (!avis || !avis.present) return null;
            const livrableLabels: Record<string, string> = {
              bmc: '📊 Business Model Canvas',
              sic: '🌍 Social Impact Canvas',
              inputs: '💰 Inputs Financiers',
              framework: '📈 Plan Financier Intermédiaire',
              plan_ovo: '📋 Plan Financier Final (OVO)',
              business_plan: '📄 Business Plan',
              odd: '✅ Due Diligence ODD',
            };
            return (
              <Card key={livrable}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-sm font-semibold">{livrableLabels[livrable] || livrable}</h4>
                    {avis.qualite && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${qualiteColor(avis.qualite)}`}>
                        {avis.qualite}
                      </span>
                    )}
                  </div>
                  {avis.avis_global && (
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">{avis.avis_global}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {avis.points_forts?.length > 0 && (
                      <div className="p-2 rounded bg-green-50 border border-green-100">
                        <p className="text-[10px] font-bold text-green-700 mb-1">✅ Points forts</p>
                        <ul className="space-y-0.5">
                          {avis.points_forts.map((pf: string, i: number) => (
                            <li key={i} className="text-[11px] text-green-700 flex gap-1">
                              <span>•</span><span>{pf}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {avis.points_amelioration?.length > 0 && (
                      <div className="p-2 rounded bg-amber-50 border border-amber-100">
                        <p className="text-[10px] font-bold text-amber-700 mb-1">💡 À améliorer</p>
                        <ul className="space-y-0.5">
                          {avis.points_amelioration.map((pa: string, i: number) => (
                            <li key={i} className="text-[11px] text-amber-700 flex gap-1">
                              <span>•</span><span>{pa}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {avis.recommandations_specifiques?.length > 0 && (
                    <div className="mt-3 p-2 rounded bg-primary/5 border border-primary/10">
                      <p className="text-[10px] font-bold text-primary mb-1">📌 Recommandations</p>
                      <ul className="space-y-1">
                        {avis.recommandations_specifiques.map((rec: string, i: number) => (
                          <li key={i} className="text-[11px] text-primary flex gap-1.5">
                            <span className="font-bold">{i + 1}.</span><span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'recommandations' && (
        <div className="space-y-3">
          {recommandations.length === 0 && (
            <Card><CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Aucune recommandation disponible.</p>
            </CardContent></Card>
          )}
          {recommandations.map((rec: any, i: number) => {
            if (typeof rec === 'string') {
              return (
                <Card key={i}><CardContent className="py-3 px-4 flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-none">{i + 1}</div>
                  <p className="text-xs">{rec}</p>
                </CardContent></Card>
              );
            }
            const urgenceColor = (u: string) =>
              u === 'elevee' ? 'border-l-red-400' : u === 'moyenne' ? 'border-l-yellow-400' : 'border-l-green-400';
            return (
              <Card key={i} className={`border-l-4 ${urgenceColor(rec.urgence || 'faible')}`}>
                <CardContent className="py-4 px-4">
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-black text-primary flex-none">
                      {rec.priorite || i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-xs font-bold">{rec.titre}</h4>
                        {rec.urgence && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-none ${
                            rec.urgence === 'elevee' ? 'bg-red-100 text-red-600' :
                            rec.urgence === 'moyenne' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-green-100 text-green-600'
                          }`}>{rec.urgence}</span>
                        )}
                      </div>
                      {rec.detail && <p className="text-xs text-muted-foreground mb-2">{rec.detail}</p>}
                      {rec.impact_viabilite && (
                        <p className="text-[11px] text-primary mb-1">📈 Impact: {rec.impact_viabilite}</p>
                      )}
                      {rec.action_concrete && (
                        <div className="p-2 rounded bg-primary/5 text-[11px] text-primary font-medium mb-1">
                          📋 Action: {rec.action_concrete}
                        </div>
                      )}
                      {rec.livrable_a_modifier && (
                        <span className="text-[10px] text-muted-foreground">Livrable: {rec.livrable_a_modifier}</span>
                      )}
                      {rec.message_encourageant && (
                        <p className="text-[11px] italic text-green-600 mt-1">💬 {rec.message_encourageant}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'synthese' && (
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="py-4">
              <h4 className="text-xs font-bold text-primary mb-3">🎯 Avis sur l'ensemble du projet</h4>
              <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                {synthese.avis_ensemble || 'En cours de génération...'}
              </div>
            </CardContent>
          </Card>

          {synthese.points_cles_a_retenir?.length > 0 && (
            <Card><CardContent className="py-4">
              <h4 className="text-xs font-bold text-primary mb-3">🔑 Points clés à retenir</h4>
              <div className="space-y-2">
                {synthese.points_cles_a_retenir.map((point: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/30 text-xs">
                    <span className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary flex-none">{i + 1}</span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}

          {synthese.demarche_recommandee?.length > 0 && (
            <Card><CardContent className="py-4">
              <h4 className="text-xs font-bold text-primary mb-3">🚀 Démarche recommandée</h4>
              <div className="space-y-3">
                {synthese.demarche_recommandee.map((etape: any, i: number) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-black text-primary-foreground flex-none">
                      {etape.etape || i + 1}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-xs font-semibold">{typeof etape === 'string' ? etape : etape.action}</p>
                      {etape.raison && <p className="text-[11px] text-muted-foreground mt-0.5">{etape.raison}</p>}
                      {etape.livrable_concerne && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground mt-1 inline-block">
                          {etape.livrable_concerne}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}

          {synthese.prochaines_etapes?.length > 0 && (
            <Card className="border-green-200 bg-green-50"><CardContent className="py-4">
              <h4 className="text-xs font-bold text-green-700 mb-2">📋 Prochaines étapes</h4>
              <ol className="space-y-1.5">
                {synthese.prochaines_etapes.map((etape: string, i: number) => (
                  <li key={i} className="text-xs text-green-800 flex gap-2">
                    <span className="font-bold text-green-600 flex-none">{i + 1}.</span>
                    <span>{etape}</span>
                  </li>
                ))}
              </ol>
            </CardContent></Card>
          )}
        </div>
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


// ===== GENERIC FALLBACK =====
function GenericJsonViewer({ data: _data }: { data: any }) {
  return (
    <Card><CardContent className="py-4">
      <p className="text-sm text-muted-foreground italic">Données disponibles — aucun viewer spécifique pour ce module.</p>
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
