// src/components/ba/sections/FundMatchingSection.tsx
// Brief fund_matching + deal_tracking (Ordre 15-16) — wireframe wireframe_fund_matching_ba.html.
//
// Composition exacte du wireframe :
// - Header : titre + badge fonds contactés + boutons Ajouter/Envoyer teaser/Handoff PE
// - KPIs 6 cards (Matchés, Contactés, Intéressés, NDA, IOI, Déclinés)
// - Funnel visuel 9 étapes (Matchés → Closing)
// - Tableau fonds : Fonds + Score + Pipeline dots + Statut + Last action + Relance + Actions
// - Panel détail fonds sélectionné : score détaillé, timeline, IOI, documents, notes privées
// - Comparaison IOI (max 3 cards)
// - Relances suggérées (delta > 4j sans action)
// - Handoff BA → PE (LOI signée requise)
// - Métriques conversion (4 cards)
//
// Catégorie 2 : composant BA dédié.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Plus, Send, ArrowRight, AlertCircle, Phone,
  Mail, Edit3, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  type FundRow, type OutreachStatus, type FundingProgramRow, type OutreachRow,
  type OutreachKpis, type ConversionMetrics,
  OUTREACH_STEPS, STAGE_ORDER,
} from '@/types/fund-matching';

interface Props {
  dealId: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function statusLabel(s: OutreachStatus): string {
  const map: Record<OutreachStatus, string> = {
    matched: 'Matché', teaser_sent: 'Teaser envoyé', interested: 'Intéressé',
    nda_pending: 'NDA en cours', nda_signed: 'NDA signée', im_shared: 'IM partagé',
    meeting_held: 'Mgmt meeting', ioi_received: 'IOI reçue', loi_signed: 'LOI signée',
    closed: 'Closé', declined: 'Décliné',
  };
  return map[s];
}
function statusBadgeClass(s: OutreachStatus): string {
  if (s === 'declined') return 'bg-muted text-muted-foreground';
  if (s === 'ioi_received' || s === 'loi_signed') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s === 'closed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s === 'meeting_held' || s === 'im_shared' || s === 'nda_signed')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'interested') return 'bg-violet-100 text-violet-700 border-violet-200';
  if (s === 'nda_pending' || s === 'teaser_sent') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-muted text-muted-foreground';
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function fmtAmount(n: number | null, currency = 'USD'): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ${currency}`;
  return `${n} ${currency}`;
}

function fmtTicketRange(min: number | null, max: number | null): string {
  if (min == null || max == null) return '—';
  return `${(min / 1_000_000).toFixed(min >= 1_000_000 ? 1 : 0)}-${(max / 1_000_000).toFixed(0)}M`;
}

function computeKpis(funds: FundRow[]): OutreachKpis {
  return {
    matched: funds.length,
    contacted: funds.filter(f => f.outreach && STAGE_ORDER[f.outreach.status] >= 1).length,
    interested: funds.filter(f => f.outreach && f.outreach.status !== 'declined' && STAGE_ORDER[f.outreach.status] >= 2).length,
    nda: funds.filter(f => f.outreach && STAGE_ORDER[f.outreach.status] >= 3).length,
    ioi: funds.filter(f => f.outreach && STAGE_ORDER[f.outreach.status] >= 6).length,
    declined: funds.filter(f => f.outreach?.status === 'declined').length,
  };
}

function computeMetrics(k: OutreachKpis): ConversionMetrics {
  const safe = (num: number, denom: number) => denom > 0 ? Math.round((num / denom) * 100) : 0;
  return {
    teaser_to_interest: { pct: safe(k.interested, k.contacted), num: k.interested, denom: k.contacted },
    interest_to_nda:    { pct: safe(k.nda, k.interested),       num: k.nda,        denom: k.interested },
    nda_to_ioi:         { pct: safe(k.ioi, k.nda),              num: k.ioi,        denom: k.nda },
    overall:            { pct: safe(k.ioi, k.contacted),         num: k.ioi,        denom: k.contacted },
  };
}

function localScore(prog: FundingProgramRow, deal: { sector: string | null; country: string | null; ticket: number | null }): number {
  let s = 40;
  if (deal.ticket && prog.ticket_min && prog.ticket_max
      && deal.ticket >= prog.ticket_min && deal.ticket <= prog.ticket_max) s += 25;
  if (deal.sector && prog.secteurs_eligibles?.some(x => x.toLowerCase().includes(deal.sector!.toLowerCase()))) s += 20;
  if (deal.country && prog.pays_eligibles?.some(x => x.toLowerCase().includes(deal.country!.toLowerCase()))) s += 15;
  return Math.min(100, s);
}

// ─── Composants enfants ────────────────────────────────────────────────────
function KpisRow({ k }: { k: OutreachKpis }) {
  const items: { label: string; value: number; color?: string }[] = [
    { label: 'Matchés',     value: k.matched },
    { label: 'Contactés',   value: k.contacted,  color: 'text-violet-600' },
    { label: 'Intéressés',  value: k.interested, color: 'text-amber-600' },
    { label: 'NDA signées', value: k.nda,        color: 'text-emerald-700' },
    { label: 'IOI reçues',  value: k.ioi,        color: 'text-blue-700' },
    { label: 'Déclinés',    value: k.declined,   color: 'text-muted-foreground' },
  ];
  return (
    <div className="grid grid-cols-6 gap-2 px-5 py-4 border-b bg-muted/10">
      {items.map(i => (
        <div key={i.label} className="bg-muted/30 border rounded-md p-2.5">
          <div className="text-[10px] text-muted-foreground">{i.label}</div>
          <div className={`text-xl font-semibold mt-0.5 ${i.color || ''}`}>{i.value}</div>
        </div>
      ))}
    </div>
  );
}

function Funnel({ k }: { k: OutreachKpis }) {
  // 9 étapes du wireframe (Matchés→Closing)
  const steps = [
    { c: k.matched,     l: 'Matchés' },
    { c: k.contacted,   l: 'Teaser envoyé' },
    { c: k.interested,  l: 'Intéressés' },
    { c: k.nda,         l: 'NDA signée' },
    { c: k.nda,         l: 'IM partagé' },
    { c: 0,             l: 'Mgmt meeting' },
    { c: k.ioi,         l: 'IOI reçue' },
    { c: 0,             l: 'LOI' },
    { c: 0,             l: 'Closing' },
  ];
  return (
    <div className="flex items-center gap-1 px-5 py-3 border-b bg-card">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1 flex-1">
          <div
            className={`flex-1 text-center py-2 px-1 rounded text-[10px] ${
              s.c > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-muted/30 text-muted-foreground'
            }`}
          >
            <div className="text-base font-semibold">{s.c}</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wide">{s.l}</div>
          </div>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function PipelineDots({ status }: { status: OutreachStatus | null }) {
  const cur = status ? STAGE_ORDER[status] : 0;
  const dots = [
    { stage: 1, label: 'Teaser', char: 'T' },
    { stage: 2, label: 'Intéressé', char: 'I' },
    { stage: 3, label: 'NDA', char: 'N' },
    { stage: 4, label: 'IM', char: 'M' },
    { stage: 5, label: 'Meeting', char: 'R' },
    { stage: 6, label: 'IOI', char: 'O' },
    { stage: 7, label: 'LOI', char: 'L' },
    { stage: 8, label: 'Close', char: 'C' },
  ];
  return (
    <div className="flex gap-0.5">
      {dots.map(d => {
        const done = cur >= d.stage;
        const current = Math.floor(cur) === d.stage;
        return (
          <div
            key={d.stage}
            title={d.label}
            className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold ${
              done ? 'bg-emerald-700 text-white' :
              current ? 'bg-amber-500 text-white' :
              'bg-muted text-muted-foreground/60'
            }`}
          >
            {d.char}
          </div>
        );
      })}
    </div>
  );
}

function FundTable({ funds, selected, onSelect, onAction }: {
  funds: FundRow[];
  selected: string | null;
  onSelect: (id: string) => void;
  onAction: (fundId: string, action: 'send_teaser' | 'send_nda' | 'relance') => void;
}) {
  return (
    <div className="px-5 py-4 border-b">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Tableau des fonds</div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b">
            <th className="text-left py-2 px-1.5 font-medium">Fonds</th>
            <th className="text-left py-2 px-1.5 font-medium">Score</th>
            <th className="text-left py-2 px-1.5 font-medium">Pipeline</th>
            <th className="text-left py-2 px-1.5 font-medium">Statut</th>
            <th className="text-left py-2 px-1.5 font-medium">Dernière action</th>
            <th className="text-left py-2 px-1.5 font-medium">Relance</th>
            <th className="text-right py-2 px-1.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {funds.map(f => {
            const status = f.outreach?.status ?? 'matched';
            const declined = status === 'declined';
            const daysSinceAction = daysSince(f.outreach?.last_action_at ?? null);
            const needsRelance = daysSinceAction !== null && daysSinceAction >= 5
              && status !== 'declined' && status !== 'closed' && status !== 'loi_signed';
            return (
              <tr
                key={f.program.id}
                className={`border-b last:border-b-0 cursor-pointer hover:bg-muted/20 ${
                  selected === f.program.id ? 'bg-violet-50/40' : ''
                } ${declined ? 'opacity-40' : ''}`}
                onClick={() => onSelect(f.program.id)}
              >
                <td className="py-2.5 px-1.5">
                  <div className="font-semibold text-xs">{f.program.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {f.program.type_financement?.[0] ?? '—'} ·
                    {' '}{fmtTicketRange(f.program.ticket_min, f.program.ticket_max)} ·
                    {' '}{f.program.pays_eligibles?.[0] ?? '—'}
                    {f.program.organisme ? ` · ${f.program.organisme}` : ''}
                  </div>
                </td>
                <td className="py-2.5 px-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-[50px] h-[5px] bg-muted rounded">
                      <div
                        className={`h-full rounded ${
                          f.fit_score >= 80 ? 'bg-emerald-700' :
                          f.fit_score >= 60 ? 'bg-amber-500' : 'bg-muted-foreground/40'
                        }`}
                        style={{ width: `${f.fit_score}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">{f.fit_score}%</span>
                  </div>
                </td>
                <td className="py-2.5 px-1.5"><PipelineDots status={status} /></td>
                <td className="py-2.5 px-1.5">
                  <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(status)}`}>
                    {statusLabel(status)}
                  </Badge>
                </td>
                <td className="py-2.5 px-1.5 text-[10px] text-muted-foreground">
                  {f.outreach?.last_action_label ? (
                    <>
                      {f.outreach.last_action_label}
                      <div>{daysSinceAction !== null ? `il y a ${daysSinceAction}j` : ''}</div>
                    </>
                  ) : '—'}
                </td>
                <td className="py-2.5 px-1.5">
                  {needsRelance && (
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                      ⏰ J+{daysSinceAction}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-1.5 text-right">
                  {status === 'matched' && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); onAction(f.program.id, 'send_teaser'); }}>
                      Envoyer teaser
                    </Button>
                  )}
                  {status === 'interested' && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); onAction(f.program.id, 'send_nda'); }}>
                      Envoyer NDA
                    </Button>
                  )}
                  {needsRelance && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); onAction(f.program.id, 'relance'); }}>
                      Relancer
                    </Button>
                  )}
                  {!needsRelance && status !== 'matched' && status !== 'interested' && (
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2">Détail</Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FundDetailPanel({ fund }: { fund: FundRow }) {
  const o = fund.outreach;
  const status = o?.status ?? 'matched';
  return (
    <div className="px-5 py-4 border-b">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
        Détail fonds — {fund.program.name}
      </div>
      <Card className="p-3.5 bg-muted/20">
        <h3 className="text-xs font-semibold mb-2">{fund.program.name} — Score {fund.fit_score}%</h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Field label="Organisme"  value={fund.program.organisme ?? '—'} />
          <Field label="Type"        value={fund.program.type_financement?.[0] ?? '—'} />
          <Field label="Ticket"      value={fmtTicketRange(fund.program.ticket_min, fund.program.ticket_max)} />
          <Field label="Secteurs"    value={fund.program.secteurs_eligibles?.slice(0,2).join(', ') || '—'} ok />
          <Field label="Géographie"  value={fund.program.pays_eligibles?.[0] ?? '—'} ok />
          <Field label="Contact"     value={fund.program.contact_email ?? '—'} />
        </div>

        {/* Score détaillé */}
        <div className="text-[10px] font-medium text-muted-foreground mb-1">Score détaillé — Critères remplis vs manquants</div>
        <div className="grid grid-cols-2 gap-x-3 mb-3">
          <div>
            {fund.criteria_met.slice(0, 5).map(c => (
              <div key={c} className="text-[11px] py-0.5 text-emerald-700">✓ {c}</div>
            ))}
          </div>
          <div>
            {fund.criteria_missing.slice(0, 4).map(c => (
              <div key={c} className="text-[11px] py-0.5 text-amber-700">⚠ {c}</div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="text-[10px] font-medium text-muted-foreground mb-1">Timeline des interactions</div>
        <div className="flex gap-0.5 mb-3">
          {OUTREACH_STEPS.slice(1).map(step => {
            const reached = STAGE_ORDER[status] >= STAGE_ORDER[step.code];
            const current = STAGE_ORDER[status] === STAGE_ORDER[step.code];
            return (
              <div
                key={step.code}
                className={`flex-1 text-center py-1.5 px-1 rounded text-[9px] ${
                  current ? 'bg-amber-100 text-amber-800 font-semibold' :
                  reached ? 'bg-emerald-50 text-emerald-700' : 'bg-muted/40 text-muted-foreground/40'
                }`}
              >
                {step.label}
              </div>
            );
          })}
        </div>

        {/* IOI */}
        {o?.ioi_amount && (
          <>
            <div className="text-[10px] font-medium text-muted-foreground mb-1">IOI reçue</div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <Field label="Montant"      value={fmtAmount(o.ioi_amount, o.ioi_currency ?? 'USD')} highlight />
              <Field label="Structure"    value={o.ioi_structure ?? '—'} />
              <Field label="Conditions"   value={o.ioi_conditions ?? '—'} />
              <Field label="Exclusivité"  value={o.ioi_exclusivity_days ? `Demandée ${o.ioi_exclusivity_days}j` : '—'} />
            </div>
          </>
        )}

        {/* Notes privées */}
        {o?.private_notes && (
          <>
            <div className="text-[10px] font-medium text-muted-foreground mb-1">Notes privées</div>
            <div className="bg-white border rounded p-2 text-[11px] text-muted-foreground">{o.private_notes}</div>
          </>
        )}

        <div className="flex gap-1.5 justify-end mt-3">
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"><Mail className="h-3 w-3" /> Envoyer un document</Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"><Edit3 className="h-3 w-3" /> Ajouter une note</Button>
          {(status === 'ioi_received' || status === 'meeting_held') && (
            <Button size="sm" className="h-7 text-[10px] gap-1"><ArrowRight className="h-3 w-3" /> Négocier LOI</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, ok, highlight }: { label: string; value: string; ok?: boolean; highlight?: boolean }) {
  return (
    <div className={`border rounded p-2 ${highlight ? 'bg-violet-50 border-violet-200' : 'bg-white'}`}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-xs font-medium mt-0.5 ${highlight ? 'text-violet-700 text-base' : ''}`}>
        {ok && <span className="text-emerald-700 mr-1">✓</span>}{value}
      </div>
    </div>
  );
}

function IoiCompare({ funds }: { funds: FundRow[] }) {
  const ioiFunds = funds.filter(f => f.outreach && f.outreach.status === 'ioi_received');
  const candidates = funds
    .filter(f => f.outreach && STAGE_ORDER[f.outreach.status] >= 3 && f.outreach.status !== 'declined')
    .slice(0, 3);
  if (ioiFunds.length === 0 && candidates.length === 0) return null;

  // Si au moins 1 IOI : afficher 3 cards (IOI ou candidats en attente)
  const best = [...ioiFunds].sort((a, b) => (b.outreach!.ioi_amount ?? 0) - (a.outreach!.ioi_amount ?? 0))[0];
  const display = (ioiFunds.length > 0 ? [best, ...candidates.filter(c => c.program.id !== best.program.id)] : candidates).slice(0, 3);

  return (
    <div className="px-5 py-4 border-b">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Comparaison des offres (IOI reçues)</div>
      <div className="grid grid-cols-3 gap-2">
        {display.map(f => {
          const isBest = best && f.program.id === best.program.id;
          const o = f.outreach;
          return (
            <Card
              key={f.program.id}
              className={`p-3 text-center ${isBest ? 'border-violet-500 bg-violet-50' : 'opacity-60'}`}
            >
              <div className="text-xs font-semibold">{f.program.name}</div>
              <div className={`text-xl font-bold my-1.5 ${isBest ? 'text-violet-700' : 'text-muted-foreground'}`}>
                {o?.ioi_amount ? fmtAmount(o.ioi_amount, o.ioi_currency ?? 'USD') : 'En attente'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {o?.ioi_amount ? (
                  <>
                    {o.ioi_structure ?? '—'} ·
                    {' '}DD {o.ioi_conditions ?? '—'} ·
                    {' '}Excl {o.ioi_exclusivity_days ?? '—'}j
                  </>
                ) : (
                  <>
                    {o?.last_action_label ?? statusLabel(o?.status ?? 'matched')}
                    {o?.last_action_at && ` il y a ${daysSince(o.last_action_at)}j`}
                  </>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">Score adéquation : {f.fit_score}%</div>
              <div className="mt-1.5">
                {isBest ? (
                  <Badge variant="outline" className="text-[9px] bg-violet-100 text-violet-700 border-violet-200">Meilleure offre</Badge>
                ) : o?.status === 'im_shared' ? (
                  <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-700">IOI attendue</Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px]">En amont</Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function RelancesPanel({ funds, onRelance }: { funds: FundRow[]; onRelance: (id: string) => void }) {
  const relances = funds.filter(f => {
    if (!f.outreach || f.outreach.status === 'declined' || f.outreach.status === 'closed') return false;
    const d = daysSince(f.outreach.last_action_at);
    return d !== null && d >= 4;
  });
  if (relances.length === 0) return null;
  return (
    <div className="px-5 py-4 border-b">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Relances suggérées</div>
      <div className="bg-amber-50/40 border border-amber-200 rounded-md p-3">
        {relances.map((f, i) => (
          <div key={f.program.id} className={`flex justify-between items-center py-1.5 ${i < relances.length - 1 ? 'border-b border-amber-100' : ''}`}>
            <div>
              <div className="text-xs font-medium">{f.program.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {f.outreach!.last_action_label} il y a {daysSince(f.outreach!.last_action_at)} jours — pas de retour
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2" onClick={() => onRelance(f.program.id)}>
                <Mail className="h-3 w-3" /> Relancer
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2">
                <Phone className="h-3 w-3" /> Appeler
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HandoffPanel({ funds, dealId, onHandoff }: { funds: FundRow[]; dealId: string; onHandoff: () => void }) {
  const loiFund = funds.find(f => f.outreach && (f.outreach.status === 'loi_signed' || f.outreach.status === 'closed'));
  if (!loiFund) return null;
  const o = loiFund.outreach!;
  return (
    <div className="px-5 py-4 border-b">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Handoff BA → PE</div>
      <Card className="p-3.5 bg-violet-50/50 border-violet-200">
        <h3 className="text-xs font-semibold text-violet-700 mb-2">→ Transférer vers le module PE pour la due diligence</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
          Quand un fonds confirme son intention d'investir (LOI signée), le dossier est transféré vers
          le module PE du fonds pour le suivi de la due diligence et du closing.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Field label="Fonds repreneur" value={loiFund.program.name} />
          <Field label="Ticket"          value={fmtAmount(o.ioi_amount, o.ioi_currency ?? 'USD')} />
          <Field label="Prochaine étape" value="DD financière + juridique" />
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">
          Le handoff transfère : enterprise + deal {dealId.slice(0,8)} + documents + memo + valuation
          vers l'espace PE du fonds.
        </p>
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs">Annuler</Button>
          <Button size="sm" className="h-7 text-xs" onClick={onHandoff}>Confirmer le handoff → PE</Button>
        </div>
      </Card>
    </div>
  );
}

function MetricsPanel({ m }: { m: ConversionMetrics }) {
  const items = [
    { label: 'Teaser → Intérêt',    value: m.teaser_to_interest },
    { label: 'Intérêt → NDA',       value: m.interest_to_nda },
    { label: 'NDA → IOI',            value: m.nda_to_ioi },
    { label: 'Global teaser → IOI', value: m.overall },
  ];
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Métriques de conversion</div>
      <div className="grid grid-cols-4 gap-2">
        {items.map(i => (
          <Card key={i.label} className="p-2.5 text-center">
            <div className="text-[10px] text-muted-foreground">{i.label}</div>
            <div className="text-base font-semibold text-violet-600 mt-0.5">{i.value.pct}%</div>
            <div className="text-[9px] text-muted-foreground">{i.value.num} sur {i.value.denom}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Composant principal ────────────────────────────────────────────────────
export default function FundMatchingSection({ dealId }: Props) {
  const [funds, setFunds] = useState<FundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);
  const [dealInfo, setDealInfo] = useState<{ name: string; sector: string | null; country: string | null; ticket: number | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Deal info
    const { data: deal } = await supabase
      .from('pe_deals')
      .select('enterprise_id, ticket_demande, organization_id')
      .eq('id', dealId)
      .maybeSingle();
    const entId = (deal as any)?.enterprise_id;
    let info: { name: string; sector: string | null; country: string | null; ticket: number | null } | null = null;
    if (entId) {
      const { data: ent } = await supabase
        .from('enterprises').select('name, sector, country').eq('id', entId).maybeSingle();
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

    // Funding programs actifs
    const { data: programs } = await supabase
      .from('funding_programs')
      .select('id, name, organisme, type_financement, pays_eligibles, secteurs_eligibles, ticket_min, ticket_max, contact_email')
      .eq('is_active', true)
      .limit(50);

    // Match IA scores
    const { data: matchesData } = entId
      ? await supabase
          .from('funding_matches')
          .select('funding_program_id, match_score, criteria_met, criteria_missing')
          .eq('enterprise_id', entId)
      : { data: [] as any[] };
    const matchMap = new Map<string, { score: number; met: string[]; missing: string[] }>(
      ((matchesData || []) as any[]).map(m => [m.funding_program_id, {
        score: m.match_score ?? 0,
        met: Array.isArray(m.criteria_met) ? m.criteria_met : [],
        missing: Array.isArray(m.criteria_missing) ? m.criteria_missing : [],
      }]),
    );

    // Outreach par deal
    const { data: outreachData } = await supabase
      .from('pe_fund_outreach')
      .select('id, deal_id, funding_program_id, status, match_score, last_action_at, last_action_label, ioi_amount, ioi_currency, ioi_structure, ioi_conditions, ioi_exclusivity_days, ioi_received_at, private_notes')
      .eq('deal_id', dealId);
    const outreachMap = new Map<string, OutreachRow>(
      ((outreachData || []) as any[]).map(o => [o.funding_program_id, o as OutreachRow]),
    );

    const rows: FundRow[] = ((programs || []) as any[]).map(p => {
      const program: FundingProgramRow = {
        id: p.id, name: p.name, organisme: p.organisme ?? null,
        type_financement: p.type_financement ?? null,
        pays_eligibles: p.pays_eligibles ?? null,
        secteurs_eligibles: p.secteurs_eligibles ?? null,
        ticket_min: p.ticket_min ?? null, ticket_max: p.ticket_max ?? null,
        contact_email: p.contact_email ?? null,
      };
      const ai = matchMap.get(p.id);
      const outreach = outreachMap.get(p.id) ?? null;
      const fit_score = outreach?.match_score ?? ai?.score ?? localScore(program, info ?? { sector: null, country: null, ticket: null });
      return {
        program, outreach, fit_score,
        criteria_met: ai?.met ?? [],
        criteria_missing: ai?.missing ?? [],
      };
    });
    rows.sort((a, b) => b.fit_score - a.fit_score);

    setFunds(rows);
    if (!selectedFundId && rows.length > 0) {
      // Sélectionner par défaut le fonds avec le statut le plus avancé (ou le mieux scoré)
      const sortedByAdvance = [...rows].sort((a, b) => {
        const oa = a.outreach ? STAGE_ORDER[a.outreach.status] : 0;
        const ob = b.outreach ? STAGE_ORDER[b.outreach.status] : 0;
        return ob - oa || b.fit_score - a.fit_score;
      });
      setSelectedFundId(sortedByAdvance[0].program.id);
    }
    setLoading(false);
  }, [dealId, selectedFundId]);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => computeKpis(funds), [funds]);
  const metrics = useMemo(() => computeMetrics(kpis), [kpis]);
  const selectedFund = useMemo(
    () => funds.find(f => f.program.id === selectedFundId) ?? null,
    [funds, selectedFundId],
  );

  const updateOutreach = async (fundId: string, patch: Partial<OutreachRow> & { status: OutreachStatus; last_action_label: string }) => {
    const { data: deal } = await supabase
      .from('pe_deals')
      .select('organization_id')
      .eq('id', dealId)
      .maybeSingle();
    if (!deal) { toast.error('Deal introuvable'); return; }
    const existing = funds.find(f => f.program.id === fundId)?.outreach;
    if (existing) {
      const { error } = await supabase.from('pe_fund_outreach')
        .update({ ...patch, last_action_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from('pe_fund_outreach').insert({
        organization_id: (deal as any).organization_id,
        deal_id: dealId,
        funding_program_id: fundId,
        ...patch,
        last_action_at: new Date().toISOString(),
      });
      if (error) { toast.error(error.message); return; }
    }
    await load();
  };

  const handleAction = async (fundId: string, action: 'send_teaser' | 'send_nda' | 'relance') => {
    if (action === 'send_teaser') {
      await updateOutreach(fundId, { status: 'teaser_sent', last_action_label: 'Teaser envoyé' });
      toast.success('Teaser envoyé (statut mis à jour)');
    } else if (action === 'send_nda') {
      await updateOutreach(fundId, { status: 'nda_pending', last_action_label: 'NDA envoyée' });
      toast.success('NDA envoyée (statut mis à jour)');
    } else if (action === 'relance') {
      await updateOutreach(fundId, {
        status: funds.find(f => f.program.id === fundId)?.outreach?.status ?? 'matched',
        last_action_label: 'Relance manuelle',
      });
      toast.success('Relance enregistrée');
    }
  };

  const handleHandoff = () => {
    toast.info('Handoff PE — workflow à intégrer avec EF create-pe-deal-from-ba');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (funds.length === 0) {
    return (
      <Card className="p-12 text-center max-w-2xl mx-auto">
        <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
        <h3 className="text-sm font-semibold mb-1">Aucun fonds dans le référentiel</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          La table funding_programs est vide. À seeder avec les fonds DFI / VC actifs
          (Helios, AfricInvest, IFC, BIO, FMO, Adiwale, I&P, etc.) pour activer le matching.
        </p>
      </Card>
    );
  }

  return (
    <div className="max-w-[1140px] mx-auto bg-card rounded-lg border overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Fonds & matching — {dealInfo?.name}</h2>
            <Badge variant="outline" className="text-[10px] bg-violet-100 text-violet-700 border-violet-200">
              {kpis.contacted} fonds contactés
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Deal {dealId.slice(0, 8)} · {dealInfo?.sector ?? '—'} · {dealInfo?.ticket ? fmtAmount(dealInfo.ticket) : '—'}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
            <Plus className="h-3 w-3" /> Ajouter un fonds
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
            <Send className="h-3 w-3" /> Envoyer teaser
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={handleHandoff}>
            <ArrowRight className="h-3 w-3" /> Handoff PE
          </Button>
        </div>
      </div>

      <KpisRow k={kpis} />
      <Funnel k={kpis} />
      <FundTable funds={funds} selected={selectedFundId} onSelect={setSelectedFundId} onAction={handleAction} />
      {selectedFund && <FundDetailPanel fund={selectedFund} />}
      <IoiCompare funds={funds} />
      <RelancesPanel funds={funds} onRelance={(id) => handleAction(id, 'relance')} />
      <HandoffPanel funds={funds} dealId={dealId} onHandoff={handleHandoff} />
      <MetricsPanel m={metrics} />
    </div>
  );
}
