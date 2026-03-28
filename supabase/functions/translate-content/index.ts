import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set");

    const { text, target_lang } = await req.json();
    if (!text || !target_lang) {
      return new Response(JSON.stringify({ error: "text and target_lang required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = target_lang === 'en' ? 'English' : 'Français';

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: `Translate the following text to ${lang}. Keep the same formatting, structure, and tone. Do NOT add any explanation, just return the translated text.\n\n${text}`,
        }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`AI error ${resp.status}: ${err.slice(0, 200)}`);
    }

    const result = await resp.json();
    const translated = result.content?.[0]?.text || "";

    return new Response(JSON.stringify({ translated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[translate-content] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
