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

    const prompt = `You are translating UI text segments. Each segment is prefixed with a marker like [0], [1], [2], etc.

CRITICAL RULES:
1. Translate ONLY the text AFTER each marker into ${lang}
2. KEEP the markers EXACTLY as they are: [0], [1], [2], ... — DO NOT translate, modify, or remove them
3. Output one segment per line in the same order
4. Do NOT add explanations, headers, or any text outside the markers
5. Preserve numbers, currencies, percentages, and proper nouns
6. If a segment is already in ${lang}, return it unchanged with its marker

Example input:
[0] Bonjour
[1] Comment ça va ?
[2] CA: 12M FCFA

Example output (target=English):
[0] Hello
[1] How are you?
[2] Revenue: 12M FCFA

Now translate this:

${text}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(60_000),
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
