import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stages canoniques Phase B' : analyse + ic1 + ic_finale ont été renommés.
const VALID_STAGES = [
  'sourcing',
  'pre_screening',
  'note_ic1',
  'dd',
  'note_ic_finale',
  'closing',
  'portfolio',
  'lost',
];

// Stages autorisés selon rôle (lost est toujours autorisé).
const STAGES_BY_ROLE: Record<string, string[]> = {
  analyste:           ['sourcing', 'pre_screening'],
  analyst:            ['sourcing', 'pre_screening'],
  investment_manager: ['sourcing', 'pre_screening', 'note_ic1', 'dd', 'note_ic_finale'],
  managing_director:  ['sourcing', 'pre_screening', 'note_ic1', 'dd', 'note_ic_finale', 'closing', 'portfolio'],
  admin:              ['sourcing', 'pre_screening', 'note_ic1', 'dd', 'note_ic_finale', 'closing', 'portfolio'],
  owner:              ['sourcing', 'pre_screening', 'note_ic1', 'dd', 'note_ic_finale', 'closing', 'portfolio'],
};

// Seuils de validation requis pour chaque transition critique.
// Le check est sur le nombre de sections 'validated' dans la dernière version 'ready' du stage source.
interface ValidationGate {
  fromStage: string;
  fromVersionStage: string;        // stage memo_versions à inspecter (ex: 'pre_screening')
  minSectionsValidated: number;    // sur 12 sections totales
}

const VALIDATION_GATES: Record<string, ValidationGate> = {
  // pre_screening → note_ic1 : 8/12 sections validées (analyse de fond)
  note_ic1: { fromStage: 'pre_screening', fromVersionStage: 'pre_screening', minSectionsValidated: 8 },
  // note_ic1 → dd : 12/12 sections validées (toutes les sections approuvées)
  dd: { fromStage: 'note_ic1', fromVersionStage: 'note_ic1', minSectionsValidated: 12 },
  // dd → note_ic_finale : pas de check sur sections (DD module n'existe pas encore)
  // note_ic_finale → closing : 12/12 IC finale validées
  closing: { fromStage: 'note_ic_finale', fromVersionStage: 'note_ic_finale', minSectionsValidated: 12 },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { deal_id, new_stage, lost_reason, force, ic_decision } = await req.json();
    if (!deal_id || !new_stage) throw new Error("deal_id and new_stage required");
    if (!VALID_STAGES.includes(new_stage)) {
      throw new Error(`Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}`);
    }
    if (new_stage === 'lost' && (!lost_reason || !lost_reason.trim())) {
      throw new Error('lost_reason required when stage=lost');
    }

    // Validation IC decision si fournie
    if (ic_decision) {
      if (!['ic1', 'ic_finale'].includes(ic_decision.ic_type)) throw new Error("ic_decision.ic_type must be ic1 or ic_finale");
      if (!['go', 'go_conditional', 'no_go'].includes(ic_decision.decision)) throw new Error("ic_decision.decision invalid");
      if (ic_decision.decision === 'no_go' && (!ic_decision.motif || !ic_decision.motif.trim())) {
        throw new Error("motif required when ic_decision.decision=no_go");
      }
      if (ic_decision.decision === 'go_conditional' && (!ic_decision.conditions || ic_decision.conditions.length === 0)) {
        throw new Error("conditions[] required when ic_decision.decision=go_conditional");
      }
    }

    // 1. Charger le deal
    const { data: deal } = await adminClient
      .from("pe_deals")
      .select("id, organization_id, stage, lead_analyst_id")
      .eq("id", deal_id)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found");

    // 2. Récupérer le rôle de l'utilisateur dans l'org
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", deal.organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) throw new Error("Not a member of this organization");

    // 3. Vérifier RLS visibilité
    const { data: canSee } = await adminClient.rpc('can_see_pe_deal', {
      p_deal_id: deal_id, p_user_id: user.id,
    });
    if (!canSee) {
      return new Response(JSON.stringify({ error: "Cannot see this deal" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Vérifier transition autorisée selon rôle (lost toujours autorisé)
    const allowedStages = STAGES_BY_ROLE[membership.role] || [];
    if (new_stage !== 'lost' && !allowedStages.includes(new_stage)) {
      return new Response(JSON.stringify({
        error: `Stage '${new_stage}' réservé à un rôle supérieur (votre rôle: ${membership.role})`,
        code: 'role_forbidden',
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Vérifier le gating par validations de sections
    //    (skipable via flag `force=true` réservé MD/admin/owner pour cas exceptionnels)
    const isMdOrAbove = ['managing_director', 'admin', 'owner'].includes(membership.role);
    const gate = VALIDATION_GATES[new_stage];
    if (gate && !(force === true && isMdOrAbove)) {
      // Trouver la dernière version 'ready' du stage source
      const { data: latestVersion } = await adminClient
        .from('memo_versions')
        .select('id, investment_memos!inner(deal_id)')
        .eq('investment_memos.deal_id', deal_id)
        .eq('stage', gate.fromVersionStage)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestVersion) {
        return new Response(JSON.stringify({
          error: `Aucune version ${gate.fromVersionStage} prête. Génère le ${gate.fromVersionStage} avant de passer en ${new_stage}.`,
          code: 'no_source_version',
        }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Compter les sections validées
      const { count: validatedCount } = await adminClient
        .from('memo_sections')
        .select('id', { count: 'exact', head: true })
        .eq('version_id', latestVersion.id)
        .eq('status', 'validated');

      if ((validatedCount ?? 0) < gate.minSectionsValidated) {
        return new Response(JSON.stringify({
          error: `Validation insuffisante : ${validatedCount ?? 0}/${gate.minSectionsValidated} sections validées requises pour passer en ${new_stage}.`,
          code: 'insufficient_validations',
          validated_count: validatedCount ?? 0,
          required: gate.minSectionsValidated,
          total: 12,
        }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 6. UPDATE (les triggers gèrent enterprise_id requis + audit)
    const updatePayload: any = { stage: new_stage };
    if (new_stage === 'lost') updatePayload.lost_reason = lost_reason.trim();

    const { data: updated, error: updErr } = await adminClient
      .from("pe_deals")
      .update(updatePayload)
      .eq("id", deal_id)
      .select('*')
      .single();
    if (updErr) throw updErr;

    // 6.5 Capture décision IC si fournie (transitions note_ic1→dd ou note_ic_finale→closing)
    if (ic_decision) {
      const { error: icErr } = await adminClient.from('pe_ic_decisions').insert({
        deal_id,
        organization_id: deal.organization_id,
        ic_type: ic_decision.ic_type,
        decision: ic_decision.decision,
        conditions: ic_decision.conditions || [],
        motif: ic_decision.motif || null,
        notes: ic_decision.notes || null,
        decided_by: user.id,
        voted_by: ic_decision.voted_by || [user.id],
      });
      if (icErr) {
        console.warn(`[update-pe-deal-stage] failed to insert ic_decision: ${icErr.message}`);
        // non-bloquant — la transition est déjà faite
      }
    }

    // 7. Hook post-transition : à l'entrée en 'closing', déclencher l'ingestion
    //    deal-learnings (capitalisation post-deal pour la KB propriétaire du fonds).
    //    Non-bloquant : invoqué en background via EdgeRuntime.waitUntil pour ne pas
    //    ralentir la réponse user. Échec silencieux (loggué).
    if (deal.stage !== 'closing' && new_stage === 'closing') {
      // @ts-ignore - EdgeRuntime est disponible dans Deno Deploy
      const waitUntil = (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil)
        ? EdgeRuntime.waitUntil.bind(EdgeRuntime)
        : (p: Promise<any>) => p.catch(e => console.error('[hook] background failure:', e));

      waitUntil((async () => {
        try {
          const { error: ingestErr } = await adminClient.functions.invoke('ingest-deal-learnings', {
            body: { deal_id, force: false },
          });
          if (ingestErr) {
            console.warn(`[update-pe-deal-stage] ingest-deal-learnings failed for ${deal_id}:`, ingestErr.message);
          } else {
            console.log(`[update-pe-deal-stage] ingest-deal-learnings triggered for ${deal_id}`);
          }
        } catch (e: any) {
          console.error(`[update-pe-deal-stage] ingest hook exception for ${deal_id}:`, e.message);
        }
      })());
    }

    return new Response(JSON.stringify({ success: true, deal: updated }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[update-pe-deal-stage] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
