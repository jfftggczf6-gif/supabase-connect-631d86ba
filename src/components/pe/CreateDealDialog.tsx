import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, X, FileText } from 'lucide-react';
import { useCurrentRole } from '@/hooks/useCurrentRole';

const SOURCES = [
  { value: 'reseau_pe', label: 'Réseau PE' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'dfi', label: 'DFI' },
  { value: 'banque', label: 'Banque' },
  { value: 'mandat_ba', label: "Mandat banque d'affaires" },
  { value: 'conference', label: 'Conférence' },
  { value: 'autre', label: 'Autre' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentUserId: string;
  onCreated: () => void;
}

interface AnalystOpt { user_id: string; full_name: string | null; email: string | null; role: string; }

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export default function CreateDealDialog({ open, onOpenChange, organizationId, currentUserId, onCreated }: Props) {
  const { role } = useCurrentRole();
  const isAnalyst = role === 'analyste' || role === 'analyst';

  const [enterpriseName, setEnterpriseName] = useState('');
  const [ticket, setTicket] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [source, setSource] = useState('reseau_pe');
  const [sourceDetail, setSourceDetail] = useState('');
  const [leadAnalystId, setLeadAnalystId] = useState(currentUserId);
  const [analysts, setAnalysts] = useState<AnalystOpt[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Files staged for upload after creation
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLeadAnalystId(currentUserId);
    setPendingFiles([]);
    if (isAnalyst) return; // analyst skip team load (auto-self)
    (async () => {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('role', ['analyst', 'analyste', 'investment_manager', 'managing_director', 'owner', 'admin']);
      const ids = (members || []).map((m: any) => m.user_id);
      if (!ids.length) { setAnalysts([]); return; }
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      setAnalysts((members || []).map((m: any) => ({
        ...m,
        full_name: profMap.get(m.user_id)?.full_name || null,
        email: profMap.get(m.user_id)?.email || null,
      })));
    })();
  }, [open, organizationId, currentUserId, isAnalyst]);

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

  const handleCreate = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('create-pe-deal', {
      body: {
        organization_id: organizationId,
        enterprise_name: enterpriseName.trim() || null,
        ticket_demande: ticket ? Number(ticket) * 1_000_000 : null,
        currency,
        source,
        source_detail: source === 'autre' ? sourceDetail.trim() || null : null,
        lead_analyst_id: leadAnalystId,
      },
    });
    if (error || (data as any)?.error) {
      setSubmitting(false);
      toast.error((data as any)?.error || error?.message);
      return;
    }
    const dealId = (data as any).deal.id;
    toast.success(`Deal ${(data as any).deal.deal_ref} créé`);

    // Upload pending files vers le nouveau deal
    if (pendingFiles.length > 0) {
      await uploadDocsToDeal(dealId);
    }

    setSubmitting(false);
    setEnterpriseName(''); setTicket(''); setSourceDetail(''); setPendingFiles([]);
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouveau deal</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nom de la cible</Label>
            <Input value={enterpriseName} onChange={e => setEnterpriseName(e.target.value)} placeholder="PharmaCi Industries" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ticket demandé (M)</Label>
              <Input type="number" step="0.1" value={ticket} onChange={e => setTicket(e.target.value)} placeholder="4.2" />
            </div>
            <div className="space-y-1.5">
              <Label>Devise</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="FCFA">FCFA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {source === 'autre' && (
            <div className="space-y-1.5">
              <Label>Précision</Label>
              <Input value={sourceDetail} onChange={e => setSourceDetail(e.target.value)} placeholder="…" />
            </div>
          )}

          {!isAnalyst && (
            <div className="space-y-1.5">
              <Label>Analyste lead</Label>
              <Select value={leadAnalystId} onValueChange={setLeadAnalystId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {analysts.map((a) => (
                    <SelectItem key={a.user_id} value={a.user_id}>
                      {a.full_name || a.email} {a.user_id === currentUserId ? '(moi)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pièces initiales — drag-drop optionnel à la création */}
          <div className="space-y-1.5">
            <Label>Pièces initiales (optionnel)</Label>
            <div
              className={`rounded-lg border-2 border-dashed p-3 text-center text-sm transition cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
              />
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>Glisser-déposer ou cliquer · PDF, Excel, Word · 50 Mo max</span>
              </div>
            </div>

            {pendingFiles.length > 0 && (
              <div className="space-y-1 mt-1">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} Mo</span>
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      title="Retirer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Si tu joins des pièces, tu pourras pousser le deal en Pré-screening pour générer l'analyse 360°.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
