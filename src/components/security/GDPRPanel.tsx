import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Download, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function GDPRPanel() {
  const [exporting, setExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error((await resp.json()).error);
      const data = await resp.json();

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `esono_data_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé');
    } catch (err: any) {
      toast.error(err.message);
    }
    setExporting(false);
  };

  const handleDelete = async () => {
    if (deleteConfirm !== 'SUPPRIMER') return;
    setDeleting(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ confirmation: 'SUPPRIMER_TOUTES_MES_DONNEES' }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error);
      toast.success('Toutes vos données ont été supprimées');
      window.location.href = '/login';
    } catch (err: any) {
      toast.error(err.message);
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-4">
      {/* Data Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Exporter mes données (RGPD Art. 20)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Téléchargez une copie complète de toutes vos données personnelles : profil, entreprises, livrables, notes de coaching, historique d'activité.
          </p>
          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exporter en JSON
          </Button>
        </CardContent>
      </Card>

      {/* Data Deletion */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Supprimer mon compte (RGPD Art. 17)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Supprimez définitivement votre compte et toutes vos données. Cette action est irréversible.
          </p>
          <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4" /> Supprimer mon compte
          </Button>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Suppression définitive
            </DialogTitle>
            <DialogDescription>
              Cette action va supprimer définitivement votre compte et toutes vos données : profil, entreprises, livrables, notes de coaching, documents uploadés. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">Tapez <strong>SUPPRIMER</strong> pour confirmer :</p>
            <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="SUPPRIMER" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteConfirm !== 'SUPPRIMER' || deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
