// Plan100DaysSection — gestion du plan 100 jours post-closing
// Affiché dans la sidebar du deal quand stage='closing' ou 'portfolio'
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Loader2, Sparkles, Plus, CheckCircle2, Circle, AlertCircle, Trash2,
  Briefcase, Users, FileBarChart, Zap, ShieldCheck, Wallet, ShoppingCart, Cog, MoreHorizontal,
  Calendar, Edit2, Save, X, Activity, Clock, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import StatCard from '@/components/shared/StatCard';

interface Props {
  dealId: string;
  organizationId: string;
}

type Status = 'todo' | 'in_progress' | 'done' | 'blocked';
type Category = 'recrutement' | 'gouvernance' | 'reporting' | 'quick_win' | 'compliance' | 'finance' | 'commercial' | 'operationnel' | 'autre';

interface ActionItem {
  id: string;
  deal_id: string;
  organization_id: string;
  action_label: string;
  description: string | null;
  category: Category;
  status: Status;
  priority: number;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  source: string;
  created_at: string;
}

const STATUS_META: Record<Status, { label: string; cls: string; Icon: any }> = {
  todo: { label: 'À faire', cls: 'bg-slate-50 text-slate-700 border-slate-200', Icon: Circle },
  in_progress: { label: 'En cours', cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: Loader2 },
  done: { label: 'Fait', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  blocked: { label: 'Bloqué', cls: 'bg-red-50 text-red-700 border-red-200', Icon: AlertCircle },
};

const CAT_META: Record<Category, { label: string; Icon: any; cls: string }> = {
  recrutement: { label: 'Recrutement', Icon: Users, cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  gouvernance: { label: 'Gouvernance', Icon: Briefcase, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  reporting: { label: 'Reporting', Icon: FileBarChart, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  quick_win: { label: 'Quick Win', Icon: Zap, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  compliance: { label: 'Compliance', Icon: ShieldCheck, cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  finance: { label: 'Finance', Icon: Wallet, cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  commercial: { label: 'Commercial', Icon: ShoppingCart, cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  operationnel: { label: 'Opérationnel', Icon: Cog, cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  autre: { label: 'Autre', Icon: MoreHorizontal, cls: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const STATUS_NEXT: Record<Status, Status> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
  blocked: 'in_progress',
};

export default function Plan100DaysSection({ dealId, organizationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAction, setNewAction] = useState({
    label: '', description: '', category: 'autre' as Category, priority: 5, due_date: '',
  });

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pe_action_plans')
      .select('*')
      .eq('deal_id', dealId)
      .order('priority')
      .order('due_date');
    if (!error) setActions((data ?? []) as any);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { reload(); }, [reload]);

  const generateFromMemo = async () => {
    if (generating) return;
    if (actions.some(a => a.source === 'memo_extracted')) {
      if (!confirm('Un plan a déjà été généré depuis le memo. Régénérer écraserait celui-ci. Continuer ?')) return;
    }
    setGenerating(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-100days-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ deal_id: dealId, force: actions.some(a => a.source === 'memo_extracted') }),
      });
      const result = await resp.json();
      if (resp.ok) {
        if (result.skipped) {
          toast.info(result.reason);
        } else {
          toast.success(`${result.actions_created} actions extraites du memo IC finale`);
        }
        reload();
      } else {
        toast.error(`Génération échouée : ${result.error}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setGenerating(false);
  };

  const addAction = async () => {
    if (!newAction.label.trim()) return;
    const { error } = await supabase.from('pe_action_plans').insert({
      deal_id: dealId,
      organization_id: organizationId,
      action_label: newAction.label.trim(),
      description: newAction.description.trim() || null,
      category: newAction.category,
      priority: newAction.priority,
      due_date: newAction.due_date || null,
      status: 'todo',
      source: 'manual',
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Action ajoutée');
    setNewAction({ label: '', description: '', category: 'autre', priority: 5, due_date: '' });
    setShowAdd(false);
    reload();
  };

  const updateStatus = async (id: string, currentStatus: Status, e?: React.MouseEvent) => {
    const next = e?.shiftKey ? 'blocked' : STATUS_NEXT[currentStatus];
    const updates: any = { status: next };
    if (next === 'done') updates.completed_at = new Date().toISOString();
    if (currentStatus === 'done' && next !== 'done') updates.completed_at = null;
    const { error } = await supabase.from('pe_action_plans').update(updates).eq('id', id);
    if (error) toast.error(error.message);
    else reload();
  };

  const removeAction = async (id: string) => {
    if (!confirm('Supprimer cette action ?')) return;
    const { error } = await supabase.from('pe_action_plans').delete().eq('id', id);
    if (!error) reload();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Stats
  const total = actions.length;
  const done = actions.filter(a => a.status === 'done').length;
  const inProgress = actions.filter(a => a.status === 'in_progress').length;
  const blocked = actions.filter(a => a.status === 'blocked').length;
  const overdue = actions.filter(a => a.status !== 'done' && a.due_date && a.due_date < new Date().toISOString().slice(0, 10)).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  // Group by category
  const byCategory = actions.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {} as Record<Category, ActionItem[]>);

  return (
    <div className="space-y-4">
      {/* === Header === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Plan 100 jours
              <Badge variant="outline" className="text-xs">{total} actions</Badge>
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={generateFromMemo} disabled={generating} className="gap-1.5">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Extraire du memo (IA)
              </Button>
              <Button size="sm" onClick={() => setShowAdd(v => !v)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Stats récap */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <StatCard icon={CheckCircle2} value={`${done}/${total}`} label="Fait" iconColor="text-emerald-500" />
            <StatCard icon={Activity} value={inProgress} label="En cours" iconColor="text-blue-500" />
            <StatCard icon={AlertCircle} value={blocked} label="Bloqué" iconColor="text-red-500" />
            <StatCard icon={Clock} value={overdue} label="En retard" iconColor="text-amber-500" highlight={overdue > 0 ? 'amber' : undefined} />
            <StatCard icon={TrendingUp} value={`${progress}%`} label="Progression" iconColor="text-primary" />
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Form ajouter */}
      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Action *</Label>
                <Input value={newAction.label} onChange={e => setNewAction(a => ({ ...a, label: e.target.value }))} placeholder="Recruter un DAF expérimenté" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Catégorie</Label>
                <Select value={newAction.category} onValueChange={(v) => setNewAction(a => ({ ...a, category: v as Category }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAT_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priorité (1=haute)</Label>
                <Input type="number" min={1} max={10} value={newAction.priority} onChange={e => setNewAction(a => ({ ...a, priority: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Date prévue</Label>
                <Input type="date" value={newAction.due_date} onChange={e => setNewAction(a => ({ ...a, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Description (optionnel)</Label>
                <Textarea rows={2} value={newAction.description} onChange={e => setNewAction(a => ({ ...a, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Annuler</Button>
              <Button size="sm" onClick={addAction}>Ajouter</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste par catégorie */}
      {total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <Sparkles className="h-8 w-8 mx-auto text-violet-300" />
            <p>Aucune action pour le moment.</p>
            <p className="text-sm">Clique "Extraire du memo" pour générer le plan automatiquement à partir du memo IC finale.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(byCategory)
          .sort((a, b) => CAT_META[a[0] as Category].label.localeCompare(CAT_META[b[0] as Category].label))
          .map(([cat, items]) => {
            const meta = CAT_META[cat as Category];
            const CatIcon = meta.Icon;
            return (
              <Card key={cat}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CatIcon className="h-4 w-4" />
                    {meta.label}
                    <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {items.map(a => {
                    const sm = STATUS_META[a.status];
                    const SIcon = sm.Icon;
                    const overdue = a.status !== 'done' && a.due_date && a.due_date < new Date().toISOString().slice(0, 10);
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center gap-2 p-2 rounded border hover:bg-muted/30 transition-colors ${overdue ? 'border-red-200 bg-red-50/30' : ''}`}
                      >
                        <button
                          onClick={(e) => updateStatus(a.id, a.status, e)}
                          title={`Click : ${STATUS_NEXT[a.status]} · Shift+Click : bloquer`}
                          className="shrink-0"
                        >
                          <SIcon className={`h-5 w-5 ${a.status === 'in_progress' ? 'animate-spin text-blue-500' : a.status === 'done' ? 'text-emerald-500' : a.status === 'blocked' ? 'text-red-500' : 'text-muted-foreground'}`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${a.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                              {a.action_label}
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                            <Badge variant="outline" className={`text-[10px] ${sm.cls}`}>P{a.priority}</Badge>
                            {a.source === 'memo_extracted' && (
                              <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200 gap-1">
                                <Sparkles className="h-2.5 w-2.5" /> IA
                              </Badge>
                            )}
                          </div>
                          {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                          {a.due_date && (
                            <div className={`text-[11px] flex items-center gap-1 mt-0.5 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                              <Calendar className="h-3 w-3" />
                              {new Date(a.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {overdue && ' (en retard)'}
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive shrink-0" onClick={() => removeAction(a.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })
      )}
    </div>
  );
}
