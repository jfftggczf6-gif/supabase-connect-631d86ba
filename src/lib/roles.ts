// ESONO — source unique des rôles d'organisation et de leurs labels.
// Toute l'app doit passer par ces helpers pour afficher / filtrer les rôles.

export type OrgRole =
  // Rôles génériques (tous segments)
  | 'owner' | 'admin' | 'manager'
  // Rôles segment programme
  | 'coach' | 'entrepreneur'
  // Rôles segment PE
  | 'analyst' | 'managing_director' | 'investment_manager'
  // Rôles segment banque (NSIA-style et apparentés)
  | 'directeur_pme' | 'direction_pme' | 'directeur_agence'
  | 'analyste_credit' | 'conseiller_pme' | 'partner';

export type OrgType = 'programme' | 'pe' | 'mixed' | 'banque';

// Labels affichés à l'utilisateur, par type d'org.
// La même clé technique (ex: 'manager') a un label différent selon le contexte.
export const ROLE_LABELS: Record<OrgType, Partial<Record<OrgRole, string>>> = {
  programme: {
    owner: 'Propriétaire',
    admin: 'Administrateur',
    manager: 'Chef de programme',
    coach: 'Coach',
    analyst: 'Analyste',                 // techniquement invité, mais filtré dans les selects
    entrepreneur: 'Entrepreneur',
  },
  pe: {
    owner: 'Propriétaire',
    admin: 'Administrateur',
    manager: "Directeur d'investissement",
    managing_director: 'Managing Director',
    investment_manager: 'Investment Manager',
    analyst: 'Analyste',
    coach: 'Coach',                       // techniquement invité, mais filtré dans les selects
    entrepreneur: 'Entrepreneur',
  },
  mixed: {
    owner: 'Propriétaire',
    admin: 'Administrateur',
    manager: 'Responsable',
    managing_director: 'Managing Director',
    investment_manager: 'Investment Manager',
    coach: 'Coach',
    analyst: 'Analyste',
    entrepreneur: 'Entrepreneur',
  },
  banque: {
    owner: 'Propriétaire',
    admin: 'Administrateur',
    manager: 'Responsable',
    directeur_pme: 'Directeur PME',
    direction_pme: 'Direction PME',           // alias historique du directeur_pme
    directeur_agence: 'Directeur d\'agence',
    analyste_credit: 'Analyste crédit',
    conseiller_pme: 'Conseiller PME',
    partner: 'Partenaire (OEC, courtier…)',
  },
};

// Définit quels rôles sont pertinents (donc invitables) selon le type d'org.
const RELEVANT_ROLES: Record<OrgType, OrgRole[]> = {
  programme: ['owner', 'admin', 'manager', 'coach', 'entrepreneur'],
  pe:        ['owner', 'admin', 'managing_director', 'investment_manager', 'analyst', 'entrepreneur'],
  mixed:     ['owner', 'admin', 'manager', 'managing_director', 'investment_manager', 'coach', 'analyst', 'entrepreneur'],
  banque:    [
    'owner', 'admin', 'manager',
    'directeur_pme', 'directeur_agence',
    'analyste_credit', 'conseiller_pme',
    'partner',
  ],
};

// Hiérarchie : un rôle peut inviter ceux du même niveau ou inférieur.
// Plus le nombre est BAS, plus le rôle est haut placé.
// Banque : directeur_pme < directeur_agence < analyste_credit < conseiller_pme.
// Le manager (Responsable) reste org-level au-dessus du directeur_pme et n'est
// donc jamais invitable depuis l'UI banque (cohérent avec INVITE_PERMISSIONS du
// edge function send-invitation).
const ROLE_PRIORITY: Record<OrgRole, number> = {
  owner: 0,
  admin: 1,
  manager: 2,
  // PE
  managing_director: 2,       // niveau manager (chef de fond PE)
  investment_manager: 3,      // niveau supérieur à analyst, inférieur à MD
  // banque (ordre strictement décroissant)
  directeur_pme: 2.5,
  direction_pme: 2.5,
  directeur_agence: 3,
  analyste_credit: 3.5,
  conseiller_pme: 4,
  partner: 4,
  // programme
  coach: 3,
  analyst: 3,
  entrepreneur: 4,
};

/** Label humain d'un rôle dans le contexte d'une org. */
export function humanizeRole(role: string | null | undefined, orgType: OrgType | string | null | undefined): string {
  if (!role) return '';
  const type = (orgType as OrgType) || 'programme';
  return ROLE_LABELS[type]?.[role as OrgRole] || role;
}

/**
 * Liste des rôles invitables par un user, dans le contexte d'une org.
 * - Filtre sur les rôles pertinents (programme vs pe vs mixed vs banque)
 * - Filtre sur la hiérarchie : un user ne peut inviter que des rôles ≤ au sien
 *   (sauf super_admin qui peut tout)
 *
 * @param orgType type de l'org active
 * @param inviterRole rôle du user qui invite (owner / admin / manager / etc.)
 * @param isSuperAdmin true → bypass tout
 * @param includeOwner inclut "owner" dans la liste (par défaut false : on n'invite pas un owner)
 */
export function getInvitableRoles(
  orgType: OrgType | string | null | undefined,
  inviterRole: OrgRole | string | null | undefined,
  isSuperAdmin = false,
  includeOwner = false,
): { value: OrgRole; label: string }[] {
  const type = (orgType as OrgType) || 'programme';
  const relevant = RELEVANT_ROLES[type] || RELEVANT_ROLES.programme;
  const inviterPriority = isSuperAdmin ? -1 : (ROLE_PRIORITY[inviterRole as OrgRole] ?? 99);

  return relevant
    .filter((r) => includeOwner || r !== 'owner')
    .filter((r) => ROLE_PRIORITY[r] >= inviterPriority || isSuperAdmin)
    .map((r) => ({ value: r, label: ROLE_LABELS[type]?.[r] || r }));
}

/** Description courte d'un rôle (utile dans les wizards / tooltips). */
export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Le boss de l\'organisation. Tout pouvoir sauf changer le owner.',
  admin: 'Bras droit du propriétaire. Tout sauf supprimer l\'org.',
  manager: 'Pilote opérationnel : crée programmes, gère cohortes, assigne coachs/analystes.',
  managing_director: 'Pilote du fond PE. Valide les comités d\'investissement, vue portefeuille global.',
  investment_manager: 'Supervise une équipe d\'analystes. Valide les sections memo, peut intervenir sur tous les deals de son équipe.',
  coach: 'Accompagne des PME. Génère livrables et notes coaching pour ses entreprises.',
  analyst: 'Analyse des deals PE. Produit memos et valorisations pour ses dossiers.',
  entrepreneur: 'Bénéficiaire (PME). Voit uniquement sa propre boîte.',
  // banque
  directeur_pme: 'Pilote la BU PME : voit tous les dossiers de l\'org, valide les exceptions, gère ses équipes.',
  direction_pme: 'Direction PME (équivalent de directeur_pme — alias historique).',
  directeur_agence: 'Pilote une agence : voit les dossiers de ses analystes / conseillers.',
  analyste_credit: 'Analyse les dossiers crédit : valide ou demande corrections sur les livrables Credit Readiness, prépare la note crédit.',
  conseiller_pme: 'Sur le terrain : crée les dossiers, dépose les pièces, génère les livrables initiaux et les soumet pour validation.',
  partner: 'Partenaire externe (OEC, courtier, consultant) : accès limité aux dossiers qu\'il apporte.',
};
