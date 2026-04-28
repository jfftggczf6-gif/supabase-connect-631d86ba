import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface PlanFinancementData {
  intro_narratif?: string;
  caracteristiques_credit?: {
    montant?: number;
    montant_commentaire?: string | null;
    duree_annees?: number;
    duree_commentaire?: string | null;
    taux_nominal_pct?: number;
    taux_commentaire?: string;
    periodicite?: string;
    periodicite_commentaire?: string | null;
    differe_remboursement_mois?: number;
    service_annuel_apres_differe?: number;
    service_commentaire?: string | null;
    cout_total?: number;
    cout_commentaire?: string | null;
  };
  echeancier_remboursement?: Array<{ annee: string; capital_rembourse: number; interets_payes: number; service_total: number; capital_restant: number }>;
  garanties_propres?: Array<{ garantie: string; description: string; valeur_estimee?: number | null; decote_pct?: number | null; valeur_retenue?: number | null; modalite_juridique: string; valeur_estimee_label?: string | null }>;
  couverture_propre?: { total_valeur_retenue?: number; ratio_couverture_pct?: number; verdict?: string };
  garantie_partage_risque?: {
    applicable?: boolean;
    nom_ligne?: string;
    comparaison?: {
      sans_garantie?: { seuil_couverture_requis_pct?: number; couverture_propre_pct?: number; deficit_pct?: number; conformite?: string; decision_probable?: string };
      avec_garantie?: { seuil_couverture_requis_pct?: number; couverture_propre_pct?: number; marge_pts?: number; conformite?: string; decision_probable?: string };
    };
    mecanique?: string;
    eligibilite?: string[];
    narratif?: string;
  };
  conditions_attendues?: string[];
  frais_mise_en_place?: Array<{ frais: string; montant: number; beneficiaire: string; commentaire?: string | null }>;
  total_frais_initiaux?: number;
  frais_pct_credit?: number;
  synthese_comite?: { narratif?: string; conformite_grille?: string };
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

export default function PlanFinancementViewer({ data }: { data: PlanFinancementData }) {
  const car = data.caracteristiques_credit || {};
  const ech = data.echeancier_remboursement || [];
  const gar = data.garanties_propres || [];
  const cov = data.couverture_propre || {};
  const partage = data.garantie_partage_risque || {};
  const conds = data.conditions_attendues || [];
  const frais = data.frais_mise_en_place || [];
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

      {/* Caractéristiques crédit */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Caractéristiques du crédit proposé</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label="Montant" value={fmt(car.montant, devise)} sub={car.montant_commentaire || undefined} />
          <KPI label="Durée" value={car.duree_annees ? `${car.duree_annees} ans` : '—'} sub={car.duree_commentaire || undefined} />
          <KPI label="Taux nominal" value={car.taux_nominal_pct ? `${car.taux_nominal_pct}%` : '—'} sub={car.taux_commentaire} tone="emerald" />
          <KPI label="Périodicité" value={car.periodicite || '—'} sub={car.periodicite_commentaire || undefined} />
          <KPI label="Service annuel" value={fmt(car.service_annuel_apres_differe, devise)} sub={car.service_commentaire || (car.differe_remboursement_mois ? `Après différé ${car.differe_remboursement_mois} mois` : undefined)} />
          <KPI label="Coût total" value={fmt(car.cout_total, devise)} sub={car.cout_commentaire || undefined} />
        </div>
      </Card>

      {/* Échéancier */}
      {ech.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Échéancier de remboursement</h3>
          <div className="rounded-md border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-5 gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
              <span>Année</span>
              <span className="text-right">Capital remb.</span>
              <span className="text-right">Intérêts</span>
              <span className="text-right">Service total</span>
              <span className="text-right">Capital restant</span>
            </div>
            {ech.map((row, i) => (
              <div key={i} className={`grid grid-cols-5 gap-2 px-3 py-2 border-t ${i === ech.length - 1 ? 'font-semibold bg-muted/20' : ''}`}>
                <span>{row.annee}</span>
                <span className="text-right">{fmt(row.capital_rembourse)}</span>
                <span className="text-right">{fmt(row.interets_payes)}</span>
                <span className="text-right">{fmt(row.service_total)}</span>
                <span className="text-right">{fmt(row.capital_restant)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Garanties propres */}
      {gar.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Garanties propres proposées</h3>
          <div className="rounded-md border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-[2fr_1fr_0.7fr_1fr_2fr] gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
              <span>Garantie</span>
              <span className="text-right">Valeur estimée</span>
              <span className="text-right">Décote</span>
              <span className="text-right">Retenue</span>
              <span>Modalité</span>
            </div>
            {gar.map((g, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_0.7fr_1fr_2fr] gap-2 px-3 py-2 border-t">
                <div>
                  <div className="font-medium">{g.garantie}</div>
                  {g.description && <div className="text-[10px] text-muted-foreground">{g.description}</div>}
                </div>
                <span className="text-right">
                  {g.valeur_estimee_label ? <span className="italic text-muted-foreground">{g.valeur_estimee_label}</span> :
                    g.valeur_estimee !== null && g.valeur_estimee !== undefined ? fmt(g.valeur_estimee, devise) : <span className="italic text-muted-foreground">n/a</span>}
                </span>
                <span className="text-right">
                  {g.decote_pct !== null && g.decote_pct !== undefined ? <span className="text-red-600">-{g.decote_pct}%</span> : <span className="italic text-muted-foreground">n/a</span>}
                </span>
                <span className="text-right font-medium">
                  {g.valeur_retenue !== null && g.valeur_retenue !== undefined ? fmt(g.valeur_retenue, devise) : <span className="italic text-muted-foreground font-normal">n/a</span>}
                </span>
                <span className="text-muted-foreground leading-snug">{g.modalite_juridique}</span>
              </div>
            ))}
          </div>
          {cov.ratio_couverture_pct !== undefined && (
            <div className={`mt-3 rounded-md p-3 text-sm flex items-center justify-between gap-3 ${cov.ratio_couverture_pct >= 100 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              <span className="font-medium">Couverture propre : {fmt(cov.total_valeur_retenue, devise)} → {cov.ratio_couverture_pct}% du crédit</span>
              {cov.verdict && <span className="text-xs italic">{cov.verdict}</span>}
            </div>
          )}
        </Card>
      )}

      {/* Garantie de partage de risque */}
      {partage.applicable && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            Activation {partage.nom_ligne || 'garantie de partage de risque'}
          </h3>

          {partage.comparaison && (
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              {/* Sans garantie */}
              {partage.comparaison.sans_garantie && (
                <div className="rounded-md border-2 border-red-200 bg-red-50/50 p-3">
                  <div className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                    <X className="h-3 w-3" />
                    Sans garantie
                  </div>
                  <ul className="space-y-1 text-xs">
                    <li>Seuil couverture requis : <span className="font-medium">{partage.comparaison.sans_garantie.seuil_couverture_requis_pct}%</span></li>
                    <li>Couverture propre : <span className="font-medium">{partage.comparaison.sans_garantie.couverture_propre_pct}%</span></li>
                    <li className="text-red-700">Déficit : <span className="font-medium">{partage.comparaison.sans_garantie.deficit_pct}%</span></li>
                    {partage.comparaison.sans_garantie.conformite && <li>Conformité : <span className="font-medium">{partage.comparaison.sans_garantie.conformite}</span></li>}
                  </ul>
                  {partage.comparaison.sans_garantie.decision_probable && (
                    <div className="mt-2 pt-2 border-t border-red-200 text-xs font-semibold text-red-800">
                      {partage.comparaison.sans_garantie.decision_probable}
                    </div>
                  )}
                </div>
              )}

              {/* Avec garantie */}
              {partage.comparaison.avec_garantie && (
                <div className="rounded-md border-2 border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Avec garantie
                  </div>
                  <ul className="space-y-1 text-xs">
                    <li>Seuil couverture requis : <span className="font-medium">{partage.comparaison.avec_garantie.seuil_couverture_requis_pct}%</span></li>
                    <li>Couverture propre : <span className="font-medium">{partage.comparaison.avec_garantie.couverture_propre_pct}%</span></li>
                    {partage.comparaison.avec_garantie.marge_pts !== undefined && (
                      <li className="text-emerald-700">Marge : <span className="font-medium">+{partage.comparaison.avec_garantie.marge_pts} pts</span></li>
                    )}
                    {partage.comparaison.avec_garantie.conformite && <li>Conformité : <span className="font-medium">{partage.comparaison.avec_garantie.conformite}</span></li>}
                  </ul>
                  {partage.comparaison.avec_garantie.decision_probable && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 text-xs font-semibold text-emerald-800">
                      {partage.comparaison.avec_garantie.decision_probable}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {partage.mecanique && (
            <div className="rounded-md bg-muted/30 p-3 text-xs leading-relaxed mb-3">
              <div className="font-semibold mb-1">Mécanique de la garantie</div>
              <p className="text-muted-foreground">{partage.mecanique}</p>
            </div>
          )}

          {partage.eligibilite?.length ? (
            <div>
              <div className="text-xs font-semibold mb-1.5">Critères d'éligibilité</div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {partage.eligibilite.map((e, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      )}

      {/* Conditions */}
      {conds.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Conditions habituelles attendues</h3>
          <ul className="space-y-1.5 text-xs">
            {conds.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span className="text-muted-foreground leading-relaxed">{c}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Frais */}
      {frais.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Frais de mise en place</h3>
          <div className="rounded-md border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
              <span>Frais</span>
              <span className="text-right">Montant</span>
              <span>Bénéficiaire</span>
              <span>Commentaire</span>
            </div>
            {frais.map((f, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-2 px-3 py-2 border-t">
                <span className="font-medium">{f.frais}</span>
                <span className="text-right">{fmt(f.montant, devise)}</span>
                <span className="text-muted-foreground">{f.beneficiaire}</span>
                <span className="text-muted-foreground text-[10px]">{f.commentaire || ''}</span>
              </div>
            ))}
            {data.total_frais_initiaux !== undefined && (
              <div className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-2 px-3 py-2 border-t bg-muted/30 font-semibold">
                <span>Total frais initiaux</span>
                <span className="text-right">{fmt(data.total_frais_initiaux, devise)}</span>
                <span></span>
                <span className="text-muted-foreground text-[10px]">~{data.frais_pct_credit}% du crédit</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Synthèse */}
      {synth.narratif && (
        <Card className="p-5 border-l-4 border-l-primary bg-emerald-50/30">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            Synthèse pour le comité
            {synth.conformite_grille && (
              <Badge variant="outline" className="ml-auto bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                Conformité grille : {synth.conformite_grille}
              </Badge>
            )}
          </h3>
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

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'emerald' }) {
  const cls = tone === 'emerald' ? 'text-emerald-700' : '';
  return (
    <div className="rounded-md bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
