import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import DocumentDropzone from './DocumentDropzone';

interface Props { dealId: string; organizationId: string; }

interface Doc {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string | null;
  created_at: string;
}

export default function DealDocumentsList({ dealId, organizationId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);

  const reload = async () => {
    const { data } = await supabase
      .from('pe_deal_documents')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });
    setDocs((data ?? []) as Doc[]);
  };
  useEffect(() => { reload(); }, [dealId]);

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from('pe_deal_docs').createSignedUrl(d.storage_path, 60);
    if (error || !data) { toast.error(`Téléchargement échoué : ${error?.message}`); return; }
    window.open(data.signedUrl, '_blank');
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Supprimer ${d.filename} ?`)) return;
    const { error: storErr } = await supabase.storage.from('pe_deal_docs').remove([d.storage_path]);
    if (storErr) toast.warning(`Storage : ${storErr.message}`);
    const { error: dbErr } = await supabase.from('pe_deal_documents').delete().eq('id', d.id);
    if (dbErr) { toast.error(`DB : ${dbErr.message}`); return; }
    toast.success(`${d.filename} supprimé`);
    reload();
  };

  return (
    <div className="space-y-3">
      <DocumentDropzone dealId={dealId} organizationId={organizationId} onUploaded={reload} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Data Room ({docs.length} {docs.length > 1 ? 'pièces' : 'pièce'})</CardTitle></CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Votre Data Room est vide. Glisse-dépose les pièces ci-dessus.</p>
          ) : (
            <div className="space-y-1">
              {docs.map(d => (
                <div key={d.id} className="flex justify-between items-center border-b border-border/50 py-1.5 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{d.filename}</span>
                    {d.category && <span className="text-xs text-muted-foreground">[{d.category}]</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => download(d)} title="Télécharger">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(d)} title="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
