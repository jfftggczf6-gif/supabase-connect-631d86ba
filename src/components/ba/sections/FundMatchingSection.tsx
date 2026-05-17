// src/components/ba/sections/FundMatchingSection.tsx
// Fonds & matching BA — feature #15 fund_matching.
//
// Brief : matching anonyme deal↔fonds, score, statuts par fonds, notes,
// relances suggérées, envoi teaser via send-email, partage IM via data room.
//
// V1 : lit funding_programs (vide sur staging — à seeder) + funding_matches.
// L'agent matching IA (match-deal-funds) sera ajouté dans une session dédiée.

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Briefcase, Send, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  dealId: string;
}

interface FundRow {
  id: string;
  name: string;
  type: string | null;
  geo_focus: string | null;
  ticket_min: number | null;
  ticket_max: number | null;
  /** Statut depuis funding_matches s'il existe (non_contacte/teaser_envoye/...). */
  status: string | null;
  /** Score d'adéquation 0-100 (calculé localement V1, sera IA plus tard). */
  fit_score: number;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  non_contacte:    { label: 'Non contacté',    color: 'bg-muted text-muted-foreground' },
  teaser_envoye:   { label: 'Teaser envoyé',   color: 'bg-blue-100 text-blue-700' },
  interesse:       { label: 'Intéressé',       color: 'bg-violet-100 text-violet-700' },
  nda_signee:      { label: 'NDA signée',      color: 'bg-amber-100 text-amber-700' },
  im_partage:      { label: 'IM partagé',      color: 'bg-orange-100 text-orange-700' },
  ioi_recu:        { label: 'IOI reçu',        color: 'bg-emerald-100 text-emerald-700' },
  decline:         { label: 'Décliné',         color: 'bg-rose-100 text-rose-700' },
};

export default function FundMatchingSection({ dealId }: Props) {
  const [funds, setFunds] = useState<FundRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // 1. Récup secteur + ticket du deal pour scoring
      const { data: deal } = await supabase
        .from('pe_deals')
        .select('enterprise_id, ticket_demande')
        .eq('id', dealId)
        .maybeSingle();

      let sector: string | null = null;
      const ent_id = (deal as any)?.enterprise_id;
      if (ent_id) {
        const { data: ent } = await supabase
          .from('enterprises')
          .select('sector, country')
          .eq('id', ent_id)
          .maybeSingle();
        sector = (ent as any)?.sector ?? null;
      }
      const ticket = (deal as any)?.ticket_demande ?? null;

      // 2. Lit funding_programs (table existante, vide sur staging)
      const { data: programs } = await supabase
        .from('funding_programs')
        .select('id, name, type, geo_focus, ticket_min, ticket_max')
        .limit(50);

      // 3. Lit funding_matches pour ce deal
      const { data: matches } = await supabase
        .from('funding_matches')
        .select('funding_id, status')
        .eq('enterprise_id', ent_id);
      const statusMap = new Map<string, string>(
        ((matches || []) as any[]).map(m => [m.funding_id, m.status]),
      );

      // 4. Score simple : secteur match + ticket dans fourchette
      const rows: FundRow[] = ((programs || []) as any[]).map(p => {
        let score = 50;
        if (ticket && p.ticket_min && p.ticket_max) {
          if (ticket >= p.ticket_min && ticket <= p.ticket_max) score += 30;
        }
        if (sector && (p.type ?? '').toLowerCase().includes(sector.toLowerCase())) score += 20;
        return {
          id: p.id,
          name: p.name,
          type: p.type ?? null,
          geo_focus: p.geo_focus ?? null,
          ticket_min: p.ticket_min ?? null,
          ticket_max: p.ticket_max ?? null,
          status: statusMap.get(p.id) ?? 'non_contacte',
          fit_score: Math.min(score, 100),
        };
      });
      rows.sort((a, b) => b.fit_score - a.fit_score);

      if (!cancelled) {
        setFunds(rows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <header>
        <h2 className="text-base font-semibold">Fonds & matching</h2>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Matching anonyme deal ↔ fonds. Score d'adéquation calculé depuis secteur + fourchette ticket.
          Workflow : non contacté → teaser envoyé → intéressé → NDA → IM partagé → IOI reçu.
        </p>
      </header>

      {funds.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
          <h3 className="text-sm font-semibold mb-1">Aucun fonds dans le référentiel</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            La table <code className="bg-muted/50 px-1.5 py-0.5 rounded">funding_programs</code> est vide sur staging.
            À seeder avec les fonds DFI / VC actifs sur la zone (Helios, AfricInvest, IFC, BIO, FMO, Adiwale, etc.)
            pour activer le matching.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b">
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                <th className="text-left py-2.5 px-3">Fonds</th>
                <th className="text-left py-2.5 px-2">Type</th>
                <th className="text-left py-2.5 px-2">Géo</th>
                <th className="text-right py-2.5 px-2">Ticket</th>
                <th className="text-center py-2.5 px-2">Score</th>
                <th className="text-left py-2.5 px-2">Statut</th>
                <th className="text-right py-2.5 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {funds.map(f => {
                const meta = STATUS_LABEL[f.status || 'non_contacte'] ?? STATUS_LABEL.non_contacte;
                return (
                  <tr key={f.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="py-2.5 px-3 font-medium">{f.name}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">{f.type || '—'}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">{f.geo_focus || '—'}</td>
                    <td className="py-2.5 px-2 text-right">
                      {f.ticket_min && f.ticket_max
                        ? `${(f.ticket_min / 1_000_000).toFixed(0)}-${(f.ticket_max / 1_000_000).toFixed(0)}M`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-[10px] font-bold ${
                        f.fit_score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                        f.fit_score >= 60 ? 'bg-amber-100 text-amber-700' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {f.fit_score}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <Badge variant="outline" className={`text-[10px] ${meta.color}`}>
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1">
                        <Send className="h-3 w-3" /> Envoyer teaser
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="p-3 bg-violet-50 border-violet-200 text-xs text-violet-800 flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Score V1 calculé localement (secteur + ticket). L'agent IA <code>match-deal-funds</code> qui
          intègre thèse d'investissement détaillée + historique fonds sera ajouté dans une session future.
        </span>
      </Card>
    </div>
  );
}
