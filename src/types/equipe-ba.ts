// src/types/equipe-ba.ts
// Types pour la feature equipe_ba (gestion équipe BA — Partner only).
//
// Sources DB réutilisées :
//   - organization_members  → role + is_active (statut)
//   - profiles              → full_name + email
//   - pe_deals              → mandates_count (source='mandat_ba' + lead_analyst_id)
//   - pe_deal_history       → last_activity_at (max created_at par changed_by)
//   - pe_team_assignments   → binding IM ↔ Analyst (RLS can_see_pe_deal)
//
// EFs réutilisées : send-invitation, accept-invitation, get-invitation-details,
//                   admin-manage-users.

/** Rôles BA invitables (sous-ensemble de app_role).
 *  Note : le rôle effectif autorisé dépend du rôle inviteur (matrice
 *  INVITE_PERMISSIONS dans send-invitation). MD ne peut pas inviter MD. */
export type BaInviteRole = 'analyst' | 'investment_manager' | 'managing_director';

/** Statut d'un membre dans l'org.
 *  - active   : membre actif (organization_members.is_active = true)
 *  - disabled : membre désactivé (is_active = false) — réversible
 *  - invited  : invitation envoyée non encore acceptée */
export type MemberStatus = 'active' | 'disabled' | 'invited';

/** Ligne de la liste membres (vue Partner). */
export interface BaTeamMember {
  user_id: string;
  full_name: string | null;
  email: string;
  /** org_role brut (analyst, investment_manager, managing_director, owner…). */
  role: string;
  /** Label affichable, lu depuis preset.roles_labels avec fallback BA_ROLE_LABELS. */
  role_label: string;
  status: MemberStatus;
  /** pe_deals.source='mandat_ba' WHERE lead_analyst_id = user_id (uniquement pour analystes). */
  mandates_count: number;
  /** ISO date — max(pe_deal_history.created_at) pour les deals où user a agi. */
  last_activity_at: string | null;
  /** Si status='invited', date de l'invitation (lecture invitations.created_at). */
  invited_at: string | null;
}

/** Body pour send-invitation (EF existante, shape stricte). */
export interface SendInvitationInput {
  email: string;
  role: BaInviteRole;
  organization_id: string;
  full_name?: string;
  personal_message?: string;
}

/** Binding IM ↔ Analyst (lecture pe_team_assignments + jointures profiles). */
export interface ImAnalystBinding {
  id: string;
  im_user_id: string;
  im_name: string | null;
  analyst_user_id: string;
  analyst_name: string | null;
  is_active: boolean;
  created_at: string;
}

/** Body pour créer un binding (insert direct dans pe_team_assignments). */
export interface CreateBindingInput {
  organization_id: string;
  im_user_id: string;
  analyst_user_id: string;
}

/** Labels d'affichage par rôle — fallback si preset.roles_labels[role] absent. */
export const BA_ROLE_LABELS: Record<BaInviteRole, string> = {
  analyst: 'Analyste',
  investment_manager: 'Senior',
  managing_director: 'Partner',
};
