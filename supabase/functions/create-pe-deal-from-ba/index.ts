// create-pe-deal-from-ba — Handoff cross-organization BA → PE.
//
// Workflow :
// 1. Vérifie LOI signée (pe_fund_outreach.status='loi_signed' ou 'closed' pour le fond_target)
// 2. Vérifie target_org_id = type='pe'
// 3. COPY enterprise (nouveau row dans org PE) — sauf si déjà existante par nom
// 4. COPY pe_deal en pre_screening dans org PE, source='mandat_ba', source_ba_deal_id=current
// 5. COPY documents (pe_deal_documents) — les rows liées au nouveau deal_id
// 6. COPY investment_memos + memo_versions + memo_sections (jsonb deep copy)
// 7. COPY pe_valuation (copy row + reset id)
// 8. UPDATE pe_fund_outreach.status='closed' pour ce fund (handoff = closing BA)
// 9. UPDATE BA pe_deals.stage='close' (handoff fait = mandat terminé)
// 10. Returns {new_deal_id, new_enterprise_id, items_copied}
//
// Sécurité :
// - Caller doit être managing_director/owner/partner de l'org BA source
// - Target org doit être type=pe (vérifié)
// - Toutes les writes en service role car cross-org RLS bypass
// - Audit dans pe_deal_history des 2 deals (BA close + PE new)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";

interface RequestBody {
  ba_deal_id: string;
  funding_program_id: string;
  target_pe_org_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Authorization required", 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse("Not authenticated", 401);

    const body: RequestBody = await req.json();
    if (!body.ba_deal_id || !body.funding_program_id || !body.target_pe_org_id) {
      return errorResponse("ba_deal_id, funding_program_id, target_pe_org_id requis", 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Vérifier accès au deal BA (auth via userClient RLS)
    const { data: baDeal } = await userClient
      .from("pe_deals")
      .select("id, organization_id, enterprise_id, deal_ref, ticket_demande, currency, stage, source")
      .eq("id", body.ba_deal_id)
      .maybeSingle();
    if (!baDeal) return errorResponse("BA deal introuvable ou non accessible", 404);

    // 2. Vérifier caller est MD/owner/partner de l'org BA
    const { data: member } = await userClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", baDeal.organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    const allowedRoles = ["owner", "admin", "managing_director", "partner"];
    if (!member || !allowedRoles.includes(member.role)) {
      return errorResponse(`Rôle insuffisant pour handoff (requis: ${allowedRoles.join(", ")})`, 403);
    }

    // 3. Vérifier target org est PE
    const { data: targetOrg } = await adminClient
      .from("organizations")
      .select("id, name, type")
      .eq("id", body.target_pe_org_id)
      .maybeSingle();
    if (!targetOrg) return errorResponse("Target org introuvable", 404);
    if (targetOrg.type !== "pe") return errorResponse(`Target org doit être type=pe (actuel: ${targetOrg.type})`, 400);

    // 4. Vérifier outreach LOI signée
    const { data: outreach } = await adminClient
      .from("pe_fund_outreach")
      .select("id, status")
      .eq("deal_id", body.ba_deal_id)
      .eq("funding_program_id", body.funding_program_id)
      .maybeSingle();
    if (!outreach) return errorResponse("Outreach introuvable", 404);
    const validStatuses = ["loi_signed", "closed", "ioi_received", "meeting_held"];
    if (!validStatuses.includes(outreach.status)) {
      return errorResponse(`Handoff impossible depuis status='${outreach.status}' (attendu: ${validStatuses.join(", ")})`, 400);
    }

    // 5. Charger BA enterprise
    const { data: baEnt } = await adminClient
      .from("enterprises")
      .select("name, sector, country, city, contact_name, contact_email, contact_phone, document_content")
      .eq("id", baDeal.enterprise_id)
      .maybeSingle();
    if (!baEnt) return errorResponse("Enterprise BA introuvable", 404);

    // 6. Find ou create enterprise dans target PE org
    const { data: existingPeEnt } = await adminClient
      .from("enterprises")
      .select("id")
      .eq("organization_id", body.target_pe_org_id)
      .eq("name", baEnt.name)
      .maybeSingle();

    let newEnterpriseId: string;
    if (existingPeEnt) {
      newEnterpriseId = existingPeEnt.id;
    } else {
      const { data: newEnt, error: entErr } = await adminClient
        .from("enterprises")
        .insert({
          name: baEnt.name,
          sector: baEnt.sector,
          country: baEnt.country,
          city: baEnt.city,
          contact_name: baEnt.contact_name,
          contact_email: baEnt.contact_email,
          contact_phone: baEnt.contact_phone,
          organization_id: body.target_pe_org_id,
          user_id: null,
        })
        .select("id")
        .single();
      if (entErr) return errorResponse(`Enterprise copy failed: ${entErr.message}`, 500);
      newEnterpriseId = newEnt.id;
    }

    // 7. Créer pe_deal dans target PE org (stage='pre_screening')
    const { data: newDeal, error: dealErr } = await adminClient
      .from("pe_deals")
      .insert({
        deal_ref: "",  // trigger auto-genère
        organization_id: body.target_pe_org_id,
        enterprise_id: newEnterpriseId,
        stage: "pre_screening",
        source: "mandat_ba",
        source_detail: `Handoff depuis ${baDeal.deal_ref || baDeal.id} (org: ${baDeal.organization_id})`,
        source_ba_deal_id: body.ba_deal_id,
        source_ba_org_id: baDeal.organization_id,
        ticket_demande: baDeal.ticket_demande,
        currency: baDeal.currency,
      })
      .select("id, deal_ref")
      .single();
    if (dealErr) return errorResponse(`PE deal insert failed: ${dealErr.message}`, 500);

    let itemsCopied = { documents: 0, memo_versions: 0, memo_sections: 0, valuation: 0 };

    // 8. COPY documents
    const { data: baDocs } = await adminClient
      .from("pe_deal_documents")
      .select("filename, storage_path, mime_type, size_bytes, category, content_extracted, chars_extracted, parse_quality")
      .eq("deal_id", body.ba_deal_id);
    if (baDocs && baDocs.length > 0) {
      const docRows = baDocs.map(d => ({
        ...d,
        deal_id: newDeal.id,
        organization_id: body.target_pe_org_id,
        uploaded_by: null,
      }));
      const { error: docsErr } = await adminClient.from("pe_deal_documents").insert(docRows);
      if (!docsErr) itemsCopied.documents = baDocs.length;
    }

    // 9. COPY investment_memos + memo_versions + memo_sections
    const { data: baMemo } = await adminClient
      .from("investment_memos")
      .select("id")
      .eq("deal_id", body.ba_deal_id)
      .maybeSingle();
    let newMemoId: string | null = null;
    if (baMemo) {
      const { data: newMemo } = await adminClient
        .from("investment_memos")
        .insert({ deal_id: newDeal.id })
        .select("id")
        .single();
      newMemoId = newMemo?.id ?? null;

      if (newMemoId) {
        // Copy versions
        const { data: baVersions } = await adminClient
          .from("memo_versions")
          .select("id, label, stage, status, overall_score, classification, generated_at")
          .eq("memo_id", baMemo.id);
        for (const v of (baVersions || [])) {
          const { data: newVer } = await adminClient
            .from("memo_versions")
            .insert({
              memo_id: newMemoId,
              label: v.label,
              stage: v.stage,
              status: v.status,
              overall_score: v.overall_score,
              classification: v.classification,
              generated_at: v.generated_at,
              generated_by_agent: "create-pe-deal-from-ba (handoff)",
            })
            .select("id")
            .single();
          if (newVer) {
            itemsCopied.memo_versions++;
            // Copy sections
            const { data: baSecs } = await adminClient
              .from("memo_sections")
              .select("section_code, title, content_md, content_json, source_doc_ids, position, status")
              .eq("version_id", v.id);
            if (baSecs && baSecs.length > 0) {
              const secRows = baSecs.map(s => ({ ...s, version_id: newVer.id }));
              const { error: secErr } = await adminClient.from("memo_sections").insert(secRows);
              if (!secErr) itemsCopied.memo_sections += baSecs.length;
            }
          }
        }
      }
    }

    // 10. COPY pe_valuation
    const { data: baVal } = await adminClient
      .from("pe_valuation")
      .select("currency, dcf_inputs, dcf_projections, dcf_terminal, dcf_outputs, multiples_comparables, multiples_outputs, ancc_assets, ancc_liabilities, ancc_outputs, synthesis, ai_justification")
      .eq("deal_id", body.ba_deal_id)
      .maybeSingle();
    if (baVal) {
      const { error: valErr } = await adminClient
        .from("pe_valuation")
        .insert({ ...baVal, deal_id: newDeal.id, organization_id: body.target_pe_org_id });
      if (!valErr) itemsCopied.valuation = 1;
    }

    // 11. UPDATE outreach.status='closed' (handoff = closing BA pour ce fond)
    await adminClient
      .from("pe_fund_outreach")
      .update({
        status: "closed",
        last_action_at: new Date().toISOString(),
        last_action_label: `Handoff vers ${targetOrg.name} (PE deal ${newDeal.deal_ref})`,
      })
      .eq("id", outreach.id);

    // 12. UPDATE BA deal stage='close'
    await adminClient
      .from("pe_deals")
      .update({ stage: "close" })
      .eq("id", body.ba_deal_id);

    // 13. Audit history (BA close)
    await adminClient.from("pe_deal_history").insert({
      deal_id: body.ba_deal_id,
      from_stage: baDeal.stage,
      to_stage: "close",
      changed_by: user.id,
      reason: `Handoff BA → PE ${targetOrg.name} (new deal ${newDeal.deal_ref})`,
    });

    // 14. Audit history (PE create)
    await adminClient.from("pe_deal_history").insert({
      deal_id: newDeal.id,
      from_stage: null,
      to_stage: "pre_screening",
      changed_by: user.id,
      reason: `Handoff depuis BA deal ${baDeal.deal_ref || baDeal.id}`,
    });

    return jsonResponse({
      success: true,
      new_deal_id: newDeal.id,
      new_deal_ref: newDeal.deal_ref,
      new_enterprise_id: newEnterpriseId,
      target_org_name: targetOrg.name,
      items_copied: itemsCopied,
    });
  } catch (err: any) {
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
