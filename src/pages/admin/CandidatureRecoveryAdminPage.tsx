// CandidatureRecoveryAdminPage — page super-admin pour générer des liens de
// rattrapage candidature. Réservée au super_admin (RequireSuperAdmin).
// Workflow : choisir une candidature → générer le lien → copier → l'envoyer
// au chef de programme par email/WhatsApp, qui le retransmet à l'entrepreneur.
import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Search, KeyRound, Copy, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface Row {
  id: string;
  company_name: string;
  contact_email: string;
  contact_name: string | null;
  programme_name: string | null;
  org_name: string | null;
  documents_count: number;
  recovery_token: string | null;
  recovery_expires_at: string | null;
  recovery_used_at: string | null;
  submitted_at: string;
}

export default function CandidatureRecoveryAdminPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);

  const [dialogUrl, setDialogUrl] = useState<string | null>(null);
  const [dialogCandidature, setDialogCandidature] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('candidatures')
      .select(`
        id, company_name, contact_email, contact_name, documents,
        recovery_token, recovery_expires_at, recovery_used_at, submitted_at,
        programmes:programme_id ( name, organizations:organization_id ( name ) )
      `)
      .order('submitted_at', { ascending: false })
      .limit(100);

    setRows(((data || []) as any[]).map((c: any) => ({
      id: c.id,
      company_name: c.company_name,
      contact_email: c.contact_email,
      contact_name: c.contact_name,
      programme_name: c.programmes?.name ?? null,
      org_name: c.programmes?.organizations?.name ?? null,
      documents_count: Array.isArray(c.documents) ? c.documents.length : 0,
      recovery_token: c.recovery_token,
      recovery_expires_at: c.recovery_expires_at,
      recovery_used_at: c.recovery_used_at,
      submitted_at: c.submitted_at,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.company_name?.toLowerCase().includes(q)
      || r.contact_email?.toLowerCase().includes(q)
      || r.programme_name?.toLowerCase().includes(q)
      || r.org_name?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const handleGenerate = async (row: Row) => {
    setGenerating(row.id);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/candidature-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          action: 'generate',
          candidature_id: row.id,
          origin: window.location.origin,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(data.error || 'Erreur de génération');
        setGenerating(null);
        return;
      }
      setDialogUrl(data.recovery_url);
      setDialogCandidature(row);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
    setGenerating(null);
  };

  const copyUrl = () => {
    if (!dialogUrl) return;
    navigator.clipboard.writeText(dialogUrl).then(() => toast.success('Lien copié 📋'));
  };

  const tokenStatus = (r: Row): { label: string; cls: string } => {
    if (!r.recovery_token) return { label: '—', cls: 'bg-slate-100 text-slate-600' };
    if (r.recovery_used_at) return { label: 'Utilisé', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (r.recovery_expires_at && new Date(r.recovery_expires_at) < new Date()) {
      return { label: 'Expiré', cls: 'bg-red-50 text-red-700 border-red-200' };
    }
    return { label: 'Actif', cls: 'bg-violet-50 text-violet-700 border-violet-200' };
  };

  return (
    <DashboardLayout title="Liens de rattrapage candidatures" subtitle="Super admin — génère des liens pour que les candidats re-uploadent leurs pièces si elles ont été perdues">
      <div className="space-y-4">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-amber-900">
              <p className="font-medium">À utiliser uniquement en cas de fichiers perdus</p>
              <p className="text-xs mt-1">
                Génère un lien sécurisé valable 7 jours, à transmettre au chef de programme qui le retransmettra à l'entrepreneur.
                Le candidat re-uploade ses fichiers et ils sont rattachés automatiquement à sa candidature existante.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recherche */}
        <div className="relative max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche : entreprise, email, programme, organisation…"
            className="pl-8"
          />
        </div>

        {/* Tableau */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead className="text-center">Docs</TableHead>
                    <TableHead>Soumise</TableHead>
                    <TableHead>Token actuel</TableHead>
                    <TableHead className="w-[160px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Aucune candidature ne correspond.</TableCell></TableRow>
                  ) : filtered.map(r => {
                    const ts = tokenStatus(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.company_name}</div>
                          <div className="text-xs text-muted-foreground">{r.contact_email}</div>
                        </TableCell>
                        <TableCell className="text-sm">{r.programme_name ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.org_name ?? '—'}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums">{r.documents_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {new Date(r.submitted_at).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${ts.cls}`}>{ts.label}</Badge>
                          {r.recovery_expires_at && !r.recovery_used_at && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Expire le {new Date(r.recovery_expires_at).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={r.recovery_token && !r.recovery_used_at ? "outline" : "default"}
                            onClick={() => handleGenerate(r)}
                            disabled={generating === r.id}
                            className="gap-1.5"
                          >
                            {generating === r.id ? <Loader2 className="h-3 w-3 animate-spin" />
                              : r.recovery_token && !r.recovery_used_at ? <RefreshCw className="h-3 w-3" />
                              : <KeyRound className="h-3 w-3" />}
                            {r.recovery_token && !r.recovery_used_at ? 'Régénérer' : 'Générer lien'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog : URL copiable */}
      <Dialog open={!!dialogUrl} onOpenChange={(o) => { if (!o) { setDialogUrl(null); setDialogCandidature(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-violet-600" /> Lien généré
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {dialogCandidature && (
              <p className="text-sm text-muted-foreground">
                Lien de rattrapage pour <strong>{dialogCandidature.company_name}</strong> ({dialogCandidature.contact_email}).
                Valable <strong>7 jours</strong>.
              </p>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">URL à transmettre au chef de programme</label>
              <div className="flex gap-2">
                <Input value={dialogUrl ?? ''} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyUrl}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="text-xs bg-muted p-3 rounded space-y-1">
              <p className="font-medium">Email type à envoyer au chef de programme :</p>
              <p className="text-muted-foreground italic">
                "Bonjour, peux-tu transmettre ce lien à <strong>{dialogCandidature?.company_name}</strong> ({dialogCandidature?.contact_email}) ?
                Suite à un souci technique, leurs pièces justificatives n'ont pas été enregistrées. Ce lien (valable 7 jours)
                leur permet de les re-uploader sans recommencer toute la candidature : <strong>{dialogUrl}</strong>"
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
