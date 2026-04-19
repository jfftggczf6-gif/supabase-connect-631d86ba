import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Eye, RefreshCw, Database, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface PendingDoc {
  id: string;
  title: string;
  content: string;
  category: string;
  sector: string | null;
  country: string | null;
  source: string | null;
  source_url: string | null;
  quality_score: number;
  ai_summary: string | null;
  ai_reasoning: string | null;
  status: string;
  created_at: string;
}

interface EnrichmentRun {
  id: string;
  run_date: string;
  sources_refreshed: number;
  new_discovered: number;
  auto_ingested: number;
  pending_review: number;
  rejected: number;
  cost_usd: number;
}

export default function KnowledgeReviewPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingDoc[]>([]);
  const [runs, setRuns] = useState<EnrichmentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<PendingDoc | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [triggeringRun, setTriggeringRun] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: pendingData }, { data: runData }] = await Promise.all([
      supabase.from('knowledge_pending_review' as any).select('*').eq('status', 'pending').order('quality_score', { ascending: false }),
      supabase.from('knowledge_enrichment_log' as any).select('*').order('run_date', { ascending: false }).limit(10),
    ]);
    setPending(pendingData || []);
    setRuns(runData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (doc: PendingDoc) => {
    setProcessing(doc.id);
    try {
      // Insert into knowledge_base
      const { error: insertErr } = await supabase.from('knowledge_base').insert({
        title: doc.title,
        content: doc.content,
        category: doc.category,
        sector: doc.sector,
        country: doc.country,
        source: doc.source,
        tags: ['reviewed-approved', `quality-${doc.quality_score}`],
      });
      if (insertErr) throw insertErr;

      // Mark as approved
      await supabase.from('knowledge_pending_review' as any).update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      }).eq('id', doc.id);

      // Generate embedding
      const token = await getValidAccessToken(null);
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mode: 'backfill' }),
      }).catch(() => {});

      toast.success(`"${doc.title}" approuvé et intégré à la KB`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
    setProcessing(null);
  };

  const handleReject = async (doc: PendingDoc) => {
    setProcessing(doc.id);
    await supabase.from('knowledge_pending_review' as any).update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
    }).eq('id', doc.id);
    toast.success(`"${doc.title}" rejeté`);
    fetchData();
    setProcessing(null);
  };

  const handleApproveAll = async () => {
    for (const doc of pending) {
      await handleApprove(doc);
    }
  };

  const handleTriggerRun = async () => {
    setTriggeringRun(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-enrich-knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: '{}',
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast.success(`Enrichissement terminé : ${result.auto_ingested} auto-ingérés, ${result.pending_review} en attente`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
    setTriggeringRun(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <DashboardLayout title="Validation KB" subtitle="Documents en attente de validation">
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate('/admin/organizations')}>
        <ArrowLeft className="h-4 w-4" /> Retour admin
      </Button>

      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-lg px-3 py-1">
            {pending.length} en attente
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <Button variant="outline" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={handleApproveAll}>
              <CheckCircle2 className="h-4 w-4" /> Tout approuver
            </Button>
          )}
          <Button className="gap-2" onClick={handleTriggerRun} disabled={triggeringRun}>
            {triggeringRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Lancer un enrichissement
          </Button>
        </div>
      </div>

      {/* Pending documents */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500 opacity-50" />
            <p className="font-medium">Aucun document en attente</p>
            <p className="text-sm mt-1">Tous les documents ont été traités.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Documents à valider</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Secteur</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Score IA</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium max-w-[250px] truncate">
                      <button onClick={() => setPreviewDoc(doc)} className="text-left hover:text-primary hover:underline">{doc.title}</button>
                    </TableCell>
                    <TableCell className="text-sm">{doc.sector || '—'}</TableCell>
                    <TableCell className="text-sm">{doc.country || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{doc.source || '—'}</TableCell>
                    <TableCell>
                      <Badge className={doc.quality_score >= 7 ? 'bg-emerald-100 text-emerald-700' : doc.quality_score >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                        {doc.quality_score}/10
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(doc.created_at)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewDoc(doc)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => handleApprove(doc)} disabled={!!processing}>
                        {processing === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleReject(doc)} disabled={!!processing}>
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Enrichment history */}
      {runs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" /> Historique des enrichissements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sources rafraîchies</TableHead>
                  <TableHead>Découverts</TableHead>
                  <TableHead>Auto-ingérés</TableHead>
                  <TableHead>En attente</TableHead>
                  <TableHead>Rejetés</TableHead>
                  <TableHead>Coût</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(run => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm">{formatDate(run.run_date)}</TableCell>
                    <TableCell className="text-sm text-center">{run.sources_refreshed}</TableCell>
                    <TableCell className="text-sm text-center">{run.new_discovered}</TableCell>
                    <TableCell className="text-sm text-center text-emerald-600 font-medium">{run.auto_ingested}</TableCell>
                    <TableCell className="text-sm text-center text-amber-600 font-medium">{run.pending_review}</TableCell>
                    <TableCell className="text-sm text-center">{run.rejected}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">${Number(run.cost_usd).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title}</DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge className={previewDoc.quality_score >= 7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                  Score : {previewDoc.quality_score}/10
                </Badge>
                {previewDoc.sector && <Badge variant="secondary">{previewDoc.sector}</Badge>}
                {previewDoc.country && <Badge variant="secondary">{previewDoc.country}</Badge>}
              </div>
              {previewDoc.source && <p className="text-sm text-muted-foreground">Source : {previewDoc.source}</p>}
              {previewDoc.ai_reasoning && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Raisonnement IA :</p>
                  <p className="text-sm">{previewDoc.ai_reasoning}</p>
                </div>
              )}
              <div className="prose prose-sm max-w-none whitespace-pre-wrap bg-white border rounded-lg p-4 text-sm">
                {previewDoc.content}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="gap-2 text-destructive" onClick={() => { handleReject(previewDoc); setPreviewDoc(null); }}>
                  <XCircle className="h-4 w-4" /> Rejeter
                </Button>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => { handleApprove(previewDoc); setPreviewDoc(null); }}>
                  <CheckCircle2 className="h-4 w-4" /> Approuver et intégrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
