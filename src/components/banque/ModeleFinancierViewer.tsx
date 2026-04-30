// ModeleFinancierViewer — affichage du livrable "Modèle financier nettoyé" (CR_1).
// Structure : objectif → travaux réalisés → PnL retraité 3 ans → bilan retraité →
// 8 KPIs recalculés → synthèse comité → sources.

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

interface PnLLine {
  label: string;
  values?: (number | null)[];
  type?: 'produit' | 'charge' | 'calc' | 'sub' | 'retraitement' | 'sub_retraitement';
  bold?: boolean;
  with_pct?: boolean;
  highlight?: 'green' | null;
  can_be_positive?: boolean;
}

interface BilanLine {
  label: string;
  value?: number | null;
  type?: 'ligne' | 'sub' | 'calc' | 'negatif';
}

interface KpiCard {
  code: string;
  label: string;
  valeur: string;
  valeur_num?: number;
  detail?: string;
  seuil?: string;
  tone?: 'good' | 'warning' | 'bad';
}

interface ModeleFinancierData {
  objectif?: string;
  travaux_realises?: Array<{ label: string; detail: string }>;
  pnl_retraite?: { annees: string[]; lignes: PnLLine[] };
  bilan_retraite?: {
    date_arrete?: string;
    actif?: BilanLine[];
    passif?: BilanLine[];
    total_actif?: number;
    total_passif?: number;
  };
  kpis_recalcules?: KpiCard[];
  synthese_comite?: {
    narratif?: string;
    ebe_avant_retraitement?: number;
    ebe_apres_retraitement?: number;
    ecart_pct?: number;
    verdict?: string;
  };
  sources?: string[];
  metadata?: { devise?: string };

  // ─── compat avec l'ancien schéma (fallback rendu si nouveau manquant) ───
  compte_resultat_retraite?: any;
  retraitements?: any[];
  ratios_post_retraitement?: any;
  synthese?: any;
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
  if (n >= 0) return `+${fmt(n)}`;
  return `-${fmt(Math.abs(n))}`;
}

const TONE_CLS: Record<string, string> = {
  good:    'text-emerald-700',
  warning: 'text-amber-700',
  bad:     'text-red-700',
};

export default function ModeleFinancierViewer({ data }: { data: ModeleFinancierData }) {
  const pnl = data.pnl_retraite;
  const bilan = data.bilan_retraite;
  const kpis = data.kpis_recalcules || [];
  const synth = data.synthese_comite;
  const travaux = data.travaux_realises || [];
  const sources = data.sources || [];

  return (
    <div className="space-y-4">
      {/* Objectif */}
      {data.objectif && (
        <Card className="p-4 bg-muted/20">
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">Objectif : </span>
            {data.objectif}
          </p>
        </Card>
      )}

      {/* Travaux réalisés */}
      {travaux.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Travaux réalisés</h3>
          <ul className="space-y-2 text-xs">
            {travaux.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <div className="flex-1 leading-relaxed">
                  <span className="font-semibold">{t.label}</span>
                  {t.detail && <span className="text-muted-foreground"> : {t.detail}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* PnL retraité 3 ans */}
      {pnl && pnl.lignes?.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">PnL retraité — historique 3 ans</h3>
          <div className="rounded-md bg-muted/30 p-3 overflow-x-auto">
            <PnLTable annees={pnl.annees} lignes={pnl.lignes} />
          </div>
        </Card>
      )}

      {/* Bilan retraité — synthèse */}
      {bilan && (bilan.actif?.length || bilan.passif?.length) && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">
            Bilan retraité — synthèse
            {bilan.date_arrete && <span className="text-xs text-muted-foreground font-normal ml-2">au {bilan.date_arrete}</span>}
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            <BilanSide title="Actif" lines={bilan.actif || []} total={bilan.total_actif} />
            <BilanSide title="Passif" lines={bilan.passif || []} total={bilan.total_passif} />
          </div>
        </Card>
      )}

      {/* 8 KPIs recalculés */}
      {kpis.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">KPIs financiers recalculés</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map((k) => {
              const tone = TONE_CLS[k.tone || 'good'] || 'text-foreground';
              return (
                <div key={k.code} className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
                  <div className={`text-2xl font-bold ${tone}`}>{k.valeur}</div>
                  {k.detail && <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{k.detail}</div>}
                  {k.seuil && <div className={`text-[10px] mt-0.5 ${k.tone === 'good' ? 'text-emerald-700' : 'text-muted-foreground italic'}`}>{k.seuil}</div>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Synthèse comité */}
      {synth?.narratif && (
        <Card className="p-5 border-l-4 border-l-amber-500 bg-amber-50/30">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            Synthèse pour le comité
            {synth.verdict && (
              <Badge variant="outline" className="ml-auto bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {synth.verdict}
              </Badge>
            )}
          </h3>
          {(synth.ebe_avant_retraitement !== undefined || synth.ebe_apres_retraitement !== undefined) && (
            <div className="grid grid-cols-3 gap-3 mb-3">
              {synth.ebe_avant_retraitement !== undefined && (
                <div className="rounded-md bg-muted/40 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">EBE déclaré</div>
                  <div className="font-semibold">{fmt(synth.ebe_avant_retraitement)}</div>
                </div>
              )}
              {synth.ebe_apres_retraitement !== undefined && (
                <div className="rounded-md bg-emerald-100 p-2 text-center">
                  <div className="text-[10px] text-emerald-700">EBE retraité</div>
                  <div className="font-semibold text-emerald-700">{fmt(synth.ebe_apres_retraitement)}</div>
                </div>
              )}
              {synth.ecart_pct !== undefined && (
                <div className="rounded-md bg-amber-100 p-2 text-center">
                  <div className="text-[10px] text-amber-700">Écart</div>
                  <div className="font-semibold text-amber-700">{synth.ecart_pct > 0 ? '+' : ''}{synth.ecart_pct.toFixed(1)}%</div>
                </div>
              )}
            </div>
          )}
          <p className="text-sm leading-relaxed">{synth.narratif}</p>
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

function PnLTable({ annees, lignes }: { annees: string[]; lignes: PnLLine[] }) {
  // % du CA pour les lignes calc avec with_pct
  const ca = lignes.find(l => l.type === 'produit' && l.bold)?.values || [];

  const cols = annees.length;
  const gridCls = `grid grid-cols-[2.4fr_repeat(${cols},1fr)] gap-2`;

  return (
    <div>
      <div className={`${gridCls} text-[10px] font-semibold text-muted-foreground border-b pb-2 mb-1`}>
        <span></span>
        {annees.map((y, i) => (
          <span key={i} className="text-right">{y}</span>
        ))}
      </div>
      {lignes.map((row, i) => {
        const isSub = row.type === 'sub';
        const isCharge = row.type === 'charge';
        const isCalc = row.type === 'calc';
        const isRetr = row.type === 'retraitement';
        const isSubRetr = row.type === 'sub_retraitement';
        const isHighlight = row.highlight === 'green';

        const lineCls = [
          gridCls,
          'py-1 text-xs',
          isCalc ? `border-t mt-0.5 pt-1.5 ${row.bold ? 'font-semibold' : ''}` : '',
          isHighlight ? 'text-emerald-700 font-semibold' : '',
          isRetr || isSubRetr ? 'text-red-700 italic' : '',
        ].filter(Boolean).join(' ');

        return (
          <div key={i} className={lineCls}>
            <span className={`${isSub || isSubRetr ? 'pl-4' : ''} ${isSub && !isSubRetr ? 'italic text-muted-foreground' : ''}`}>
              {isCharge ? '(-) ' : ''}
              {(isSub || isSubRetr) ? '. ' : ''}
              {row.label.replace(/^dont /, '')}
            </span>
            {(row.values || []).map((v, idx) => {
              if (v === null || v === undefined) return <span key={idx} className="text-right text-muted-foreground">—</span>;
              const display = isCharge && v > 0 ? -v : (isRetr || isSubRetr) ? -Math.abs(v) : v;
              const isVarStock = row.label.toLowerCase().includes('variation stock');
              const showSign = isVarStock || row.can_be_positive;
              const pct = row.with_pct && ca[idx] && (ca[idx] as number) > 0 ? ` (${Math.round((v / (ca[idx] as number)) * 100)}%)` : '';
              return (
                <span key={idx} className="text-right">
                  {showSign ? fmtSigned(display) : fmt(display)}{pct}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function BilanSide({ title, lines, total }: { title: string; lines: BilanLine[]; total?: number }) {
  return (
    <div className="rounded-md bg-muted/30 p-3">
      <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase">{title}</div>
      <div className="space-y-0.5">
        {lines.map((l, i) => {
          const isSub = l.type === 'sub';
          const isCalc = l.type === 'calc';
          const isNegatif = l.type === 'negatif';
          return (
            <div key={i} className={`flex justify-between gap-2 text-xs py-1 ${isCalc ? 'border-t pt-1.5 font-semibold' : ''}`}>
              <span className={`${isSub ? 'pl-4 italic text-muted-foreground' : ''}`}>
                {isSub ? '. ' : ''}{l.label.replace(/^dont /, '')}
              </span>
              <span className={`${isNegatif ? 'text-red-600' : ''}`}>
                {l.value !== undefined && l.value !== null ? (isNegatif && l.value > 0 ? `-${fmt(l.value)}` : fmt(l.value)) : '—'}
              </span>
            </div>
          );
        })}
        {total !== undefined && (
          <div className="flex justify-between gap-2 text-xs py-2 border-t mt-1 font-semibold">
            <span>TOTAL {title.toUpperCase()}</span>
            <span>{fmt(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
