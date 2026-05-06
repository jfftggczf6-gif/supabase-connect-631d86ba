// PeCandidatureFormEditorPage — éditeur dédié du formulaire d'appel à candidatures (PE)
// Layout 2 colonnes :
//   GAUCHE : Critères de sélection · Champs personnalisés · Dates candidatures
//   DROITE : Aperçu live du formulaire public (sticky) + CTA Enregistrer / Publier
// Au save : update programmes(form_fields, start_date, end_date) + programme_criteria.custom_criteria
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Plus, X, Upload, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { derivePeAppelStatus, PE_APPEL_STATUS_META } from '@/lib/pe-appel-status';

type FieldType = 'text' | 'textarea' | 'file' | 'number' | 'date' | 'email';

interface CustomField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texte court',
  textarea: 'Texte long',
  file: 'Fichier',
  number: 'Nombre',
  date: 'Date',
  email: 'Email',
};

function makeId() { return Math.random().toString(36).slice(2, 10); }

function slugify(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) + '-' + Math.random().toString(36).slice(2, 8);
}

export default function PeCandidatureFormEditorPage() {
  const { programmeId } = useParams<{ programmeId: string }>();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [programmeName, setProgrammeName] = useState('');
  const [programmeStatus, setProgrammeStatus] = useState<string>('draft');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [criteriaId, setCriteriaId] = useState<string | null>(null);

  // État édition
  const [criteres, setCriteres] = useState<string[]>([]);
  const [newCritere, setNewCritere] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    if (!programmeId) return;
    setLoading(true);
    const { data: prog, error: progErr } = await supabase
      .from('programmes')
      .select('id, name, status, form_fields, start_date, end_date, criteria_id, organization_id, form_slug')
      .eq('id', programmeId)
      .single();

    if (progErr || !prog) {
      toast.error('Programme introuvable');
      nav('/pe?tab=candidature');
      return;
    }

    setProgrammeName(prog.name);
    setProgrammeStatus(prog.status);
    setOrganizationId(prog.organization_id);
    setCriteriaId(prog.criteria_id);
    setStartDate(prog.start_date ?? '');
    setEndDate(prog.end_date ?? '');
    setCustomFields(Array.isArray(prog.form_fields) ? prog.form_fields as any : []);

    // Charge critères de sélection
    if (prog.criteria_id) {
      const { data: crit } = await supabase
        .from('programme_criteria')
        .select('custom_criteria')
        .eq('id', prog.criteria_id)
        .single();
      const cc = (crit?.custom_criteria as any) || {};
      setCriteres(Array.isArray(cc.criteres_selection) ? cc.criteres_selection : []);
    }

    setLoading(false);
  }, [programmeId, nav]);

  useEffect(() => { load(); }, [load]);

  const addCritere = () => {
    const v = newCritere.trim();
    if (!v || criteres.includes(v)) { setNewCritere(''); return; }
    setCriteres([...criteres, v]);
    setNewCritere('');
  };

  const addField = () => {
    const v = newFieldLabel.trim();
    if (!v) return;
    setCustomFields([...customFields, { id: makeId(), label: v, type: newFieldType, required: false }]);
    setNewFieldLabel('');
    setNewFieldType('text');
  };

  const removeField = (id: string) => setCustomFields(customFields.filter(f => f.id !== id));
  const toggleRequired = (id: string) => setCustomFields(customFields.map(f =>
    f.id === id ? { ...f, required: !f.required } : f
  ));

  // Save = persiste form_fields, dates, critères. Le statut est dérivé des dates.
  const persist = async () => {
    if (!programmeId) return false;

    // 1. Critères : upsert dans programme_criteria si criteria_id existe, sinon créer
    let critId = criteriaId;
    if (criteres.length > 0 && !critId) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: pc, error: pcErr } = await supabase
        .from('programme_criteria')
        .insert({
          name: programmeName,
          organization_id: organizationId,
          created_by: user?.id || null,
          is_active: true,
          custom_criteria: { criteres_selection: criteres },
        } as any)
        .select('id')
        .single();
      if (pcErr) { toast.error(`Critères : ${pcErr.message}`); return false; }
      critId = pc.id;
      // Lier au programme
      await supabase.from('programmes').update({ criteria_id: critId }).eq('id', programmeId);
      setCriteriaId(critId);
    } else if (critId) {
      const { data: existing } = await supabase
        .from('programme_criteria').select('custom_criteria').eq('id', critId).single();
      const merged = { ...((existing?.custom_criteria as any) || {}), criteres_selection: criteres };
      const { error: upErr } = await supabase
        .from('programme_criteria').update({ custom_criteria: merged }).eq('id', critId);
      if (upErr) { toast.error(`Critères : ${upErr.message}`); return false; }
    }

    // 2. Programme : form_fields, dates, status calculé selon les dates, form_slug toujours généré
    //    (pour que le diffuseur soit dispo dès qu'il y a des dates).
    const derived = derivePeAppelStatus(startDate || null, endDate || null);
    // Mapping derived → status DB existant (programmes_status est un text libre)
    //   draft     → 'draft'        (pas de dates)
    //   scheduled → 'open'         (programmé : URL publique active mais formulaire pas encore accepté)
    //                              (l'edge fn submit-candidature vérifie la date début elle-même)
    //   open      → 'open'         (en cours)
    //   closed    → 'closed'       (clôturé auto)
    const dbStatus = derived === 'draft' ? 'draft'
                   : derived === 'closed' ? 'closed'
                   : 'open';

    const updateData: any = {
      form_fields: customFields,
      start_date: startDate || null,
      end_date: endDate || null,
      status: dbStatus,
    };

    // Génère form_slug dès qu'il y a des dates (= prêt à diffuser)
    if (startDate && endDate) {
      const { data: cur } = await supabase
        .from('programmes').select('form_slug').eq('id', programmeId).single();
      if (!cur?.form_slug) {
        updateData.form_slug = slugify(programmeName);
      }
    }

    const { error: progErr } = await supabase
      .from('programmes').update(updateData).eq('id', programmeId);
    if (progErr) { toast.error(`Programme : ${progErr.message}`); return false; }
    return true;
  };

  // Un seul CTA "Enregistrer" : save + crée le formulaire.
  // Le diffuseur s'affiche ensuite automatiquement sur la page Candidature dès
  // que des dates sont renseignées. Le statut (Brouillon/Programmé/Ouvert/Clôturé)
  // est calculé à partir des dates et de la date courante.
  const handleSave = async () => {
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (ok) {
      const derived = derivePeAppelStatus(startDate || null, endDate || null);
      const meta = PE_APPEL_STATUS_META[derived];
      toast.success(`Formulaire enregistré — statut : ${meta.label}`);
      nav('/pe?tab=candidature');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Formulaire de candidature">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Badge statut dérivé en temps réel des dates (live preview pendant l'édition)
  const derivedStatus = derivePeAppelStatus(startDate || null, endDate || null);
  const sb = PE_APPEL_STATUS_META[derivedStatus];

  return (
    <DashboardLayout title="Formulaire de candidature" subtitle={programmeName}>
      {/* Header bar : retour à gauche + statut + UN SEUL bouton "Enregistrer" à droite */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => nav('/pe?tab=candidature')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Retour à Candidature
        </Button>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={sb.cls}>{sb.emoji} {sb.label}</Badge>
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-violet-600 hover:bg-violet-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* === COLONNE GAUCHE : édition === */}
        <div className="space-y-4">
          {/* Critères de sélection */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">Critères de sélection</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">Critères de notation et classement utilisés au screening</p>

              {criteres.length > 0 && (
                <ul className="space-y-1.5">
                  {criteres.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-2 py-1.5">
                      <span className="text-violet-600">◆</span>
                      <span className="flex-1">{c}</span>
                      <button onClick={() => setCriteres(criteres.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500" type="button">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <Input
                  value={newCritere}
                  onChange={(e) => setNewCritere(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCritere(); } }}
                  placeholder="Ajouter un critère…"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addCritere} disabled={!newCritere.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Formulaire de candidature (champs personnalisés) */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Formulaire de candidature (champs personnalisés)</h3>

              {/* Drop zone (placeholder visuel pour AI extraction — non implémenté MVP) */}
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
                <Upload className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium">Glisse un modèle de formulaire existant ici</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, image — tous formats</p>
                <p className="text-xs text-muted-foreground italic">L'IA extraira les champs automatiquement <span className="text-amber-600">(à venir)</span></p>
              </div>

              <p className="text-xs text-muted-foreground">
                Les champs fixes (nom entreprise, contact, email, téléphone) sont toujours inclus. Ajoutez ici des champs personnalisés.
              </p>

              {/* Liste champs custom */}
              {customFields.length > 0 && (
                <ul className="space-y-1.5">
                  {customFields.map(f => (
                    <li key={f.id} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-2 py-1.5">
                      <Input value={f.label} onChange={(e) => setCustomFields(customFields.map(x => x.id === f.id ? { ...x, label: e.target.value } : x))} className="h-7 flex-1 bg-transparent border-0 px-1" />
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${f.type === 'file' ? 'bg-violet-50 text-violet-700' : ''} cursor-pointer`}
                        onClick={() => {
                          const next: FieldType = f.type === 'text' ? 'textarea' : f.type === 'textarea' ? 'file' : f.type === 'file' ? 'number' : f.type === 'number' ? 'date' : f.type === 'date' ? 'email' : 'text';
                          setCustomFields(customFields.map(x => x.id === f.id ? { ...x, type: next } : x));
                        }}
                      >
                        {FIELD_TYPE_LABELS[f.type]}
                      </Badge>
                      <button onClick={() => toggleRequired(f.id)} type="button" className={`text-[10px] px-2 py-0.5 rounded ${f.required ? 'bg-red-50 text-red-600' : 'bg-muted text-muted-foreground'}`}>
                        {f.required ? 'Obligatoire' : 'Optionnel'}
                      </button>
                      <button onClick={() => removeField(f.id)} className="text-muted-foreground hover:text-red-500" type="button">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Ajout nouveau champ */}
              <div className="flex gap-2">
                <Input
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }}
                  placeholder="Label du champ"
                  className="flex-1"
                />
                <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as FieldType)}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={addField} disabled={!newFieldLabel.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Dates de candidatures */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Dates de candidatures</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Début candidatures</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fin candidatures</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Quand la date de fin est dépassée, les candidatures sont automatiquement clôturées.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* === COLONNE DROITE : aperçu live === */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-sm">Aperçu du formulaire public</h3>

              {/* Champs fixes */}
              <div>
                <p className="text-xs uppercase tracking-wide text-violet-600 font-semibold mb-2">Champs fixes (obligatoires)</p>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Nom de l'entreprise *</Label>
                    <Input placeholder="Nom de l'entreprise" disabled className="bg-muted/30" />
                  </div>
                  <div>
                    <Label className="text-xs">Nom du contact *</Label>
                    <Input placeholder="Nom du contact" disabled className="bg-muted/30" />
                  </div>
                  <div>
                    <Label className="text-xs">Email *</Label>
                    <Input placeholder="Email" disabled className="bg-muted/30" />
                  </div>
                  <div>
                    <Label className="text-xs">Téléphone</Label>
                    <Input placeholder="Téléphone" disabled className="bg-muted/30" />
                  </div>
                </div>
              </div>

              {/* Champs personnalisés */}
              {customFields.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-violet-600 font-semibold mb-2">Champs personnalisés</p>
                  <div className="space-y-2">
                    {customFields.map(f => (
                      <div key={f.id}>
                        <Label className="text-xs">{f.label} {f.required && '*'}</Label>
                        {f.type === 'textarea' ? (
                          <Input placeholder={f.label} disabled className="bg-muted/30" />
                        ) : f.type === 'file' ? (
                          <div className="flex items-center gap-2 border rounded px-2 py-1.5 bg-muted/30">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Choisir le fichier</span>
                          </div>
                        ) : (
                          <Input type={f.type === 'number' || f.type === 'date' || f.type === 'email' ? f.type : 'text'} placeholder={f.label} disabled className="bg-muted/30" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bouton preview "Soumettre la candidature" (factice — illustre le rendu public) */}
              <Button disabled className="w-full bg-violet-200 text-violet-900 hover:bg-violet-200 cursor-default mt-2">
                Soumettre la candidature
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
