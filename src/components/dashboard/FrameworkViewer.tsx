import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ConfidenceIndicator from './ConfidenceIndicator';


interface FrameworkViewerProps {
  data: any;
}

export default function FrameworkViewer({ data }: FrameworkViewerProps) {
  const ratios = data.ratios || {};
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

  const formatAmount = (n: number) => {
    if (!n && n !== 0) return '—';
    return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
  };

  return (
    <div className="space-y-4">
      {/* Score Header */}
      <Card className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(222,47%,25%)] text-primary-foreground border-0">
        <CardContent className="py-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-display font-bold">Plan Financier Intermédiaire</h2>
              {data.capacite_investissement && <p className="mt-1.5 text-sm opacity-80">{data.capacite_investissement}</p>}
              {data.periode && <Badge className="mt-2 bg-white/20 text-primary-foreground border-0 text-[10px]">{data.periode} • Fiabilité: {data.fiabilite || 'N/A'}</Badge>}
            </div>
            {data.score !== undefined && (
              <div className="text-center ml-4">
                <p className="text-4xl font-display font-black">{data.score}</p>
                <p className="text-[10px] opacity-60">/100</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs Bar */}
      {kpis.ca_annee_n && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Marge EBITDA', value: kpis.marge_ebitda },
            { label: 'CA Année N', value: <>{formatAmount(kpis.ca_annee_n)}<ConfidenceIndicator field="chiffre_affaires_y0" confidence={data._confidence} /></> },
            { label: 'EBITDA', value: <>{formatAmount(kpis.ebitda)}<ConfidenceIndicator field="ebitda" confidence={data._confidence} /></> },
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

      {/* Ratios par catégorie */}
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

      {/* État de santé financière */}
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
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-success/20 bg-success/5"><CardContent className="py-3">
              <h4 className="text-xs font-bold text-success mb-1">✅ Forces</h4>
              <ul className="text-[11px] space-y-0.5">{(sante.forces || []).map((s: string, i: number) => <li key={i}>• {s}</li>)}</ul>
            </CardContent></Card>
            <Card className="border-destructive/20 bg-destructive/5"><CardContent className="py-3">
              <h4 className="text-xs font-bold text-destructive mb-1">⚠️ Faiblesses</h4>
              <ul className="text-[11px] space-y-0.5">{(sante.faiblesses || []).map((w: string, i: number) => <li key={i}>• {w}</li>)}</ul>
            </CardContent></Card>
          </div>
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
                  <tr key={i} className={`border-b border-border/30 ${l.poste.includes('CA') || l.poste.includes('Trésorerie') ? 'font-bold' : ''}`}>
                    <td className="py-1">{l.poste}</td>
                    <td className="text-right">{typeof l.an1 === 'number' ? new Intl.NumberFormat('fr-FR').format(l.an1) : l.an1}</td>
                    <td className="text-right">{typeof l.an2 === 'number' ? new Intl.NumberFormat('fr-FR').format(l.an2) : l.an2}</td>
                    <td className="text-right">{typeof l.an3 === 'number' ? new Intl.NumberFormat('fr-FR').format(l.an3) : l.an3}</td>
                    <td className="text-right">{typeof l.an4 === 'number' ? new Intl.NumberFormat('fr-FR').format(l.an4) : l.an4}</td>
                    <td className="text-right">{typeof l.an5 === 'number' ? new Intl.NumberFormat('fr-FR').format(l.an5) : l.an5}</td>
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
                  <tr key={i} className={`border-b border-border/30 ${r.indicateur === 'ROI' ? 'font-bold' : ''}`}>
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

      {/* Score investissabilité */}
      {data.score_investissabilite != null && (
        <Card><CardContent className="py-4 text-center">
          <h4 className="text-xs font-bold text-primary mb-2">💰 Score d'Investissabilité</h4>
          <p className="text-3xl font-display font-black">{data.score_investissabilite} <span className="text-lg text-muted-foreground">/100</span></p>
          {data.analyse_scenarios_ia && <p className="text-xs text-muted-foreground mt-2 max-w-lg mx-auto">{data.analyse_scenarios_ia}</p>}
        </CardContent></Card>
      )}

      {/* Risques clés */}
      {risques.length > 0 && (
        <Card className="border-destructive/20"><CardContent className="py-4">
          <h4 className="text-xs font-bold text-destructive mb-2">🚨 Risques Clés</h4>
          {risques.map((r: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-border/30">
              <Badge variant="outline" className={`text-[9px] flex-none ${r.severite === 'HAUTE' || r.severite === 'CRITIQUE' ? 'text-destructive border-destructive/30' : 'text-warning border-warning/30'}`}>{r.severite}</Badge>
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

      {/* Legacy: points forts/faibles + recommandations (if no sante_financiere) */}
      {!sante.forces?.length && (data.points_forts?.length > 0 || data.points_faibles?.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-success/20 bg-success/5"><CardContent className="py-3">
            <h4 className="text-xs font-bold text-success mb-1">✅ Points forts</h4>
            <ul className="text-[11px] space-y-0.5">{(data.points_forts || []).map((s: string, i: number) => <li key={i}>• {s}</li>)}</ul>
          </CardContent></Card>
          <Card className="border-destructive/20 bg-destructive/5"><CardContent className="py-3">
            <h4 className="text-xs font-bold text-destructive mb-1">⚠️ Points faibles</h4>
            <ul className="text-[11px] space-y-0.5">{(data.points_faibles || []).map((w: string, i: number) => <li key={i}>• {w}</li>)}</ul>
          </CardContent></Card>
        </div>
      )}

      {data.recommandations?.length > 0 && (
        <Card><CardContent className="py-4">
          <h4 className="text-xs font-bold text-primary mb-2">🎯 Recommandations</h4>
          <ul className="space-y-1">
            {data.recommandations.map((r: string, i: number) => (
              <li key={i} className="text-xs flex gap-1.5"><span className="text-primary">→</span>{r}</li>
            ))}
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
