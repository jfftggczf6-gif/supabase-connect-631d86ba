import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, X, Loader2, Upload, FileText, CheckCircle2, AlertTriangle, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const COUNTRIES = ['Côte d\'Ivoire', 'Sénégal', 'Cameroun', 'Burkina Faso', 'Mali', 'Togo', 'Bénin', 'Guinée', 'Niger', 'Congo', 'RDC', 'Gabon', 'Madagascar', 'Rwanda', 'Kenya'];
const SECTORS = ['Agriculture', 'Agro-industrie', 'Énergie', 'Fintech', 'Santé', 'Éducation', 'Transport', 'Commerce', 'BTP', 'Technologie', 'Textile', 'Tourisme'];

interface FormField {
  id: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'date' | 'file';
  label: string;
  required: boolean;
  options?: string[];
}

export default function ProgrammeCreatePage() {
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [prefilledFields, setPrefilledFields] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: '', organization: '', description: '',
    budget: '', nb_places: '', currency: 'XOF',
    country_filter: [] as string[],
    sector_filter: [] as string[],
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    programme_start: undefined as Date | undefined,
    programme_end: undefined as Date | undefined,
    min_revenue: '', min_margin: '',
  });
  const [criteresEligibilite, setCriteresEligibilite] = useState<string[]>([]);
  const [criteresSelection, setCriteresSelection] = useState<string[]>([]);
  const [conditionsSpecifiques, setConditionsSpecifiques] = useState<string[]>([]);
  const [newCritere, setNewCritere] = useState('');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FormField['type']>('text');

  const toggleTag = (key: 'country_filter' | 'sector_filter', val: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val]
    }));
  };

  const addField = () => {
    if (!newFieldLabel.trim()) return;
    setFormFields(f => [...f, { id: crypto.randomUUID(), type: newFieldType, label: newFieldLabel.trim(), required: false }]);
    setNewFieldLabel('');
  };

  const removeField = (id: string) => setFormFields(f => f.filter(ff => ff.id !== id));
  const toggleFieldRequired = (id: string) => setFormFields(f => f.map(ff => ff.id === id ? { ...ff, required: !ff.required } : ff));

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const ACCEPTED = ['pdf', 'docx', 'doc', 'txt', 'md', 'xlsx', 'xls', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'];
    if (!ACCEPTED.includes(ext || '')) {
      toast({ title: 'Format non supporté', description: 'Formats acceptés : PDF, DOCX, XLSX, images, TXT.', variant: 'destructive' });
      return;
    }

    setUploadedFile(file);
    setExtracting(true);

    try {
      // Upload to storage first
      const storagePath = `programme-criteria/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file);

      if (uploadError) throw new Error(uploadError.message);

      // Call extraction function
      const { data, error } = await supabase.functions.invoke('extract-programme-criteria', {
        body: { storage_path: storagePath }
      });

      if (error) throw new Error(error.message);

      const extracted = data?.extracted;
      if (!extracted) throw new Error('Aucune donnée extraite');

      const filled = new Set<string>();

      // Parse dates from custom_criteria
      let endDate: Date | undefined;
      let progStart: Date | undefined;
      let progEnd: Date | undefined;
      
      if (extracted.custom_criteria?.date_limite) {
        try { endDate = new Date(extracted.custom_criteria.date_limite); if (isNaN(endDate.getTime())) endDate = undefined; } catch { /* ignore */ }
      }
      if (extracted.custom_criteria?.duree_programme) {
        const dur = extracted.custom_criteria.duree_programme;
        const monthsMatch = dur.match(/(\d+)\s*mois/i);
        const yearsMatch = dur.match(/(\d+)\s*an/i);
        if (monthsMatch || yearsMatch) {
          const months = monthsMatch ? parseInt(monthsMatch[1]) : (yearsMatch ? parseInt(yearsMatch[1]) * 12 : 0);
          if (months > 0) {
            progStart = new Date();
            progEnd = new Date();
            progEnd.setMonth(progEnd.getMonth() + months);
            filled.add('programme_start');
            filled.add('programme_end');
          }
        }
      }

      // Store criteria in dedicated sections (NOT as form fields)
      if (extracted.custom_criteria?.criteres_eligibilite?.length) {
        setCriteresEligibilite(extracted.custom_criteria.criteres_eligibilite);
        filled.add('criteres_eligibilite');
      }
      if (extracted.custom_criteria?.criteres_selection?.length) {
        setCriteresSelection(extracted.custom_criteria.criteres_selection);
        filled.add('criteres_selection');
      }
      if (extracted.custom_criteria?.conditions_specifiques?.length) {
        setConditionsSpecifiques(extracted.custom_criteria.conditions_specifiques);
        filled.add('conditions_specifiques');
      }

      // Pre-fill form
      setForm(f => {
        const updated = { ...f };
        if (extracted.name) { updated.name = extracted.name; filled.add('name'); }
        if (extracted.description) { updated.description = extracted.description; filled.add('description'); }
        if (extracted.country_filter?.length) { updated.country_filter = extracted.country_filter; filled.add('country_filter'); }
        if (extracted.sector_filter?.length) { updated.sector_filter = extracted.sector_filter; filled.add('sector_filter'); }
        if (extracted.min_revenue) { updated.min_revenue = String(extracted.min_revenue); filled.add('min_revenue'); }
        if (extracted.min_margin) { updated.min_margin = String(extracted.min_margin); filled.add('min_margin'); }
        if (extracted.custom_criteria?.montant_financement) { updated.budget = extracted.custom_criteria.montant_financement.replace(/[^\d]/g, ''); filled.add('budget'); }
        if (endDate) { updated.end_date = endDate; filled.add('end_date'); }
        if (progStart) { updated.programme_start = progStart; }
        if (progEnd) { updated.programme_end = progEnd; }
        return updated;
      });

      setPrefilledFields(filled);
      toast({ title: '✅ Critères extraits avec succès', description: `${filled.size} champs pré-remplis depuis ${file.name}. Vérifiez et ajustez avant de sauvegarder.` });
    } catch (err: any) {
      toast({ title: 'Erreur d\'extraction', description: err.message, variant: 'destructive' });
    } finally {
      setExtracting(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleSave = async (publish = false) => {
    if (!form.name.trim()) { toast({ title: 'Le nom est requis', variant: 'destructive' }); return; }
    setSaving(true);
    const body: any = {
      action: 'create',
      name: form.name,
      organization: form.organization || undefined,
      description: form.description || undefined,
      budget: form.budget ? Number(form.budget) : undefined,
      nb_places: form.nb_places ? Number(form.nb_places) : undefined,
      currency: form.currency,
      country_filter: form.country_filter.length ? form.country_filter : undefined,
      sector_filter: form.sector_filter.length ? form.sector_filter : undefined,
      start_date: form.start_date?.toISOString() || undefined,
      end_date: form.end_date?.toISOString() || undefined,
      programme_start: form.programme_start?.toISOString() || undefined,
      programme_end: form.programme_end?.toISOString() || undefined,
      form_fields: formFields.length ? formFields : undefined,
    };

    const { data, error } = await supabase.functions.invoke('manage-programme', { body });
    if (error || !data?.id) {
      toast({ title: 'Erreur', description: error?.message || 'Impossible de créer le programme', variant: 'destructive' });
      setSaving(false);
      return;
    }

    if (publish) {
      await supabase.functions.invoke('manage-programme', { body: { action: 'publish', id: data.id } });
    }

    toast({ title: publish ? '✅ Programme publié' : '✅ Brouillon enregistré' });
    nav(`/programmes/${data.id}`);
    setSaving(false);
  };

  const DatePicker = ({ value, onChange, label }: { value: Date | undefined; onChange: (d: Date | undefined) => void; label: string }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'PPP', { locale: fr }) : 'Sélectionner...'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <DashboardLayout title="Nouveau programme" subtitle="Créer un appel à candidatures">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Upload fiche programme */}
          <Card>
            <CardHeader><CardTitle className="text-base">📄 Importer une fiche programme</CardTitle></CardHeader>
            <CardContent>
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
                  extracting && 'pointer-events-none opacity-60'
                )}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff"
                  onChange={onFileInput}
                />
                {extracting ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">Extraction des critères en cours...</p>
                    <p className="text-xs text-muted-foreground">Analyse IA du document</p>
                  </div>
                ) : uploadedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <p className="text-sm font-medium">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">Critères extraits — modifiez les champs ci-dessous</p>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}>
                      Changer de fichier
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">📄 Glissez votre fiche programme ici</p>
                    <p className="text-xs text-muted-foreground">(PDF, DOCX, XLSX, image — tous formats acceptés) · L'IA extraira automatiquement les critères</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Identité */}
          <Card>
            <CardHeader><CardTitle className="text-base">Identité</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className={cn(prefilledFields.has('name') && 'ring-2 ring-primary/30 rounded-md p-2 bg-primary/5')}>
                <Label>Nom du programme * {prefilledFields.has('name') && <Badge variant="outline" className="ml-2 text-[10px] text-primary">IA</Badge>}</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Programme Pilote GIZ 2026" />
              </div>
              <div><Label>Organisation</Label><Input value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} placeholder="Ex: GIZ, AFD, I&P" /></div>
              <div className={cn(prefilledFields.has('description') && 'ring-2 ring-primary/30 rounded-md p-2 bg-primary/5')}>
                <Label>Description {prefilledFields.has('description') && <Badge variant="outline" className="ml-2 text-[10px] text-primary">IA</Badge>}</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Description du programme..." />
              </div>
            </CardContent>
          </Card>

          {/* Paramètres */}
          <Card>
            <CardHeader><CardTitle className="text-base">Paramètres</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className={cn(prefilledFields.has('budget') && 'ring-2 ring-primary/30 rounded-md p-1 bg-primary/5')}>
                  <Label>Budget {prefilledFields.has('budget') && <Badge variant="outline" className="ml-1 text-[10px] text-primary">IA</Badge>}</Label>
                  <Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
                </div>
                <div><Label>Nb places</Label><Input type="number" value={form.nb_places} onChange={e => setForm(f => ({ ...f, nb_places: e.target.value }))} /></div>
                <div>
                  <Label>Devise</Label>
                  <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="XOF">XOF</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className={cn(prefilledFields.has('country_filter') && 'ring-2 ring-primary/30 rounded-md p-2 bg-primary/5')}>
                <Label className="text-xs">Pays éligibles {prefilledFields.has('country_filter') && <Badge variant="outline" className="ml-1 text-[10px] text-primary">IA</Badge>}</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {COUNTRIES.map(c => (
                    <Badge key={c} variant={form.country_filter.includes(c) ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => toggleTag('country_filter', c)}>{c}</Badge>
                  ))}
                </div>
              </div>
              <div className={cn(prefilledFields.has('sector_filter') && 'ring-2 ring-primary/30 rounded-md p-2 bg-primary/5')}>
                <Label className="text-xs">Secteurs éligibles {prefilledFields.has('sector_filter') && <Badge variant="outline" className="ml-1 text-[10px] text-primary">IA</Badge>}</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {SECTORS.map(s => (
                    <Badge key={s} variant={form.sector_filter.includes(s) ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => toggleTag('sector_filter', s)}>{s}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader><CardTitle className="text-base">Dates</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <DatePicker label="Début candidatures" value={form.start_date} onChange={d => setForm(f => ({ ...f, start_date: d }))} />
                <div className={cn(prefilledFields.has('end_date') && 'ring-2 ring-primary/30 rounded-md p-1 bg-primary/5')}>
                  <DatePicker label={`Fin candidatures ${prefilledFields.has('end_date') ? '(IA)' : ''}`} value={form.end_date} onChange={d => setForm(f => ({ ...f, end_date: d }))} />
                </div>
                <div className={cn(prefilledFields.has('programme_start') && 'ring-2 ring-primary/30 rounded-md p-1 bg-primary/5')}>
                  <DatePicker label={`Début programme ${prefilledFields.has('programme_start') ? '(IA)' : ''}`} value={form.programme_start} onChange={d => setForm(f => ({ ...f, programme_start: d }))} />
                </div>
                <div className={cn(prefilledFields.has('programme_end') && 'ring-2 ring-primary/30 rounded-md p-1 bg-primary/5')}>
                  <DatePicker label={`Fin programme ${prefilledFields.has('programme_end') ? '(IA)' : ''}`} value={form.programme_end} onChange={d => setForm(f => ({ ...f, programme_end: d }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Formulaire candidature */}
          <Card>
            <CardHeader><CardTitle className="text-base">Formulaire de candidature (champs personnalisés)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Les champs fixes (nom entreprise, contact, email, téléphone) sont toujours inclus. Ajoutez ici des champs personnalisés.</p>
              {formFields.map(f => (
                <div key={f.id} className="flex items-center gap-2 p-2 border rounded-md">
                  <span className="text-sm flex-1">{f.label}</span>
                  <Badge variant="outline" className="text-[10px]">{f.type}</Badge>
                  <Badge variant={f.required ? 'default' : 'outline'} className="cursor-pointer text-[10px]" onClick={() => toggleFieldRequired(f.id)}>{f.required ? 'Requis' : 'Optionnel'}</Badge>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeField(f.id)}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input placeholder="Label du champ" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} className="flex-1" />
                <Select value={newFieldType} onValueChange={v => setNewFieldType(v as any)}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texte</SelectItem>
                    <SelectItem value="number">Nombre</SelectItem>
                    <SelectItem value="textarea">Zone de texte</SelectItem>
                    <SelectItem value="select">Liste</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="file">Fichier</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={addField}><Plus className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview sidebar */}
        <div className="space-y-4">
          <Card className="sticky top-20">
            <CardHeader><CardTitle className="text-base">Preview formulaire</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground italic">Champs fixes :</p>
              {['Nom entreprise *', 'Nom contact *', 'Email *', 'Téléphone'].map(f => (
                <div key={f} className="space-y-1">
                  <Label className="text-xs">{f}</Label>
                  <Input disabled className="h-8" />
                </div>
              ))}
              {formFields.length > 0 && <p className="text-xs text-muted-foreground italic pt-2">Champs personnalisés :</p>}
              {formFields.map(f => (
                <div key={f.id} className="space-y-1">
                  <Label className="text-xs">{f.label} {f.required ? '*' : ''}</Label>
                  {f.type === 'textarea' ? <Textarea disabled className="h-16" /> : <Input disabled className="h-8" />}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button onClick={() => handleSave(false)} disabled={saving} variant="outline" className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Enregistrer (brouillon)
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Publier l'appel
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
