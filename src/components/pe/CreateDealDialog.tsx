// CreateDealDialog — Formulaire de création d'un nouveau deal PE.
//
// Plan formulaire (7 champs) :
//   1. Entreprise (input texte)
//   2. Nom et prénom du dirigeant (input texte)
//   3. Secteur (dropdown fixe)
//   4. Pays (dropdown fixe — UEMOA/CEMAC + autres)
//   5. Ticket demandé (input numérique)
//   6. Analyste (dropdown — lead_analyst_id)
//   7. Responsable (dropdown — lead_im_id, IM/MD/owner)
//
// La devise est calculée auto depuis le pays via trigger
// pe_deals_set_currency_from_enterprise — pas de choix manuel.

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { Loader2, Upload, X, FileText } from 'lucide-react';

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentUserId: string;
  onCreated: () => void;
}

interface MemberOpt {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

const SECTORS = [
  'Pharma',
  'Agroalimentaire',
  'Agro / Aquaculture',
  'Logistique',
  'Distribution',
  'Industrie',
  'Énergie',
  'Eau & assainissement',
  'Fintech',
  'Tech / Logiciels',
  'Télécoms',
  'Éducation',
  'Santé',
  'Immobilier',
  'BTP',
  'Mode & Textile',
  'Tourisme & Hôtellerie',
  'Médias',
  'Services',
  'Autre',
];

const COUNTRIES = [
  // UEMOA
  "Côte d'Ivoire", 'Sénégal', 'Burkina Faso', 'Mali', 'Bénin', 'Togo', 'Niger', 'Guinée-Bissau',
  // CEMAC
  'Cameroun', 'Gabon', 'Tchad', 'République du Congo', 'République Centrafricaine', 'Guinée Équatoriale',
  // Autres marchés clés
  'RDC', 'Maroc', 'Tunisie', 'Algérie', 'Mauritanie', 'Guinée', 'Madagascar',
  // Anglophone
  'Ghana', 'Nigeria', 'Kenya', 'Rwanda', 'Tanzanie', 'Ouganda', 'Afrique du Sud',
];

const ANALYST_ROLES = ['analyst', 'analyste'];
const IM_ROLES = ['investment_manager', 'managing_director', 'owner', 'admin'];

export default function CreateDealDialog({ open, onOpenChange, organizationId, currentUserId, onCreated }: Props) {
  const { currentRole, isSuperAdmin } = useOrganization();
  // L'analyste qui crée un deal devient automatiquement le lead_analyst.
  // Le lead_im (Responsable) sera assigné plus tard par le MD/IM — pas par
  // l'analyste lui-même. On cache donc les 2 dropdowns dans ce cas.
  const isAnalystCreator = !isSuperAdmin && ['analyst', 'analyste'].includes(currentRole || '');

  // Form state
  const [enterpriseName, setEnterpriseName] = useState('');
  const [dirigeantName, setDirigeantName] = useState('');
  const [sector, setSector] = useState<string>('');
  const [country, setCountry] = useState<string>('');
  const [ticket, setTicket] = useState('');
  const [analystId, setAnalystId] = useState<string>(currentUserId);
  const [imId, setImId] = useState<string>('');

  // Members
  const [analysts, setAnalysts] = useState<MemberOpt[]>([]);
  const [ims, setIms] = useState<MemberOpt[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Drag & drop documents (optionnel — uploadés après création du deal)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: File[] = [];
    for (const f of arr) {
      if (f.size > MAX_SIZE_BYTES) {
        toast.error(`${f.name} dépasse 50 Mo`);
        continue;
      }
      valid.push(f);
    }
    setPendingFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (idx: number) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

  const uploadDocsToDeal = async (dealId: string) => {
    if (pendingFiles.length === 0) return;
    let uploaded = 0;
    for (const file of pendingFiles) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${organizationId}/${dealId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from('pe_deal_docs').upload(path, file);
      if (upErr) {
        toast.error(`Upload ${file.name} échoué : ${upErr.message}`);
        continue;
      }
      const { error: dbErr } = await supabase.from('pe_deal_documents').insert({
        deal_id: dealId,
        organization_id: organizationId,
        filename: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: currentUserId,
      });
      if (dbErr) {
        toast.error(`Enregistrement ${file.name} échoué : ${dbErr.message}`);
        continue;
      }
      uploaded++;
    }
    if (uploaded) toast.success(`${uploaded} document${uploaded > 1 ? 's' : ''} attaché${uploaded > 1 ? 's' : ''}`);
  };

  useEffect(() => {
    if (!open) return;
    setAnalystId(currentUserId);
    setImId('');
    setPendingFiles([]);
    (async () => {
      const allRoles = [...new Set([...ANALYST_ROLES, ...IM_ROLES])];
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('role', allRoles);
      const ids = (members || []).map((m: any) => m.user_id);
      if (!ids.length) { setAnalysts([]); setIms([]); return; }
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      const enriched: MemberOpt[] = (members || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: profMap.get(m.user_id)?.full_name || null,
        email: profMap.get(m.user_id)?.email || null,
      }));
      setAnalysts(enriched.filter(m => ANALYST_ROLES.includes(m.role)));
      setIms(enriched.filter(m => IM_ROLES.includes(m.role)));
    })();
  }, [open, organizationId, currentUserId]);

  const labelOf = (m: MemberOpt) => m.full_name || m.email || m.user_id.slice(0, 8);

  const reset = () => {
    setEnterpriseName('');
    setDirigeantName('');
    setSector('');
    setCountry('');
    setTicket('');
    setAnalystId(currentUserId);
    setImId('');
    setPendingFiles([]);
  };

  const handleCreate = async () => {
    if (!enterpriseName.trim()) {
      toast.error("Le nom de l'entreprise est requis");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('create-pe-deal', {
      body: {
        organization_id: organizationId,
        enterprise_name: enterpriseName.trim(),
        enterprise_country: country || null,
        enterprise_sector: sector || null,
        dirigeant_name: dirigeantName.trim() || null,
        ticket_demande: ticket ? Number(ticket) * 1_000_000 : null,
        lead_analyst_id: analystId,
        lead_im_id: imId || null,
      },
    });
    if (error || (data as any)?.error) {
      setSubmitting(false);
      toast.error((data as any)?.error || error?.message || 'Erreur création deal');
      return;
    }
    const dealId = (data as any).deal.id;
    toast.success(`Deal ${(data as any).deal.deal_ref} créé`);

    // Upload des fichiers optionnels vers le nouveau deal
    if (pendingFiles.length > 0) {
      await uploadDocsToDeal(dealId);
    }

    setSubmitting(false);
    reset();
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouveau deal</DialogTitle>
          <DialogDescription>
            La devise du deal est définie automatiquement selon le pays de l'entreprise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 1. Entreprise */}
          <div className="space-y-1.5">
            <Label htmlFor="ent-name">Entreprise <span className="text-destructive">*</span></Label>
            <Input
              id="ent-name"
              value={enterpriseName}
              onChange={(e) => setEnterpriseName(e.target.value)}
              placeholder="Ex : PharmaCi Industries SA"
              autoFocus
            />
          </div>

          {/* 2. Dirigeant */}
          <div className="space-y-1.5">
            <Label htmlFor="dirigeant">Nom et prénom du dirigeant</Label>
            <Input
              id="dirigeant"
              value={dirigeantName}
              onChange={(e) => setDirigeantName(e.target.value)}
              placeholder="Ex : Amidou Kouassi"
            />
          </div>

          {/* 3. Secteur + 4. Pays */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Secteur</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pays</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 5. Ticket demandé */}
          <div className="space-y-1.5">
            <Label htmlFor="ticket">Ticket demandé (en M)</Label>
            <Input
              id="ticket"
              type="number"
              inputMode="decimal"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="Ex : 4.2"
            />
            <p className="text-[11px] text-muted-foreground">
              Devise déterminée automatiquement selon le pays sélectionné.
            </p>
          </div>

          {/* 6. Analyste + 7. Responsable — cachés pour l'analyste (auto-assigné à lui-même,
              le Responsable sera défini plus tard par le MD/IM) */}
          {!isAnalystCreator && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Analyste</Label>
                <Select value={analystId} onValueChange={setAnalystId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {analysts.length === 0 && (
                      <SelectItem value="__none" disabled>Aucun analyste disponible</SelectItem>
                    )}
                    {analysts.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{labelOf(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Responsable</Label>
                <Select value={imId} onValueChange={setImId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {ims.length === 0 && (
                      <SelectItem value="__none" disabled>Aucun responsable disponible</SelectItem>
                    )}
                    {ims.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{labelOf(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Drag & drop optionnel — documents associés au deal (uploadés après création) */}
          <div className="space-y-1.5 pt-2">
            <Label>
              Documents <span className="text-muted-foreground font-normal">(optionnel)</span>
            </Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors ${
                dragOver ? 'border-violet-500 bg-violet-50/40' : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
              <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm font-medium">Déposez les pièces du deal</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pitch deck, liasses, business plan, etc. — 50 Mo max par fichier
              </p>
            </div>
            {pendingFiles.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-muted/40 rounded text-xs">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {(f.size / 1024 / 1024).toFixed(1)} Mo
                    </Badge>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={submitting || !enterpriseName.trim()}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Création...</> : 'Créer le deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
