// src/components/ba/CandidatureDetailDialog.tsx
// Modale détail candidature (Bloc 5 brief).
// Affiche : description, contact, pré-screening IA (5 critères), actions statut.
// Bloc 6 : bouton "→ Créer le mandat" sur status='accepted' qui appelle
// create-pe-deal (source='mandat_ba', source_detail = candidature.id).
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ELIGIBILITY_LABEL, STATUS_LABEL, UI_TO_DB_STATUS,
  computeEligibility,
  type CandidatureRow, type CandidatureStatus, type EligibilityLevel,
} from '@/types/candidature-ba';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidature: CandidatureRow | null;
  organizationId: string;
  /** ID currentUser pour created_by + lead_analyst default. */
  currentUserId: string;
  /** True si un mandat existe déjà pour cette candidature (pe_deals.source_detail). */
  alreadyConverted: boolean;
  onChanged: () => void;
}

function StatusBadge({ s }: { s: CandidatureStatus }) {
  const cls =
    s === 'new' ? 'bg-violet-100 text-violet-700 border-violet-200'
    : s === 'reviewing' ? 'bg-amber-100 text-amber-700 border-amber-200'
    : s === 'accepted' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : 'bg-muted text-muted-foreground border-border';
  return <Badge variant="outline" className={cls}>{STATUS_LABEL[s]}</Badge>;
}

function EligibilityBadge({ level }: { level: EligibilityLevel }) {
  const cls =
    level === 'green' ? 'bg-emerald-100 text-emerald-700'
    : level === 'orange' ? 'bg-amber-100 text-amber-700'
    : 'bg-rose-100 text-rose-700';
  const icon = level === 'green' ? '🟢' : level === 'orange' ? '🟠' : '🔴';
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {icon} {ELIGIBILITY_LABEL[level]}
    </span>
  );
}

export default function CandidatureDetailDialog({
  open, onOpenChange, candidature, organizationId, currentUserId, alreadyConverted, onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);

  if (!candidature) return null;

  const changeStatus = async (uiStatus: CandidatureStatus) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('update-candidature', {
      body: {
        candidature_id: candidature.id,
        action: 'change_status',
        new_status: UI_TO_DB_STATUS[uiStatus],
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      let real: string | null = (data as any)?.error || null;
      if (!real && error) {
        const ctx = (error as any)?.context;
        if (ctx?.json) { try { real = (await ctx.json())?.error ?? null; } catch {} }
        if (!real) real = error.message;
      }
      toast.error(real || 'Action refusée');
      return;
    }
    toast.success(`Candidature ${STATUS_LABEL[uiStatus].toLowerCase()}`);
    onChanged();
    onOpenChange(false);
  };

  const createMandate = async () => {
    setBusy(true);
    const description = (candidature.form_data?.['Description de l\'activité'] as string) ?? '';
    const ticketStr = candidature.ticket ?? '';
    // Convert ticket "10M" / "2-5M" → number if possible (premier nombre × 1M)
    const ticketMatch = ticketStr.match(/(\d+(?:\.\d+)?)/);
    const ticket = ticketMatch ? Number(ticketMatch[1]) * 1_000_000 : null;

    const { data, error } = await supabase.functions.invoke('create-pe-deal', {
      body: {
        organization_id: organizationId,
        enterprise_name: candidature.company_name,
        enterprise_country: candidature.country || null,
        enterprise_sector: candidature.sector || null,
        dirigeant_name: candidature.contact_name || null,
        ticket_demande: ticket,
        source: 'mandat_ba',
        source_detail: candidature.id, // sert au tracking "convertie"
        stage: 'recus',
        lead_analyst_id: currentUserId,
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      let real: string | null = (data as any)?.error || null;
      if (!real && error) {
        const ctx = (error as any)?.context;
        if (ctx?.json) { try { real = (await ctx.json())?.error ?? null; } catch {} }
        if (!real) real = error.message;
      }
      toast.error(real || 'Création mandat échouée');
      return;
    }
    toast.success(`Mandat ${(data as any).deal?.deal_ref ?? 'créé'} — basé sur ${candidature.company_name}`);
    if (description) console.log('[create-mandat] description candidate:', description.slice(0, 200));
    onChanged();
    onOpenChange(false);
  };

  // Critères d'éligibilité calculés depuis form_data (rule-based, pas IA).
  const eligibility = computeEligibility(candidature.form_data);
  const criteria = eligibility.criteria;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <span>{candidature.company_name}</span>
            <StatusBadge s={candidature.status} />
            {alreadyConverted && (
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Convertie</Badge>
            )}
            <span className="ml-auto"><EligibilityBadge level={computeEligibility(candidature.form_data).level} /></span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
            {candidature.sector && <span>· {candidature.sector}</span>}
            {candidature.country && <span>· {candidature.country}</span>}
            {candidature.ticket && <span>· ticket {candidature.ticket}</span>}
          </div>

          {(candidature.form_data?.['Description de l\'activité'] as string) && (
            <Card className="p-3 bg-muted/30">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5">Description</div>
              <p className="text-sm leading-relaxed">
                {String(candidature.form_data['Description de l\'activité'])}
              </p>
            </Card>
          )}

          <Card className="p-3">
            <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">Contact candidat</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Référent :</span> <strong>{candidature.contact_name || '—'}</strong></div>
              <div><span className="text-muted-foreground">Email :</span> <strong>{candidature.contact_email}</strong></div>
              {candidature.contact_phone && (
                <div><span className="text-muted-foreground">Téléphone :</span> <strong>{candidature.contact_phone}</strong></div>
              )}
              <div><span className="text-muted-foreground">Reçue :</span> <strong>
                {new Date(candidature.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </strong></div>
            </div>
          </Card>

          <Card className="p-3 bg-violet-50/40 border-l-4 border-l-violet-500">
            <div className="text-[11px] font-semibold uppercase text-violet-700 mb-2">
              Pré-screening éligibilité · {eligibility.criteriaPassed}/5 critères
            </div>
            <div className="space-y-1.5">
              {criteria.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {c.ok
                    ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    : <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className={c.ok ? '' : 'text-muted-foreground'}>{c.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {candidature.status === 'new' && (
            <>
              <Button variant="outline" onClick={() => changeStatus('rejected')} disabled={busy}
                className="text-destructive hover:text-destructive">
                <X className="h-3.5 w-3.5 mr-1" /> Refuser
              </Button>
              <Button onClick={() => changeStatus('reviewing')} disabled={busy}>
                Mettre en revue
              </Button>
            </>
          )}
          {candidature.status === 'reviewing' && (
            <>
              <Button variant="outline" onClick={() => changeStatus('rejected')} disabled={busy}
                className="text-destructive hover:text-destructive">
                <X className="h-3.5 w-3.5 mr-1" /> Refuser
              </Button>
              <Button onClick={() => changeStatus('accepted')} disabled={busy}>
                <Check className="h-3.5 w-3.5 mr-1" /> Accepter
              </Button>
            </>
          )}
          {candidature.status === 'accepted' && !alreadyConverted && (
            <Button onClick={createMandate} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              Créer le mandat
            </Button>
          )}
          {candidature.status === 'accepted' && alreadyConverted && (
            <Badge variant="outline" className="bg-blue-100 text-blue-700">
              Mandat déjà créé pour cette candidature
            </Badge>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
