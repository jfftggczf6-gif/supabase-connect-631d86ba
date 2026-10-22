/**
 * Helpers pour résoudre le rôle effectif d'un utilisateur
 * en combinant l'ancien système (user_roles) et le nouveau (organization_members).
 *
 * Utilisé par toutes les edge functions qui font de l'autorisation
 * pour éviter les 403 sur les nouveaux rôles d'org (owner/admin/manager).
 */

export interface EffectiveRoles {
  legacyRoles: string[];             // TOUS les rôles historiques du compte (user_roles)
  userRole: string | null;           // Premier rôle historique — conservé par compatibilité
  orgRole: string | null;            // Rôle dans l'org active (organization_members)
  organizationId: string | null;     // ID de l'org active
  isSuperAdmin: boolean;
  isChefProg: boolean;               // chef_programme OU owner/admin/manager d'une org
  isCoach: boolean;                  // coach OU coach/analyst d'une org
  isOwnerOrAdmin: boolean;           // owner ou admin d'une org (gestion totale de l'org)
}

/**
 * Résout les rôles effectifs d'un utilisateur.
 * @param supabase - client Supabase (service role)
 * @param userId - ID du user authentifié
 * @param overrideOrgId - si fourni, utilise cette org au lieu de la première active
 */
export async function resolveEffectiveRoles(
  supabase: any,
  userId: string,
  overrideOrgId?: string | null
): Promise<EffectiveRoles> {
  const [roleRes, orgRes] = await Promise.all([
    // Pas de .maybeSingle() ici : un compte peut porter PLUSIEURS rôles historiques
    // (18 cas en production). maybeSingle() échoue alors et renvoie data: null, ce qui
    // effaçait silencieusement tous les droits hérités de l'ancien système.
    supabase.from("user_roles").select("role").eq("user_id", userId),
    overrideOrgId
      ? supabase
          .from("organization_members")
          .select("organization_id, role")
          .eq("user_id", userId)
          .eq("organization_id", overrideOrgId)
          .eq("is_active", true)
          .maybeSingle()
      : supabase
          .from("organization_members")
          .select("organization_id, role")
          .eq("user_id", userId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
  ]);

  const legacyRoles: string[] = (roleRes?.data || [])
    .map((r: any) => r?.role)
    .filter((r: any): r is string => typeof r === "string");
  const userRole = legacyRoles[0] || null;
  const orgRole = orgRes?.data?.role || null;
  const organizationId = orgRes?.data?.organization_id || overrideOrgId || null;

  const isSuperAdmin = legacyRoles.includes("super_admin");
  const isOwnerOrAdmin = orgRole === "owner" || orgRole === "admin";
  const isChefProg =
    legacyRoles.includes("chef_programme") ||
    orgRole === "owner" ||
    orgRole === "admin" ||
    orgRole === "manager";
  const isCoach =
    legacyRoles.includes("coach") ||
    orgRole === "coach" ||
    orgRole === "analyst";

  return { legacyRoles, userRole, orgRole, organizationId, isSuperAdmin, isChefProg, isCoach, isOwnerOrAdmin };
}

/**
 * Helper canManage : un utilisateur peut-il gérer (update/publish/delete) une ressource liée à une org ?
 * - super_admin : tout
 * - owner/admin de l'org : toutes les ressources de leur org
 * - manager/chef_programme legacy : uniquement si ils en sont le chef (chef_programme_id === user.id)
 */
export function canManageResource(
  roles: EffectiveRoles,
  resource: { chef_programme_id?: string | null; organization_id?: string | null; created_by?: string | null },
  userId: string
): boolean {
  if (roles.isSuperAdmin) return true;
  if (roles.isOwnerOrAdmin && roles.organizationId && resource.organization_id === roles.organizationId) return true;
  if (roles.isChefProg && resource.chef_programme_id === userId) return true;
  if (roles.isChefProg && resource.created_by === userId) return true;
  return false;
}
