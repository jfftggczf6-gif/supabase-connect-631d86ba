// src/pages/ba/BaWorkspacePage.tsx
// Workspace BA — route unique /ba pour TOUS les rôles BA (Partner / Senior / Analyste).
// Filtrage des tabs selon le rôle :
//   - Partner (owner/admin/managing_director) : 5 tabs (Synthèse · Mandats · Candidature · Équipe · Paramètres)
//   - Senior (investment_manager)             : 1 tab  (Mandats — TabsList cachée)
//   - Analyste                                 : 1 tab  (Mandats — TabsList cachée)
//
// Routes :
//   /ba                  ← default (synthese pour Partner, mandats pour autres)
//   /ba?tab=mandats      ← pipeline (kanban + table, filtré par rôle dans BaPipelineContent)
//   /ba?tab=synthese     ← Partner only
//   /ba?tab=candidature  ← Partner only
//   /ba?tab=equipe       ← Partner only
//   /ba?tab=parametres   ← Partner only
//
// Rétro-compat : /ba/pipeline redirige vers /ba?tab=mandats (cf. App.tsx).

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Users, Inbox, Settings, LayoutDashboard } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import BaPipelineContent from '@/components/ba/BaPipelineContent';
import EquipeContent from '@/components/ba/EquipeContent';
import CandidatureContent from '@/components/ba/CandidatureContent';
import ParametresContent from '@/components/ba/parametres/ParametresContent';
import SyntheseContent from '@/components/ba/synthese/SyntheseContent';

const PARTNER_ROLES = ['owner', 'admin', 'managing_director'];

const ALL_TABS = [
  { value: 'synthese',    label: 'Synthèse',    icon: LayoutDashboard, partnerOnly: true  },
  { value: 'mandats',     label: 'Mandats',     icon: Briefcase,       partnerOnly: false },
  { value: 'candidature', label: 'Candidature', icon: Inbox,           partnerOnly: true  },
  { value: 'equipe',      label: 'Équipe',      icon: Users,           partnerOnly: true  },
  { value: 'parametres',  label: 'Paramètres',  icon: Settings,        partnerOnly: true  },
] as const;

export default function BaWorkspacePage() {
  const { currentOrg } = useOrganization();
  const { role, isSuperAdmin } = useCurrentRole();
  const [searchParams, setSearchParams] = useSearchParams();

  const isPartner = isSuperAdmin || PARTNER_ROLES.includes(role || '');

  // Tabs accessibles à ce rôle.
  const tabs = useMemo(
    () => ALL_TABS.filter(t => !t.partnerOnly || isPartner),
    [isPartner],
  );

  // Default tab : Synthèse pour Partner, Mandats pour Senior/Analyste.
  const defaultTab = isPartner ? 'synthese' : 'mandats';
  const activeTab = searchParams.get('tab') || defaultTab;

  // Si l'utilisateur tente un tab qu'il n'a pas le droit de voir, on retombe sur default.
  useEffect(() => {
    const validValues = tabs.map(t => t.value as string);
    if (!validValues.includes(activeTab)) {
      setSearchParams({ tab: defaultTab }, { replace: true });
    }
  }, [activeTab, tabs, defaultTab, setSearchParams]);

  const subtitle = currentOrg?.name ?? '';
  const showTabsList = tabs.length > 1;

  return (
    <DashboardLayout title="Workspace BA" subtitle={subtitle}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
      >
        {showTabsList && (
          <TabsList>
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                  <Icon className="h-3.5 w-3.5" /> {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        )}

        <TabsContent value="synthese" className={showTabsList ? 'mt-4' : 'mt-0'}>
          <SyntheseContent />
        </TabsContent>

        <TabsContent value="mandats" className={showTabsList ? 'mt-4' : 'mt-0'}>
          <BaPipelineContent />
        </TabsContent>

        <TabsContent value="candidature" className={showTabsList ? 'mt-4' : 'mt-0'}>
          <CandidatureContent />
        </TabsContent>

        <TabsContent value="equipe" className={showTabsList ? 'mt-4' : 'mt-0'}>
          <EquipeContent />
        </TabsContent>

        <TabsContent value="parametres" className={showTabsList ? 'mt-4' : 'mt-0'}>
          <ParametresContent />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
