import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import {
  createMemoVersion,
  updateMemoVersion,
  insertMemoSections,
  fetchSections,
  getLatestVersion,
  type MemoSectionCode,
} from "../_shared/memo-helpers.ts";

interface RequestBody {
  deal_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Authorization required", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse("Not authenticated", 401);

    const body: RequestBody = await req.json();
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    // Vérifier que le user voit le deal (RLS)
    const { data: deal, error: dealErr } = await userClient
      .from("pe_deals").select("id").eq("id", body.deal_id).maybeSingle();
    if (dealErr || !deal) return errorResponse("Deal not found or not accessible", 404);

    // Trouver la dernière version pre_screening ready
    const lastPreScreening = await getLatestVersion(adminClient, body.deal_id, "pre_screening", "ready");
    if (!lastPreScreening) {
      return errorResponse("No ready pre_screening version to clone from", 400);
    }

    // Vérifier qu'il n'y a pas déjà une note_ic1 pour ce memo
    const existingIc1 = await getLatestVersion(adminClient, body.deal_id, "note_ic1");
    if (existingIc1) {
      return jsonResponse({
        success: true,
        version_id: existingIc1.id,
        already_exists: true,
      });
    }

    // Créer la nouvelle version note_ic1_v1 (clone)
    const newVersionId = await createMemoVersion(adminClient, {
      memo_id: lastPreScreening.memo_id,
      label: "note_ic1_v1",
      parent_version_id: lastPreScreening.id,
      stage: "note_ic1",
      status: "generating",
      overall_score: lastPreScreening.overall_score,
      classification: lastPreScreening.classification,
      generated_by_agent: "clone_from_pre_screening",
      generated_by_user_id: user.id,
    });

    // Cloner les 12 sections du parent
    const parentSections = await fetchSections(adminClient, lastPreScreening.id);
    const sectionsMap: Partial<Record<MemoSectionCode, any>> = {};
    for (const sec of parentSections) {
      sectionsMap[sec.section_code] = {
        title: sec.title,
        content_md: sec.content_md,
        content_json: sec.content_json,
        source_doc_ids: sec.source_doc_ids,
      };
    }
    await insertMemoSections(adminClient, newVersionId, sectionsMap);

    // Finalize
    await updateMemoVersion(adminClient, newVersionId, {
      status: "ready",
      generated_at: new Date().toISOString(),
    });

    return jsonResponse({
      success: true,
      version_id: newVersionId,
      cloned_from: lastPreScreening.id,
    });
  } catch (err: any) {
    console.error(`[generate-ic1-memo] error: ${err.message}`);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
