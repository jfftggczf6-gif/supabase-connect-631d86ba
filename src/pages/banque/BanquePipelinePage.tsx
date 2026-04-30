// BanquePipelinePage — Pipeline kanban du segment Banque.
//
// La vue est piloté par le RÔLE RÉEL de l'utilisateur (lu via useCurrentRole) :
//   - conseiller_pme  → voit ses dossiers, kanban réduit (5 colonnes typ.)
//   - analyste_credit → voit les dossiers de ses équipes (8-9 typ.), kanban étendu
//   - directeur_pme   → voit toute l'org, kanban complet (8 colonnes typ.)
//
// Le filtrage dossiers est fait CÔTÉ BASE par la RLS — le frontend ne s'en
// préoccupe pas. Le frontend choisit juste quelles colonnes afficher selon
// le rôle (config_banque.pipeline_views_per_role[rôle]).
//
// Mapping rôle → vue : si role est une clé de pipeline_views_per_role, utilisé tel quel.
// Sinon (owner/admin/manager) on retombe sur la "vue large" (dernière du mapping = directeur typ.).

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useSegment } from '@/hooks/useSegment';

interface DossierRow {
  id: string;
  numero: string | null;
  montant_demande: number | null;
  devise: string | null;
  pipeline_status: string;
  classification_diagnostic: string | null;
  classification_monitoring: string | null;
  encours_actuel: number | null;
  retard_jours: number | null;
  metadata: any;
  enterprise: { id: string; name: string; sector: string | null; source_acquisition: string | null } | null;
}

interface KanbanColumnDef {
  label: string;
  statuts: string[];
  color?: string;
}

const ROLE_DISPLAY_HEX: Record<string, string> = {
  indigo: '#EEEDFE',
  amber: '#FEF3C7',
  purple: '#EDE9FE',
  teal: '#CCFBF1',
  green: '#DCFCE7',
  red: '#FEE2E2',
  neutral: '#F3F4F6',
};

const ROLE_TEXT_HEX: Record<string, string> = {
  indigo: '#3F51B5',
  amber: '#92400E',
  purple: '#7F77DD',
  teal: '#0F766E',
  green: '#15803D',
  red: '#991B1B',
  neutral: '#6B7280',
};

function formatMoney(amount: number | null, devise: string | null) {
  if (!amount) return '—';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} Mds ${devise || ''}`.trim();
  if (amount >= 1_000_000) return `${Math.round(amount / 1_000_000)}M ${devise || ''}`.trim();
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K ${devise || ''}`.trim();
  return `${amount} ${devise || ''}`.trim();
}

export default function BanquePipelinePage() {
  const nav = useNavigate();
  const segment = useSegment();
  const { currentOrg } = useOrganization();
  const { role: currentRole } = useCurrentRole();

  const [loading, setLoading] = useState(true);
  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [preset, setPreset] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const [{ data: dossRows, error: dossErr }, { data: pres, error: presErr }] = await Promise.all([
        supabase
          .from('credit_dossiers')
          // RLS filtre déjà par rôle ; on récupère ce que l'user a le droit de voir.
          .select('id, numero, montant_demande, devise, pipeline_status, classification_diagnostic, classification_monitoring, encours_actuel, retard_jours, metadata, enterprise:enterprises(id, name, sector, source_acquisition)')
          .eq('organization_id', currentOrg.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('organization_presets')
          .select('config_banque, devise')
          .eq('organization_id', currentOrg.id)
          .maybeSingle(),
      ]);
      if (dossErr) throw dossErr;
      if (presErr) throw presErr;
      setDossiers((dossRows || []) as any);
      setPreset(pres);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cb = preset?.config_banque || {};
  const pipelineViews: Record<string, KanbanColumnDef[]> = cb.pipeline_views_per_role || {};
  const rolesLabels: Record<string, string> = cb.roles_labels || {};
  const canaux: any[] = cb.canaux_acquisition || [];
  const branding = cb.branding || {};

  // Mapping rôle réel → vue kanban
  // - Si le rôle est une clé directe → on prend cette vue
  // - Sinon (owner/admin/manager pas spécifique banque) → on prend la "vue la plus large"
  //   (= la dernière dans pipeline_views_per_role, qui est typiquement directeur)
  const viewKey = useMemo(() => {
    const keys = Object.keys(pipelineViews);
    if (!keys.length) return null;
    if (currentRole && pipelineViews[currentRole]) return currentRole;
    return keys[keys.length - 1];
  }, [pipelineViews, currentRole]);

  const currentColumns: KanbanColumnDef[] = useMemo(() => {
    if (!viewKey || !pipelineViews[viewKey]) return [];
    return pipelineViews[viewKey];
  }, [viewKey, pipelineViews]);

  const canauxCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of dossiers) {
      const canal = d.enterprise?.source_acquisition || d.metadata?.canal;
      if (canal) counts[canal] = (counts[canal] || 0) + 1;
    }
    return counts;
  }, [dossiers]);

  const dossiersByColumn = useMemo(() => {
    const map = new Map<string, DossierRow[]>();
    for (const col of currentColumns) {
      map.set(col.label, dossiers.filter(d => col.statuts.includes(d.pipeline_status)));
    }
    return map;
  }, [currentColumns, dossiers]);

  // Garde : org non banque
  if (currentOrg && currentOrg.type !== 'banque') {
    return (
      <DashboardLayout title="Pipeline" subtitle="">
        <Card className="p-12 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm font-medium">Cette vue est réservée au segment Banque.</div>
          <div className="text-xs text-muted-foreground mt-1">
            L'organisation courante est de type <strong>{currentOrg.type}</strong>.
          </div>
          <Button onClick={() => nav('/programmes')} className="mt-4">Retour aux programmes</Button>
        </Card>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Pipeline" subtitle="">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!preset?.config_banque) {
    return (
      <DashboardLayout title="Pipeline" subtitle={currentOrg?.name}>
        <Card className="p-12 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
          <div className="text-sm font-medium">Preset banque non configuré pour cette organisation.</div>
          <div className="text-xs text-muted-foreground mt-1">
            Charge un preset (ex: <code>preset_nsia.json</code>) avant d'utiliser le pipeline.
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  // Libellé du rôle vu (depuis preset.roles_labels). Si le rôle réel n'est pas
  // un rôle banque (owner/admin), on affiche le rôle générique.
  const myRoleLabel = (currentRole && rolesLabels[currentRole]) || rolesLabels[viewKey || ''] || currentRole || 'Membre';

  return (
    <DashboardLayout
      title="Pipeline"
      subtitle={`${dossiers.length} dossier${dossiers.length > 1 ? 's' : ''} dans votre périmètre`}
    >
      {/* Bandeau identité utilisateur (rôle banque) — pas de switcher */}
      <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span>Vue <strong className="text-foreground">{myRoleLabel}</strong> · {currentOrg?.name}</span>
      </div>

      {/* Bandeau sources d'acquisition (configurable, change par banque) */}
      {canaux.length > 0 && (
        <Card className="p-3 mb-4 border-l-4" style={{ borderLeftColor: ROLE_TEXT_HEX.indigo }}>
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-semibold">Sources des dossiers ({segment.label})</div>
            <div className="text-[10px] text-muted-foreground">{dossiers.length} dossiers · {canaux.length} canaux</div>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${canaux.length}, minmax(0, 1fr))` }}>
            {canaux.map((c: any) => (
              <div key={c.code} className="rounded-md bg-muted/40 p-2 text-center">
                <div className="text-base font-semibold" style={{ color: ROLE_TEXT_HEX.indigo }}>
                  {canauxCounts[c.code] || 0}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">{c.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Kanban */}
      <div className="grid gap-2 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${currentColumns.length}, minmax(140px, 1fr))` }}>
        {currentColumns.map(col => {
          const dossiersInCol = dossiersByColumn.get(col.label) || [];
          const bgHex = ROLE_DISPLAY_HEX[col.color || 'neutral'] || ROLE_DISPLAY_HEX.neutral;
          const txHex = ROLE_TEXT_HEX[col.color || 'neutral'] || ROLE_TEXT_HEX.neutral;
          return (
            <div key={col.label} className="rounded-md p-2 min-h-[200px]" style={{ background: bgHex }}>
              <div className="text-[11px] font-semibold mb-2" style={{ color: txHex }}>
                {col.label} ({dossiersInCol.length})
              </div>
              <div className="space-y-1.5">
                {dossiersInCol.map(d => {
                  const e = d.enterprise;
                  const sourceCode = e?.source_acquisition || d.metadata?.canal;
                  const sourceLabel = canaux.find((c: any) => c.code === sourceCode)?.label;
                  return (
                    <button
                      key={d.id}
                      onClick={() => nav(`/banque/dossiers/${e?.id}`)}
                      className="w-full text-left rounded bg-background border hover:shadow-md transition-shadow p-2"
                      style={{ borderLeft: `2px solid ${txHex}` }}
                    >
                      <div className="text-xs font-semibold leading-tight">{e?.name || 'Sans nom'}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {formatMoney(d.montant_demande, d.devise)}
                        {sourceLabel && ` · ${sourceLabel}`}
                      </div>
                      {d.classification_monitoring && (
                        <Badge
                          variant="outline"
                          className="text-[9px] mt-1"
                          style={d.classification_monitoring === 'pre_douteux' || d.classification_monitoring === 'douteux'
                            ? { background: ROLE_DISPLAY_HEX.red, color: ROLE_TEXT_HEX.red, borderColor: ROLE_TEXT_HEX.red }
                            : d.classification_monitoring === 'alerte'
                            ? { background: ROLE_DISPLAY_HEX.amber, color: ROLE_TEXT_HEX.amber, borderColor: ROLE_TEXT_HEX.amber }
                            : { background: ROLE_DISPLAY_HEX.green, color: ROLE_TEXT_HEX.green, borderColor: ROLE_TEXT_HEX.green }
                          }
                        >
                          {d.classification_monitoring}
                          {d.retard_jours ? ` ${d.retard_jours}j` : ''}
                        </Badge>
                      )}
                      {d.numero && (
                        <div className="text-[9px] text-muted-foreground mt-0.5">{d.numero}</div>
                      )}
                    </button>
                  );
                })}
                {dossiersInCol.length === 0 && (
                  <div className="text-center text-[10px] text-muted-foreground py-2">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Discret : branding */}
      {(branding.diagnostic_label || branding.matching_label) && (
        <div className="mt-4 text-[10px] text-muted-foreground">
          Vocabulaire : {branding.diagnostic_label} · {branding.credit_readiness_label} · {(branding.matching_label || '').replace('{{org.short_name}}', currentOrg?.name || '')}
        </div>
      )}
    </DashboardLayout>
  );
}
