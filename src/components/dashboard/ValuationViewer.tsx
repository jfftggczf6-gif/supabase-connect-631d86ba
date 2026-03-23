import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Target, AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportToPdf } from '@/lib/export-pdf';
import ConfidenceIndicator from './ConfidenceIndicator';

interface Props {
  data: Record<string, any>;
  onRegenerate?: () => void;
}

const fmt = (n: any, devise = 'FCFA') => {
  if (n == null || isNaN(Number(n))) return '—';
  const num = Number(n);
  if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(1)}B ${devise}`;
  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(0)}M ${devise}`;
  if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(0)}k ${devise}`;
  return `${num.toLocaleString('fr-FR')} ${devise}`;
};

export default function ValuationViewer({ data, onRegenerate }: Props) {
  const devise = data.devise || 'FCFA';
  const dcf = data.dcf || {};
  const multiples = data.multiples || {};
  const decotes = data.decotes_primes || {};
  const synthese = data.synthese_valorisation || {};
  const implications = data.implications_investissement || {};
  const wacc = dcf.wacc_detail || {};

  const scoreBg = (data.score || 0) >= 70 ? 'bg-emerald-100 text-emerald-700' : (data.score || 0) >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  const handleDownloadHtml = () => {
    const content = document.getElementById('valuation-viewer-content')?.innerHTML || '';
    const fullHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Valorisation</title>
    <style>@page{size:A4;margin:16mm}body{font-family:"Segoe UI",sans-serif;font-size:10pt;color:#1E293B;max-width:190mm;margin:0 auto;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px;text-align:left;font-size:9pt}</style>
    </head><body>${content}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `valorisation_${new Date().toISOString().slice(0, 10)}.html`; a.click();
    URL.revokeObjectURL(url);
    toast.success('HTML téléchargé');
  };

  return (
    <div className="space-y-6" id="valuation-viewer-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-violet-600" /> Valorisation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Analyse par 3 méthodes — DCF, Multiples EBITDA, Multiples CA</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadHtml}>
            <Download className="h-3.5 w-3.5" /> HTML (A4)
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
            try {
              const content = document.getElementById('valuation-viewer-content')?.innerHTML || '';
              const fullHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Valorisation</title><style>@page{size:A4;margin:16mm}body{font-family:"Segoe UI",sans-serif;font-size:10pt;color:#1E293B;max-width:190mm;margin:0 auto;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px;text-align:left;font-size:9pt}</style></head><body>${content}</body></html>`;
              await exportToPdf(fullHtml, `valorisation_${new Date().toISOString().slice(0, 10)}.pdf`);
              toast.success('PDF téléchargé');
            } catch (err: any) { toast.error(`Erreur PDF : ${err.message}`); }
          }}>
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Badge className={`text-lg px-4 py-2 ${scoreBg}`}>{data.score || 0}/100</Badge>
          {onRegenerate && (
            <button onClick={onRegenerate} className="text-xs text-muted-foreground hover:text-foreground underline">
              Regénérer
            </button>
          )}
        </div>
      </div>

      {/* Fourchette de valorisation */}
      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Valeur Basse</p>
              <p className="text-2xl font-bold text-red-600">{fmt(synthese.valeur_basse, devise)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Valeur Médiane</p>
              <p className="text-3xl font-bold text-violet-700">{fmt(synthese.valeur_mediane, devise)}<ConfidenceIndicator field="valeur_mediane" confidence={data._confidence} /></p>
              <p className="text-xs text-muted-foreground mt-1">Méthode : {synthese.methode_privilegiee || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Valeur Haute</p>
              <p className="text-2xl font-bold text-emerald-600">{fmt(synthese.valeur_haute, devise)}</p>
            </div>
          </div>
          {synthese.justification_methode && (
            <p className="text-sm text-muted-foreground mt-4 text-center italic">{synthese.justification_methode}</p>
          )}
        </CardContent>
      </Card>

      {/* 3 Method Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* DCF */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-600" /> DCF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">WACC</span><span className="font-semibold">{dcf.wacc_pct || '—'}%<ConfidenceIndicator field="wacc" confidence={data._confidence} /></span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Valeur Terminale</span><span className="font-semibold">{fmt(dcf.terminal_value, devise)}<ConfidenceIndicator field="terminal_value" confidence={data._confidence} /></span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Enterprise Value</span><span className="font-semibold">{fmt(dcf.enterprise_value, devise)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Equity Value</span><span className="font-bold text-blue-600">{fmt(dcf.equity_value, devise)}</span></div>
            {dcf.projections_cashflow && (
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold mb-1">Cash-flows projetés</p>
                {dcf.projections_cashflow.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs text-muted-foreground">
                    <span>{p.annee}</span><span>{fmt(p.fcf, devise)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Multiples EBITDA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /> Multiples EBITDA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">EBITDA</span><span className="font-semibold">{fmt(multiples.ebitda_dernier_exercice, devise)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Multiple retenu</span><span className="font-semibold">{multiples.multiple_ebitda_retenu || '—'}×</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Valeur</span><span className="font-bold text-emerald-600">{fmt(multiples.valeur_par_ebitda, devise)}</span></div>
            {multiples.fourchette_ebitda && (
              <p className="text-[10px] text-muted-foreground">
                Fourchette sectorielle : {multiples.fourchette_ebitda[0]}×–{multiples.fourchette_ebitda[1]}×
                {multiples.source_multiples && <span className="italic"> (source: {multiples.source_multiples})</span>}
              </p>
            )}
            {multiples.justification_multiples && (
              <p className="text-xs text-muted-foreground pt-2 border-t">{multiples.justification_multiples}</p>
            )}
          </CardContent>
        </Card>

        {/* Multiples CA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-amber-600" /> Multiples CA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">CA</span><span className="font-semibold">{fmt(multiples.ca_dernier_exercice, devise)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Multiple retenu</span><span className="font-semibold">{multiples.multiple_ca_retenu || '—'}×</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Valeur</span><span className="font-bold text-amber-600">{fmt(multiples.valeur_par_ca, devise)}</span></div>
            {multiples.fourchette_ca && (
              <p className="text-[10px] text-muted-foreground">
                Fourchette sectorielle : {multiples.fourchette_ca[0]}×–{multiples.fourchette_ca[1]}×
              </p>
            )}
            {multiples.comparables_references && multiples.comparables_references.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold mb-1">Comparables</p>
                {multiples.comparables_references.map((r: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">• {r}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* WACC Decomposition */}
      {wacc.cost_of_equity && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Décomposition du WACC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Risk-Free Rate', val: wacc.risk_free_rate },
                { label: 'ERP Afrique', val: wacc.equity_risk_premium_africa },
                { label: 'Prime Taille', val: wacc.size_premium },
                { label: 'Prime Illiquidité', val: wacc.illiquidity_premium },
                { label: 'Cost of Equity', val: wacc.cost_of_equity },
                { label: 'Cost of Debt', val: wacc.cost_of_debt },
                { label: 'Poids Equity', val: wacc.equity_weight ? `${(wacc.equity_weight * 100).toFixed(0)}%` : null },
                { label: 'WACC Final', val: dcf.wacc_pct },
              ].map((item, i) => (
                <div key={i} className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                  <p className="text-sm font-semibold">{typeof item.val === 'number' ? `${item.val}%` : item.val || '—'}</p>
                </div>
              ))}
            </div>
            {(wacc.source_wacc || dcf.source_wacc) && (
              <p className="text-[10px] text-muted-foreground mt-3 italic">
                Source : {wacc.source_wacc || dcf.source_wacc}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sensitivity */}
      {dcf.sensitivity && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Analyse de Sensibilité</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-red-50">
                <p className="text-xs text-red-600 mb-1">WACC +2%</p>
                <p className="font-bold text-sm">{fmt(dcf.sensitivity.wacc_plus_2, devise)}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50">
                <p className="text-xs text-blue-600 mb-1">Base</p>
                <p className="font-bold text-sm">{fmt(dcf.sensitivity.wacc_base, devise)}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50">
                <p className="text-xs text-emerald-600 mb-1">WACC -2%</p>
                <p className="font-bold text-sm">{fmt(dcf.sensitivity.wacc_minus_2, devise)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 text-center">
              <div className="p-3 rounded-lg bg-amber-50">
                <p className="text-xs text-amber-600 mb-1">Croissance -1%</p>
                <p className="font-bold text-sm">{fmt(dcf.sensitivity.growth_minus_1, devise)}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50">
                <p className="text-xs text-emerald-600 mb-1">Croissance +1%</p>
                <p className="font-bold text-sm">{fmt(dcf.sensitivity.growth_plus_1, devise)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Décotes / Primes */}
      {decotes.ajustement_total_pct != null && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Décotes & Primes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: 'Illiquidité', val: decotes.decote_illiquidite_pct, neg: true },
                { label: 'Taille', val: decotes.decote_taille_pct, neg: true },
                { label: 'Gouvernance', val: decotes.decote_gouvernance_pct, neg: true },
                { label: 'Prime Croissance', val: decotes.prime_croissance_pct, neg: false },
              ].filter(d => d.val).map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{d.label}</span>
                  <span className={`text-sm font-semibold ${d.neg ? 'text-red-600' : 'text-emerald-600'}`}>
                    {d.neg ? '-' : '+'}{d.val}%
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-semibold">Ajustement Total</span>
                <span className={`text-sm font-bold ${decotes.ajustement_total_pct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {decotes.ajustement_total_pct > 0 ? '+' : ''}{decotes.ajustement_total_pct}%
                </span>
              </div>
            </div>
            {decotes.justification && <p className="text-xs text-muted-foreground mt-3">{decotes.justification}</p>}
          </CardContent>
        </Card>
      )}

      {/* Implications investissement */}
      {implications.pre_money_estime && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-indigo-600" /> Implications Investissement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pre-money estimé</span><span className="font-bold">{fmt(implications.pre_money_estime, devise)}</span></div>
            {implications.si_levee_100m && <div className="text-sm p-2 rounded bg-muted/50">💰 Levée 100M : {implications.si_levee_100m}</div>}
            {implications.si_levee_500m && <div className="text-sm p-2 rounded bg-muted/50">💰 Levée 500M : {implications.si_levee_500m}</div>}
            {implications.multiple_sortie_estime && <div className="text-sm p-2 rounded bg-muted/50">📈 Multiple sortie : {implications.multiple_sortie_estime}</div>}
            {implications.irr_investisseur_estime && <div className="text-sm p-2 rounded bg-muted/50">📊 IRR investisseur : {implications.irr_investisseur_estime}</div>}
          </CardContent>
        </Card>
      )}

      {/* Note analyste */}
      {synthese.note_analyste && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Note de l'Analyste</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{synthese.note_analyste}</p>
          </CardContent>
        </Card>
      )}

      {dcf.note_methodologique && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Note Méthodologique DCF</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{dcf.note_methodologique}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
