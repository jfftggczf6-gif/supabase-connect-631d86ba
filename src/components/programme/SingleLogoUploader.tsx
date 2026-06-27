import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ACCEPTED = ["png", "jpg", "jpeg", "webp", "svg", "gif"];
const BUCKET = "programme-logos";

/**
 * Upload d'UN seul logo (logo en-tête du formulaire → programmes.logo_url). Contrôlé : value/onChange.
 * Stocke dans le bucket public programme-logos et renvoie l'URL publique.
 */
export function SingleLogoUploader({
  programmeId,
  value,
  onChange,
}: {
  programmeId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    if (!ACCEPTED.includes(ext)) {
      toast({ title: "Format non supporté", description: "png, jpg, webp, svg, gif", variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${programmeId}/header-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) {
      toast({ title: "Échec de l'import", description: error.message, variant: "destructive" });
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {value ? (
        <div className="flex items-center gap-2 rounded-md border p-2">
          <img src={value} alt="" className="h-12 max-w-[160px] object-contain bg-muted/30 rounded" />
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Retirer le logo">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-dashed px-4 py-3 text-xs text-muted-foreground">Aucun logo en-tête</div>
      )}
      <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {value ? "Remplacer le logo" : "Importer un logo"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        hidden
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
      />
    </div>
  );
}
