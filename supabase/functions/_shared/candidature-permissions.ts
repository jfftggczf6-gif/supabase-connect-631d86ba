// Permission d'écriture sur les candidatures d'un programme (envoi de lien de
// complétion, changement de statut, assignation coach, etc.).
//
// SOURCE UNIQUE de la règle, pour éviter la divergence qui a causé le bug
// « Accès refusé » : un admin d'organisation (ex. Nathalie chez OVO) pouvait
// VOIR une candidature (get-candidature-detail l'autorisait) mais pas AGIR
// dessus, car candidature-recovery / update-candidature ne testaient que
// user_roles ∈ {super_admin, chef_programme} en ignorant organization_members.
//
// Règle (alignée sur l'accès en lecture de get-candidature-detail, bornée à
// l'organisation propriétaire du programme → multi-tenant respecté) :
//   super_admin (global)
//   OU chef_programme PROPRIÉTAIRE du programme
//   OU owner/admin/manager de l'ORGANISATION propriétaire du programme.

export interface ProgrammeRef {
  organization_id?: string | null;
  chef_programme_id?: string | null;
}

export interface CandidatureManageContext {
  userId: string;
  superAdmin: boolean;
  chefProgramme: boolean;
  /** Organisations où l'utilisateur est owner/admin/manager (membre actif). */
  mgmtOrgIds: Set<string>;
}

/** Charge le contexte de rôles UNE fois (2 requêtes), réutilisable pour N programmes. */
export async function loadCandidatureManageContext(
  adminClient: any,
  userId: string,
): Promise<CandidatureManageContext> {
  const [{ data: roleData }, { data: orgMems }] = await Promise.all([
    adminClient.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    adminClient.from("organization_members")
      .select("role, organization_id").eq("user_id", userId).eq("is_active", true),
  ]);
  const mgmtOrgIds = new Set<string>(
    (orgMems || [])
      .filter((m: any) => ["owner", "admin", "manager"].includes(m.role) && m.organization_id)
      .map((m: any) => m.organization_id as string),
  );
  return {
    userId,
    superAdmin: roleData?.role === "super_admin",
    chefProgramme: roleData?.role === "chef_programme",
    mgmtOrgIds,
  };
}

/** Décision synchrone : cet utilisateur peut-il gérer les candidatures de CE programme ? */
export function canManageProgrammeCandidatures(
  ctx: CandidatureManageContext,
  programme: ProgrammeRef | null | undefined,
): boolean {
  if (!programme) return false;
  if (ctx.superAdmin) return true;
  if (ctx.chefProgramme && programme.chef_programme_id === ctx.userId) return true;
  return !!programme.organization_id && ctx.mgmtOrgIds.has(programme.organization_id);
}
