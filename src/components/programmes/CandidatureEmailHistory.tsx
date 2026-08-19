// Historique des e-mails envoyés à une candidature (brief 1, critère 10).
// Lecture de candidature_emails : type, objet, horodatage, émetteur, statut de remise.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Mail } from 'lucide-react';

interface EmailRow {
  id: string; type: string; subject: string; sent_at: string;
  delivery_status: string; sent_by: string | null;
}

const DELIVERY_LABELS: Record<string, string> = {
  queued: 'en file', sent: 'envoyé', delivered: 'remis', bounced: 'rebond',
  complained: 'plainte', failed: 'échec',
};
function deliveryTone(s: string): string {
  if (s === 'delivered' || s === 'sent') return 'border-emerald-300 text-emerald-700';
  if (s === 'bounced' || s === 'failed' || s === 'complained') return 'border-red-300 text-red-700';
  return 'border-muted-foreground/30 text-muted-foreground';
}

export default function CandidatureEmailHistory({ candidatureId }: { candidatureId: string | null }) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [emetteurs, setEmetteurs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!candidatureId) { setRows([]); return; }
    let annule = false;
    (async () => {
      const { data } = await supabase
        .from('candidature_emails')
        .select('id, type, subject, sent_at, delivery_status, sent_by')
        .eq('candidature_id', candidatureId)
        .order('sent_at', { ascending: false });
      if (annule) return;
      setRows((data as EmailRow[]) ?? []);
      const ids = [...new Set((data ?? []).map((r: any) => r.sent_by).filter(Boolean))];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
        if (annule) return;
        const map: Record<string, string> = {};
        for (const p of profs ?? []) map[p.user_id] = p.full_name ?? '';
        setEmetteurs(map);
      }
    })();
    return () => { annule = true; };
  }, [candidatureId]);

  if (!candidatureId) return null;

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm">Historique des e-mails ({rows.length})</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun e-mail envoyé à ce candidat.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-xs border rounded px-2.5 py-2">
              <Mail className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{r.type === 'relance' ? 'Relance' : 'Communication'}</Badge>
                  <span className="font-medium truncate">{r.subject}</span>
                </div>
                <p className="text-muted-foreground">
                  {new Date(r.sent_at).toLocaleString('fr-FR')}{r.sent_by ? ` · ${emetteurs[r.sent_by] || '—'}` : ''}
                </p>
              </div>
              <Badge variant="outline" className={`shrink-0 ${deliveryTone(r.delivery_status)}`}>
                {DELIVERY_LABELS[r.delivery_status] || r.delivery_status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
