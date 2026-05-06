import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function PublicCandidatureForm() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const [programme, setProgramme] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fileUploads, setFileUploads] = useState<Record<string, File>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-programme-form`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ slug })
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Programme introuvable'); return; }
        if (data.closed) { setError(data.reason || 'Cet appel à candidatures est clôturé.'); return; }
        if (!data.success || !data.programme) { setError('Programme introuvable'); return; }
        setProgramme(data.programme);
      } catch { setError('Erreur de connexion'); }
      finally { setLoading(false); }
    })();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !contactName || !contactEmail) return;
    setSubmitting(true);
    try {
      // 1. Submit candidature first to get the ID
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-candidature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({
          programme_slug: slug,
          company_name: companyName,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          form_data: formData,
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur lors de la soumission'); setSubmitting(false); return; }

      const candidatureId = data.candidature_id;

      // 2. Upload files to Supabase Storage. On capture chaque erreur — si UN
      // SEUL upload échoue, on bloque la soumission (sinon les fichiers manquants
      // sont silencieusement perdus comme cas FoodSen).
      if (Object.keys(fileUploads).length > 0) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const docsMeta: any[] = [];
        const failedUploads: string[] = [];

        for (const [fieldLabel, filesOrFile] of Object.entries(fileUploads)) {
          const fileList = Array.isArray(filesOrFile) ? filesOrFile : [filesOrFile];
          for (const file of fileList) {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${candidatureId}/${Date.now()}_${safeName}`;
            const { error: uploadErr } = await supabaseClient.storage
              .from('candidature-documents')
              .upload(storagePath, file, { upsert: true });
            if (uploadErr) {
              console.error(`[PublicCandidatureForm] upload failed for ${file.name}:`, uploadErr.message);
              failedUploads.push(file.name);
              continue;
            }
            docsMeta.push({
              field_label: fieldLabel,
              file_name: file.name,
              file_size: file.size,
              storage_path: `candidature-documents/${storagePath}`,
            });
          }
        }

        // Si au moins un upload a échoué, on stoppe la soumission avec un message clair.
        if (failedUploads.length > 0) {
          setError(
            `Impossible de téléverser ${failedUploads.length} fichier(s) : ${failedUploads.slice(0, 3).join(', ')}` +
            `${failedUploads.length > 3 ? '…' : ''}. ` +
            `Ta candidature N'A PAS été enregistrée. Vérifie ta connexion et réessaie, ou contacte le support.`
          );
          setSubmitting(false);
          return;
        }

        // 3. Update candidature with document metadata — bloquant aussi (si ça
        // rate, les docs ne seront pas attachés à la candidature en DB).
        if (docsMeta.length > 0) {
          const updateRes = await fetch(`${SUPABASE_URL}/functions/v1/submit-candidature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
            body: JSON.stringify({
              action: 'update_documents',
              candidature_id: candidatureId,
              documents: docsMeta,
            }),
          });
          if (!updateRes.ok) {
            const result = await updateRes.json().catch(() => ({}));
            setError(`Erreur lors de l'enregistrement des documents : ${result.error || 'erreur inconnue'}. Réessaie.`);
            setSubmitting(false);
            return;
          }
        }
      }

      setSubmitted(true);
    } catch (e: any) {
      console.error('[PublicCandidatureForm] submit error:', e);
      setError(e?.message ? `Erreur : ${e.message}` : 'Erreur de connexion');
    }
    finally { setSubmitting(false); }
  };

  const setField = (key: string, val: any) => setFormData(f => ({ ...f, [key]: val }));

  const handleFileSelect = (fieldLabel: string, file: File | null) => {
    if (file) {
      setFileUploads(prev => ({ ...prev, [fieldLabel]: file }));
    } else {
      setFileUploads(prev => { const n = { ...prev }; delete n[fieldLabel]; return n; });
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md w-full mx-4"><CardContent className="p-8 text-center">
        <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <p className="text-lg font-medium">❌ {error}</p>
      </CardContent></Card>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md w-full mx-4"><CardContent className="p-8 text-center">
        <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
        <p className="text-lg font-medium">✅ Votre candidature a bien été enregistrée</p>
        <p className="text-sm text-muted-foreground mt-2">Vous recevrez une confirmation par email.</p>
      </CardContent></Card>
    </div>
  );

  const formFields = programme?.form_fields || [];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {programme.logo_url && <img src={programme.logo_url} alt="" className="h-16 mx-auto mb-4" />}
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center mx-auto mb-3">
            <span className="text-sm font-bold text-primary-foreground">ES</span>
          </div>
          <h1 className="text-2xl font-display font-bold">🏢 {programme.name}</h1>
          {programme.organization && <p className="text-muted-foreground mt-1">Organisation : {programme.organization}</p>}
          {programme.description && <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">{programme.description}</p>}
          {programme.end_date && (
            <p className="text-sm mt-3 font-medium">📅 Date limite : {format(new Date(programme.end_date), 'd MMMM yyyy', { locale: fr })}</p>
          )}
        </div>

        {/* Form */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Fixed fields */}
              <div><Label>Nom de l'entreprise *</Label><Input required value={companyName} onChange={e => setCompanyName(e.target.value)} /></div>
              <div><Label>Nom du contact *</Label><Input required value={contactName} onChange={e => setContactName(e.target.value)} /></div>
              <div><Label>Email *</Label><Input type="email" required value={contactEmail} onChange={e => setContactEmail(e.target.value)} /></div>
              <div><Label>Téléphone</Label><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></div>
              <div>
                <Label>Pays</Label>
                <Select value={formData.pays || ''} onValueChange={v => setField('pays', v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un pays..." /></SelectTrigger>
                  <SelectContent>
                    {[...['Bénin', 'Burkina Faso', 'Cameroun', 'Comores', 'Congo', "Côte d'Ivoire", 'Djibouti', 'Gabon', 'Guinée', 'Kenya', 'Madagascar', 'Mali', 'Mauritanie', 'Niger', 'RDC', 'Rwanda', 'Sénégal', 'Tchad', 'Togo'].sort((a, b) => a.localeCompare(b, 'fr')), 'Autre'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic fields */}
              {formFields.length > 0 && <hr className="my-4" />}
              {formFields.map((field: any) => (
                <div key={field.id || field.label}>
                  <Label>{field.label} {field.required ? '*' : ''}</Label>
                  {field.type === 'file' ? (
                    <div className="mt-1">
                      <input
                        ref={el => { fileInputRefs.current[field.label] = el; }}
                        type="file"
                        multiple
                        accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png,.pptx,.ppt,.csv,.txt"
                        className="hidden"
                        onChange={e => {
                          const files = e.target.files;
                          if (files) {
                            const existing = Array.isArray(fileUploads[field.label]) ? fileUploads[field.label] : fileUploads[field.label] ? [fileUploads[field.label]] : [];
                            setFileUploads(prev => ({ ...prev, [field.label]: [...existing, ...Array.from(files)] as any }));
                          }
                        }}
                      />
                      {fileUploads[field.label] ? (
                        <div className="space-y-1">
                          {(Array.isArray(fileUploads[field.label]) ? fileUploads[field.label] : [fileUploads[field.label]]).map((f: File, fi: number) => (
                            <div key={fi} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              <span className="text-sm truncate flex-1">{f.name}</span>
                              <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                              <button type="button" onClick={() => {
                                const arr = Array.isArray(fileUploads[field.label]) ? [...fileUploads[field.label]] : [fileUploads[field.label]];
                                arr.splice(fi, 1);
                                if (arr.length === 0) {
                                  setFileUploads(prev => { const n = { ...prev }; delete n[field.label]; return n; });
                                } else {
                                  setFileUploads(prev => ({ ...prev, [field.label]: arr as any }));
                                }
                              }} className="text-muted-foreground hover:text-destructive">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => fileInputRefs.current[field.label]?.click()} className="text-xs text-primary hover:underline mt-1">
                            + Ajouter un fichier
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRefs.current[field.label]?.click()}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
                          onDragLeave={e => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
                          onDrop={e => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                            if (e.dataTransfer.files.length > 0) {
                              setFileUploads(prev => ({ ...prev, [field.label]: Array.from(e.dataTransfer.files) as any }));
                            }
                          }}
                          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-all"
                        >
                          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Cliquez ou glissez vos fichiers</p>
                          <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, PowerPoint, Images — plusieurs fichiers acceptés</p>
                        </div>
                      )}
                    </div>
                  ) : field.type === 'textarea' ? (
                    <Textarea required={field.required} value={formData[field.label] || ''} onChange={e => setField(field.label, e.target.value)} rows={3} />
                  ) : field.type === 'select' && field.options?.length ? (
                    <Select value={formData[field.label] || ''} onValueChange={v => setField(field.label, v)}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>{field.options.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : field.type === 'checkbox' && field.options?.length ? (
                    <div className="space-y-2 mt-1">
                      {field.options.map((o: string) => (
                        <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(formData[field.label] || []).includes(o)}
                            onChange={e => {
                              const current: string[] = formData[field.label] || [];
                              setField(field.label, e.target.checked ? [...current, o] : current.filter((v: string) => v !== o));
                            }}
                            className="rounded border-gray-300"
                          />
                          {o}
                        </label>
                      ))}
                    </div>
                  ) : field.type === 'radio' && field.options?.length ? (
                    <div className="space-y-2 mt-1">
                      {field.options.map((o: string) => (
                        <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name={field.label}
                            value={o}
                            checked={formData[field.label] === o}
                            onChange={() => setField(field.label, o)}
                            className="border-gray-300"
                          />
                          {o}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} required={field.required} value={formData[field.label] || ''} onChange={e => setField(field.label, e.target.value)} />
                  )}
                </div>
              ))}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Soumettre ma candidature
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">ESONO © 2026 · Confidentialité</p>
      </div>
    </div>
  );
}
