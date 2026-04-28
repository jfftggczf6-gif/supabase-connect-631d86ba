// DiagnosticBancabiliteViewer
//
// Viewer "2 cercles" du diagnostic de bancabilité — segment Banque.
// Toutes les valeurs (libellés, classifications, couleurs) viennent du
// payload du deliverable. Aucune valeur banque hardcodée — l'organisation
// (NSIA, Atlantique, IMF…) est entièrement portée par le preset.

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, Eye } from 'lucide-react';

type Statut = 'conforme' | 'non_conforme';
type Tag = 'bloquant' | 'a_corriger' | 'a_surveiller' | 'ok';

interface Critere {
  code: string;
  label: string;
  valeur_pme: string | number;
  seuil: string | number | boolean;
  operateur: 'gte' | 'lte' | 'eq';
  statut: Statut;
  source?: string;
}

interface Constat {
  code: string;
  label: string;
  tag: Tag;
  constat: string;
  impact_financement: string;
  remediation?: string;
  items_check?: Record<string, boolean>;
}

interface PlanItem {
  action: string;
  duree_estimee?: string;
  criteres_impactes?: string[];
  constats_impactes?: string[];
}

export interface DiagnosticPayload {
  cercle_1_grille: Critere[];
  cercle_2_constats: Constat[];
  synthese: {
    nb_criteres_total: number;
    nb_criteres_conformes: number;
    nb_constats_bloquants: number;
    nb_constats_a_corriger: number;
    nb_constats_a_surveiller: number;
    nb_constats_ok: number;
    classification: string;
    classification_label: string;
    argumentaire: string;
  };
  plan_structuration: {
    p1_bloquants: PlanItem[];
    p2_a_corriger: PlanItem[];
    p3_a_surveiller: PlanItem[];
  };
  metadata?: { devise_org?: string; date_diagnostic?: string };
}

const operateurSymbol = (op: string) =>
  op === 'gte' ? '≥' : op === 'lte' ? '≤' : op === 'eq' ? '=' : op;

const tagColor: Record<Tag, string> = {
  bloquant:    'bg-red-50 text-red-700 border-red-200',
  a_corriger:  'bg-amber-50 text-amber-700 border-amber-200',
  a_surveiller:'bg-amber-50 text-amber-700 border-amber-200',
  ok:          'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const tagLabel: Record<Tag, string> = {
  bloquant:     'Bloquant',
  a_corriger:   'À corriger',
  a_surveiller: 'À surveiller',
  ok:           'OK',
};

export default function DiagnosticBancabiliteViewer({ data }: { data: DiagnosticPayload }) {
  const s = data.synthese;
  const grille = data.cercle_1_grille || [];
  const constats = data.cercle_2_constats || [];
  const plan = data.plan_structuration || { p1_bloquants: [], p2_a_corriger: [], p3_a_surveiller: [] };

  return (
    <div className="space-y-4">
      {/* CERCLE 1 — Grille de conformité */}
      <Card className="p-4 border-2 border-indigo-100">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-base font-semibold text-indigo-700">Cercle 1 — Grille de conformité quantitative</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ratios financiers comparés aux seuils de la banque. Pas de score — conforme ou non conforme.
            </p>
          </div>
          <div className="px-3 py-2 rounded-md bg-amber-50 text-center min-w-[80px]">
            <div className="text-xl font-semibold text-amber-700">
              {s.nb_criteres_conformes} / {s.nb_criteres_total}
            </div>
            <div className="text-[10px] text-amber-700">critères conformes</div>
          </div>
        </div>

        <div className="rounded-md bg-muted/30 p-3">
          <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr] gap-2 text-[10px] font-semibold text-muted-foreground border-b pb-2">
            <span>Critère</span>
            <span className="text-right">Valeur PME</span>
            <span className="text-right">Seuil</span>
            <span className="text-right">Statut</span>
          </div>
          {grille.map(c => (
            <div key={c.code} className="grid grid-cols-[2.5fr_1fr_1fr_1fr] gap-2 py-1.5 border-b border-border/30 text-xs items-center">
              <span className="text-muted-foreground">{c.label}</span>
              <span className={`text-right font-medium ${c.statut === 'conforme' ? 'text-emerald-700' : 'text-red-700'}`}>
                {String(c.valeur_pme)}
              </span>
              <span className="text-right text-muted-foreground">
                {operateurSymbol(c.operateur)} {String(c.seuil)}
              </span>
              <span className="text-right">
                <Badge variant="outline" className={`text-[9px] ${c.statut === 'conforme' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {c.statut === 'conforme' ? 'Conforme' : 'Non conforme'}
                </Badge>
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* CERCLE 2 — Constats */}
      <Card className="p-4 border-2 border-dashed border-border">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-base font-semibold">Cercle 2 — Constats et signaux</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Facteurs qualitatifs qui impactent la capacité de remboursement dans le temps.
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="text-red-700 font-medium">{s.nb_constats_bloquants} bloquant{s.nb_constats_bloquants > 1 ? 's' : ''}</span>
            <span className="text-amber-700 font-medium">{s.nb_constats_a_corriger} à corriger</span>
            <span className="text-emerald-700 font-medium">{s.nb_constats_ok} OK</span>
          </div>
        </div>

        <div className="space-y-2">
          {constats.map(c => (
            <div key={c.code} className={`rounded-md border-l-4 p-3 ${tagColor[c.tag]}`}>
              <div className="flex justify-between items-center mb-1.5">
                <div className="font-semibold text-sm">{c.label}</div>
                <Badge variant="outline" className={`text-[9px] ${tagColor[c.tag]}`}>
                  {tagLabel[c.tag]}
                </Badge>
              </div>
              <div className="text-xs leading-relaxed">
                <span className="font-semibold">Constat :</span> {c.constat}
              </div>
              {c.impact_financement && (
                <div className="text-xs leading-relaxed mt-1.5 px-2 py-1 rounded bg-black/5">
                  <span className="font-semibold">Impact financement :</span> {c.impact_financement}
                </div>
              )}
              {c.items_check && Object.keys(c.items_check).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                  {Object.entries(c.items_check).map(([k, v]) => (
                    <span key={k} className="inline-flex items-center gap-1">
                      {v ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <XCircle className="h-3 w-3" />}
                      {k.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
              {c.remediation && c.tag !== 'ok' && (
                <div className="text-xs leading-relaxed mt-1.5">
                  <span className="font-semibold">Remédiation :</span> {c.remediation}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* SYNTHÈSE + PLAN */}
      <Card className="p-4 border-t-4 border-t-indigo-500">
        <h3 className="text-base font-semibold mb-3">Synthèse et plan de structuration</h3>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-md bg-muted/40 p-3 text-center">
            <div className="text-lg font-semibold text-amber-700">{s.nb_criteres_conformes} / {s.nb_criteres_total}</div>
            <div className="text-[10px] text-muted-foreground">Critères conformes</div>
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-center">
            <div className="text-lg font-semibold text-red-700">{s.nb_constats_bloquants}</div>
            <div className="text-[10px] text-muted-foreground">Bloquant{s.nb_constats_bloquants > 1 ? 's' : ''}</div>
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-center">
            <div className="text-lg font-semibold text-amber-700">{s.nb_constats_a_corriger + s.nb_constats_a_surveiller}</div>
            <div className="text-[10px] text-muted-foreground">À corriger / surveiller</div>
          </div>
        </div>

        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 mb-3">
          <span className="font-semibold">Classification : {s.classification_label}.</span> {s.argumentaire}
        </div>

        {plan.p1_bloquants?.length > 0 && (
          <div className="mb-3">
            <div className="font-semibold text-sm text-red-700 mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> P1 — Bloquants à lever
            </div>
            <ul className="space-y-1 text-xs">
              {plan.p1_bloquants.map((p, i) => (
                <li key={i} className="pl-4 border-l-2 border-red-300">
                  <span className="font-medium">{p.action}</span>
                  {p.duree_estimee && <span className="text-muted-foreground"> · {p.duree_estimee}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan.p2_a_corriger?.length > 0 && (
          <div className="mb-3">
            <div className="font-semibold text-sm text-amber-700 mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> P2 — À corriger
            </div>
            <ul className="space-y-1 text-xs">
              {plan.p2_a_corriger.map((p, i) => (
                <li key={i} className="pl-4 border-l-2 border-amber-300">{p.action}</li>
              ))}
            </ul>
          </div>
        )}

        {plan.p3_a_surveiller?.length > 0 && (
          <div>
            <div className="font-semibold text-sm text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> P3 — À surveiller
            </div>
            <ul className="space-y-1 text-xs">
              {plan.p3_a_surveiller.map((p, i) => (
                <li key={i} className="pl-4 border-l-2 border-border">{p.action}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
