// src/components/ba/ImAnalystBindings.tsx
// Section "Bindings IM ↔ Analyste" dans la page Équipe BA.
// Le Partner peut lier un Senior à un Analyste pour que le Senior voie ses
// mandats (RLS can_see_pe_deal).
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { useImAnalystBindings } from '@/hooks/useImAnalystBindings';
import type { BaTeamMember } from '@/types/equipe-ba';

interface Props {
  organizationId: string;
  members: BaTeamMember[];
}

export default function ImAnalystBindings({ organizationId, members }: Props) {
  const { bindings, loading, createBinding, toggleBinding } = useImAnalystBindings(organizationId);

  const seniors = useMemo(
    () => members.filter(m => m.status === 'active' && (m.role === 'investment_manager' || m.role === 'managing_director')),
    [members],
  );
  const analystes = useMemo(
    () => members.filter(m => m.status === 'active' && (m.role === 'analyst' || m.role === 'analyste')),
    [members],
  );

  const [selectedIm, setSelectedIm] = useState<string>('');
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!selectedIm || !selectedAnalyst) {
      toast.error('Sélectionne un Senior et un Analyste');
      return;
    }
    setSubmitting(true);
    const err = await createBinding(selectedIm, selectedAnalyst);
    setSubmitting(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success('Binding créé');
    setSelectedIm('');
    setSelectedAnalyst('');
  };

  const handleToggle = async (bindingId: string, currentActive: boolean) => {
    const err = await toggleBinding(bindingId, !currentActive);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(currentActive ? 'Binding désactivé' : 'Binding réactivé');
  };

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-1">Affectations Senior ↔ Analyste</div>
      <p className="text-xs text-muted-foreground mb-4">
        Lie un Senior à un Analyste pour qu'il voie les mandats où l'analyste est lead.
      </p>

      <div className="flex flex-col md:flex-row gap-2 md:items-end mb-4 pb-4 border-b">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium">Senior</label>
          <Select value={selectedIm} onValueChange={setSelectedIm}>
            <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>
              {seniors.length === 0 && (
                <SelectItem value="__none" disabled>Aucun Senior actif</SelectItem>
              )}
              {seniors.map(s => (
                <SelectItem key={s.user_id} value={s.user_id}>
                  {s.full_name || s.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium">Analyste</label>
          <Select value={selectedAnalyst} onValueChange={setSelectedAnalyst}>
            <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>
              {analystes.length === 0 && (
                <SelectItem value="__none" disabled>Aucun Analyste actif</SelectItem>
              )}
              {analystes.map(a => (
                <SelectItem key={a.user_id} value={a.user_id}>
                  {a.full_name || a.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleCreate}
          disabled={submitting || !selectedIm || !selectedAnalyst}
          className="gap-1.5"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Lier
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : bindings.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune affectation pour le moment.</p>
      ) : (
        <div className="space-y-1.5">
          {bindings.map(b => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{b.im_name ?? b.im_user_id.slice(0, 8)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{b.analyst_name ?? b.analyst_user_id.slice(0, 8)}</span>
                {!b.is_active && (
                  <Badge variant="outline" className="text-[10px]">Désactivé</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggle(b.id, b.is_active)}
                className="h-7 px-2"
              >
                {b.is_active ? <X className="h-3.5 w-3.5" /> : 'Réactiver'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
