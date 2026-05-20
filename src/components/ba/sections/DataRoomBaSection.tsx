// src/components/ba/sections/DataRoomBaSection.tsx
// Brief P7 #31 — Section Data Room côté BA :
//   - Liste des partages data_room_shares pour le deal
//   - Access log (qui a ouvert, quand)
//   - Bouton révoquer + prolonger expiration

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Lock, Copy, RotateCcw, Trash2, Clock, Eye, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  dealId: string;
}

interface Share {
  id: string;
  access_token: string;
  investor_email: string | null;
  investor_name: string | null;
  expires_at: string | null;
  can_download: boolean;
  created_at: string;
  last_accessed_at: string | null;
  access_count: number | null;
  revoked_at: string | null;
}

export default function DataRoomBaSection({ dealId }: Props) {
  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState<Share[]>([]);

  const load = async () => {
    setLoading(true);
    // data_room_shares est indexé par enterprise_id (pas deal_id direct).
    // On récupère enterprise_id via pe_deals.
    const { data: deal } = await supabase
      .from('pe_deals')
      .select('enterprise_id, organization_id')
      .eq('id', dealId)
      .maybeSingle();
    const entId = (deal as any)?.enterprise_id;
    if (!entId) { setShares([]); setLoading(false); return; }

    const { data, error } = await supabase
      .from('data_room_shares')
      .select('id, access_token, investor_email, investor_name, expires_at, can_download, created_at, last_accessed_at, access_count, revoked_at')
      .eq('enterprise_id', entId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(`Chargement échoué : ${error.message}`);
    }
    setShares(((data || []) as any[]) as Share[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [dealId]);

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/data-room/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié', { description: url });
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const revoke = async (s: Share) => {
    if (!confirm(`Révoquer l'accès de ${s.investor_name || s.investor_email || 'ce lien'} ?`)) return;
    const { error } = await supabase
      .from('data_room_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Accès révoqué');
    load();
  };

  const extend = async (s: Share, days: number) => {
    const base = s.expires_at ? new Date(s.expires_at) : new Date();
    const target = base < new Date() ? new Date() : base;
    target.setTime(target.getTime() + days * 86_400_000);
    const { error } = await supabase
      .from('data_room_shares')
      .update({ expires_at: target.toISOString() })
      .eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Expiration prolongée de ${days} jours`);
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-violet-600" /> Data Room
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Liens d'accès partagés avec les investisseurs ayant signé une NDA.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {shares.filter(s => !s.revoked_at).length} actif{shares.filter(s => !s.revoked_at).length > 1 ? 's' : ''} · {shares.length} au total
        </Badge>
      </div>

      {shares.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucun partage data room pour ce deal.
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Les partages sont créés automatiquement quand un fonds signe la NDA dans Investisseurs cibles.
            </p>
          </CardContent>
        </Card>
      )}

      {shares.map(s => {
        const expired = s.expires_at ? new Date(s.expires_at) < new Date() : false;
        const revoked = !!s.revoked_at;
        const status = revoked ? 'revoked' : expired ? 'expired' : 'active';
        return (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold truncate">
                      {s.investor_name || s.investor_email || 'Investisseur'}
                    </h3>
                    {status === 'active' && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Actif</Badge>
                    )}
                    {status === 'expired' && (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Expiré</Badge>
                    )}
                    {status === 'revoked' && (
                      <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">Révoqué</Badge>
                    )}
                    {s.can_download && (
                      <Badge variant="outline" className="text-[10px]">Téléchargement OK</Badge>
                    )}
                  </div>
                  {s.investor_email && (
                    <div className="text-[11px] text-muted-foreground">{s.investor_email}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Créé le {new Date(s.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    {s.expires_at && (
                      <span className="flex items-center gap-1">
                        Expire le {new Date(s.expires_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {s.access_count ?? 0} ouverture{(s.access_count ?? 0) > 1 ? 's' : ''}
                    </span>
                    {s.last_accessed_at && (
                      <span>· dernière {new Date(s.last_accessed_at).toLocaleDateString('fr-FR')}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5 shrink-0">
                  {!revoked && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => copyLink(s.access_token)}>
                        <Copy className="h-3 w-3" /> Copier lien
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" asChild>
                        <a href={`/data-room/${s.access_token}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" /> Voir
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => extend(s, 30)}>
                        <RotateCcw className="h-3 w-3" /> +30j
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => revoke(s)}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
