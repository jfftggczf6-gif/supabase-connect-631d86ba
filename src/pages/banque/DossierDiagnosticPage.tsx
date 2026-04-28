// DossierDiagnosticPage — segment Banque
//
// Page d'un dossier de crédit, onglet "Diagnostic de bancabilité".
// Le segment, le vocabulaire et les libellés (classification, plan) viennent
// du preset de l'org via useSegment + organization_presets — aucune valeur
// banque hardcodée.

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, RefreshCw, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSegment } from '@/hooks/useSegment';
import DiagnosticBancabiliteViewer, { type DiagnosticPayload } from '@/components/banque/DiagnosticBancabiliteViewer';
import DossierFlowNav from '@/components/banque/DossierFlowNav';

export default function DossierDiagnosticPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const segment = useSegment();

  const [enterprise, setEnterprise] = useState<any>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticPayload | null>(null);
  const [preset, setPreset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: ent } = await supabase.from('enterprises').select('*').eq('id', id).single();
      setEnterprise(ent);

      const [{ data: deliv }, { data: pres }] = await Promise.all([
        supabase.from('deliverables').select('data').eq('enterprise_id', id).eq('type', 'diagnostic_bancabilite').maybeSingle(),
        ent?.organization_id
          ? supabase.from('organization_presets').select('config_banque, devise').eq('organization_id', ent.organization_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setPreset(pres);
      const data = deliv?.data as any;
      if (data && !data.status) {
        setDiagnostic(data as DiagnosticPayload);
      } else if (data?.status === 'processing') {
        setDiagnostic(null);
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Polling léger pendant la génération (toutes les 5s, max 5 min)
  useEffect(() => {
    if (!generating) return;
    const start = Date.now();
    const poll = setInterval(async () => {
      if (!id) return;
      const { data: deliv } = await supabase
        .from('deliverables')
        .select('data')
        .eq('enterprise_id', id)
        .eq('type', 'diagnostic_bancabilite')
        .maybeSingle();
      const data = deliv?.data as any;
      if (data && !data.status) {
        setDiagnostic(data as DiagnosticPayload);
        setGenerating(false);
        clearInterval(poll);
        toast({ title: 'Diagnostic prêt', description: 'Le diagnostic de bancabilité a été généré.' });
      } else if (data?.status === 'error') {
        setGenerating(false);
        clearInterval(poll);
        toast({ title: 'Erreur', description: data.error || 'Échec de la génération', variant: 'destructive' });
      } else if (Date.now() - start > 5 * 60 * 1000) {
        setGenerating(false);
        clearInterval(poll);
        toast({ title: 'Timeout', description: 'La génération prend plus de temps que prévu.', variant: 'destructive' });
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [generating, id]);

  const handleGenerate = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke('generate-diagnostic-bancabilite', {
        body: { enterprise_id: id },
      });
      if (error) throw error;
      toast({ title: 'Génération lancée', description: 'Le diagnostic est en cours de calcul.' });
    } catch (e: any) {
      setGenerating(false);
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  // Libellés depuis le preset (config_banque.branding) — fallback sur libellés génériques
  const branding = preset?.config_banque?.branding;
  const diagnosticLabel = branding?.diagnostic_label || 'Diagnostic de bancabilité';

  if (loading) {
    return (
      <DashboardLayout title={diagnosticLabel} subtitle="">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!enterprise) {
    return (
      <DashboardLayout title="Dossier introuvable" subtitle="">
        <div className="text-center py-20 text-muted-foreground">
          <p>Ce dossier n'existe pas ou vous n'y avez pas accès.</p>
          <Button onClick={() => nav(-1)} className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={diagnosticLabel} subtitle={enterprise.name}>
      {/* Flow-nav adaptative — masque automatiquement les écrans non autorisés */}
      <DossierFlowNav
        enterpriseId={enterprise.id}
        configBanque={preset?.config_banque}
        viewAs={null}
        currentScreenCode="diagnostic"
      />

      {/* En-tête du dossier */}
      <Card className="p-4 mb-4 flex justify-between items-start flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{diagnosticLabel}</span>
            {diagnostic?.synthese?.classification_label && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                {diagnostic.synthese.classification_label}
              </Badge>
            )}
          </div>
          <div className="text-lg font-semibold">{enterprise.name}</div>
          <div className="text-sm text-muted-foreground">
            {enterprise.sector || '—'} · {enterprise.country || '—'}
            {enterprise.source_acquisition && ` · Source : ${enterprise.source_acquisition}`}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {diagnostic ? 'Regénérer' : 'Lancer le diagnostic'}
          </Button>
        </div>
      </Card>

      {/* Affichage diagnostic */}
      {generating && !diagnostic && (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
          <div className="text-sm font-medium">Génération du diagnostic en cours…</div>
          <div className="text-xs text-muted-foreground mt-1">Cela peut prendre 1 à 2 minutes.</div>
        </Card>
      )}

      {!generating && !diagnostic && (
        <Card className="p-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm font-medium">Aucun diagnostic généré pour ce dossier</div>
          <div className="text-xs text-muted-foreground mt-1">
            Lance une analyse pour évaluer la bancabilité de la PME selon les critères {segment.label}.
          </div>
          <Button onClick={handleGenerate} className="mt-4 gap-2">
            <RefreshCw className="h-4 w-4" /> Lancer le diagnostic
          </Button>
        </Card>
      )}

      {diagnostic && <DiagnosticBancabiliteViewer data={diagnostic} />}
    </DashboardLayout>
  );
}
