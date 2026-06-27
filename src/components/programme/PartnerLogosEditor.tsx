import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { PartnerLogo } from "./PartnerLogos";

const ACCEPTED = ["png", "jpg", "jpeg", "webp", "svg", "gif"];
const BUCKET = "programme-logos";

/**
 * Éditeur admin de la bande « Partenaires ». Importe des logos dans le bucket public programme-logos,
 * permet de les nommer (alt) et de les supprimer. Contrôlé : remonte la liste via onChange.
 */
export function PartnerLogosEditor({
  programmeId,
  value,
  onChange,
}: {
  programmeId: string;
  value: PartnerLogo[];
  onChange: (logos: PartnerLogo[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logos = value || [];

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const added: PartnerLogo[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      if (!ACCEPTED.includes(ext)) {
        toast({ title: "Format non supporté", description: `${file.name} — png, jpg, webp, svg, gif`, variant: "destructive" });
        continue;
      }
      const path = `${programmeId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        toast({ title: "Échec de l'import", description: error.message, variant: "destructive" });
        continue;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      added.push({ url: data.publicUrl, name: file.name.replace(/\.[^.]+$/, "") });
    }
    setUploading(false);
    if (added.length) onChange([...logos, ...added]);
  };

  const updateName = (i: number, name: string) => onChange(logos.map((l, idx) => (idx === i ? { ...l, name } : l)));
  const remove = (i: number) => onChange(logos.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Logos partenaires</Label>
          <p className="text-[11px] text-muted-foreground">Affichés en bas du formulaire public (« Avec le soutien de … »).</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importer un logo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          multiple
          hidden
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {logos.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground">Aucun logo partenaire. Cliquez « Importer un logo » pour en ajouter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logos.map((l, i) => (
            <div key={`${l.url}-${i}`} className="flex items-center gap-3 rounded-md border p-2">
              <img src={l.url} alt={l.name || ""} className="h-10 w-16 object-contain bg-muted/30 rounded" />
              <Input className="flex-1" placeholder="Nom du partenaire (optionnel)" value={l.name || ""} onChange={(e) => updateName(i, e.target.value)} />
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Retirer">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
