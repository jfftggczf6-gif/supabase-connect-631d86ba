// src/lib/pe-section-validation.ts
// Logique RBAC + transitions valides pour le workflow validation IM/MD par section.

export type SectionStatus = 'draft' | 'pending_validation' | 'validated' | 'needs_revision';

export interface RoleContext {
  role: string | null | undefined;
  isSuperAdmin?: boolean;
}

const isAnalyst = (ctx: RoleContext) => ctx.role === 'analyste' || ctx.role === 'analyst';
const isIm = (ctx: RoleContext) => ctx.role === 'investment_manager';
const isMdOrAbove = (ctx: RoleContext) =>
  ctx.role === 'managing_director' || ctx.role === 'admin' || ctx.role === 'owner' || !!ctx.isSuperAdmin;
const isImOrAbove = (ctx: RoleContext) => isIm(ctx) || isMdOrAbove(ctx);

/** L'utilisateur peut-il éditer le contenu de la section (markdown + content_json) ? */
export function canEdit(ctx: RoleContext, status: SectionStatus): boolean {
  // L'analyste peut éditer en draft et needs_revision
  // L'IM et le MD peuvent toujours éditer (ils peuvent corriger directement)
  if (isAnalyst(ctx)) return status === 'draft' || status === 'needs_revision';
  if (isImOrAbove(ctx)) return true;
  return false;
}

/** L'utilisateur peut-il régénérer la section via IA ? */
export function canRegenerate(ctx: RoleContext, status: SectionStatus): boolean {
  // Mêmes règles qu'éditer (régénération = remplacer le contenu)
  return canEdit(ctx, status);
}

/** L'utilisateur peut-il soumettre la section à validation IM/MD ? */
export function canSubmit(ctx: RoleContext, status: SectionStatus): boolean {
  // Analyste depuis draft ou needs_revision → pending_validation
  // IM peut aussi soumettre (typique : IM travaille sur une section, soumet au MD)
  if (status !== 'draft' && status !== 'needs_revision') return false;
  return isAnalyst(ctx) || isIm(ctx);
}

/** L'utilisateur peut-il valider la section ? */
export function canValidate(ctx: RoleContext, status: SectionStatus): boolean {
  if (status !== 'pending_validation') return false;
  return isImOrAbove(ctx);
}

/** L'utilisateur peut-il demander une révision (renvoie en needs_revision avec commentaire) ? */
export function canRequestRevision(ctx: RoleContext, status: SectionStatus): boolean {
  if (status !== 'pending_validation') return false;
  return isImOrAbove(ctx);
}

/** L'utilisateur peut-il réouvrir une section validée (la repasser en draft) ? */
export function canResetToDraft(ctx: RoleContext, status: SectionStatus): boolean {
  if (status !== 'validated') return false;
  return isImOrAbove(ctx);
}

export const STATUS_LABELS: Record<SectionStatus, string> = {
  draft:              'Brouillon',
  pending_validation: 'À valider',
  validated:          'Validée',
  needs_revision:     'À réviser',
};

export const STATUS_COLORS: Record<SectionStatus, { bg: string; color: string }> = {
  draft:              { bg: 'var(--muted)',           color: 'var(--muted-foreground)' },
  pending_validation: { bg: 'var(--pe-bg-info)',      color: 'var(--pe-info)' },
  validated:          { bg: 'var(--pe-bg-ok)',        color: 'var(--pe-ok)' },
  needs_revision:     { bg: 'var(--pe-bg-warning)',   color: 'var(--pe-warning)' },
};

/** Snapshot du rôle pour audit (sauvegardé dans memo_section_validations.actor_role). */
export function getRoleSnapshot(ctx: RoleContext): string {
  if (ctx.isSuperAdmin) return 'super_admin';
  if (isMdOrAbove(ctx)) return 'managing_director';
  if (isIm(ctx)) return 'investment_manager';
  if (isAnalyst(ctx)) return 'analyste';
  return ctx.role || 'unknown';
}
