import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Archive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildZipBlob, triggerDownload, zipFilename, type ZipFile } from '@/lib/download-zip';

/**
 * Bouton réutilisable « Télécharger tout (ZIP) » : rassemble une liste de fichiers
 * (chacun avec sa fonction de récupération) dans un seul zip côté client, puis le
 * télécharge. Tolérant aux échecs (signale les fichiers ratés). Désactivé si vide.
 */
export function DownloadAllZipButton({
  files,
  zipBaseName,
  size = 'sm',
  variant = 'outline',
  className,
  label = 'Télécharger tout (ZIP)',
}: {
  files: ZipFile[];
  zipBaseName: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const disabled = busy || !files.length;

  const handleClick = async () => {
    setBusy(true);
    try {
      const { blob, added, failed } = await buildZipBlob(files);
      if (added === 0) {
        toast.error("Aucun document n'a pu être récupéré.");
        return;
      }
      triggerDownload(blob, zipFilename(zipBaseName));
      if (failed.length) {
        toast.warning(`${added} fichier(s) zippé(s) — ${failed.length} en échec : ${failed.join(', ')}`);
      } else {
        toast.success(`${added} document(s) téléchargé(s) en ZIP.`);
      }
    } catch (e: any) {
      toast.error(`Échec du ZIP : ${e?.message || 'erreur'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size={size} variant={variant} className={`gap-1.5 ${className || ''}`} disabled={disabled} onClick={handleClick}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />} {label}
    </Button>
  );
}
