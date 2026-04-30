// DossierWorkspacePage — espace de travail d'un dossier de crédit (segment Banque).
//
// Pattern visuel : reprend la mécanique de la page entreprise du segment Programme
// (DashboardSidebar à gauche, contenu à droite). Phases banque filtrées selon
// le rôle de l'utilisateur via getPhasesForBanqueRole().
//
// Le contenu central change selon `selectedModule` :
//   - 'overview' (défaut) → hub : progression par phase + prochaine étape + activité
//   - 'diagnostic_bancabilite' → DiagnosticBancabiliteViewer existant
//   - autres modules → placeholders avec actions producteur/valideur (à remplir)
//
// Les libellés des phases peuvent être overridés par preset.config_banque.branding
// (ex : "Diagnostic de bancabilité" → "Pré-instruction crédit" pour Atlantique).

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft, ArrowRight, Activity as ActivityIcon, Building2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DiagnosticBancabiliteViewer, { type DiagnosticPayload } from '@/components/banque/DiagnosticBancabiliteViewer';
import CreditReadinessLivrablePanel from '@/components/banque/CreditReadinessLivrablePanel';
import ModeleFinancierViewer from '@/components/banque/ModeleFinancierViewer';
import ProjectionsViewer from '@/components/banque/ProjectionsViewer';
import BPCreditViewer from '@/components/banque/BPCreditViewer';
import PlanFinancementViewer from '@/components/banque/PlanFinancementViewer';
import OrganigrammeViewer from '@/components/banque/OrganigrammeViewer';
import AnalyseCommercialeViewer from '@/components/banque/AnalyseCommercialeViewer';
import BanqueDocumentUploader from '@/components/banque/BanqueDocumentUploader';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getPhasesForBanqueRole, DELIV_TYPE_MAP_BANQUE, PHASES_BANQUE_ALL } from '@/lib/banque-phases';

// Dictionnaire des 6 livrables Credit Readiness — chaque entrée pointe vers
// son deliverable_type (DB), son label et son viewer dédié. Le router edge
// 'generate-credit-readiness' utilise la clé (livrable_code) pour résoudre le prompt.
const CR_LIVRABLES: Record<
  string,
  { deliverableType: string; label: string; emptyHint: string; renderViewer: (data: any) => React.ReactNode }
> = {
  modele_financier: {
    deliverableType: 'credit_readiness_modele_financier',
    label: 'Modèle financier nettoyé',
    emptyHint: "L'IA produit un compte de résultat 3 ans retraité (charges perso DG, conventions règlementées) avec ratios financiers recalculés.",
    renderViewer: (data) => <ModeleFinancierViewer data={data} />,
  },
  projections: {
    deliverableType: 'credit_readiness_projections',
    label: 'Projections financières',
    emptyHint: "L'IA produit des projections sur 5 ans avec 3 scénarios (réaliste / stress / optimiste) et table de sensibilité.",
    renderViewer: (data) => <ProjectionsViewer data={data} />,
  },
  bp_credit: {
    deliverableType: 'credit_readiness_bp_credit',
    label: 'Business plan orienté crédit',
    emptyHint: "Document focalisé sur ce qui justifie l'octroi du crédit : objet, marge additionnelle, pipeline commercial, calendrier.",
    renderViewer: (data) => <BPCreditViewer data={data} />,
  },
  plan_financement: {
    deliverableType: 'credit_readiness_plan_financement',
    label: 'Plan de financement et garanties',
    emptyHint: "Caractéristiques du crédit, échéancier, garanties propres, activation IFC, conditions et frais.",
    renderViewer: (data) => <PlanFinancementViewer data={data} />,
  },
  organigramme: {
    deliverableType: 'credit_readiness_organigramme',
    label: 'Organigramme et gouvernance',
    emptyHint: "Analyse de la solidité organisationnelle : capital, équipe dirigeante, fragilités (homme-clé, DAF, gouvernance), plan de renforcement.",
    renderViewer: (data) => <OrganigrammeViewer data={data} />,
  },
  analyse_commerciale: {
    deliverableType: 'credit_readiness_analyse_commerciale',
    label: 'Analyse commerciale',
    emptyHint: "Portefeuille clients, concentration, géographie, saisonnalité, sensibilité prix mondial, plan de diversification.",
    renderViewer: (data) => <AnalyseCommercialeViewer data={data} />,
  },
};

export default function DossierWorkspacePage() {
  const { id: enterpriseId } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedModule = searchParams.get('module') || 'overview';

  const { role: currentRole } = useCurrentRole();
  const { currentOrg } = useOrganization();

  const [enterprise, setEnterprise] = useState<any>(null);
  const [dossier, setDossier] = useState<any>(null);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [modulesData, setModulesData] = useState<any[]>([]);
  const [preset, setPreset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!enterpriseId) return;
    setLoading(true);
    try {
      const [{ data: ent }, { data: dossiers }, { data: delivs }, { data: mods }] = await Promise.all([
        supabase.from('enterprises').select('*').eq('id', enterpriseId).single(),
        supabase.from('credit_dossiers').select('*').eq('enterprise_id', enterpriseId).order('created_at', { ascending: false }).limit(1),
        supabase.from('deliverables').select('*').eq('enterprise_id', enterpriseId),
        supabase.from('enterprise_modules').select('*').eq('enterprise_id', enterpriseId),
      ]);
      setEnterprise(ent);
      setDossier(dossiers?.[0] || null);
      setDeliverables(delivs || []);
      setModulesData(mods || []);

      if (ent?.organization_id) {
        const { data: pres } = await supabase
          .from('organization_presets')
          .select('config_banque, devise')
          .eq('organization_id', ent.organization_id)
          .maybeSingle();
        setPreset(pres);
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [enterpriseId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Phases adaptées au rôle (override par preset.config_banque.branding pour les libellés)
  const phases = useMemo(() => {
    const base = getPhasesForBanqueRole(currentRole);
    const branding = preset?.config_banque?.branding;
    if (!branding) return base;
    // Override le label de quelques phases si branding présent
    return base.map(p => {
      if (p.id === 'phase_diagnostic' && branding.diagnostic_label) {
        return { ...p, label: branding.diagnostic_label };
      }
      if (p.id === 'phase_credit_readiness' && branding.credit_readiness_label) {
        return { ...p, label: branding.credit_readiness_label };
      }
      return p;
    });
  }, [currentRole, preset]);

  const setSelectedModule = (code: string) => {
    if (code === 'overview') setSearchParams({}, { replace: true });
    else setSearchParams({ module: code }, { replace: true });
  };

  // Diagnostic data pour le viewer
  const diagnostic = useMemo(() => {
    const d = deliverables.find(x => x.type === 'diagnostic_bancabilite');
    if (!d?.data || (d.data as any).status) return null;
    return d.data as DiagnosticPayload;
  }, [deliverables]);

  if (loading) {
    return (
      <DashboardLayout title="Dossier" subtitle="">
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
          <Button onClick={() => nav('/banque/pipeline')} className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour au pipeline
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={enterprise.name}
      subtitle={`${enterprise.sector || '—'} · ${enterprise.country || '—'}${dossier?.numero ? ` · ${dossier.numero}` : ''}`}
    >
      {/* Bandeau action retour + métadonnées */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button variant="outline" onClick={() => nav('/banque/pipeline')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour au pipeline
        </Button>
        {dossier?.numero && (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            {dossier.numero}
          </Badge>
        )}
        {dossier?.classification_diagnostic && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            {dossier.classification_diagnostic}
          </Badge>
        )}
        {dossier?.montant_demande && (
          <span className="text-sm text-muted-foreground">
            Demande : <strong>{Math.round(dossier.montant_demande / 1_000_000)}M {dossier.devise || ''}</strong>
          </span>
        )}
      </div>

      {/* ===== Sidebar + Contenu ===== */}
      <div className="flex border rounded-lg overflow-hidden bg-card min-h-[600px]">
        {/* Sidebar (réutilisée du segment Programme avec phases banque) */}
        <div className="w-64 shrink-0 border-r bg-card">
          <DashboardSidebar
            enterprise={enterprise}
            deliverables={deliverables}
            modules={modulesData}
            selectedModule={selectedModule}
            onSelectModule={setSelectedModule}
            onGenerateAll={() => {/* TODO: pipeline auto */}}
            generating={false}
            globalScore={0}
            hideActions={true}
            phases={phases}
            deliverableTypeMap={DELIV_TYPE_MAP_BANQUE}
          />
        </div>

        {/* Contenu central */}
        <div className="flex-1 min-w-0 p-6 overflow-y-auto">
          {selectedModule === 'overview' && (
            <OverviewHub
              enterprise={enterprise}
              dossier={dossier}
              deliverables={deliverables}
              phases={phases}
              onSelectModule={setSelectedModule}
              orgName={currentOrg?.name}
            />
          )}

          {selectedModule === 'diagnostic_bancabilite' && (
            <DiagnosticPanel
              enterpriseId={enterprise.id}
              diagnostic={diagnostic}
              onRefresh={fetchAll}
            />
          )}

          {/* Livrables Credit Readiness — workflow producteur/valideur unifié via le router */}
          {CR_LIVRABLES[selectedModule] && (() => {
            const def = CR_LIVRABLES[selectedModule];
            return (
              <CreditReadinessLivrablePanel
                enterpriseId={enterprise.id}
                deliverableType={def.deliverableType}
                livrableCode={selectedModule}
                livrableLabel={def.label}
                emptyHint={def.emptyHint}
                renderViewer={def.renderViewer}
              />
            );
          })()}

          {selectedModule === 'matching' && <ComingSoonPanel moduleCode="matching" roleHint={currentRole} />}
          {selectedModule === 'note_credit' && <ComingSoonPanel moduleCode="note_credit" roleHint={currentRole} />}
          {selectedModule === 'monitoring' && <ComingSoonPanel moduleCode="monitoring" roleHint={currentRole} />}

          {/* Upload — drag-and-drop avec parsing Railway, alimente enterprise.document_content */}
          {selectedModule === 'upload' && (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Pièces du dossier</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Déposez les pièces du dossier (liasses, relevés bancaires, statuts, contrats, RCCM).
                  Elles sont parsées et alimentent le contexte lu par l'IA pour produire les livrables.
                </p>
              </div>
              <BanqueDocumentUploader enterpriseId={enterprise.id} onComplete={fetchAll} />
            </div>
          )}

          {['coach_info','sources'].includes(selectedModule) && (
            <ComingSoonPanel moduleCode={selectedModule} roleHint={currentRole} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Hub par défaut (overview)
// ───────────────────────────────────────────────────────────────────────────

function OverviewHub({
  enterprise, dossier, deliverables, phases, onSelectModule, orgName,
}: {
  enterprise: any;
  dossier: any;
  deliverables: any[];
  phases: any[];
  onSelectModule: (m: string) => void;
  orgName?: string;
}) {
  // Calcul progression par phase
  const phaseStats = phases.map(p => {
    const total = p.modules.length;
    const done = p.modules.filter((m: any) => {
      const t = DELIV_TYPE_MAP_BANQUE[m.code];
      return t && deliverables.some(d => d.type === t && !(d.data as any)?.status);
    }).length;
    return { phase: p, total, done };
  });

  const totalDone = phaseStats.reduce((s, x) => s + x.done, 0);
  const totalAll = phaseStats.reduce((s, x) => s + x.total, 0);
  const totalPct = totalAll === 0 ? 0 : Math.round((totalDone / totalAll) * 100);

  // Prochaine étape : 1ère phase non complétée
  const nextStep = phaseStats.find(x => x.done < x.total);
  const nextModule = nextStep?.phase.modules.find((m: any) => {
    const t = DELIV_TYPE_MAP_BANQUE[m.code];
    return !t || !deliverables.some(d => d.type === t && !(d.data as any)?.status);
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-2xl font-display font-semibold">{enterprise.name}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {enterprise.sector || '—'} · {enterprise.country || '—'}{orgName ? ` · ${orgName}` : ''}
        </p>
        {(enterprise.source_acquisition || dossier?.metadata?.canal) && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            Source : {enterprise.source_acquisition || dossier?.metadata?.canal}
          </p>
        )}
      </div>

      {/* Progression par phase */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Progression par phase</h3>
        <div className="space-y-3">
          {phaseStats.map(({ phase, done, total }) => (
            <div key={phase.id}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{phase.label}</span>
                <span className="font-medium">{done}/{total}</span>
              </div>
              <Progress value={total === 0 ? 0 : (done / total) * 100} className="h-1.5" />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
          <strong className="text-foreground">{totalPct}% complété</strong> · {totalDone}/{totalAll} livrables produits
        </div>
      </Card>

      {/* Prochaine étape */}
      {nextStep && nextModule && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-2">Prochaine étape recommandée</h3>
          <button
            onClick={() => onSelectModule(nextModule.code)}
            className="w-full flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <nextModule.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium">{nextModule.label}</div>
                <div className="text-xs text-muted-foreground">{nextStep.phase.label}</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Card>
      )}

      {/* Activité récente — placeholder pour l'instant */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-2">Activité récente</h3>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <ActivityIcon className="h-3.5 w-3.5" />
          {deliverables.length === 0 ? 'Aucune activité enregistrée' : `${deliverables.length} livrable${deliverables.length > 1 ? 's' : ''} produit${deliverables.length > 1 ? 's' : ''}`}
        </div>
      </Card>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Panneau Diagnostic (réutilise le viewer existant)
// ───────────────────────────────────────────────────────────────────────────

function DiagnosticPanel({
  enterpriseId, diagnostic, onRefresh,
}: {
  enterpriseId: string;
  diagnostic: DiagnosticPayload | null;
  onRefresh: () => void;
}) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke('generate-diagnostic-bancabilite', {
        body: { enterprise_id: enterpriseId },
      });
      if (error) throw error;
      toast({ title: 'Génération lancée', description: 'Le diagnostic est en cours de calcul.' });
      // Polling minimal — refetch dans 5s, puis l'user peut rafraîchir
      setTimeout(onRefresh, 5000);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  if (!diagnostic) {
    return (
      <Card className="p-12 text-center">
        <div className="text-sm font-medium">Aucun diagnostic généré pour ce dossier</div>
        <div className="text-xs text-muted-foreground mt-1 mb-4">
          Lance une analyse pour évaluer la bancabilité de la PME selon les critères de la banque.
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Lancer le diagnostic
        </Button>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold">Diagnostic de bancabilité</h2>
          <p className="text-xs text-muted-foreground">
            Classification : <strong>{diagnostic.synthese?.classification_label}</strong>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Regénérer
        </Button>
      </div>
      <DiagnosticBancabiliteViewer data={diagnostic} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Placeholder pour les modules pas encore implémentés
// ───────────────────────────────────────────────────────────────────────────

function ComingSoonPanel({ moduleCode, roleHint }: { moduleCode: string; roleHint: string | null }) {
  const mod = PHASES_BANQUE_ALL.flatMap(p => p.modules).find(m => m.code === moduleCode);
  return (
    <Card className="p-12 text-center">
      <div className="rounded-md bg-muted/50 inline-flex p-3 mb-3">
        {mod ? <mod.icon className="h-6 w-6 text-muted-foreground" /> : null}
      </div>
      <div className="text-sm font-semibold">{mod?.label || moduleCode}</div>
      <div className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
        Cet écran sera disponible au prochain sprint. Le workflow producteur/valideur
        ({roleHint === 'analyste_credit' || roleHint === 'directeur_pme' ? 'vous validerez ce livrable' : 'vous produirez ce livrable'})
        s'inscrira ici.
      </div>
    </Card>
  );
}
