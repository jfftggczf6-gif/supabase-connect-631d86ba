import JSZip from 'jszip';

/** Un fichier à zipper : son nom d'affichage + une fonction qui récupère son contenu. */
export interface ZipFile {
  name: string;
  fetch: () => Promise<Blob | null>;
}

/**
 * Construit un zip à partir d'une liste de fichiers. Tolérant : un fichier dont le
 * fetch échoue (null ou exception) est ignoré et listé dans `failed` — les autres
 * sont quand même inclus. Déduplique les noms identiques (doc.pdf → doc_1.pdf).
 */
export async function buildZipBlob(files: ZipFile[]): Promise<{ blob: Blob; added: number; failed: string[] }> {
  const zip = new JSZip();
  const failed: string[] = [];
  const used = new Set<string>();
  let added = 0;

  for (const f of files || []) {
    try {
      const blob = await f.fetch();
      if (!blob) { failed.push(f.name); continue; }
      let name = f.name || 'fichier';
      if (used.has(name)) {
        const dot = name.lastIndexOf('.');
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        let i = 1;
        while (used.has(`${base}_${i}${ext}`)) i++;
        name = `${base}_${i}${ext}`;
      }
      used.add(name);
      zip.file(name, blob);
      added++;
    } catch {
      failed.push(f.name);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, added, failed };
}

/** Déclenche le téléchargement d'un blob dans le navigateur. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Nom de fichier zip lisible : Documents_[Nom].zip */
export function zipFilename(baseName: string | undefined): string {
  const safe = (baseName || 'documents').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `Documents_${safe || 'documents'}.zip`;
}
