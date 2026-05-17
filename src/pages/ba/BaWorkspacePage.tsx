// src/pages/ba/BaWorkspacePage.tsx
// Workspace BA (Partner only) avec onglets internes — pattern aligné PeWorkspacePage.
// Tabs : Mandats (kanban+table) · Candidature · Équipe (membres+bindings).
//
// Routes :
//   /ba?tab=mandats      ← défaut Partner
//   /ba?tab=candidature  ← appel à candidatures
//   /ba?tab=equipe       ← onglet équipe
//
// Analyste & Senior n'arrivent pas ici (redirigés par DashboardLayout vers /ba/pipeline).
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Users, Inbox } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import BaPipelineContent from '@/components/ba/BaPipelineContent';
import EquipeContent from '@/components/ba/EquipeContent';
import CandidatureContent from '@/components/ba/CandidatureContent';

const TABS = [
  { value: 'mandats',     label: 'Mandats',     icon: Briefcase },
  { value: 'candidature', label: 'Candidature', icon: Inbox },
  { value: 'equipe',      label: 'Équipe',      icon: Users },
] as const;

export default function BaWorkspacePage() {
  const { currentOrg } = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'mandats';

  // Normalise un tab inconnu vers mandats (default).
  useEffect(() => {
    const valid = TABS.map(t => t.value as string);
    if (!valid.includes(activeTab)) {
      setSearchParams({ tab: 'mandats' }, { replace: true });
    }
  }, [activeTab, setSearchParams]);

  const subtitle = currentOrg?.name ?? '';

  return (
    <DashboardLayout title="Workspace BA" subtitle={subtitle}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
      >
        <TabsList>
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="mandats" className="mt-4">
          <BaPipelineContent />
        </TabsContent>

        <TabsContent value="candidature" className="mt-4">
          <CandidatureContent />
        </TabsContent>

        <TabsContent value="equipe" className="mt-4">
          <EquipeContent />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
