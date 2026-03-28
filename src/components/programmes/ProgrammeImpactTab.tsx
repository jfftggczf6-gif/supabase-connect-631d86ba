import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Users, TrendingUp, Target, Globe, Pencil, Plus, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props { programmeId: string; }

const KPI_LABELS: Record<string, string> = {
  emplois_total: "Emplois total", ca_total_cohorte: "CA total", resultat_net_total: "Résultat net",
  odd_couverts: "ODD couverts", cibles_odd_positives: "Cibles ODD+", score_impact_social_moyen: "Score impact social",
  beneficiaires_directs: "Bénéficiaires", score_ir_moyen: "Score IR moyen", nb_livrables_total: "Livrables",
  nb_notes_coaching: "Sessions coaching", nb_pays: "Pays", nb_secteurs: "Secteurs", nb_entreprises: "Entreprises",
};

const fmtVal = (v: number, unit: string) => {
  if (unit === "FCFA" || unit === "EUR" || unit === "USD") return v >= 1e9 ? `${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v.toLocaleString('fr-FR');
  return v.toLocaleString('fr-FR');
};

export default function ProgrammeImpactTab({ programmeId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddKpi, setShowAddKpi] = useState(false);
  const [editKpi, setEditKpi] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newKpi, setNewKpi] = useState({ kpi_name: '', kpi_code: '', kpi_category: 'custom', unit: '', target_value: '', current_value: '', description: '', bailleur: '' });
  const [editValue, setEditValue] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke('get-programme-impact', { body: { programme_id: programmeId } });
    if (error) toast.error(error.message);
    else setData(res?.impact);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [programmeId]);

  const handleInitTemplate = async (template: string) => {
    const { error } = await supabase.functions.invoke('manage-programme-kpis', { body: { action: 'init_template', programme_id: programmeId, template } });
    if (error) toast.error(error.message);
    else { toast.success(`Template ${template.toUpperCase()} appliqué`); fetchData(); }
  };

  const handleAddKpi = async () => {
    setSaving(true);
    const code = newKpi.kpi_code || newKpi.kpi_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const { error } = await supabase.functions.invoke('manage-programme-kpis', {
      body: { action: 'add', programme_id: programmeId, kpi: { ...newKpi, kpi_code: code, target_value: Number(newKpi.target_value) || null, current_value: Number(newKpi.current_value) || 0 } }
    });
    if (error) toast.error(error.message);
    else { toast.success('KPI ajouté'); setShowAddKpi(false); setNewKpi({ kpi_name: '', kpi_code: '', kpi_category: 'custom', unit: '', target_value: '', current_value: '', description: '', bailleur: '' }); fetchData(); }
    setSaving(false);
  };

  const handleUpdateKpi = async () => {
    if (!editKpi) return;
    setSaving(true);
    const { error } = await supabase.functions.invoke('manage-programme-kpis', {
      body: { action: 'update_value', kpi_id: editKpi.id, value: Number(editValue), notes: editNotes }
    });
    if (error) toast.error(error.message);
    else { toast.success('Valeur mise à jour'); setEditKpi(null); fetchData(); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-8">Aucune donnée d'impact.</p>;

  const auto = data.auto_kpis || {};
  const custom = data.custom_kpis || [];
  const oddDetail = data.odd_detail || {};
  const parPays = data.par_pays || {};
  const progression = data.progression || {};

  const topKpis = ['nb_entreprises', 'emplois_total', 'ca_total_cohorte', 'score_ir_moyen', 'odd_couverts', 'nb_pays'];

  return (
    <div className="space-y-6">
      {/* Custom KPIs BAILLEURS — en premier (c'est ce qui intéresse le bailleur) */}
      <Card><CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">KPIs Bailleurs</h3>
          <div className="flex items-center gap-2">
            <Select onValueChange={handleInitTemplate}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="giz">GIZ</SelectItem>
                <SelectItem value="afd">AFD</SelectItem>
                <SelectItem value="bad">BAD</SelectItem>
                <SelectItem value="enabel">Enabel</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setShowAddKpi(true)}><Plus className="h-3.5 w-3.5 mr-1" /> KPI</Button>
          </div>
        </div>
        {custom.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun KPI bailleur. Sélectionnez un template ou ajoutez manuellement.</p>
        ) : (
          <div className="space-y-3">
            {custom.map((k: any) => {
              const pct = k.target_value ? Math.round((k.current_value / k.target_value) * 100) : 0;
              return (
                <div key={k.id} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate">{k.kpi_name}</span>
                  <div className="flex-1"><Progress value={Math.min(pct, 100)} className="h-2" /></div>
                  <span className="text-xs font-medium w-28 text-right">{k.current_value} / {k.target_value || '—'} {k.unit} ({pct}%)</span>
                  <button onClick={() => { setEditKpi(k); setEditValue(String(k.current_value)); setEditNotes(''); }} className="p-1 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent></Card>

      {/* ODD */}
      {oddDetail.par_odd && Object.keys(oddDetail.par_odd).length > 0 && (
        <Card><CardContent className="p-5">
          <h3 className="font-semibold mb-3">ODD adressés par la cohorte</h3>
          <div className="space-y-2">
            {Object.entries(oddDetail.par_odd).sort((a: any, b: any) => b[1].cibles_positives - a[1].cibles_positives).map(([num, v]: [string, any]) => (
              <div key={num} className="flex items-center gap-3">
                <Badge variant={v.nb_entreprises >= 5 ? 'default' : v.nb_entreprises >= 3 ? 'secondary' : 'outline'} className="w-16 justify-center text-xs">ODD {num}</Badge>
                <span className="text-sm flex-1">{v.nom}</span>
                <span className="text-xs text-muted-foreground">{v.nb_entreprises} entr. ({v.cibles_positives} cibles)</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Par pays */}
      {Object.keys(parPays).length > 0 && (
        <Card><CardContent className="p-5">
          <h3 className="font-semibold mb-3">Ventilation géographique</h3>
          <div className="space-y-2">
            {Object.entries(parPays).sort((a: any, b: any) => b[1].nb_entreprises - a[1].nb_entreprises).map(([pays, v]: [string, any]) => (
              <div key={pays} className="flex items-center gap-3 p-2 rounded bg-muted/30">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm flex-1">{pays}</span>
                <span className="text-xs">{v.nb_entreprises} entr.</span>
                <span className="text-xs text-muted-foreground">{fmtVal(v.ca_total, 'FCFA')} FCFA</span>
                <span className="text-xs text-muted-foreground">{v.emplois} emplois</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Progression */}
      <Card><CardContent className="p-5">
        <h3 className="font-semibold mb-3">Progression</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-2xl font-bold">{progression.score_actuel_moyen || '—'}</p><p className="text-xs text-muted-foreground">Score IR moyen actuel</p></div>
          <div><p className="text-2xl font-bold">{progression.nb_entreprises_pipeline_complet || 0}</p><p className="text-xs text-muted-foreground">Pipeline complet</p></div>
          <div><p className="text-2xl font-bold">{progression.taux_completion_pipeline || 0}%</p><p className="text-xs text-muted-foreground">Taux complétion</p></div>
        </div>
      </CardContent></Card>

      {/* Données sources (auto-calculées) */}
      <details>
        <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">Données sources (calculées automatiquement)</summary>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
          {topKpis.map(key => {
            const kpi = auto[key];
            if (!kpi) return null;
            return (
              <Card key={key}><CardContent className="p-3 text-center">
                <p className="text-lg font-bold">{fmtVal(kpi.value, kpi.unit)}</p>
                <p className="text-[10px] text-muted-foreground">{KPI_LABELS[key] || key}</p>
              </CardContent></Card>
            );
          })}
        </div>
      </details>

      {/* Add KPI dialog */}
      <Dialog open={showAddKpi} onOpenChange={setShowAddKpi}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un indicateur d'impact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nom *</Label><Input value={newKpi.kpi_name} onChange={e => setNewKpi({ ...newKpi, kpi_name: e.target.value })} placeholder="Emplois féminins créés" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Catégorie *</Label>
                <Select value={newKpi.kpi_category} onValueChange={v => setNewKpi({ ...newKpi, kpi_category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emploi">Emploi</SelectItem><SelectItem value="financier">Financier</SelectItem>
                    <SelectItem value="impact_social">Impact social</SelectItem><SelectItem value="genre">Genre</SelectItem>
                    <SelectItem value="formation">Formation</SelectItem><SelectItem value="gouvernance">Gouvernance</SelectItem>
                    <SelectItem value="impact_environnemental">Environnemental</SelectItem><SelectItem value="custom">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Unité *</Label><Input value={newKpi.unit} onChange={e => setNewKpi({ ...newKpi, unit: e.target.value })} placeholder="emplois" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Objectif</Label><Input type="number" value={newKpi.target_value} onChange={e => setNewKpi({ ...newKpi, target_value: e.target.value })} /></div>
              <div className="space-y-1"><Label>Valeur actuelle</Label><Input type="number" value={newKpi.current_value} onChange={e => setNewKpi({ ...newKpi, current_value: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Input value={newKpi.description} onChange={e => setNewKpi({ ...newKpi, description: e.target.value })} /></div>
            <div className="space-y-1"><Label>Bailleur</Label><Input value={newKpi.bailleur} onChange={e => setNewKpi({ ...newKpi, bailleur: e.target.value })} placeholder="GIZ, AFD..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddKpi(false)}>Annuler</Button>
            <Button onClick={handleAddKpi} disabled={saving || !newKpi.kpi_name || !newKpi.unit}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit KPI value dialog */}
      <Dialog open={!!editKpi} onOpenChange={() => setEditKpi(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mettre à jour : {editKpi?.kpi_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Valeur actuelle</Label><Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} /></div>
            <div className="space-y-1"><Label>Notes</Label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Mis à jour après visite terrain..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditKpi(null)}>Annuler</Button>
            <Button onClick={handleUpdateKpi} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
