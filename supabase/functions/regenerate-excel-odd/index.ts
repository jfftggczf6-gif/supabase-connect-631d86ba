// Generate ODD Excel from existing odd_analysis data — no AI call
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, verifyAndGetContext, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const supabase = ctx.supabase;
    const enterpriseId = ctx.enterprise_id;
    const enterprise = ctx.enterprise;

    // 1. Load existing odd_analysis
    const { data: deliv } = await supabase
      .from("deliverables")
      .select("data")
      .eq("enterprise_id", enterpriseId)
      .eq("type", "odd_analysis")
      .maybeSingle();

    const oddData = deliv?.data;
    if (!oddData || typeof oddData !== "object" || Object.keys(oddData).length === 0) {
      return errorResponse("Aucune analyse ODD existante. Générez-la d'abord.", 400);
    }

    // 2. Download ODD template
    const { data: templateBlob, error: tplErr } = await supabase.storage
      .from("ovo-templates")
      .download("ODD template.xlsx");

    if (tplErr || !templateBlob) {
      return errorResponse(`Template ODD non trouvé: ${tplErr?.message}`, 500);
    }

    const templateBuffer = await templateBlob.arrayBuffer();
    const templateBytes = new Uint8Array(templateBuffer);
    let binaryStr = "";
    for (let i = 0; i < templateBytes.length; i++) {
      binaryStr += String.fromCharCode(templateBytes[i]);
    }
    const templateBase64 = btoa(binaryStr);

    // 3. Call Railway
    const railwayUrl = Deno.env.get("RAILWAY_URL") || "https://esono-parser-production-8f89.up.railway.app";
    const parserApiKey = Deno.env.get("PARSER_API_KEY") || "esono-parser-2026-prod";

    console.log(`[regenerate-excel-odd] Sending ${(oddData as any).evaluation_cibles_odd?.cibles?.length || 0} cibles to Railway`);

    const excelResp = await fetch(`${railwayUrl}/generate-odd-excel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${parserApiKey}`,
      },
      body: JSON.stringify({ data: oddData, template_base64: templateBase64 }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!excelResp.ok) {
      const errText = await excelResp.text();
      return errorResponse(`Railway error ${excelResp.status}: ${errText.slice(0, 300)}`, 502);
    }

    // 4. Upload to Storage
    const excelBuffer = await excelResp.arrayBuffer();
    const filename = `ODD_${enterprise.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.xlsx`;

    const { error: uploadErr } = await supabase.storage
      .from("deliverables")
      .upload(`${enterpriseId}/${filename}`, excelBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadErr) {
      return errorResponse(`Upload error: ${uploadErr.message}`, 500);
    }

    // 5. Build download URL
    const { data: signedUrl } = await supabase.storage
      .from("deliverables")
      .createSignedUrl(`${enterpriseId}/${filename}`, 3600);

    console.log(`[regenerate-excel-odd] Done: ${filename} (${excelBuffer.byteLength} bytes)`);

    return jsonResponse({
      success: true,
      download_url: signedUrl?.signedUrl || null,
      file_name: filename,
      size_bytes: excelBuffer.byteLength,
    });
  } catch (e: any) {
    console.error("[regenerate-excel-odd] error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
