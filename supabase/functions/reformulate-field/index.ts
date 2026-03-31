import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = "claude-sonnet-4-6";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      enterprise_id,
      deliverable_id,
      deliverable_type,
      field_path,
      current_text,
      instruction,
      context,
    } = body;

    if (!current_text || !instruction) {
      return new Response(JSON.stringify({ error: "current_text and instruction required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch enterprise context for better reformulation
    const { data: enterprise } = await supabase
      .from("enterprises")
      .select("name, sector, country")
      .eq("id", enterprise_id)
      .single();

    const systemPrompt = `Tu es un rédacteur expert spécialisé dans les documents d'investissement pour PME africaines.
Tu dois reformuler UN SEUL passage de texte selon l'instruction du coach.

Règles :
- Conserve le même niveau de détail et le même ton professionnel
- Conserve les chiffres exacts sauf si l'instruction demande de les changer
- Conserve les sources et citations
- Retourne UNIQUEMENT le texte reformulé, sans guillemets, sans explication
- Écris en français`;

    const userPrompt = `Entreprise : ${enterprise?.name || "N/A"} (${enterprise?.sector || "N/A"}, ${enterprise?.country || "N/A"})
Document : ${deliverable_type}
Champ : ${field_path}
${context ? `\nContexte additionnel : ${context}` : ""}

═══ TEXTE ACTUEL ═══
${current_text}
═══ FIN TEXTE ═══

═══ INSTRUCTION DU COACH ═══
${instruction}
═══ FIN INSTRUCTION ═══

Reformule le texte selon l'instruction. Retourne UNIQUEMENT le nouveau texte.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const reformulated = data.content
      ?.filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n") || "";

    // Log activity (non-blocking)
    try {
      await supabase.from("activity_log").insert({
        enterprise_id,
        actor_id: user.id,
        actor_role: "coach",
        action: "reformulation",
        resource_type: "deliverable",
        resource_id: deliverable_id,
        deliverable_type,
        metadata: { field_path, instruction },
      });
    } catch { /* non-blocking */ }

    return new Response(JSON.stringify({ success: true, reformulated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[reformulate-field] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
