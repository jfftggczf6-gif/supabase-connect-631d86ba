// Regenerate Excel OVO from existing plan_financier data — no AI call
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, verifyAndGetContext, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { adaptPlanFinancierToOvoFormat } from "../_shared/plan-to-ovo-adapter.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const supabase = ctx.supabase;
    const enterpriseId = ctx.enterprise_id;
    const enterprise = ctx.enterprise;

    // 1. Load existing plan_financier
    const { data: deliv } = await supabase
      .from("deliverables")
      .select("data")
      .eq("enterprise_id", enterpriseId)
      .eq("type", "plan_financier")
      .maybeSingle();

    const planData = deliv?.data;
    if (!planData || typeof planData !== "object" || Object.keys(planData).length === 0) {
      return errorResponse("Aucun plan financier existant. Générez-le d'abord.", 400);
    }

    // 2. Download template
    const { data: templateBlob, error: tplErr } = await supabase.storage
      .from("ovo-templates")
      .download("251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm");

    if (tplErr || !templateBlob) {
      return errorResponse(`Template non trouvé: ${tplErr?.message}`, 500);
    }

    const templateBuffer = await templateBlob.arrayBuffer();
    const templateBytes = new Uint8Array(templateBuffer);
    let binaryStr = "";
    for (let i = 0; i < templateBytes.length; i++) {
      binaryStr += String.fromCharCode(templateBytes[i]);
    }
    const templateBase64 = btoa(binaryStr);

    // 3. Adapt data → OVO format
    const ovoData = adaptPlanFinancierToOvoFormat(planData as Record<string, any>);
    console.log(`[regenerate-excel-ovo] Sending to Railway: ${Object.keys(ovoData).length} keys, ${(ovoData.products || []).length} products`);

    // 4. Call Railway
    const railwayUrl = Deno.env.get("RAILWAY_URL") || "https://esono-parser-production-8f89.up.railway.app";
    const parserApiKey = Deno.env.get("PARSER_API_KEY") || "esono-parser-2026-prod";

    const excelResp = await fetch(`${railwayUrl}/generate-ovo-excel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${parserApiKey}`,
      },
      body: JSON.stringify({ data: ovoData, template_base64: templateBase64 }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!excelResp.ok) {
      const errText = await excelResp.text();
      return errorResponse(`Railway error ${excelResp.status}: ${errText.slice(0, 300)}`, 502);
    }

    // 5. Upload to Storage
    const excelBuffer = await excelResp.arrayBuffer();
    const filename = `PlanFinancier_${enterprise.name.replace(/\s+/g, "_")}_OVO_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.xlsm`;

    const { error: uploadErr } = await supabase.storage
      .from("deliverables")
      .upload(`${enterpriseId}/${filename}`, excelBuffer, {
        contentType: "application/vnd.ms-excel.sheet.macroEnabled.12",
        upsert: true,
      });

    if (uploadErr) {
      return errorResponse(`Upload error: ${uploadErr.message}`, 500);
    }

    // 6. Update deliverable metadata
    await supabase.from("deliverables").update({
      data: { ...(planData as Record<string, any>), excel_filename: filename, excel_generated: true },
    }).eq("enterprise_id", enterpriseId).eq("type", "plan_financier");

    // Build download URL
    const { data: signedUrl } = await supabase.storage
      .from("deliverables")
      .createSignedUrl(`${enterpriseId}/${filename}`, 3600);

    console.log(`[regenerate-excel-ovo] Done: ${filename} (${excelBuffer.byteLength} bytes)`);

    return jsonResponse({
      success: true,
      download_url: signedUrl?.signedUrl || null,
      file_name: filename,
      size_bytes: excelBuffer.byteLength,
    });
  } catch (e: any) {
    console.error("[regenerate-excel-ovo] error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
