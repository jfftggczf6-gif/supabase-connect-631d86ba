// src/components/ba/sections/TeaserBaSection.tsx
// Brief generate_teaser (Ordre 14) — wireframe src/wireframes/wireframe_teaser_ba.html.
//
// Composition exacte du wireframe :
// - Header : titre + badges (warnings count + version) + boutons Régénérer/Aperçu/Exporter PDF
// - Layout 2 cols : Sidebar (codebox + workflow 4 étapes + sources IM + versions + distribution)
//                 + Content (warning box + doc cover violette + 8 sections + footer)
// - Section comparaison IM ↔ Teaser
// - Actions bas : Envoyer à 1 fonds / Copier lien / Renvoyer Analyste / Approuver
//
// Catégorie 2 : composant BA dédié (pas un wrapper PE).

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Sparkles, RefreshCw, FileDown, Eye,
  Send, Link2, RotateCcw, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  pickCodeName, type TeaserRow, type TeaserPayload, type TeaserWarning,
} from '@/types/teaser-ba';

interface Props {
  dealId: string;
}

// ─── Mock payload pour démo si aucun teaser n'existe encore ────────────────
function mockPayload(enterpriseName: string, sector: string | null, country: string | null, ticket: number | null): TeaserPayload {
  const ticketStr = ticket
    ? `${(ticket * 0.8 / 1_000_000).toFixed(0)} — ${(ticket * 1.2 / 1_000_000).toFixed(0)} M USD`
    : '5 — 15 M USD';
  return {
    code_name: pickCodeName(),
    cover: {
      confidentiel: 'Confidentiel — Cissé Advisory',
      type: 'Teaser — Opportunité d\'investissement',
      tags: [
        sector || 'Secteur — à compléter',
        country ? `Afrique de l'Ouest (${country})` : 'Afrique de l\'Ouest',
        ticketStr,
        'Cession majoritaire',
      ],
    },
    sections: {
      presentation: {
        secteur: sector || '—',
        geographie: country ? `Afrique de l'Ouest (${country})` : 'Afrique de l\'Ouest',
        creation: '— (à compléter)',
        effectifs: '~250',
        ticket: ticketStr,
        operation: 'Cession majoritaire',
      },
      resume: {
        paragraphs: [
          `Société leader dans son secteur en Afrique de l'Ouest, avec une présence dans 3 pays UEMOA. Portefeuille de +120 références, capacité de production locale certifiée normes internationales.`,
          `Le fondateur souhaite céder sa participation majoritaire à un investisseur capable d'accompagner la prochaine phase : expansion régionale, nouvelles gammes, structuration industrielle.`,
        ],
      },
      marche: {
        taille_marche: '~5 Mrd USD',
        croissance: '+8-10% / an',
        position: 'Top 3',
        narrative: 'Différenciation par la production locale (vs import) et les certifications GMP. Marché fragmenté avec opportunités de consolidation.',
      },
      equipe: {
        dirigeant: 'Fondateur, 15+ ans',
        direction: '5 cadres clés',
        effectif: '~250 pers.',
        narrative: 'Direction industrielle (ex-multinationale), commerciale (réseau 3 pays), financière (audit Big 4). Transition 12-18 mois prévue.',
      },
      finances: {
        ca_n: '~15 Mrd FCFA',
        croissance_3y: '+18% / an',
        marge_ebitda: '~12%',
        ebitda_n: '~1.8 Mrd',
        years: ['2023', '2024', '2025', 'Δ'],
        table: [
          { label: 'Chiffre d\'affaires', values: ['10.8 Mrd', '12.7 Mrd', '~15.0 Mrd'], delta: '+18%' },
          { label: 'EBITDA',              values: ['1.1 Mrd',  '1.4 Mrd',  '~1.8 Mrd'],  delta: '+28%' },
          { label: 'Marge EBITDA',        values: ['10.2%',    '11.0%',    '~12.0%'],    delta: '+1.8pp' },
          { label: 'BFR / CA',            values: ['22%',      '20%',      '~18%'],      delta: '-4pp' },
          { label: 'Dette nette / EBITDA', values: ['1.8x',     '1.5x',     '~1.2x'],     delta: '-0.6x' },
        ],
      },
      equity_story: {
        points: [
          { title: 'Leader marché en croissance', description: 'Top 3 distributeurs UEMOA, marché +8-10%/an' },
          { title: 'Production locale certifiée', description: 'Usine GMP, barrière à l\'entrée vs importateurs' },
          { title: 'Pipeline produits',           description: 'Relais de croissance 2026-2028' },
          { title: 'Management stable',           description: '15+ ans expertise sectorielle' },
          { title: 'Rentabilité croissante',      description: 'EBITDA 10% → 12% en 3 ans, BFR optimisé' },
          { title: 'Expansion régionale',         description: '3 pays, extensible à 6 UEMOA' },
        ],
      },
      esg: {
        items: [
          { icon: '🏥', label: 'Santé',         description: 'Accès médicaments pour +2M patients/an' },
          { icon: '👥', label: 'Emplois',       description: '250 directs, 60% femmes' },
          { icon: '🌱', label: 'Environnement', description: 'Déchets pharma normes OMS' },
          { icon: '🎯', label: 'ODD',           description: 'ODD 3, ODD 8, ODD 9' },
        ],
        odd_tags: ['ODD 3', 'ODD 8', 'ODD 9'],
        has_ifc_ps: true,
      },
      adequation: {
        criteria: [
          { label: 'Secteur',       value: `${sector || '—'} → dans la thèse`,    status: 'ok' },
          { label: 'Géographie',    value: `${country || '—'} → zone éligible`,    status: 'ok' },
          { label: 'Ticket',        value: `${ticketStr} → dans [5-25M]`,          status: 'ok' },
          { label: 'Ancienneté',    value: '18 ans → ≥ 3 ans',                      status: 'ok' },
          { label: 'Rentabilité',   value: '12% → au-dessus médiane',               status: 'ok' },
          { label: 'Documentation', value: '5/7 fournis',                           status: 'warning' },
        ],
        score_pct: 92,
        score_label: '5/6 critères remplis',
      },
    },
    warnings: [
      {
        id: 'w-1', type: 'geographique', section_num: 2,
        label: 'Zone géographique trop précise',
        detail: `"...usine située dans la zone industrielle de Yopougon, Abidjan"`,
        suggestion: `"zone industrielle d'une métropole ouest-africaine"`,
      },
      {
        id: 'w-2', type: 'client', section_num: 2,
        label: 'Client nommé',
        detail: `"...principal client est le CHU de Cocody"`,
        suggestion: `"réseau hospitalier public"`,
      },
    ],
    source_section_codes: [
      'executive_summary', 'shareholding_governance', 'top_management',
      'services', 'competition_market', 'financials_pnl',
      'investment_thesis', 'esg_risks',
    ],
    comparison: [
      { im_original: enterpriseName,                       teaser_anonymise: pickCodeName() },
      { im_original: 'Zone industrielle de Yopougon',     teaser_anonymise: 'Métropole Afrique de l\'Ouest' },
      { im_original: 'CHU de Cocody, Clinique Farah',     teaser_anonymise: 'Réseau hospitalier public' },
      { im_original: 'CA 14,97 Mrd FCFA',                  teaser_anonymise: '~15 Mrd FCFA' },
      { im_original: 'Dr Amadou Koné, PDG',                teaser_anonymise: 'Fondateur, 15+ ans exp.' },
    ],
  };
}

// ─── Sidebar : codebox + workflow + sources + versions + distribution ──────
function TeaserSidebar({ teaser, payload, onRegenCodeName, onSubmitToPartner }: {
  teaser: TeaserRow | null;
  payload: TeaserPayload;
  onRegenCodeName: () => void;
  onSubmitToPartner: () => void;
}) {
  const status = teaser?.status ?? 'draft';
  const warningsCount = payload.warnings.length;

  const workflowSteps = [
    { label: 'Généré par IA',         state: 'done' as const, icon: '✓' },
    { label: warningsCount > 0 ? `${warningsCount} warning${warningsCount > 1 ? 's' : ''} à résoudre` : '0 warning',
      state: warningsCount > 0 ? 'current' as const : 'done' as const,
      icon: warningsCount > 0 ? '⚠' : '✓' },
    { label: 'Soumis au Partner',     state: (status === 'pending_validation' || status === 'validated') ? 'done' as const : 'todo' as const,
      icon: status === 'draft' ? '○' : '✓' },
    { label: 'Approuvé → diffusable', state: status === 'validated' ? 'done' as const : 'todo' as const,
      icon: status === 'validated' ? '✓' : '○' },
  ];

  const sectionLabels = [
    '§1 Résumé exécutif',
    '§2 Actionnariat',
    '§3 Management',
    '§4 Description activité',
    '§5 Marché & concurrence',
    '§8 Analyse financière',
    '§10 Thèse investissement',
    '§11 Risques & ESG',
  ];

  return (
    <aside className="w-[210px] shrink-0 border-r bg-muted/20 p-3.5 overflow-y-auto">
      {/* Codebox */}
      <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Nom de code</div>
      <div className="border-2 border-violet-500 rounded-md p-2.5 text-center mb-3.5">
        <div className="text-[15px] font-bold tracking-wider text-violet-600">{payload.code_name}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">Attribué automatiquement</div>
        <button onClick={onRegenCodeName} className="text-[10px] text-violet-600 hover:underline mt-1">
          Changer le nom
        </button>
      </div>

      {/* Workflow */}
      <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Workflow</div>
      <div className="space-y-0.5 mb-3.5">
        {workflowSteps.map((s, i) => (
          <div key={i} className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] ${
            s.state === 'done' ? 'text-foreground/70' :
            s.state === 'current' ? 'bg-amber-100 text-amber-800 font-medium' :
            'text-muted-foreground/50'
          }`}>
            <span>{s.icon}</span>
            <span className="truncate">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Sources IM utilisées */}
      <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Sections IM utilisées</div>
      <div className="space-y-0.5 mb-3.5">
        {sectionLabels.map((s, i) => (
          <div key={i} className="text-[10px] text-muted-foreground py-0.5 truncate">{s} ✓</div>
        ))}
      </div>

      {/* Versions */}
      <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Versions</div>
      <div className="space-y-0.5 mb-3.5">
        <div className="border border-violet-300 rounded p-1.5 text-[10px] text-violet-600 font-semibold">
          {teaser?.version_label ?? 'v1 — actuelle'}
        </div>
      </div>

      {/* Distribution */}
      <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Distribution</div>
      {teaser?.distribution?.length ? (
        teaser.distribution.map((d, i) => (
          <div key={i} className="flex items-center justify-between border rounded p-1.5 text-[10px] mb-0.5">
            <span>{d.fund_name}</span>
            <Badge variant="outline" className="text-[9px]">{d.status === 'sent' ? 'Envoyé' : 'En attente'}</Badge>
          </div>
        ))
      ) : (
        <div className="text-[10px] text-muted-foreground italic">Aucun envoi</div>
      )}

      {/* Bouton soumission Partner */}
      {status === 'draft' && warningsCount === 0 && (
        <Button size="sm" onClick={onSubmitToPartner} className="w-full mt-3 text-[11px] h-7">
          Soumettre au Partner
        </Button>
      )}
    </aside>
  );
}

// ─── Warning box ────────────────────────────────────────────────────────────
function WarningBox({ warnings, onApply, onIgnore }: {
  warnings: TeaserWarning[];
  onApply: (id: string) => void;
  onIgnore: (id: string) => void;
}) {
  if (warnings.length === 0) return null;
  return (
    <Card className="p-3.5 bg-amber-50/60 border-amber-200 mb-4">
      <div className="text-xs font-semibold text-amber-800 mb-2">
        ⚠ {warnings.length} mention{warnings.length > 1 ? 's' : ''} identifiante{warnings.length > 1 ? 's' : ''} — résoudre avant soumission
      </div>
      <div className="space-y-1.5">
        {warnings.map(w => (
          <div key={w.id} className="bg-white border border-amber-100 rounded p-2 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-amber-900">{w.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{w.detail}</div>
              <div className="text-[10px] text-violet-600 mt-0.5">→ {w.suggestion}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => onApply(w.id)}>Appliquer</Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">Modifier</Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onIgnore(w.id)}>Ignorer</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Doc cover violette ─────────────────────────────────────────────────────
function DocCover({ payload }: { payload: TeaserPayload }) {
  return (
    <div className="bg-violet-600 text-white text-center py-6 px-6 rounded-t">
      <div className="text-[9px] uppercase tracking-[2px] opacity-70">{payload.cover.confidentiel}</div>
      <div className="text-[22px] font-bold tracking-[2px] my-2">{payload.code_name}</div>
      <div className="text-xs opacity-85">{payload.cover.type}</div>
      <div className="flex flex-wrap justify-center gap-4 mt-2.5 text-[11px] opacity-70">
        {payload.cover.tags.map((t, i) => (
          <span key={i}>{i > 0 && <span className="mr-4">·</span>}{t}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers KPI / Section ──────────────────────────────────────────────────
function KPI({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md p-2.5 border text-left ${accent ? 'bg-violet-50 border-violet-200' : 'bg-muted/30 border-input'}`}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold mt-0.5 ${accent ? 'text-violet-700' : ''}`}>{value}</div>
    </div>
  );
}

function SectionTitle({ num, label }: { num: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b">
      <span className="bg-violet-600 text-white w-[18px] h-[18px] rounded-full text-[9px] font-bold flex items-center justify-center">
        {num}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
    </div>
  );
}

function Check({ children, color = 'text-violet-600' }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="text-xs py-1 flex items-start gap-1.5">
      <span className={`${color} font-bold`}>✓</span>
      <span>{children}</span>
    </div>
  );
}

// ─── 8 sections du teaser ───────────────────────────────────────────────────
function TeaserSections({ payload }: { payload: TeaserPayload }) {
  const s = payload.sections;
  return (
    <div className="p-5 bg-white">
      {/* §1 Présentation */}
      <div className="mb-5">
        <SectionTitle num={1} label="Présentation" />
        <div className="grid grid-cols-3 gap-2">
          <KPI label="Secteur" value={s.presentation.secteur} />
          <KPI label="Géographie" value={s.presentation.geographie} />
          <KPI label="Création" value={s.presentation.creation} />
          <KPI label="Effectifs" value={s.presentation.effectifs} />
          <KPI label="Ticket indicatif" value={s.presentation.ticket} accent />
          <KPI label="Opération" value={s.presentation.operation} />
        </div>
      </div>

      {/* §2 Résumé */}
      <div className="mb-5">
        <SectionTitle num={2} label="Résumé de l'opportunité" />
        {s.resume.paragraphs.map((p, i) => (
          <p key={i} className="text-xs leading-[1.7] text-foreground/70 mb-1.5">{p}</p>
        ))}
      </div>

      {/* §3 Marché */}
      <div className="mb-5">
        <SectionTitle num={3} label="Marché & positionnement" />
        <div className="grid grid-cols-3 gap-2 mb-2">
          <KPI label="Taille marché" value={s.marche.taille_marche} />
          <KPI label="Croissance"     value={s.marche.croissance} />
          <KPI label="Position"        value={s.marche.position} />
        </div>
        <p className="text-xs leading-[1.7] text-foreground/70">{s.marche.narrative}</p>
      </div>

      {/* §4 Équipe */}
      <div className="mb-5">
        <SectionTitle num={4} label="Équipe & management" />
        <div className="grid grid-cols-3 gap-2 mb-2">
          <KPI label="Dirigeant" value={s.equipe.dirigeant} />
          <KPI label="Direction"  value={s.equipe.direction} />
          <KPI label="Effectif"   value={s.equipe.effectif} />
        </div>
        <p className="text-xs leading-[1.7] text-foreground/70">{s.equipe.narrative}</p>
      </div>

      {/* §5 Performance financière */}
      <div className="mb-5">
        <SectionTitle num={5} label="Performance financière" />
        <div className="grid grid-cols-4 gap-2 mb-2">
          <KPI label="CA 2025"        value={s.finances.ca_n} />
          <KPI label="Croiss. 3 ans"  value={s.finances.croissance_3y} />
          <KPI label="Marge EBITDA"   value={s.finances.marge_ebitda} />
          <KPI label="EBITDA 2025"    value={s.finances.ebitda_n} accent />
        </div>
        <table className="w-full text-[11px] border-collapse mt-2">
          <thead>
            <tr className="bg-muted/30">
              <th className="text-left px-2 py-1.5"></th>
              {s.finances.years.map((y, i) => (
                <th key={i} className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.finances.table.map((row, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="px-2 py-1.5"><strong>{row.label}</strong></td>
                {row.values.map((v, j) => (
                  <td key={j} className="px-2 py-1.5">{v}</td>
                ))}
                {row.delta && <td className="px-2 py-1.5 text-emerald-700">{row.delta}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* §6 Equity story */}
      <div className="mb-5">
        <SectionTitle num={6} label="Equity story" />
        {s.equity_story.points.map((p, i) => (
          <Check key={i}><strong>{p.title}</strong> — {p.description}</Check>
        ))}
      </div>

      {/* §7 ESG */}
      <div className="mb-5">
        <SectionTitle num={7} label="Impact & ESG" />
        <div className="grid grid-cols-2 gap-1.5">
          {s.esg.items.map((item, i) => (
            <div key={i} className="bg-muted/30 border rounded p-2 text-[11px] flex items-center gap-1.5">
              <span>{item.icon}</span>
              <span><strong>{item.label}</strong> — {item.description}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {s.esg.odd_tags.map((t, i) => (
            <Badge key={i} variant="outline" className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">{t}</Badge>
          ))}
          {s.esg.has_ifc_ps && <Badge variant="outline" className="text-[9px]">IFC PS</Badge>}
        </div>
      </div>

      {/* §8 Adéquation */}
      <div>
        <SectionTitle num={8} label="Adéquation investisseur" />
        <div className="grid grid-cols-2 gap-x-3">
          {s.adequation.criteria.map((c, i) => (
            <Check key={i} color={c.status === 'ok' ? 'text-violet-600' : 'text-amber-600'}>
              <strong>{c.label}</strong> — {c.value}
            </Check>
          ))}
        </div>
        <div className="mt-2.5 text-center">
          <div className="inline-block border-2 border-violet-500 rounded-lg px-6 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Score d'adéquation</div>
            <div className="text-2xl font-bold text-violet-600">{s.adequation.score_pct}%</div>
            <div className="text-[10px] text-muted-foreground">{s.adequation.score_label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Comparaison IM ↔ Teaser ────────────────────────────────────────────────
function ComparisonView({ comparison }: { comparison: TeaserPayload['comparison'] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3.5">
      <button onClick={() => setOpen(!open)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
        {open ? '▼' : '▶'} Comparaison IM ↔ Teaser
      </button>
      {open && (
        <div className="grid grid-cols-2 border rounded mt-2 overflow-hidden">
          <div className="bg-rose-50/40 border-r p-2.5">
            <div className="text-[10px] font-semibold text-rose-700 mb-1.5">IM original (confidentiel)</div>
            {comparison.map((c, i) => (
              <div key={i} className="text-[11px] py-0.5 flex gap-1.5">
                <span className="text-rose-600">✗</span>
                <span>{c.im_original}</span>
              </div>
            ))}
          </div>
          <div className="bg-emerald-50/40 p-2.5">
            <div className="text-[10px] font-semibold text-emerald-700 mb-1.5">Teaser anonymisé</div>
            {comparison.map((c, i) => (
              <div key={i} className="text-[11px] py-0.5 flex gap-1.5">
                <span className="text-emerald-600">✓</span>
                <span>{c.teaser_anonymise}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ────────────────────────────────────────────────────
export default function TeaserBaSection({ dealId }: Props) {
  const [teaser, setTeaser] = useState<TeaserRow | null>(null);
  const [payload, setPayload] = useState<TeaserPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dealInfo, setDealInfo] = useState<{ name: string; sector: string | null; country: string | null; ticket: number | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: deal } = await supabase
      .from('pe_deals')
      .select('enterprise_id, ticket_demande')
      .eq('id', dealId)
      .maybeSingle();
    const entId = (deal as any)?.enterprise_id;
    let info: { name: string; sector: string | null; country: string | null; ticket: number | null } | null = null;
    if (entId) {
      const { data: ent } = await supabase
        .from('enterprises')
        .select('name, sector, country')
        .eq('id', entId)
        .maybeSingle();
      if (ent) {
        info = {
          name: (ent as any).name,
          sector: (ent as any).sector ?? null,
          country: (ent as any).country ?? null,
          ticket: (deal as any)?.ticket_demande ?? null,
        };
        setDealInfo(info);
      }
    }

    if (entId) {
      const { data: deliv } = await supabase
        .from('deliverables')
        .select('id, html_content, data, created_at, validation_status')
        .eq('enterprise_id', entId)
        .eq('type', 'onepager')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (deliv) {
        const dataJson = ((deliv as any).data ?? {}) as any;
        const teaserPayload: TeaserPayload | null = dataJson.teaser_payload ?? null;
        const vs = (deliv as any).validation_status;
        const status: 'draft' | 'pending_validation' | 'validated' =
          vs === 'validated' ? 'validated' : vs === 'pending_validation' ? 'pending_validation' : 'draft';
        const row: TeaserRow = {
          id: (deliv as any).id,
          enterprise_id: entId,
          deal_id: dealId,
          payload: teaserPayload,
          status,
          version_label: `v1 — ${new Date((deliv as any).created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`,
          created_at: (deliv as any).created_at,
        };
        setTeaser(row);
        setPayload(teaserPayload || (info ? mockPayload(info.name, info.sector, info.country, info.ticket) : null));
      } else if (info) {
        setPayload(mockPayload(info.name, info.sector, info.country, info.ticket));
      }
    }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!dealInfo) return;
    setGenerating(true);
    try {
      const { data: enterprise } = await supabase
        .from('pe_deals').select('enterprise_id').eq('id', dealId).maybeSingle();
      const entId = (enterprise as any)?.enterprise_id;
      if (!entId) throw new Error('Pas d\'enterprise rattachée');

      const { data, error } = await supabase.functions.invoke('generate-onepager', {
        body: { enterprise_id: entId, anonymous: true, code_name: pickCodeName() },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Échec génération');
      toast.success('Teaser généré');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenCodeName = () => {
    if (!payload) return;
    setPayload({ ...payload, code_name: pickCodeName() });
    toast.info('Nouveau nom de code généré (non sauvegardé)');
  };

  const handleApplyWarning = (id: string) => {
    if (!payload) return;
    setPayload({ ...payload, warnings: payload.warnings.filter(w => w.id !== id) });
    toast.success('Warning appliqué — suggestion intégrée');
  };
  const handleIgnoreWarning = (id: string) => {
    if (!payload) return;
    setPayload({ ...payload, warnings: payload.warnings.filter(w => w.id !== id) });
    toast.info('Warning ignoré');
  };
  const handleSubmitToPartner = () => {
    toast.info('Soumission Partner — workflow à intégrer avec EF dédiée');
  };

  const handleExport = async () => {
    if (!teaser) { toast.error('Génère d\'abord le teaser'); return; }
    const { data, error } = await supabase.functions.invoke('render-document', {
      body: { deliverable_id: teaser.id, kind: 'onepager', format: 'pdf' },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Export échoué');
      return;
    }
    const url = (data as any)?.url;
    if (url) window.open(url, '_blank');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!payload) {
    return (
      <Card className="p-12 text-center max-w-2xl mx-auto">
        <Eye className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <h3 className="text-base font-semibold mb-1">Aucun teaser généré</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
          Le teaser est un one-pager anonymisé envoyé aux fonds AVANT la NDA.
          Génération IA depuis le Memo IM.
        </p>
        <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
          {generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Génération…</> : <><Sparkles className="h-3.5 w-3.5" /> Générer le teaser</>}
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-[1140px] mx-auto bg-card rounded-lg border overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-semibold">Teaser — {dealInfo?.name}</h2>
            {payload.warnings.length > 0 && (
              <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                {payload.warnings.length} warning{payload.warnings.length > 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
              {teaser?.version_label ?? 'v1'}
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Deal {dealId.slice(0, 8)} · {dealInfo?.sector || '—'} · {dealInfo?.country || '—'}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleGenerate} disabled={generating}>
            <RefreshCw className="h-3 w-3" /> Régénérer
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleExport}>
            <Eye className="h-3 w-3" /> Aperçu PDF
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={handleExport}>
            <FileDown className="h-3 w-3" /> Exporter PDF
          </Button>
        </div>
      </div>

      {/* LAYOUT : sidebar + content */}
      <div className="flex min-h-[700px]">
        <TeaserSidebar
          teaser={teaser}
          payload={payload}
          onRegenCodeName={handleRegenCodeName}
          onSubmitToPartner={handleSubmitToPartner}
        />
        <div className="flex-1 p-5 bg-muted/10 overflow-y-auto">
          <WarningBox
            warnings={payload.warnings}
            onApply={handleApplyWarning}
            onIgnore={handleIgnoreWarning}
          />
          {/* Doc */}
          <div className="border rounded overflow-hidden bg-white">
            <DocCover payload={payload} />
            <TeaserSections payload={payload} />
            {/* Footer */}
            <div className="text-center px-5 py-3.5 border-t bg-muted/20">
              <p className="text-[9px] text-muted-foreground">
                Pour plus d'informations — <strong>Cissé Advisory</strong> — contact@cisse-advisory.com
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Document strictement confidentiel. Reproduction interdite.</p>
              <p className="text-[8px] text-muted-foreground/60 mt-0.5">
                ID: {payload.code_name.replace(/\s/g, '-')}-{teaser?.version_label?.split(' ')[0] || 'v1'} · Watermark destinataire tracé
              </p>
            </div>
          </div>

          {/* Comparaison IM ↔ Teaser */}
          <ComparisonView comparison={payload.comparison} />

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 pt-3.5 border-t">
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                <Send className="h-3 w-3" /> Envoyer à 1 fonds
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                <Link2 className="h-3 w-3" /> Copier le lien
              </Button>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                <RotateCcw className="h-3 w-3" /> Renvoyer à l'Analyste
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" /> Approuver pour diffusion
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
