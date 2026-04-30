import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: 'programme' | 'pe' | 'mixed' | 'banque_affaires' | 'banque';
  country: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  settings: Record<string, any>;
  is_active: boolean;
}

export interface OrgMembership {
  organization: Organization;
  role: string;
}

interface OrganizationContextType {
  // État courant
  currentOrg: Organization | null;
  currentRole: string | null;
  memberships: OrgMembership[];
  isSuperAdmin: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  switchOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const ORG_STORAGE_KEY = 'esono_current_org_id';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, role: authRole, loading: authLoading } = useAuth();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = authRole === 'super_admin';

  const fetchMemberships = useCallback(async () => {
    if (!user?.id) {
      setMemberships([]);
      setCurrentOrg(null);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('organization_members')
        .select(`
          role,
          organizations:organization_id (
            id, name, slug, type, country, logo_url,
            primary_color, secondary_color, settings, is_active
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      const parsed: OrgMembership[] = (data || [])
        .filter((d: any) => d.organizations)
        .map((d: any) => ({
          organization: d.organizations as Organization,
          role: d.role,
        }));

      // Tri par priorité de rôle : owner > admin > manager > coach > analyst > entrepreneur
      // => si l'utilisateur a plusieurs memberships, on privilégie le rôle avec le plus de droits
      const rolePriority: Record<string, number> = {
        owner: 0, admin: 1, manager: 2, coach: 3, analyst: 4, entrepreneur: 5,
      };
      parsed.sort((a, b) => (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99));

      setMemberships(parsed);

      // Sélectionner l'org active : localStorage > premier (= rôle le plus élevé) > aucune
      const savedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
      const savedMembership = savedOrgId ? parsed.find(m => m.organization.id === savedOrgId) : null;
      const activeMembership = savedMembership || parsed[0] || null;

      if (activeMembership) {
        setCurrentOrg(activeMembership.organization);
        setCurrentRole(activeMembership.role);
      } else {
        setCurrentOrg(null);
        setCurrentRole(null);
      }
    } catch (err: any) {
      console.error('[OrgContext] Error fetching memberships:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) {
      fetchMemberships();
    }
    // Ne dépend que de user?.id (string stable) pour éviter les re-fires
    // sur TOKEN_REFRESHED qui réémet un nouvel objet user à chaque retour
    // d'onglet — sinon ça interrompt les générations en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const switchOrganization = useCallback((orgId: string) => {
    const membership = memberships.find(m => m.organization.id === orgId);
    if (membership) {
      setCurrentOrg(membership.organization);
      setCurrentRole(membership.role);
      localStorage.setItem(ORG_STORAGE_KEY, orgId);
    }
  }, [memberships]);

  const refreshOrganizations = useCallback(async () => {
    await fetchMemberships();
  }, [fetchMemberships]);

  return (
    <OrganizationContext.Provider value={{
      currentOrg,
      currentRole,
      memberships,
      isSuperAdmin,
      loading: loading || authLoading,
      error,
      switchOrganization,
      refreshOrganizations,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider');
  return context;
}
