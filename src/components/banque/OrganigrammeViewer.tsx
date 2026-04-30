import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Users, Building2 } from 'lucide-react';

interface OrganigrammeData {
  intro_narratif?: string;
  forme_juridique?: { type?: string; capital_social?: number; annee_creation?: string; statuts_a_jour?: boolean; commentaire?: string };
  repartition_capital?: Array<{ associe: string; role: string; pct: number; nb_parts?: number; lien_dirigeant?: string | null }>;
  analyse_actionnariat?: string;
  equipe_dirigeante?: Array<{ personne: string; age?: number; role: string; profil?: string; anciennete?: string }>;
  effectif?: {
    cadres_label?: string;
    ouvriers_saisonniers_label?: string;
    total_label?: string;
    permanents?: number;
    saisonniers?: number;
    total_pic?: number;
  };
  diagnostic_fragilites?: Array<{
    code: string; label: string;
    severite: 'critique' | 'modere' | 'attention' | 'ok';
    constat: string; mitigation_existante?: string | null; recommandation_comite?: string | null;
    note_positive?: string | null;
  }>;
  plan_renforcement?: { intro?: string; actions?: Array<{ action: string; echeance: string; cout_estime?: string | null; statut?: string }> }
                    | Array<{ action: string; echeance: string; cout_estime?: string | null; statut?: string }>;
  synthese_comite?: { verdict?: string; narratif?: string; blocages_decaissement?: boolean };
  sources?: string[];
  metadata?: { date_generation?: string };
}

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}Md`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

function severityStyle(s: string) {
  switch (s) {
    case 'critique':   return { icon: AlertCircle,    cls: 'border-red-300 bg-red-50',       text: 'text-red-700',    label: 'Critique' };
    case 'modere':     return { icon: AlertTriangle,  cls: 'border-amber-300 bg-amber-50',   text: 'text-amber-800',  label: 'Modéré' };
    case 'attention':  return { icon: Info,           cls: 'border-yellow-300 bg-yellow-50', text: 'text-yellow-800', label: 'Attention' };
    case 'ok':         return { icon: CheckCircle2,   cls: 'border-emerald-300 bg-emerald-50', text: 'text-emerald-700', label: 'OK' };
    default:           return { icon: Info,           cls: 'border-border bg-muted/30',      text: 'text-muted-foreground', label: s };
  }
}

export default function OrganigrammeViewer({ data }: { data: OrganigrammeData }) {
  const fj = data.forme_juridique || {};
  const cap = data.repartition_capital || [];
  const team = data.equipe_dirigeante || [];
  const eff = data.effectif || {};
  const frag = data.diagnostic_fragilites || [];
  // Support both new (object) and legacy (array) shape for plan_renforcement
  const planRaw = data.plan_renforcement;
  const planActions = Array.isArray(planRaw) ? planRaw : (planRaw?.actions || []);
  const planIntro = Array.isArray(planRaw) ? null : planRaw?.intro;
  const synth = data.synthese_comite || {};

  return (
    <div className="space-y-4">
      {/* Intro narratif */}
      {data.intro_narratif && (
        <Card className="p-4 bg-muted/20">
          <p className="text-sm leading-relaxed">{data.intro_narratif}</p>
        </Card>
      )}

      {/* Forme juridique + capital */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Organisation actuelle
        </h3>
        <div className="rounded-md bg-muted/30 p-3 mb-3 text-xs">
          <div className="font-medium mb-1">
            {fj.type || 'Forme juridique'}
            {fj.capital_social && ` au capital de ${fmt(fj.capital_social)}`}
            {fj.annee_creation && `, fondée en ${fj.annee_creation}`}.
          </div>
          {fj.commentaire && <div className="text-muted-foreground">{fj.commentaire}</div>}
        </div>
        {cap.length > 0 && (
          <>
            <div className="text-xs font-semibold mb-2 text-muted-foreground">Répartition du capital</div>
            <div className="space-y-1.5 text-xs mb-3">
              {cap.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-medium min-w-[150px]">{row.associe}</span>
                  <span className="text-muted-foreground flex-1">{row.role}{row.lien_dirigeant ? ` · ${row.lien_dirigeant}` : ''}</span>
                  <Badge variant="outline" className="font-semibold">{row.pct}%</Badge>
                </div>
              ))}
            </div>
            {data.analyse_actionnariat && (
              <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-border pl-3">{data.analyse_actionnariat}</p>
            )}
          </>
        )}
      </Card>

      {/* Équipe dirigeante */}
      {team.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Équipe dirigeante et opérationnelle
          </h3>
          <div className="rounded-md border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-[1.5fr_1.5fr_2fr_1fr] gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
              <span>Personne</span>
              <span>Rôle</span>
              <span>Profil</span>
              <span className="text-right">Ancienneté</span>
            </div>
            {team.map((p, i) => (
              <div key={i} className="grid grid-cols-[1.5fr_1.5fr_2fr_1fr] gap-2 px-3 py-2 border-t">
                <span>
                  <span className="font-medium">{p.personne}</span>
                  {p.age && <span className="text-muted-foreground"> ({p.age} ans)</span>}
                </span>
                <span className="text-muted-foreground">{p.role}</span>
                <span className="text-muted-foreground leading-snug">{p.profil}</span>
                <span className="text-right text-muted-foreground">{p.anciennete}</span>
              </div>
            ))}
          </div>
          {(eff.cadres_label || eff.ouvriers_saisonniers_label || eff.total_label || eff.permanents !== undefined) && (
            <div className="mt-2 grid grid-cols-[1.5fr_1.5fr_2fr_1fr] gap-2 px-3 py-2 border-t bg-muted/30 rounded-md text-xs">
              <span className="font-semibold">Équipe permanente</span>
              <span className="text-muted-foreground">
                {eff.cadres_label || (eff.permanents !== undefined ? `${eff.permanents} permanents` : '—')}
              </span>
              <span className="text-muted-foreground">
                {eff.ouvriers_saisonniers_label || (eff.saisonniers !== undefined ? `+ ${eff.saisonniers} saisonniers` : '')}
              </span>
              <span className="text-right text-blue-700 font-medium">
                {eff.total_label || (eff.total_pic !== undefined ? `Total ${eff.permanents ?? '?'} / ${eff.total_pic} en pic` : '')}
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Diagnostic fragilités */}
      {frag.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Diagnostic des points de fragilité</h3>
          <div className="space-y-2">
            {frag.map((f, i) => {
              const st = severityStyle(f.severite);
              const Ic = st.icon;
              return (
                <div key={i} className={`rounded-md border-l-4 p-3 ${st.cls}`}>
                  <div className={`flex items-center gap-2 font-semibold text-xs mb-1 ${st.text}`}>
                    <Ic className="h-4 w-4" />
                    {f.label}
                    <Badge variant="outline" className={`ml-auto text-[10px] ${st.text} bg-white`}>{st.label}</Badge>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed">{f.constat}</p>
                  {f.mitigation_existante && (
                    <div className="mt-1.5 text-[11px] text-muted-foreground">
                      <span className="font-semibold">Mitigation existante :</span> {f.mitigation_existante}
                    </div>
                  )}
                  {f.recommandation_comite && (
                    <div className="mt-1.5 text-[11px]">
                      <span className="font-semibold">Recommandation comité :</span> {f.recommandation_comite}
                    </div>
                  )}
                  {f.note_positive && (
                    <div className="mt-1.5 text-[11px] text-emerald-800">
                      <span className="font-semibold">Note positive pour le comité :</span> {f.note_positive}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Plan de renforcement */}
      {planActions.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-2">Plan de renforcement de la gouvernance</h3>
          {planIntro && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{planIntro}</p>}
          <div className="rounded-md border border-border overflow-hidden text-xs">
            <div className="grid grid-cols-[2fr_1fr_1.2fr_1.5fr] gap-2 bg-muted/40 px-3 py-2 font-semibold text-muted-foreground">
              <span>Action</span>
              <span>Échéance</span>
              <span className="text-right">Coût estimé</span>
              <span>Statut</span>
            </div>
            {planActions.map((p, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_1.2fr_1.5fr] gap-2 px-3 py-2 border-t">
                <span className="font-medium">{p.action}</span>
                <span className="text-muted-foreground">{p.echeance}</span>
                <span className="text-right text-muted-foreground">{p.cout_estime || '—'}</span>
                <span className="text-muted-foreground">{p.statut}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Synthèse */}
      {synth.narratif && (
        <Card className={`p-5 border-l-4 ${synth.blocages_decaissement ? 'border-l-red-500 bg-red-50/30' : 'border-l-amber-500 bg-amber-50/30'}`}>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            {synth.blocages_decaissement ? <AlertCircle className="h-4 w-4 text-red-700" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}
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
