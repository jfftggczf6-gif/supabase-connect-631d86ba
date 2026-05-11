import { useEffect, useState, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Loader2, Paperclip, FileCheck2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { useFundCurrency } from '@/hooks/useFundCurrency';
import { useFxRates } from '@/hooks/useFxRates';
import { convertCurrency } from '@/lib/currency-conversion';
import RegenerateConfirmDialog from './RegenerateConfirmDialog';

interface Deal {
  id: string;
  deal_ref: string;
  enterprise_name?: string | null;
  ticket_demande: number | null;
  currency: string | null;
  lead_analyst_initials?: string;
  score_360: number | null;
  stage?: string;
}

interface Props {
  deal: Deal;
  organizationId?: string;
  onClick: () => void;
  onRefresh?: () => void;
}

interface VersionSummary {
  status: 'generating' | 'ready' | 'rejected' | 'validated';
  overall_score: number | null;
  stage: string;
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export default function PeDealCard({ deal, organizationId, onClick, onRefresh }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const cardStyle = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };
  const { currency: fundCurrency } = useFundCurrency(organizationId);
  const { rates: fxRates } = useFxRates();

  const [docCount, setDocCount] = useState(0);
  const [latest, setLatest] = useState<VersionSummary | null>(null);
  const [pollOn, setPollOn] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const reloadRef = useRef<() => Promise<void>>(async () => {});

  const reloadCard = async () => {
    const [docsRes, versionsRes] = await Promise.all([
      supabase.from('pe_deal_documents').select('id', { count: 'exact', head: true }).eq('deal_id', deal.id),
      supabase
        .from('memo_versions')
        .select('status, overall_score, stage, investment_memos!inner(deal_id)')
        .eq('investment_memos.deal_id', deal.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(1),
    ]);
    setDocCount(docsRes.count ?? 0);
    const v = (versionsRes.data?.[0] as any) ?? null;
    setLatest(v);
    setPollOn(v?.status === 'generating');
  };
  reloadRef.current = reloadCard;

  useEffect(() => { reloadCard(); }, [deal.id]);

  // Polling pendant génération
  useEffect(() => {
    if (!pollOn) return;
    const t = setInterval(() => reloadRef.current(), 3000);
    return () => clearInterval(t);
  }, [pollOn]);

  const triggerGeneration = async () => {
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pe-pre-screening`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ deal_id: deal.id }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Échec génération');
      toast.success(`Pré-screening lancé pour ${deal.enterprise_name ?? deal.deal_ref}`);
      setPollOn(true);
      onRefresh?.();
    } catch (e: any) {
      toast.error(`Génération échouée : ${e.message}`);
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!organizationId) {
      toast.error("Organization manquante pour l'upload");
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Non authentifié'); return; }
      const arr = Array.from(files);
      let uploaded = 0;
      for (const file of arr) {
        if (file.size > MAX_SIZE_BYTES) {
          toast.error(`${file.name} dépasse 50 Mo`);
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${organizationId}/${deal.id}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from('pe_deal_docs').upload(path, file);
        if (upErr) {
          toast.error(`Upload ${file.name} échoué : ${upErr.message}`);
          continue;
        }
        const { error: dbErr } = await supabase.from('pe_deal_documents').insert({
          deal_id: deal.id,
          organization_id: organizationId,
          filename: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: user.id,
        });
        if (dbErr) {
          toast.error(`Enregistrement ${file.name} échoué : ${dbErr.message}`);
          continue;
        }
        toast.success(`${file.name} uploadé`);
        uploaded++;
      }
      if (uploaded === 0) return;
      await reloadCard();
      // Cas A : sourcing + 1ers docs → auto-trigger
      if ((deal.stage ?? '') === 'sourcing' && !latest) {
        await triggerGeneration();
        return;
      }
      // Cas B : déjà version pre_screening 'ready' → demander confirmation
      if (latest?.stage === 'pre_screening' && latest?.status === 'ready') {
        setConfirmOpen(true);
      }
    } finally {
      setUploading(false);
    }
  };

  const fmtTicket = deal.ticket_demande
    ? `${(convertCurrency(deal.ticket_demande, deal.currency, fundCurrency, fxRates) / 1_000_000).toFixed(1)}M ${fundCurrency}`
    : '—';

  const scoreColor = (s: number) =>
    s >= 70 ? 'var(--pe-ok)' : s >= 40 ? 'var(--pe-warning)' : 'var(--pe-danger)';

  return (
    <>
      <div
        ref={setNodeRef}
        style={cardStyle}
        {...listeners}
        {...attributes}
        onClick={onClick}
        onDragOver={(e) => {
          // Only react to file drag (not the dnd-kit pointer drag)
          if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          if (e.dataTransfer?.files?.length) {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            await uploadFiles(e.dataTransfer.files);
          }
        }}
        className={`bg-white rounded-md border p-3 cursor-pointer hover:shadow-md space-y-1 select-none transition ${dragOver ? 'ring-2 ring-primary bg-primary/5' : ''}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">{deal.deal_ref}</span>
          {latest?.overall_score != null ? (
            <Badge variant="outline" className="text-[10px] font-medium" style={{ color: scoreColor(Number(latest.overall_score)), borderColor: scoreColor(Number(latest.overall_score)) }}>
              {latest.overall_score}/100
            </Badge>
          ) : deal.score_360 != null ? (
            <Badge variant="outline" className="text-[10px]">{deal.score_360}/100</Badge>
          ) : null}
        </div>
        <p className="font-medium text-sm truncate">
          {deal.enterprise_name || <span className="italic text-muted-foreground">—</span>}
        </p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{fmtTicket}</span>
          {deal.lead_analyst_initials && (
            <span className="bg-muted rounded-full px-1.5 py-0.5 font-mono">{deal.lead_analyst_initials}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t">
          <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{docCount}</span>
          {(uploading || latest?.status === 'generating') && (
            <span className="flex items-center gap-0.5"><Loader2 className="h-3 w-3 animate-spin" /> {uploading ? 'upload...' : 'IA...'}</span>
          )}
          {latest?.status === 'ready' && latest?.stage === 'pre_screening' && (
            <span className="flex items-center gap-0.5" title="Pré-screening prêt"><FileCheck2 className="h-3 w-3" style={{ color: 'var(--pe-ok)' }} /> pre</span>
          )}
          {latest?.status === 'ready' && latest?.stage === 'note_ic1' && (
            <span className="flex items-center gap-0.5" title="Note IC1 prête"><FileCheck2 className="h-3 w-3" style={{ color: 'var(--pe-ok)' }} /> ic1</span>
          )}
          {dragOver && <span className="flex items-center gap-0.5 text-primary"><Upload className="h-3 w-3" /> drop ici</span>}
        </div>
      </div>

      <RegenerateConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        newDocsCount={1}
        onConfirm={triggerGeneration}
      />
    </>
  );
}
