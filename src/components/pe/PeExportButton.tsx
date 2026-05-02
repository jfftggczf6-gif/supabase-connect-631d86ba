// PeExportButton — Bouton dropdown qui invoque l'edge fn render-document
// pour télécharger un livrable du deal en Word/PPT/Excel/PDF.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Download, FileText, Presentation, FileSpreadsheet, FileType, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type RenderKind = 'memo_ic1' | 'valuation' | 'pre_screening' | 'dd_report';
type RenderFormat = 'docx' | 'pptx' | 'xlsx' | 'pdf';

interface ExportOption {
  format: RenderFormat;
  label: string;
  Icon: typeof FileText;
}

const KIND_OPTIONS: Record<RenderKind, ExportOption[]> = {
  memo_ic1: [
    { format: 'docx', label: 'Word (.docx)',       Icon: FileText },
    { format: 'pptx', label: 'PowerPoint (.pptx)', Icon: Presentation },
    { format: 'pdf',  label: 'PDF',                Icon: FileType },
  ],
  valuation: [
    { format: 'xlsx', label: 'Excel (.xlsx)', Icon: FileSpreadsheet },
    { format: 'pdf',  label: 'PDF',           Icon: FileType },
  ],
  pre_screening: [
    { format: 'docx', label: 'Word (.docx)', Icon: FileText },
    { format: 'pdf',  label: 'PDF',          Icon: FileType },
  ],
  dd_report: [
    { format: 'docx', label: 'Word (.docx)',  Icon: FileText },
    { format: 'xlsx', label: 'Excel (.xlsx)', Icon: FileSpreadsheet },
    { format: 'pdf',  label: 'PDF',           Icon: FileType },
  ],
};

const KIND_LABELS: Record<RenderKind, string> = {
  memo_ic1: 'Exporter le memo',
  valuation: 'Exporter la valuation',
  pre_screening: 'Exporter le pré-screening',
  dd_report: 'Exporter la DD',
};

interface Props {
  dealId: string;
  kind: RenderKind;
  /** Texte du bouton. Default = label du kind. */
  label?: string;
  /** Variant du bouton. Default = outline. */
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default';
  /** Si true, affiche juste l'icône + chevron (mode compact). */
  iconOnly?: boolean;
}

export default function PeExportButton({ dealId, kind, label, variant = 'outline', size = 'sm', iconOnly = false }: Props) {
  const [busy, setBusy] = useState<RenderFormat | null>(null);
  const opts = KIND_OPTIONS[kind];

  const handleExport = async (format: RenderFormat) => {
    if (busy) return;
    setBusy(format);
    const toastId = toast.loading(`Génération du fichier ${format.toUpperCase()}...`);
    try {
      // Use Supabase functions invoke with raw response (we need the binary blob)
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Non authentifié');

      const supabaseUrl = (supabase as any).supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
      const fnUrl = `${supabaseUrl}/functions/v1/render-document`;

      const resp = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deal_id: dealId, kind, format }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error || `Erreur HTTP ${resp.status}`);
      }

      const blob = await resp.blob();
      // Extract filename from Content-Disposition
      const cd = resp.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `${kind}-${Date.now()}.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Fichier téléchargé : ${filename}`, { id: toastId });
    } catch (e) {
      toast.error(`Export échoué : ${(e as Error).message}`, { id: toastId });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5" disabled={!!busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {!iconOnly && <span>{label ?? 'Exporter'}</span>}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{KIND_LABELS[kind]}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {opts.map(opt => {
          const I = opt.Icon;
          return (
            <DropdownMenuItem
              key={opt.format}
              onClick={() => handleExport(opt.format)}
              disabled={!!busy}
              className="gap-2 cursor-pointer"
            >
              {busy === opt.format ? <Loader2 className="h-4 w-4 animate-spin" /> : <I className="h-4 w-4 text-muted-foreground" />}
              {opt.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
