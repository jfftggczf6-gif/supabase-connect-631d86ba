import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw { status: 401, message: "Non autorisé" };

    const { file_base64, file_name, media_type } = await req.json();
    if (!file_base64 || !file_name) throw { status: 400, message: "file_base64 et file_name requis" };

    console.log("[parse-vision] Processing:", file_name, "| base64 length:", file_base64.length);

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const mimeType = media_type || (file_name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    const contentType = file_name.endsWith('.pdf') ? 'document' : 'image';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            {
              type: contentType,
              source: { type: "base64", media_type: mimeType, data: file_base64 },
            },
            {
              type: "text",
              text: "Extrais TOUT le texte visible de ce document. Restitue les tableaux en format tabulaire. Inclus les en-têtes, les montants, les dates. Ne résume pas, extrais le contenu brut.",
            },
          ],
        }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      console.error("[parse-vision] API error:", response.status, err.substring(0, 200));
      throw { status: 500, message: "Erreur Vision API" };
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || "";

    console.log("[parse-vision] Extracted", text.length, "chars from", file_name);

    return new Response(JSON.stringify({ success: true, text, file_name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[parse-vision] Error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erreur" }), {
      status: e.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
