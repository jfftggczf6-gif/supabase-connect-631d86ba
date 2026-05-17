// src/components/ba/parametres/ParametresContent.tsx
// Contenu pur de la page Paramètres BA (sans DashboardLayout).
// Réutilisable dans le tab Paramètres du BaWorkspacePage et dans la route
// standalone /ba/parametres.

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Loader2, Building2, Globe, Target, Sparkles } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useParametresBa } from '@/hooks/useParametresBa';
import FundIdentitySection from './FundIdentitySection';
import DeviseFormatsSection from './DeviseFormatsSection';
import CriteresSection from './CriteresSection';
import TheseSection from './TheseSection';

const TABS = [
  { code: 'fonds',    label: 'Identité',    Icon: Building2 },
  { code: 'devise',   label: 'Devise',      Icon: Globe },
  { code: 'criteres', label: 'Critères',    Icon: Target },
  { code: 'these',    label: 'Thèse',       Icon: Sparkles },
] as const;

export default function ParametresContent() {
  const { currentOrg } = useOrganization();
  const { data, loading, saving, error, saveSection } = useParametresBa(currentOrg?.id);
  const [active, setActive] = useState<string>('fonds');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {error && (
        <Card className="p-3 mb-4 bg-rose-50 border-rose-200 text-rose-700 text-xs">
          {error}
        </Card>
      )}

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="grid grid-cols-4 max-w-2xl mb-4">
          {TABS.map(t => {
            const Icon = t.Icon;
            return (
              <TabsTrigger key={t.code} value={t.code} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="fonds">
          {currentOrg && (
            <FundIdentitySection
              organizationId={currentOrg.id}
              value={data.fund_identity}
              saving={saving}
              onSave={(next) => saveSection('fund_identity', next)}
            />
          )}
        </TabsContent>

        <TabsContent value="devise">
          <DeviseFormatsSection
            value={data.devise_formats}
            saving={saving}
            onSave={(next) => saveSection('devise_formats', next)}
          />
        </TabsContent>

        <TabsContent value="criteres">
          <CriteresSection
            value={data.investment_criteria}
            saving={saving}
            onSave={(next) => saveSection('investment_criteria', next)}
          />
        </TabsContent>

        <TabsContent value="these">
          <TheseSection
            value={data.investment_thesis}
            saving={saving}
            onSave={(next) => saveSection('investment_thesis', next)}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
