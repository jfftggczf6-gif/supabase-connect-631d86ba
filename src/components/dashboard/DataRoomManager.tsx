import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FolderOpen, Upload, Trash2, FileText, Shield, Users, BarChart3,
  Globe, Briefcase, Copy, Link, Loader2, Star, Plus, Share2, Eye,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'legal', label: 'Juridique', icon: Shield, color: 'bg-blue-100 text-blue-600', description: 'RCCM, statuts, PV AG, licences' },
  { id: 'finance', label: 'Finance', icon: BarChart3, color: 'bg-emerald-100 text-emerald-600', description: 'Bilans, CdR, relevés bancaires' },
  { id: 'commercial', label: 'Commercial', icon: Briefcase, color: 'bg-amber-100 text-amber-600', description: 'Contrats clients, factures, pipeline' },
  { id: 'team', label: 'Équipe', icon: Users, color: 'bg-purple-100 text-purple-600', description: 'Organigramme, CVs, fiches de paie' },
  { id: 'impact', label: 'ESG / Impact', icon: Globe, color: 'bg-teal-100 text-teal-600', description: 'Rapports RSE, certifications, ODD' },
  { id: 'other', label: 'Autres', icon: FileText, color: 'bg-muted text-muted-foreground', description: 'Documents divers' },
] as const;

// Evidence levels: 0=Non vérifié, 1=Auto-déclaré, 2=Document fourni, 3=Certifié

interface DataRoomDoc {
  id: string;
  enterprise_id: string;
  category: string;
  label: string;
  filename: string;
  storage_path: string;
  file_size: number | null;
  evidence_level: number;
  is_generated: boolean;
  deliverable_type: string | null;
  uploaded_by: string;
  created_at: string;
}

interface DataRoomShare {
  id: string;
  enterprise_id: string;
  investor_email: string | null;
  investor_name: string | null;
  access_token: string;
  expires_at: string | null;
  can_download: boolean;
  viewed_at: string | null;
  created_at: string;
}

interface DataRoomManagerProps {
  enterpriseId: string;
  userId: string;
}

export default function DataRoomManager({ enterpriseId, userId }: DataRoomManagerProps) {
  const [docs, setDocs] = useState<DataRoomDoc[]>([]);
  const [shares, setShares] = useState<DataRoomShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [investorName, setInvestorName] = useState('');
  const [investorEmail, setInvestorEmail] = useState('');
  const [creatingShare, setCreatingShare] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchData = async () => {
    const [{ data: docsData }, { data: sharesData }] = await Promise.all([
      supabase.from('data_room_documents').select('*').eq('enterprise_id', enterpriseId).order('category').order('created_at', { ascending: false }),
      supabase.from('data_room_shares').select('*').eq('enterprise_id', enterpriseId).order('created_at', { ascending: false }),
    ]);
    setDocs((docsData || []) as unknown as DataRoomDoc[]);
    setShares((sharesData || []) as unknown as DataRoomShare[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [enterpriseId]);

  const handleUpload = async (category: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(category);
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${enterpriseId}/dataroom/${category}/${Date.now()}_${safeName}`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, file, { upsert: true });
        if (uploadErr) throw uploadErr;

        const { error: insertErr } = await supabase.from('data_room_documents').insert({
          enterprise_id: enterpriseId,
          category,
          label: file.name,
          filename: safeName,
          storage_path: storagePath,
          file_size: file.size,
          evidence_level: 2,
          uploaded_by: userId,
        } as any);
        if (insertErr) throw insertErr;
      }
      toast.success(`${files.length} document(s) ajouté(s)`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erreur d'upload");
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (doc: DataRoomDoc) => {
    if (!confirm(`Supprimer "${doc.label}" ?`)) return;
    try {
      await supabase.storage.from('documents').remove([doc.storage_path]);
      await supabase.from('data_room_documents').delete().eq('id', doc.id);
      toast.success('Document supprimé');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  const handleCreateShare = async () => {
    if (!investorName.trim()) return;
    setCreatingShare(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const { error } = await supabase.from('data_room_shares').insert({
        enterprise_id: enterpriseId,
        investor_name: investorName.trim(),
        investor_email: investorEmail.trim() || null,
        expires_at: expiresAt.toISOString(),
      } as any);
      if (error) throw error;
      toast.success('Lien de partage créé !');
      setInvestorName('');
      setInvestorEmail('');
      setShowShare(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setCreatingShare(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/data-room/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien copié !');
  };

  const handleDeleteShare = async (id: string) => {
    if (!confirm('Révoquer cet accès ?')) return;
    await supabase.from('data_room_shares').delete().eq('id', id);
    toast.success('Accès révoqué');
    await fetchData();
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const docsByCategory = CATEGORIES.map(cat => ({
    ...cat,
    docs: docs.filter(d => d.category === cat.id),
  }));

  const totalDocs = docs.length;
  const completeness = CATEGORIES.filter(c => docs.some(d => d.category === c.id)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-display font-bold text-lg">Data Room</h2>
            <p className="text-xs text-muted-foreground">{totalDocs} document(s) · {completeness}/{CATEGORIES.length} catégories couvertes</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowShare(true)}>
          <Share2 className="h-3.5 w-3.5" /> Partager avec un investisseur
        </Button>
      </div>

      {/* Categories grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docsByCategory.map(cat => {
          const CatIcon = cat.icon;
          return (
            <Card key={cat.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-lg ${cat.color} flex items-center justify-center`}>
                    <CatIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{cat.label}</p>
                    <p className="text-[10px] text-muted-foreground">{cat.description}</p>
                  </div>
                </div>
                <div>
                  <input
                    ref={el => { fileRefs.current[cat.id] = el; }}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => handleUpload(cat.id, e.target.files)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => fileRefs.current[cat.id]?.click()}
                    disabled={uploading === cat.id}
                  >
                    {uploading === cat.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Ajouter
                  </Button>
                </div>
              </div>

              {cat.docs.length === 0 ? (
                <div
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileRefs.current[cat.id]?.click()}
                >
                  <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Glissez ou cliquez pour ajouter</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {cat.docs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 group">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-none" />
                      <span className="text-xs truncate flex-1" title={doc.label}>{doc.label}</span>
                      <span className="text-[10px] text-muted-foreground">{formatSize(doc.file_size)}</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Star key={i} className={`h-2.5 w-2.5 ${i < doc.evidence_level ? 'text-amber-400 fill-amber-400' : 'text-border'}`} />
                        ))}
                      </div>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-none"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Active shares */}
      {shares.length > 0 && (
        <Card className="p-4">
          <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
            <Link className="h-4 w-4" /> Liens de partage actifs
          </h3>
          <div className="space-y-2">
            {shares.map(share => (
              <div key={share.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{share.investor_name || 'Investisseur'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {share.investor_email || 'Pas d\'email'}
                    {share.expires_at && ` · Expire ${new Date(share.expires_at).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                {share.viewed_at && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Eye className="h-2.5 w-2.5" /> Vu
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => handleCopyLink(share.access_token)}>
                  <Copy className="h-3 w-3" /> Copier
                </Button>
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => handleDeleteShare(share.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Share dialog */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Partager la Data Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label>Nom de l'investisseur *</Label>
              <Input value={investorName} onChange={e => setInvestorName(e.target.value)} placeholder="Ex: Proparco, BAD..." />
            </div>
            <div className="space-y-1.5">
              <Label>Email (optionnel)</Label>
              <Input value={investorEmail} onChange={e => setInvestorEmail(e.target.value)} placeholder="contact@investisseur.com" />
            </div>
            <p className="text-xs text-muted-foreground">Un lien unique sera généré, valide 30 jours.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShare(false)}>Annuler</Button>
            <Button onClick={handleCreateShare} disabled={creatingShare || !investorName.trim()}>
              {creatingShare ? 'Création...' : 'Créer le lien'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
