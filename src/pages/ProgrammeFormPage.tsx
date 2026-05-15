// ProgrammeFormPage — Page dédiée pour gérer le formulaire de candidature d'un programme.
// Permet :
//  - Configurer les champs personnalisés (texte, nombre, select, file, etc.)
//  - Drag-drop d'un modèle (PDF/DOCX/XLSX/image) → extraction IA des champs via extract-form-fields
//  - Définir les dates de candidatures (début / fin)
//  - Preview live à droite
//  - Enregistrer (sauvegarde sans publier) ou Publier l'appel (génère le slug)

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, X, Upload, ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FormField {
  id: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'date' | 'file' | 'checkbox' | 'radio';
  label: string;
  required: boolean;
  options?: string[];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
  } finally { clearTimeout(timeoutId); }
}

export default function ProgrammeFormPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extractingForm, setExtractingForm] = useState(false);
  const [programme, setProgramme] = useState<any>(null);

  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FormField['type']>('text');

  // Charge le programme + ses champs existants
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('programmes')
        .select('id, name, organization, status, form_slug, form_fields, start_date, end_date')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) {
        toast({ title: 'Erreur', description: error?.message || 'Programme introuvable', variant: 'destructive' });
        setLoading(false);
        return;
      }
      setProgramme(data);
      const existing: FormField[] = Array.isArray(data.form_fields) && data.form_fields.length > 0
        ? data.form_fields as FormField[]
        : [{ id: 'default-file', type: 'file', label: 'Documents à joindre (business plan, états financiers, etc.)', required: false }];
      setFormFields(existing);
      setStartDate(data.start_date || '');
      setEndDate(data.end_date || '');
      setLoading(false);
    })();
  }, [id]);

  const addField = () => {
    if (!newFieldLabel.trim()) return;
    setFormFields(f => [...f, { id: crypto.randomUUID(), type: newFieldType, label: newFieldLabel.trim(), required: false }]);
    setNewFieldLabel('');
  };

  const removeField = (fid: string) => setFormFields(f => f.filter(ff => ff.id !== fid));
  const toggleFieldRequired = (fid: string) => setFormFields(f => f.map(ff => ff.id === fid ? { ...ff, required: !ff.required } : ff));

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const ACCEPTED = ['pdf', 'docx', 'doc', 'txt', 'md', 'xlsx', 'xls', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'];
    if (!ACCEPTED.includes(ext || '')) {
      toast({ title: 'Format non supporté', description: 'PDF, DOCX, XLSX, image acceptés.', variant: 'destructive' });
      return;
    }
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
      if (!fields.length) throw new Error('Aucun champ extrait du document');
      const newFields: FormField[] = fields.map((f: any, i: number) => ({
        id: `ext-${i}-${Date.now()}`,
        label: f.label || `Champ ${i + 1}`,
        type: (['text','number','select','textarea','date','file','checkbox','radio'].includes(f.type) ? f.type : 'text') as FormField['type'],
        required: !!f.required,
        options: f.options,
      }));
      setFormFields(prev => [...prev, ...newFields]);
      toast({ title: `${newFields.length} champs extraits`, description: file.name });
    } catch (err: any) {
      toast({ title: 'Extraction échouée', description: err.message, variant: 'destructive' });
    } finally {
      setExtractingForm(false);
    }
  }, [toast]);

  // Un seul CTA "Enregistrer" qui fait save + publish automatiquement :
  //   - 1er enregistrement : sauve les champs + dates + génère le form_slug via
  //     l'edge fn manage-programme (le formulaire devient public)
  //   - Enregistrements suivants : met juste à jour les champs/dates
  // Dans tous les cas, redirige vers le volet Candidature.
  const handleSave = async () => {
    if (!id) return;
    setSaving(true);

    // 1) Sauve les champs + dates
    const { error: saveErr } = await supabase
      .from('programmes')
      .update({
        form_fields: JSON.parse(JSON.stringify(formFields)),
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .eq('id', id);

    if (saveErr) {
      setSaving(false);
      toast({ title: 'Erreur', description: saveErr.message, variant: 'destructive' });
      return;
    }

    // 2) Si pas encore de form_slug, le génère via manage-programme (publication)
    const isFirstSave = !programme.form_slug;
    if (isFirstSave) {
      const { error: pubErr } = await supabase.functions.invoke('manage-programme', {
        body: { action: 'publish', id },
      });
      if (pubErr) {
        setSaving(false);
        toast({ title: 'Erreur publication', description: pubErr.message, variant: 'destructive' });
        return;
      }
    }

    setSaving(false);
    toast({
      title: isFirstSave ? '🚀 Formulaire enregistré et publié' : '✓ Formulaire mis à jour',
      description: isFirstSave ? 'Les candidatures sont ouvertes au public.' : undefined,
    });
    nav(`/programmes/${id}?tab=candidature`);
  };

  if (loading) return <DashboardLayout title="Formulaire"><div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  if (!programme) return <DashboardLayout title="Formulaire"><p className="text-muted-foreground">Programme introuvable</p></DashboardLayout>;

  const FIXED_FIELDS = ['Nom de l\'entreprise *', 'Nom du contact *', 'Email *', 'Téléphone'];

  return (
    <DashboardLayout title={`Formulaire — ${programme.name}`} subtitle={programme.organization || ''}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <Button variant="outline" onClick={() => nav(`/programmes/${id}?tab=candidature`)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour au programme
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Édition */}
        <div className="space-y-4">
          {/* Dates de candidatures */}
          <Card>
            <CardHeader><CardTitle className="text-base">Dates de candidatures</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Début</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fin</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Quand la date de fin est dépassée, les candidatures sont automatiquement clôturées.
              </p>
            </CardContent>
          </Card>

          {/* Drag-drop modèle + champs */}
          <Card>
            <CardHeader><CardTitle className="text-base">Champs du formulaire</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onDragOver={e => e.preventDefault()}
                onDrop={async e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) await handleFileUpload(file);
                }}
                onClick={() => document.getElementById('form-template-input')?.click()}
              >
                <input
                  id="form-template-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.jpg,.jpeg,.png,.webp"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = '';
                    await handleFileUpload(file);
                  }}
                />
                {extractingForm ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm font-medium">Extraction des champs en cours…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Glisse un modèle de formulaire existant</p>
                    <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, image</p>
                    <p className="text-xs text-muted-foreground">L'IA en extrait les champs automatiquement</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground italic">
                Champs fixes inclus automatiquement : nom entreprise, nom contact, email, téléphone.
              </p>

              {formFields.map(f => (
                <div key={f.id} className="space-y-1">
                  <div className="flex items-center gap-2 p-2 border rounded-md">
                    <span className="text-sm flex-1">{f.label}</span>
                    <Badge variant="outline" className="text-[10px]">{f.type}</Badge>
                    <Badge
                      variant={f.required ? 'default' : 'outline'}
                      className="cursor-pointer text-[10px]"
                      onClick={() => toggleFieldRequired(f.id)}
                    >
                      {f.required ? 'Obligatoire' : 'Optionnel'}
                    </Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeField(f.id)}>
                      <X className="h-3 w-3" />
                    </Button>
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
                <Input
                  placeholder="Libellé du champ"
                  value={newFieldLabel}
                  onChange={e => setNewFieldLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addField()}
                  className="flex-1"
                />
                <Select value={newFieldType} onValueChange={v => setNewFieldType(v as FormField['type'])}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texte court</SelectItem>
                    <SelectItem value="number">Nombre</SelectItem>
                    <SelectItem value="textarea">Texte long</SelectItem>
                    <SelectItem value="select">Liste déroulante</SelectItem>
                    <SelectItem value="checkbox">Cases à cocher</SelectItem>
                    <SelectItem value="radio">Choix unique</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="file">Fichier</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={addField}><Plus className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div>
          <Card className="sticky top-20 max-h-[calc(100vh-120px)] overflow-y-auto">
            <CardHeader><CardTitle className="text-base">Aperçu du formulaire public</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground italic">Champs fixes (obligatoires) :</p>
              {FIXED_FIELDS.map(f => (
                <div key={f} className="space-y-1">
                  <Label className="text-xs">{f}</Label>
                  <Input disabled placeholder={f.replace(' *', '')} />
                </div>
              ))}
              {formFields.length > 0 && <p className="text-xs text-muted-foreground italic pt-2">Champs personnalisés :</p>}
              {formFields.map(f => (
                <div key={f.id} className="space-y-1">
                  <Label className="text-xs">{f.label}{f.required && ' *'}</Label>
                  {f.type === 'textarea' ? <textarea disabled className="w-full px-3 py-2 border rounded-md text-xs bg-muted/30" rows={3} /> :
                    f.type === 'select' ? (
                      <select disabled className="w-full px-3 py-2 border rounded-md text-xs bg-muted/30">
                        {(f.options || []).map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) :
                    f.type === 'checkbox' || f.type === 'radio' ? (
                      <div className="space-y-1">
                        {(f.options || []).map(o => (
                          <label key={o} className="flex items-center gap-2 text-xs">
                            <input type={f.type} disabled />
                            {o}
                          </label>
                        ))}
                      </div>
                    ) :
                    <Input disabled type={f.type} />}
                </div>
              ))}
              <Button disabled className="w-full mt-4">Soumettre la candidature</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
