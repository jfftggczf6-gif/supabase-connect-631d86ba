import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';

interface BPCreditData {
  intro_narratif?: string;
  objet_financement?: {
    montant_total: number;
    categories: Array<{ label: string; pct: number; montant: number; description?: string; fournisseur?: string | null; delai_livraison?: string | null }>;
  };
  justification_economique?: {
    situation_actuelle: Array<{ indicateur: string; valeur: string }>;
    apres_investissement: Array<{ indicateur: string; valeur: string; delta_positif?: boolean }>;
  };
  calcul_marge_additionnelle?: {
    volume_traite_annuel?: number;
    unite_volume?: string;
    marge_additionnelle_unitaire?: number;
    marge_additionnelle_annuelle?: number;
    service_credit_annuel?: number;
    excedent_disponible?: number;
    narratif?: string;
  };
  kpis_investissement?: { payback_annees?: number; payback_detail?: string; roi_pct_annee1?: number; roi_detail?: string; van_5ans?: number; van_detail?: string; taux_actualisation?: number };
  marche_cible?: {
    narratif_marche?: string;
    pipeline_commercial?: Array<{ acheteur: string; pays: string; volume: number; unite: string; prix_unitaire: number; ca_potentiel: number; statut: string }>;
    total_pipeline_volume?: number;
    total_pipeline_prix_moyen?: number;
    total_pipeline_ca?: number;
    couverture_capacite_pct?: number;
    narratif_pipeline?: string;
  };
  calendrier_execution?: Array<{ periode: string; etapes: string }>;
  risques_operationnels?: Array<{ risque: string; probabilite: string; mitigation: string }>;
  synthese_comite?: { argument_principal?: string; couverture_dette_par_marge?: string };
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

function statutColor(s: string) {
  const k = (s || '').toLowerCase();
  if (k.includes('signé') || k.includes('signe')) return 'text-emerald-700';
  if (k.includes('verbal')) return 'text-amber-700';
  return 'text-muted-foreground';
}

export default function BPCreditViewer({ data }: { data: BPCreditData }) {
  const obj = data.objet_financement;
  const just = data.justification_economique;
  const marg = data.calcul_marge_additionnelle || {};
  const kpis = data.kpis_investissement || {};
  const marche = data.marche_cible || {};
  const cal = data.calendrier_execution || [];
  const risques = data.risques_operationnels || [];
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

      {/* Objet du financement */}
      {obj && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-1">Objet du financement</h3>
          <p className="text-xs text-muted-foreground mb-3">Total demandé : <span className="font-semibold text-foreground">{fmt(obj.montant_total, devise)}</span></p>
          <div className={`grid gap-3 ${obj.categories.length === 2 ? 'md:grid-cols-2' : obj.categories.length >= 3 ? 'md:grid-cols-3' : ''}`}>
            {obj.categories.map((c, i) => (
              <div key={i} className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
                <div className="text-2xl font-bold text-emerald-700">{c.pct}%</div>
                <div className="text-sm font-semibold mb-0.5">{c.label}</div>
                <div className="text-xs text-emerald-700 mb-1">{fmt(c.montant, devise)}</div>
                {c.description && <div className="text-[11px] text-muted-foreground leading-snug">{c.description}</div>}
                {c.fournisseur && <div className="text-[10px] text-muted-foreground mt-1">Fournisseur : {c.fournisseur}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Justification économique */}
      {just && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Justification économique</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="text-xs font-semibold mb-2 text-muted-foreground">Situation actuelle</div>
              <ul className="space-y-1.5 text-xs">
                {just.situation_actuelle?.map((row, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{row.indicateur}</span>
                    <span className="font-medium">{row.valeur}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="text-xs font-semibold mb-2 text-emerald-700">Après investissement</div>
              <ul className="space-y-1.5 text-xs">
                {just.apres_investissement?.map((row, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{row.indicateur}</span>
                    <span className="font-medium text-emerald-700">{row.valeur}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Calcul marge additionnelle */}
      {marg.narratif && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Calcul de la marge additionnelle générée</h3>
          <ul className="text-sm space-y-1.5 mb-3">
            <li>Volume traité : <span className="font-medium">{fmt(marg.volume_traite_annuel)} {marg.unite_volume}</span></li>
            <li>Marge additionnelle unitaire : <span className="font-medium">{fmt(marg.marge_additionnelle_unitaire, devise)} / {marg.unite_volume?.replace(/s$/, '')}</span></li>
            <li>Marge additionnelle annuelle : <span className="font-semibold text-emerald-700">{fmt(marg.marge_additionnelle_annuelle, devise)}</span></li>
            <li>Service annuel du crédit : <span className="font-medium">{fmt(marg.service_credit_annuel, devise)}</span></li>
            <li>Excédent disponible : <span className="font-semibold text-emerald-700">{fmt(marg.excedent_disponible, devise)}</span></li>
          </ul>
          <p className="text-xs text-muted-foreground italic">{marg.narratif}</p>
        </Card>
      )}

      {/* KPIs investissement */}
      {(kpis.payback_annees !== undefined || kpis.roi_pct_annee1 !== undefined) && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center bg-emerald-50/50 border-emerald-200">
            <div className="text-[10px] uppercase text-emerald-700">Payback simple</div>
            <div className="text-2xl font-bold text-emerald-700">{kpis.payback_annees?.toFixed(1)} ans</div>
            {kpis.payback_detail && <div className="text-[10px] text-muted-foreground mt-0.5">{kpis.payback_detail}</div>}
          </Card>
          <Card className="p-3 text-center bg-emerald-50/50 border-emerald-200">
            <div className="text-[10px] uppercase text-emerald-700">ROI 1ère année</div>
            <div className="text-2xl font-bold text-emerald-700">{kpis.roi_pct_annee1}%</div>
            {kpis.roi_detail && <div className="text-[10px] text-muted-foreground mt-0.5">{kpis.roi_detail}</div>}
          </Card>
          <Card className="p-3 text-center bg-emerald-50/50 border-emerald-200">
            <div className="text-[10px] uppercase text-emerald-700">VAN 5 ans ({kpis.taux_actualisation || 10}%)</div>
            <div className="text-2xl font-bold text-emerald-700">+{fmt(kpis.van_5ans, devise)}</div>
            {kpis.van_detail && <div className="text-[10px] text-muted-foreground mt-0.5">{kpis.van_detail}</div>}
          </Card>
        </div>
      )}

      {/* Marché cible et pipeline */}
      {(marche.narratif_marche || marche.pipeline_commercial?.length) && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-2">Marché cible et pipeline commercial</h3>
          {marche.narratif_marche && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{marche.narratif_marche}</p>}
          {marche.pipeline_commercial?.length ? (
            <div className="rounded-md border border-border overflow-hidden text-xs">
              <div className="grid grid-cols-[2fr_0.8fr_0.8fr_1fr_1.2fr] gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
                <span>Acheteur cible {marche.pipeline_commercial[0]?.unite ? '' : '(2027)'}</span>
                <span className="text-right">Volume tonnes</span>
                <span className="text-right">Prix FCFA/kg</span>
                <span className="text-right">CA potentiel</span>
                <span>Statut</span>
              </div>
              {marche.pipeline_commercial.map((p, i) => (
                <div key={i} className="grid grid-cols-[2fr_0.8fr_0.8fr_1fr_1.2fr] gap-2 px-3 py-2 border-t">
                  <span>
                    <span className="font-medium">{p.acheteur}</span>
                    {p.pays && <span className="text-muted-foreground"> ({p.pays})</span>}
                  </span>
                  <span className="text-right">{fmt(p.volume)}{p.unite ? `${p.unite}` : 't'}</span>
                  <span className="text-right">{fmt(p.prix_unitaire)}</span>
                  <span className="text-right font-medium">{fmt(p.ca_potentiel, devise)}</span>
                  <span className={statutColor(p.statut)}>{p.statut}</span>
                </div>
              ))}
              {(marche.total_pipeline_ca || marche.total_pipeline_volume) && (
                <div className="grid grid-cols-[2fr_0.8fr_0.8fr_1fr_1.2fr] gap-2 px-3 py-2 border-t bg-muted/30 font-semibold">
                  <span>Total identifié</span>
                  <span className="text-right">{marche.total_pipeline_volume ? `${fmt(marche.total_pipeline_volume)}t` : '—'}</span>
                  <span className="text-right">{marche.total_pipeline_prix_moyen ? fmt(marche.total_pipeline_prix_moyen) : '—'}</span>
                  <span className="text-right">{marche.total_pipeline_ca ? fmt(marche.total_pipeline_ca, devise) : '—'}</span>
                  <span className="text-emerald-700">{marche.couverture_capacite_pct ? `${marche.couverture_capacite_pct}% capacité` : ''}</span>
                </div>
              )}
            </div>
          ) : null}
          {marche.narratif_pipeline && (
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{marche.narratif_pipeline}</p>
          )}
        </Card>
      )}

      {/* Calendrier */}
      {cal.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Calendrier d'exécution</h3>
          <div className="space-y-2">
            {cal.map((row, i) => (
              <div key={i} className="flex gap-3 text-xs border-l-2 border-primary pl-3 py-1">
                <span className="font-semibold whitespace-nowrap min-w-[100px]">{row.periode}</span>
                <span className="text-muted-foreground">{row.etapes}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Risques opérationnels */}
      {risques.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Risques opérationnels
          </h3>
          <div className="rounded-md border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-[2fr_1fr_3fr] gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
              <span>Risque</span>
              <span>Probabilité</span>
              <span>Mitigation</span>
            </div>
            {risques.map((r, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_3fr] gap-2 px-3 py-2 border-t">
                <span className="font-medium">{r.risque}</span>
                <span><Badge variant="outline" className={`text-[10px] ${probaColor(r.probabilite)}`}>{r.probabilite}</Badge></span>
                <span className="text-muted-foreground leading-snug">{r.mitigation}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Synthèse */}
      {(synth.argument_principal || synth.couverture_dette_par_marge) && (
        <Card className="p-5 border-l-4 border-l-primary bg-emerald-50/30">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            Synthèse pour le comité
          </h3>
          {synth.argument_principal && <p className="text-sm leading-relaxed mb-2">{synth.argument_principal}</p>}
          {synth.couverture_dette_par_marge && (
            <p className="text-xs text-emerald-800 italic flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3" />
              {synth.couverture_dette_par_marge}
            </p>
          )}
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
