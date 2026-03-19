import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Save, X, Target, Filter, BarChart3, Upload, FileText, Loader2 } from 'lucide-react';

interface ProgrammeCriteria {
  id: string;
  name: string;
  description: string | null;
  min_score_ir: number;
  max_score_ir: number;
  required_deliverables: string[];
  sector_filter: string[];
  country_filter: string[];
  min_revenue: number;
  max_debt_ratio: number;
  min_margin: number;
  custom_criteria: Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  source_document_url?: string | null;
  raw_criteria_text?: string | null;
}

const DELIVERABLE_OPTIONS = [
  { value: 'bmc_analysis', label: 'BMC' },
  { value: 'sic_analysis', label: 'SIC' },
  { value: 'inputs_data', label: 'Inputs' },
  { value: 'framework_data', label: 'Framework' },
  { value: 'diagnostic_data', label: 'Diagnostic' },
  { value: 'plan_ovo', label: 'Plan OVO' },
  { value: 'business_plan', label: 'Business Plan' },
  { value: 'odd_analysis', label: 'ODD' },
  { value: 'screening_report', label: 'Screening' },
];

const SECTORS = [
  'Agriculture / Agroalimentaire', 'Tech / Digital', 'Commerce / Distribution',
  'Services / Conseil', 'Industrie / Manufacture', 'BTP / Construction',
  'Énergie / Environnement', 'Santé / Pharma', 'Éducation / Formation',
  'Transport / Logistique', 'Finance / Assurance', 'Artisanat',
];

const COUNTRIES = ["Côte d'Ivoire", 'Sénégal', 'Cameroun', 'Mali', 'Burkina Faso', 'Guinée', 'Togo', 'Bénin', 'Niger', 'Congo', 'RDC'];

const emptyForm = {
  name: '', description: '', min_score_ir: 50, max_score_ir: 100,
  required_deliverables: [] as string[], sector_filter: [] as string[],
  country_filter: [] as string[], min_revenue: 0, max_debt_ratio: 80,
  min_margin: 5, is_active: true,
};

export default function ProgrammeCriteriaEditor() {
  const { user } = useAuth();
  const [criteria, setCriteria] = useState<ProgrammeCriteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceDocName, setSourceDocName] = useState<string | null>(null);
  const [rawCriteriaText, setRawCriteriaText] = useState<string | null>(null);
  const [sourceDocUrl, setSourceDocUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCriteria = async () => {
    setLoading(true);
    const { data } = await supabase.from('programme_criteria').select('*').order('created_at', { ascending: false });
    setCriteria((data as unknown as ProgrammeCriteria[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCriteria(); }, []);

  const handleEdit = (c: ProgrammeCriteria) => {
    setEditingId(c.id);
    setForm({
      name: c.name, description: c.description || '',
      min_score_ir: c.min_score_ir, max_score_ir: c.max_score_ir,
      required_deliverables: c.required_deliverables || [],
      sector_filter: c.sector_filter || [],
      country_filter: c.country_filter || [],
      min_revenue: c.min_revenue, max_debt_ratio: c.max_debt_ratio,
      min_margin: c.min_margin, is_active: c.is_active,
    });
    setSourceDocUrl(c.source_document_url || null);
    setRawCriteriaText(c.raw_criteria_text || null);
    setSourceDocName(c.source_document_url ? c.source_document_url.split('/').pop() || null : null);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setSourceDocName(null);
    setRawCriteriaText(null);
    setSourceDocUrl(null);
    setShowForm(true);
  };

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc', 'txt'].includes(ext || '')) {
      toast.error('Format non supporté. Utilisez PDF, DOCX ou TXT.');
      return;
    }

    setUploading(true);
    try {
      // Upload to storage
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `programme-docs/${user.id}/${Date.now()}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Call edge function to extract criteria
      toast.info('Analyse du document en cours…', { duration: 10000, id: 'extracting' });

      const { data: fnData, error: fnError } = await supabase.functions.invoke('extract-programme-criteria', {
        body: { storage_path: storagePath },
      });

      toast.dismiss('extracting');

      if (fnError) throw new Error(fnError.message || 'Erreur extraction');
      if (!fnData?.success) throw new Error(fnData?.error || 'Extraction échouée');

      const extracted = fnData.extracted;

      // Populate form with extracted data
      setForm(f => ({
        ...f,
        name: extracted.name || f.name,
        description: extracted.description || f.description,
        min_score_ir: extracted.min_score_ir ?? f.min_score_ir,
        max_score_ir: extracted.max_score_ir ?? f.max_score_ir,
        min_revenue: extracted.min_revenue ?? f.min_revenue,
        max_debt_ratio: extracted.max_debt_ratio ?? f.max_debt_ratio,
        min_margin: extracted.min_margin ?? f.min_margin,
        sector_filter: extracted.sector_filter?.length ? extracted.sector_filter : f.sector_filter,
        country_filter: extracted.country_filter?.length ? extracted.country_filter : f.country_filter,
        required_deliverables: extracted.required_deliverables?.length ? extracted.required_deliverables : f.required_deliverables,
      }));

      setSourceDocUrl(storagePath);
      setSourceDocName(file.name);
      setRawCriteriaText(fnData.raw_text || null);

      toast.success('Critères extraits du document ! Vérifiez et ajustez si nécessaire.');

      // Open the form if not already open
      if (!showForm) setShowForm(true);
    } catch (err: any) {
      console.error('Upload/extract error:', err);
      toast.error(err.message || 'Erreur lors de l\'extraction');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description || null,
        min_score_ir: form.min_score_ir,
        max_score_ir: form.max_score_ir,
        required_deliverables: form.required_deliverables,
        sector_filter: form.sector_filter,
        country_filter: form.country_filter,
        min_revenue: form.min_revenue,
        max_debt_ratio: form.max_debt_ratio,
        min_margin: form.min_margin,
        is_active: form.is_active,
        custom_criteria: {},
        source_document_url: sourceDocUrl,
        raw_criteria_text: rawCriteriaText,
      };

      if (editingId) {
        const { error } = await supabase.from('programme_criteria').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Critères mis à jour');
      } else {
        const { error } = await supabase.from('programme_criteria').insert({ ...payload, created_by: user.id });
        if (error) throw error;
        toast.success('Programme créé');
      }
      setShowForm(false);
      fetchCriteria();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('programme_criteria').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Programme supprimé'); fetchCriteria(); }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from('programme_criteria').update({ is_active: active } as any).eq('id', id);
    if (error) toast.error(error.message);
    else fetchCriteria();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Programmes & Critères de sélection
          </h3>
          <p className="text-sm text-muted-foreground">Configurez les critères d'éligibilité pour vos programmes bailleurs</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            className="hidden"
            onChange={handleUploadDocument}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Analyse…' : 'Importer un document'}
          </Button>
          <Button onClick={handleNew} className="gap-2"><Plus className="h-4 w-4" /> Nouveau programme</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Chargement…</p>
      ) : criteria.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <div className="space-y-2">
            <p>Aucun programme configuré.</p>
            <p className="text-xs">Importez un document (PDF/Word) d'appel à projets ou créez manuellement.</p>
          </div>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {criteria.map(c => (
            <Card key={c.id} className={!c.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <Badge variant={c.is_active ? 'default' : 'secondary'}>
                      {c.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                    {c.source_document_url && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        Document source
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={c.is_active} onCheckedChange={v => handleToggleActive(c.id, v)} />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer « {c.name} » ?</AlertDialogTitle>
                          <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {c.description && <p className="text-sm text-muted-foreground mb-3">{c.description}</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Score IR min</span>
                    <p className="font-medium">{c.min_score_ir}/100</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Marge min</span>
                    <p className="font-medium">{c.min_margin}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ratio dette max</span>
                    <p className="font-medium">{c.max_debt_ratio}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CA min</span>
                    <p className="font-medium">{c.min_revenue?.toLocaleString('fr-FR')} FCFA</p>
                  </div>
                </div>
                {(c.sector_filter?.length > 0 || c.country_filter?.length > 0 || c.required_deliverables?.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {c.sector_filter?.map(s => <Badge key={s} variant="outline" className="text-xs"><Filter className="h-3 w-3 mr-1" />{s}</Badge>)}
                    {c.country_filter?.map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                    {c.required_deliverables?.map(d => <Badge key={d} variant="secondary" className="text-xs">{DELIVERABLE_OPTIONS.find(o => o.value === d)?.label || d}</Badge>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier le programme' : 'Nouveau programme'}</DialogTitle>
          </DialogHeader>

          {/* Source document indicator */}
          {sourceDocName && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span>Source : <strong>{sourceDocName}</strong></span>
              <span className="text-muted-foreground text-xs ml-auto">Critères extraits automatiquement — vérifiez et ajustez</span>
            </div>
          )}

          {/* Upload button inside the form */}
          {!sourceDocName && (
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                id="form-upload"
                onChange={handleUploadDocument}
              />
              <label htmlFor="form-upload" className="cursor-pointer flex flex-col items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Upload className="h-6 w-6" />
                )}
                <span>{uploading ? 'Analyse du document…' : 'Glissez ou cliquez pour importer un document programme (PDF/Word)'}</span>
                <span className="text-xs">Les critères seront extraits automatiquement</span>
              </label>
            </div>
          )}

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nom du programme *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Programme PME Croissance 2026" />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2"><BarChart3 className="h-4 w-4" /> Seuils financiers</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Score IR minimum</Label>
                  <Input type="number" value={form.min_score_ir} onChange={e => setForm(f => ({ ...f, min_score_ir: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CA minimum (FCFA)</Label>
                  <Input type="number" value={form.min_revenue} onChange={e => setForm(f => ({ ...f, min_revenue: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ratio dette max (%)</Label>
                  <Input type="number" value={form.max_debt_ratio} onChange={e => setForm(f => ({ ...f, max_debt_ratio: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Marge min (%)</Label>
                  <Input type="number" value={form.min_margin} onChange={e => setForm(f => ({ ...f, min_margin: +e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2"><Filter className="h-4 w-4" /> Livrables requis</Label>
              <div className="flex flex-wrap gap-2">
                {DELIVERABLE_OPTIONS.map(d => (
                  <Badge
                    key={d.value}
                    variant={form.required_deliverables.includes(d.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setForm(f => ({ ...f, required_deliverables: toggleArrayItem(f.required_deliverables, d.value) }))}
                  >
                    {d.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2">Filtres secteur</Label>
              <div className="flex flex-wrap gap-2">
                {SECTORS.map(s => (
                  <Badge
                    key={s}
                    variant={form.sector_filter.includes(s) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setForm(f => ({ ...f, sector_filter: toggleArrayItem(f.sector_filter, s) }))}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2">Filtres pays</Label>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map(c => (
                  <Badge
                    key={c}
                    variant={form.country_filter.includes(c) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setForm(f => ({ ...f, country_filter: toggleArrayItem(f.country_filter, c) }))}
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Programme actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}><X className="h-4 w-4 mr-1" />Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              <Save className="h-4 w-4 mr-1" />{saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
