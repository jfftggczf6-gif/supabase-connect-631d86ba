// src/components/ba/parametres/FundIdentitySection.tsx
// SECTION 1 — Identité du fonds : nom commercial, raison sociale, email,
// site web, adresse + upload logo (bucket org_logos public).

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FundIdentity } from '@/types/parametres-ba';

interface Props {
  organizationId: string;
  value: FundIdentity;
  saving: boolean;
  onSave: (next: FundIdentity) => Promise<boolean>;
}

export default function FundIdentitySection({ organizationId, value, saving, onSave }: Props) {
  const [draft, setDraft] = useState<FundIdentity>(value);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const canSubmit = !!draft.commercial_name.trim() && !!draft.legal_name.trim() && !!draft.email.trim();

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo trop volumineux (max 2 MB)');
      return;
    }
    setUploading(true);
    // Passe par EF upload-org-logo (service role bypasse RLS storage).
    const formData = new FormData();
    formData.append('file', file);
    formData.append('organization_id', organizationId);
    const { data, error: upErr } = await supabase.functions.invoke('upload-org-logo', {
      body: formData,
    });
    if (upErr || (data as any)?.error) {
      const msg = (data as any)?.error || upErr?.message || 'Upload échoué';
      toast.error(msg);
      setUploading(false);
      return;
    }
    setDraft(d => ({ ...d, logo_url: (data as any).logo_url }));
    setUploading(false);
    toast.success('Logo uploadé');
  };

  const handleLogoRemove = () => setDraft(d => ({ ...d, logo_url: null }));

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Identité du fonds</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Affichée dans tous les exports (teaser, IM, valorisation) et la page publique de candidature.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Nom commercial *</Label>
          <Input
            value={draft.commercial_name}
            onChange={(e) => setDraft({ ...draft, commercial_name: e.target.value })}
            placeholder="Cissé Advisory"
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Raison sociale *</Label>
          <Input
            value={draft.legal_name}
            onChange={(e) => setDraft({ ...draft, legal_name: e.target.value })}
            placeholder="Cissé Advisory SAS"
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email de contact *</Label>
          <Input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="contact@cisse-advisory.com"
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Site web</Label>
          <Input
            value={draft.website ?? ''}
            onChange={(e) => setDraft({ ...draft, website: e.target.value || null })}
            placeholder="https://cisse-advisory.com"
            disabled={saving}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Adresse</Label>
        <Textarea
          value={draft.address ?? ''}
          onChange={(e) => setDraft({ ...draft, address: e.target.value || null })}
          placeholder="Plateau, Abidjan, Côte d'Ivoire"
          rows={2}
          disabled={saving}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Logo</Label>
        <div className="flex items-center gap-3">
          {draft.logo_url ? (
            <div className="relative h-16 w-16 border rounded bg-muted/30 flex items-center justify-center overflow-hidden">
              <img src={draft.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
              <button
                type="button"
                onClick={handleLogoRemove}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600"
                aria-label="Retirer le logo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="h-16 w-16 border-2 border-dashed rounded bg-muted/30 flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || saving}
          >
            {uploading
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Upload…</>
              : <><Upload className="h-3 w-3 mr-1" /> {draft.logo_url ? 'Remplacer' : 'Uploader'}</>}
          </Button>
          <span className="text-[10px] text-muted-foreground">PNG / JPG / SVG / WebP, max 2 MB</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(value)} disabled={saving}>
            Annuler
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => onSave(draft)}
          disabled={!dirty || !canSubmit || saving}
        >
          {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sauvegarde…</> : 'Sauvegarder'}
        </Button>
      </div>
    </Card>
  );
}
