import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  dealId: string;
  organizationId: string;
  onUploaded?: (docId: string, filename: string) => void;
  className?: string;
  children?: React.ReactNode;
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export default function DocumentDropzone({ dealId, organizationId, onUploaded, className, children }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      const arr = Array.from(files);
      for (const file of arr) {
        if (file.size > MAX_SIZE_BYTES) {
          toast.error(`${file.name} dépasse la limite de 50 Mo`);
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${organizationId}/${dealId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from('pe_deal_docs').upload(path, file);
        if (upErr) {
          toast.error(`Upload ${file.name} échoué : ${upErr.message}`);
          continue;
        }
        const { data: { user } } = await supabase.auth.getUser();
        const { data: row, error: dbErr } = await supabase
          .from('pe_deal_documents')
          .insert({
            deal_id: dealId,
            organization_id: organizationId,
            filename: file.name,
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
            uploaded_by: user!.id,
          })
          .select('id')
          .single();
        if (dbErr) {
          toast.error(`Enregistrement ${file.name} échoué : ${dbErr.message}`);
          continue;
        }
        toast.success(`${file.name} uploadé`);
        onUploaded?.(row.id, file.name);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`relative rounded-lg border-2 border-dashed transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'} ${className ?? ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) await handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => { if (e.target.files) await handleFiles(e.target.files); e.target.value = ''; }}
      />
      {uploading ? (
        <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Upload en cours...
        </div>
      ) : children ? children : (
        <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
          <Upload className="h-4 w-4" /> Glisser-déposer ou cliquer pour ajouter des documents
        </div>
      )}
    </div>
  );
}
