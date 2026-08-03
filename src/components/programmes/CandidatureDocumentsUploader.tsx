import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildCoordinatorDoc, type CandidatureDoc } from '@/lib/candidature-docs';

const ACCEPT = '.pdf,.docx,.doc,.xlsx,.xlsm,.xls,.jpg,.jpeg,.png,.pptx,.ppt,.csv,.txt';

/**
 * Zone d'upload de documents dans la fiche candidature, pour un coordinateur.
 * Cas d'usage : l'entreprise envoie ses docs par email (n'a pas pu uploader).
 * Flux : get_upload_url → PUT direct → attach (merge + traçabilité serveur +
 * re-diagnostic auto). L'échec d'un fichier n'empêche pas les autres.
 */
export function CandidatureDocumentsUploader({
  candidatureId,
  onDone,
}: {
  candidatureId: string;
  onDone?: (added: CandidatureDoc[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    if (!files.length || busy) return;
    setBusy(true);
    const uploaded: { file_name: string; file_size: number; storage_path: string }[] = [];
    const failed: string[] = [];

    for (const file of files) {
      try {
        const { data: urlData, error: urlErr } = await supabase.functions.invoke('add-candidature-documents', {
          body: { action: 'get_upload_url', candidature_id: candidatureId, filename: file.name },
        });
        if (urlErr || !urlData?.signed_url) throw new Error(urlData?.error || urlErr?.message || 'lien upload');
        const putRes = await fetch(urlData.signed_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!putRes.ok) throw new Error(`PUT ${putRes.status}`);
        uploaded.push({ file_name: file.name, file_size: file.size, storage_path: urlData.storage_path });
      } catch (e: any) {
        console.error('[CandidatureDocumentsUploader]', file.name, e);
        failed.push(file.name);
      }
    }

    if (uploaded.length) {
      const { data: attachData, error: attachErr } = await supabase.functions.invoke('add-candidature-documents', {
        body: { action: 'attach', candidature_id: candidatureId, documents: uploaded },
      });
      if (attachErr || attachData?.error) {
        toast.error(`Ajout échoué : ${attachData?.error || attachErr?.message || 'erreur'}`);
      } else {
        toast.success(`${uploaded.length} document(s) ajouté(s) — diagnostic en cours de recalcul.`);
        const { data: { user } } = await supabase.auth.getUser();
        const now = new Date().toISOString();
        const optimistic = uploaded.map((u) =>
          buildCoordinatorDoc(u, { id: user?.id || '', name: user?.email || 'Coordinateur' }, now),
        );
        onDone?.(optimistic);
      }
    }
    if (failed.length) toast.error(`Échec sur : ${failed.join(', ')}`);

    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
      />
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files));
        }}
        className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
          drag ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
        } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 mx-auto animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
        )}
        <p className="text-xs text-muted-foreground">
          {busy ? 'Ajout en cours…' : 'Ajouter des documents (reçus par email)'}
        </p>
      </div>
    </div>
  );
}
