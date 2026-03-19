import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: Record<string, string> = {};

    // Template OVO
    const OVO_BUCKET = "ovo-templates";
    const OVO_FILE = "251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm";
    
    const { data: ovoExists } = await supabase.storage.from(OVO_BUCKET).list("", { limit: 100 });
    const ovoFound = ovoExists?.some(f => f.name === OVO_FILE);

    if (!ovoFound) {
      // Fetch from Supabase public templates bucket
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      
      if (supabaseUrl) {
        const templateUrl = `${supabaseUrl}/storage/v1/object/public/templates/${OVO_FILE}`;
        console.log(`[upload-template] Fetching OVO template from: ${templateUrl}`);
        const resp = await fetch(templateUrl);
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          // Validate it's a ZIP file
          if (buffer.byteLength > 100 && new DataView(buffer).getUint32(0, true) === 0x04034b50) {
            const { error } = await supabase.storage.from(OVO_BUCKET).upload(OVO_FILE, buffer, {
              contentType: "application/vnd.ms-excel.sheet.macroEnabled.12",
              upsert: true,
            });
            results.ovo = error ? `error: ${error.message}` : "uploaded";
          } else {
            results.ovo = "fetched_file_not_valid_zip";
          }
        } else {
          results.ovo = `fetch_failed: ${resp.status}`;
        }
      } else {
        results.ovo = "no_supabase_url";
      }
    } else {
      results.ovo = "already_exists";
    }

    // Template ODD
    const ODD_BUCKET = "templates";
    const ODD_FILE = "ODD_template.xlsx";

    const { data: oddExists } = await supabase.storage.from(ODD_BUCKET).list("", { limit: 100 });
    const oddFound = oddExists?.some(f => f.name === ODD_FILE);

    if (!oddFound) {
      const origin = req.headers.get("origin") || req.headers.get("referer") || "";
      const baseUrl = origin ? new URL(origin).origin : "";

      if (baseUrl) {
        const templateUrl = `${baseUrl}/templates/${ODD_FILE}`;
        console.log(`[upload-template] Fetching ODD template from: ${templateUrl}`);
        const resp = await fetch(templateUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          const buffer = await blob.arrayBuffer();
          const { error } = await supabase.storage.from(ODD_BUCKET).upload(ODD_FILE, buffer, {
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            upsert: true,
          });
          results.odd = error ? `error: ${error.message}` : "uploaded";
        } else {
          results.odd = `fetch_failed: ${resp.status}`;
        }
      } else {
        results.odd = "no_origin";
      }
    } else {
      results.odd = "already_exists";
    }

    console.log("[upload-template] Results:", results);
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[upload-template] Error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
