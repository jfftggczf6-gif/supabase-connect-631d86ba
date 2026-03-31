import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  type: 'text' | 'number' | 'select' | 'textarea' | 'date' | 'file' | 'checkbox' | 'radio';
  label: string;
  required: boolean;
  options?: string[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** fetch an edge function with a 120s timeout (avoids EarlyDrop on long-running functions) */
async function invokeLong(fnName: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      let msg = `Status ${res.status}`;
      try { const b = await res.json(); msg = b?.error || b?.message || msg; } catch {}
      throw new Error(msg);
    }
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Extraction timeout (>2 min)');
    throw err;
  }
}

export default function ProgrammeCreatePage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [prefilledFields, setPrefilledFields] = useState<Set<string>>(new Set());
  const [extractingForm, setExtractingForm] = useState(false);
  const [formDragOver, setFormDragOver] = useState(false);
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
  const [newCritereType, setNewCritereType] = useState<'eligibilite' | 'selection' | 'condition'>('eligibilite');
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
      toast({ title: t('programme.format_not_supported'), description: t('programme.format_hint'), variant: 'destructive' });
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

      const data = await invokeLong('extract-programme-criteria', { storage_path: storagePath });

      const extracted = data?.extracted;
      if (!extracted) throw new Error(t('programme.no_data_extracted'));

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
      toast({ title: t('programme.criteria_extracted_success'), description: t('programme.fields_prefilled', { count: filled.size, file: file.name }) });
    } catch (err: any) {
      toast({ title: t('programme.extraction_error'), description: err.message, variant: 'destructive' });
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
    if (!form.name.trim()) { toast({ title: t('programme.name_required'), variant: 'destructive' }); return; }
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error(t('programme.not_authenticated'));

      // Build slug from name
      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 60) + '-' + Date.now().toString(36);

      // 1. Create programme_criteria if custom criteria exist
      let criteriaId: string | undefined;
      if (criteresEligibilite.length || criteresSelection.length || conditionsSpecifiques.length) {
        const { data: crit, error: critErr } = await supabase.from('programme_criteria').insert({
          name: form.name,
          description: form.description || null,
          created_by: session.user.id,
          country_filter: form.country_filter,
          sector_filter: form.sector_filter,
          custom_criteria: {
            criteres_eligibilite: criteresEligibilite,
            criteres_selection: criteresSelection,
            conditions_specifiques: conditionsSpecifiques,
          },
        }).select('id').single();
        if (critErr) console.error('Criteria insert error:', critErr);
        criteriaId = crit?.id;
      }

      // 2. Insert programme
      const insertData: any = {
        name: form.name,
        organization: form.organization || null,
        description: form.description || null,
        budget: form.budget ? Number(form.budget) : null,
        nb_places: form.nb_places ? Number(form.nb_places) : null,
        currency: form.currency,
        country_filter: form.country_filter,
        sector_filter: form.sector_filter,
        start_date: form.start_date?.toISOString().split('T')[0] || null,
        end_date: form.end_date?.toISOString().split('T')[0] || null,
        programme_start: form.programme_start?.toISOString().split('T')[0] || null,
        programme_end: form.programme_end?.toISOString().split('T')[0] || null,
        form_fields: formFields.length ? JSON.parse(JSON.stringify(formFields)) : [],
        form_slug: slug,
        criteria_id: criteriaId || null,
        created_by: session.user.id,
        chef_programme_id: session.user.id,
        status: publish ? 'open' as const : 'draft' as const,
      };
      const { data: prog, error: progErr } = await supabase.from('programmes').insert(insertData).select('id').single();

      if (progErr || !prog?.id) {
        throw new Error(progErr?.message || t('programme.create_error'));
      }

      toast({ title: publish ? t('programme.programme_published') : t('programme.draft_saved') });
      nav(`/programmes/${prog.id}`);
    } catch (err: any) {
      console.error('Programme creation error:', err);
      toast({ title: t('common.error'), description: err.message || t('programme.create_error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const DatePicker = ({ value, onChange, label }: { value: Date | undefined; onChange: (d: Date | undefined) => void; label: string }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'PPP', { locale: fr }) : t('programme.select_date')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <DashboardLayout title={t('programme.create')} subtitle={t('programme.create_subtitle')}>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Upload fiche programme */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t('programme.import_file')}</CardTitle></CardHeader>
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
                    <p className="text-sm font-medium">{t('programme.extracting_criteria')}</p>
                    <p className="text-xs text-muted-foreground">{t('programme.ai_analysis')}</p>
                  </div>
                ) : uploadedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <p className="text-sm font-medium">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{t('programme.criteria_extracted_hint')}</p>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}>
                      {t('programme.change_file')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">{t('programme.drop_file')}</p>
                    <p className="text-xs text-muted-foreground">{t('programme.drop_file_formats')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Identité */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t('programme.identity')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className={cn(prefilledFields.has('name') && 'ring-2 ring-primary/30 rounded-md p-2 bg-primary/5')}>
                <Label>{t('programme.name_label')} {prefilledFields.has('name') && <Badge variant="outline" className="ml-2 text-[10px] text-primary">IA</Badge>}</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('programme.name_placeholder')} />
              </div>
              <div><Label>{t('programme.org_label')}</Label><Input value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} placeholder={t('programme.org_placeholder')} /></div>
              <div className={cn(prefilledFields.has('description') && 'ring-2 ring-primary/30 rounded-md p-2 bg-primary/5')}>
                <Label>{t('programme.desc_label')} {prefilledFields.has('description') && <Badge variant="outline" className="ml-2 text-[10px] text-primary">IA</Badge>}</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder={t('programme.desc_placeholder')} />
              </div>
            </CardContent>
          </Card>

          {/* Paramètres */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t('programme.parameters')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className={cn(prefilledFields.has('budget') && 'ring-2 ring-primary/30 rounded-md p-1 bg-primary/5')}>
                  <Label>{t('programme.budget_label')} {prefilledFields.has('budget') && <Badge variant="outline" className="ml-1 text-[10px] text-primary">IA</Badge>}</Label>
                  <Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
                </div>
                <div><Label>{t('programme.nb_places')}</Label><Input type="number" value={form.nb_places} onChange={e => setForm(f => ({ ...f, nb_places: e.target.value }))} /></div>
                <div>
                  <Label>{t('programme.currency_label')}</Label>
                  <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XOF">XOF (FCFA UEMOA)</SelectItem>
                      <SelectItem value="XAF">XAF (FCFA CEMAC)</SelectItem>
                      <SelectItem value="CDF">CDF (Franc congolais)</SelectItem>
                      <SelectItem value="GNF">GNF (Franc guinéen)</SelectItem>
                      <SelectItem value="MGA">MGA (Ariary malgache)</SelectItem>
                      <SelectItem value="RWF">RWF (Franc rwandais)</SelectItem>
                      <SelectItem value="KES">KES (Shilling kenyan)</SelectItem>
                      <SelectItem value="NGN">NGN (Naira nigérian)</SelectItem>
                      <SelectItem value="GHS">GHS (Cedi ghanéen)</SelectItem>
                      <SelectItem value="TZS">TZS (Shilling tanzanien)</SelectItem>
                      <SelectItem value="ZAR">ZAR (Rand sud-africain)</SelectItem>
                      <SelectItem value="MAD">MAD (Dirham marocain)</SelectItem>
                      <SelectItem value="TND">TND (Dinar tunisien)</SelectItem>
                      <SelectItem value="ETB">ETB (Birr éthiopien)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                      <SelectItem value="USD">USD (Dollar US)</SelectItem>
                      <SelectItem value="GBP">GBP (Livre sterling)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className={cn(prefilledFields.has('country_filter') && 'ring-2 ring-primary/30 rounded-md p-2 bg-primary/5')}>
                <Label className="text-xs">{t('programme.eligible_countries')} {prefilledFields.has('country_filter') && <Badge variant="outline" className="ml-1 text-[10px] text-primary">IA</Badge>}</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {COUNTRIES.map(c => (
                    <Badge key={c} variant={form.country_filter.includes(c) ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => toggleTag('country_filter', c)}>{c}</Badge>
                  ))}
                </div>
              </div>
              <div className={cn(prefilledFields.has('sector_filter') && 'ring-2 ring-primary/30 rounded-md p-2 bg-primary/5')}>
                <Label className="text-xs">{t('programme.eligible_sectors')} {prefilledFields.has('sector_filter') && <Badge variant="outline" className="ml-1 text-[10px] text-primary">IA</Badge>}</Label>
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
            <CardHeader><CardTitle className="text-base">{t('programme.dates_title')}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <DatePicker label={t('programme.start_candidatures')} value={form.start_date} onChange={d => setForm(f => ({ ...f, start_date: d }))} />
                <div className={cn(prefilledFields.has('end_date') && 'ring-2 ring-primary/30 rounded-md p-1 bg-primary/5')}>
                  <DatePicker label={`${t('programme.end_candidatures')} ${prefilledFields.has('end_date') ? '(IA)' : ''}`} value={form.end_date} onChange={d => setForm(f => ({ ...f, end_date: d }))} />
                </div>
                <div className={cn(prefilledFields.has('programme_start') && 'ring-2 ring-primary/30 rounded-md p-1 bg-primary/5')}>
                  <DatePicker label={`${t('programme.start_programme_date')} ${prefilledFields.has('programme_start') ? '(IA)' : ''}`} value={form.programme_start} onChange={d => setForm(f => ({ ...f, programme_start: d }))} />
                </div>
                <div className={cn(prefilledFields.has('programme_end') && 'ring-2 ring-primary/30 rounded-md p-1 bg-primary/5')}>
                  <DatePicker label={`${t('programme.end_programme')} ${prefilledFields.has('programme_end') ? '(IA)' : ''}`} value={form.programme_end} onChange={d => setForm(f => ({ ...f, programme_end: d }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Critères du programme */}
          <Card className={cn((criteresEligibilite.length || criteresSelection.length || conditionsSpecifiques.length) && 'ring-2 ring-primary/30')}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4" /> {t('programme.criteria_title')}
                {prefilledFields.has('criteres_eligibilite') && <Badge variant="outline" className="text-[10px] text-primary">IA</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Éligibilité */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> {t('programme.eligibility_criteria')}
                </Label>
                <p className="text-xs text-muted-foreground">{t('programme.eligibility_desc')}</p>
                {criteresEligibilite.map((c, i) => (
                  <div key={`elig-${i}`} className="flex items-start gap-2 p-2 border rounded-md bg-green-50/50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span className="text-sm flex-1">{c}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setCriteresEligibilite(cr => cr.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>

              {/* Sélection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> {t('programme.selection_criteria_label')}
                </Label>
                <p className="text-xs text-muted-foreground">{t('programme.selection_desc')}</p>
                {criteresSelection.map((c, i) => (
                  <div key={`sel-${i}`} className="flex items-start gap-2 p-2 border rounded-md bg-amber-50/50 dark:bg-amber-950/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <span className="text-sm flex-1">{c}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setCriteresSelection(cr => cr.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>

              {/* Conditions spécifiques */}
              {conditionsSpecifiques.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">{t('programme.specific_conditions')}</Label>
                  {conditionsSpecifiques.map((c, i) => (
                    <div key={`cond-${i}`} className="flex items-start gap-2 p-2 border rounded-md">
                      <span className="text-sm flex-1">{c}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setConditionsSpecifiques(cr => cr.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Ajouter un critère */}
              <div className="flex gap-2">
                <Input placeholder={t('programme.add_criterion')} value={newCritere} onChange={e => setNewCritere(e.target.value)} className="flex-1" />
                <Select value={newCritereType} onValueChange={v => setNewCritereType(v as typeof newCritereType)}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eligibilite">{t('programme.eligibility_option')}</SelectItem>
                    <SelectItem value="selection">{t('programme.selection_option')}</SelectItem>
                    <SelectItem value="condition">{t('programme.condition_option')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => {
                  if (!newCritere.trim()) return;
                  if (newCritereType === 'eligibilite') setCriteresEligibilite(cr => [...cr, newCritere.trim()]);
                  else if (newCritereType === 'selection') setCriteresSelection(cr => [...cr, newCritere.trim()]);
                  else setConditionsSpecifiques(cr => [...cr, newCritere.trim()]);
                  setNewCritere('');
                }}><Plus className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>

          {/* Formulaire candidature */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t('programme.custom_form_title')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone for form template */}
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer',
                  formDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
                  extractingForm && 'pointer-events-none opacity-60'
                )}
                onDragOver={e => { e.preventDefault(); setFormDragOver(true); }}
                onDragLeave={() => setFormDragOver(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setFormDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  setExtractingForm(true);
                  try {
                    const reader = new FileReader();
                    const base64: string = await new Promise((res, rej) => {
                      reader.onload = () => res((reader.result as string).split(',')[1]);
                      reader.onerror = rej;
                      reader.readAsDataURL(file);
                    });
                    const data = await invokeLong('extract-form-fields', { file_base64: base64, file_name: file.name });
                    const fields = data?.form_fields || [];
                    if (!fields.length) throw new Error(t('programme.no_fields_extracted'));
                    const newFields: FormField[] = fields.map((f: any, i: number) => ({
                      id: `ext-${i}-${Date.now()}`,
                      label: f.label || `Champ ${i + 1}`,
                      type: (['text','number','select','textarea','date','file','checkbox','radio'].includes(f.type) ? f.type : 'text') as FormField['type'],
                      required: !!f.required,
                      options: f.options,
                    }));
                    setFormFields(prev => [...prev, ...newFields]);
                    toast({ title: t('programme.fields_extracted', { count: newFields.length, file: file.name }) });
                  } catch (err: any) {
                    console.error('[extract-form-fields] Error:', err);
                    toast({ title: t('programme.extraction_error'), description: err.message, variant: 'destructive' });
                  } finally {
                    setExtractingForm(false);
                  }
                }}
                onClick={() => document.getElementById('form-template-input')?.click()}
              >
                <input id="form-template-input" type="file" className="hidden" accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.jpg,.jpeg,.png,.webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = '';
                    // Trigger same logic via synthetic drop
                    setExtractingForm(true);
                    try {
                      const reader = new FileReader();
                      const base64: string = await new Promise((res, rej) => {
                        reader.onload = () => res((reader.result as string).split(',')[1]);
                        reader.onerror = rej;
                        reader.readAsDataURL(file);
                      });
                      const data = await invokeLong('extract-form-fields', { file_base64: base64, file_name: file.name });
                      const fields = data?.form_fields || [];
                      if (!fields.length) throw new Error(t('programme.no_fields_extracted'));
                      const newFields: FormField[] = fields.map((f: any, i: number) => ({
                        id: `ext-${i}-${Date.now()}`,
                        label: f.label || `Champ ${i + 1}`,
                        type: (['text','number','select','textarea','date','file','checkbox','radio'].includes(f.type) ? f.type : 'text') as FormField['type'],
                        required: !!f.required,
                        options: f.options,
                      }));
                      setFormFields(prev => [...prev, ...newFields]);
                      toast({ title: t('programme.fields_extracted', { count: newFields.length, file: file.name }) });
                    } catch (err: any) {
                      console.error('[extract-form-fields] Error:', err);
                      toast({ title: t('programme.extraction_error'), description: err.message, variant: 'destructive' });
                    } finally {
                      setExtractingForm(false);
                    }
                  }}
                />
                {extractingForm ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm font-medium">{t('programme.extracting_fields')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t('programme.drop_form_template')}</p>
                    <p className="text-xs text-muted-foreground">{t('programme.drop_form_formats')}</p>
                    <p className="text-xs text-muted-foreground">{t('programme.ai_extract_fields')}</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">{t('programme.fixed_fields_hint')}</p>
              {formFields.map(f => (
                <div key={f.id} className="space-y-1">
                  <div className="flex items-center gap-2 p-2 border rounded-md">
                    <span className="text-sm flex-1">{f.label}</span>
                    <Badge variant="outline" className="text-[10px]">{f.type}</Badge>
                    <Badge variant={f.required ? 'default' : 'outline'} className="cursor-pointer text-[10px]" onClick={() => toggleFieldRequired(f.id)}>{f.required ? t('programme.required_field') : t('programme.optional_field')}</Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeField(f.id)}><X className="h-3 w-3" /></Button>
                  </div>
                  {['select', 'checkbox', 'radio'].includes(f.type) && (
                    <div className="ml-4">
                      <Input
                        placeholder="Options (séparées par des virgules)"
                        value={(f.options || []).join(', ')}
                        onChange={e => {
                          const opts = e.target.value.split(',').map(o => o.trim()).filter(Boolean);
                          setFormFields(fields => fields.map(ff => ff.id === f.id ? { ...ff, options: opts } : ff));
                        }}
                        className="h-7 text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Input placeholder={t('programme.field_label_placeholder')} value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} className="flex-1" />
                <Select value={newFieldType} onValueChange={v => setNewFieldType(v as any)}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t('programme.field_text')}</SelectItem>
                    <SelectItem value="number">{t('programme.field_number')}</SelectItem>
                    <SelectItem value="textarea">{t('programme.field_textarea')}</SelectItem>
                    <SelectItem value="select">{t('programme.field_list')}</SelectItem>
                    <SelectItem value="checkbox">Cases à cocher (multi-réponse)</SelectItem>
                    <SelectItem value="radio">Choix unique</SelectItem>
                    <SelectItem value="date">{t('programme.field_date')}</SelectItem>
                    <SelectItem value="file">{t('programme.field_file')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={addField}><Plus className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview sidebar */}
        <div className="space-y-4">
          <Card className="sticky top-20 max-h-[calc(100vh-120px)] overflow-y-auto">
            <CardHeader><CardTitle className="text-base">{t('programme.form_preview')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground italic">{t('programme.fixed_fields')}</p>
              {[t('programme.fixed_company'), t('programme.fixed_contact'), t('programme.fixed_email'), t('programme.fixed_phone')].map(f => (
                <div key={f} className="space-y-1">
                  <Label className="text-xs">{f}</Label>
                  <Input disabled className="h-8" />
                </div>
              ))}
              {formFields.length > 0 && <p className="text-xs text-muted-foreground italic pt-2">{t('programme.custom_fields')}</p>}
              {formFields.map(f => (
                <div key={f.id} className="space-y-1">
                  <Label className="text-xs">{f.label} {f.required ? '*' : ''}</Label>
                  {f.type === 'textarea' ? <Textarea disabled className="h-16" /> : <Input disabled className="h-8" />}
                </div>
              ))}

              <div className="flex flex-col gap-2 pt-4 border-t mt-4">
                <Button onClick={() => handleSave(false)} disabled={saving} variant="outline" className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} {t('programme.save_draft')}
                </Button>
                <Button onClick={() => handleSave(true)} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} {t('programme.publish_call')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
