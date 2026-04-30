// deliverable-workflow — orchestre les transitions du workflow producteur/valideur
// sur un deliverable.
//
// Actions (POST body : { enterprise_id, deliverable_type, action, comment? }) :
//   submit              → producteur envoie pour validation (draft|revision_requested → submitted)
//   validate            → valideur approuve (submitted → validated)
//   request_revision    → valideur renvoie au producteur (submitted → revision_requested)
//   unlock              → admin défait la validation (validated → draft)
//
// Vérifie le rôle de l'appelant + l'état actuel du livrable avant transition.
// Ajoute une entrée dans review_history pour traçabilité.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";

type Action = 'submit' | 'validate' | 'request_revision' | 'unlock';

interface WorkflowBody {
  enterprise_id: string;
  deliverable_type: string;
  action: Action;
  comment?: string;
}

const PRODUCER_ROLES = ['conseiller_pme', 'owner', 'admin', 'manager'];
const REVIEWER_ROLES = ['analyste_credit', 'directeur_pme', 'direction_pme', 'owner', 'admin', 'manager'];
const ADMIN_ROLES   = ['owner', 'admin', 'manager', 'directeur_pme', 'direction_pme'];

const ALLOWED_TRANSITIONS: Record<Action, { from: (string | null)[]; to: string; allowedRoles: string[] }> = {
  submit:           { from: ['draft', 'revision_requested', null], to: 'submitted',          allowedRoles: PRODUCER_ROLES },
  validate:         { from: ['submitted'],                          to: 'validated',          allowedRoles: REVIEWER_ROLES },
  request_revision: { from: ['submitted'],                          to: 'revision_requested', allowedRoles: REVIEWER_ROLES },
  unlock:           { from: ['validated'],                          to: 'draft',              allowedRoles: ADMIN_ROLES },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return errorResponse('Non autorisé', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey     = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || serviceKey;

    const anon = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await anon.auth.getUser();
    if (userErr || !user) return errorResponse('Non autorisé', 401);

    const body: WorkflowBody = await req.json();
    const { enterprise_id, deliverable_type, action, comment } = body;
    if (!enterprise_id || !deliverable_type || !action) {
      return errorResponse('enterprise_id, deliverable_type et action requis', 400);
    }
    if (!ALLOWED_TRANSITIONS[action]) return errorResponse(`Action inconnue : ${action}`, 400);

    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Charger le deliverable + l'org
    const { data: ent } = await sb.from('enterprises')
      .select('id, organization_id').eq('id', enterprise_id).single();
    if (!ent) return errorResponse('Entreprise non trouvée', 404);

    const { data: deliv } = await sb.from('deliverables')
      .select('id, type, validation_status, review_history')
      .eq('enterprise_id', enterprise_id)
      .eq('type', deliverable_type)
      .maybeSingle();
    if (!deliv) return errorResponse('Livrable non trouvé', 404);

    // 2. Vérifier rôle de l'utilisateur dans l'org
    const { data: membership } = await sb.from('organization_members')
      .select('role').eq('organization_id', ent.organization_id).eq('user_id', user.id)
      .eq('is_active', true).maybeSingle();
    if (!membership) return errorResponse("Vous n'êtes pas membre de cette organisation", 403);

    const transition = ALLOWED_TRANSITIONS[action];
    if (!transition.allowedRoles.includes(membership.role)) {
      return errorResponse(`Action ${action} non autorisée pour le rôle ${membership.role}`, 403);
    }

    // 3. Vérifier l'état courant
    const currentStatus = (deliv as any).validation_status;
    if (!transition.from.includes(currentStatus)) {
      return errorResponse(
        `Transition invalide : impossible de faire ${action} depuis l'état ${currentStatus || 'draft'}`,
        400,
      );
    }

    // 4. Construire la nouvelle entrée d'historique
    const historyEntry = {
      at: new Date().toISOString(),
      by_user_id: user.id,
      by_role: membership.role,
      action,
      comment: comment || null,
    };
    const newHistory = Array.isArray((deliv as any).review_history)
      ? [...(deliv as any).review_history, historyEntry]
      : [historyEntry];

    // 5. Patch
    const update: Record<string, any> = {
      validation_status: transition.to,
      review_history: newHistory,
      updated_at: new Date().toISOString(),
    };
    if (action === 'submit') {
      update.submitted_by = user.id;
      update.submitted_at = new Date().toISOString();
    }
    if (action === 'validate') {
      update.validated_by = user.id;
      update.validated_at = new Date().toISOString();
    }
    if (comment !== undefined && comment !== null && comment.length > 0) {
      update.review_comment = comment;
    }

    const { error: updErr } = await sb.from('deliverables').update(update).eq('id', deliv.id);
    if (updErr) return errorResponse(updErr.message, 500);

    return jsonResponse({
      ok: true,
      from: currentStatus || null,
      to: transition.to,
      action,
      by_role: membership.role,
    });
  } catch (e: any) {
    console.error('deliverable-workflow error:', e);
    return errorResponse(e.message || 'Erreur', e.status || 500);
  }
});
