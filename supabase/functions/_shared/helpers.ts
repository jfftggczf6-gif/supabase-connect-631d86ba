import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function verifyAndGetContext(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw { status: 401, message: "Non autorisé" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !user) throw { status: 401, message: "Non autorisé" };

  const { enterprise_id } = await req.json();
  if (!enterprise_id) throw { status: 400, message: "enterprise_id requis" };

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: ent } = await supabase.from("enterprises").select("*").eq("id", enterprise_id).single();
  if (!ent || (ent.user_id !== user.id && ent.coach_id !== user.id)) {
    throw { status: 404, message: "Entreprise non trouvée" };
  }

  // Get uploaded documents content (text-based only)
  const { data: files } = await supabase.storage.from("documents").list(enterprise_id);
  let documentContent = "";
  if (files && files.length > 0) {
    for (const file of files.slice(0, 5)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      // Skip binary files we can't parse in edge functions
      if (["docx", "xlsx", "xls", "zip", "png", "jpg", "jpeg", "gif"].includes(ext || "")) {
        documentContent += `\n\n--- Document: ${file.name} (format binaire, non lisible directement) ---`;
        continue;
      }
      const { data: fileData } = await supabase.storage.from("documents").download(`${enterprise_id}/${file.name}`);
      if (fileData) {
        const text = await fileData.text();
        documentContent += `\n\n--- Document: ${file.name} ---\n${text.substring(0, 15000)}`;
      }
    }
  }

  // Get all existing module data
  const { data: modulesData } = await supabase.from("enterprise_modules").select("*").eq("enterprise_id", enterprise_id);
  const moduleMap: Record<string, any> = {};
  (modulesData || []).forEach((m: any) => { moduleMap[m.module] = m.data || {}; });

  // Get existing deliverables
  const { data: delivs } = await supabase.from("deliverables").select("*").eq("enterprise_id", enterprise_id);
  const deliverableMap: Record<string, any> = {};
  (delivs || []).forEach((d: any) => { deliverableMap[d.type] = d.data || {}; });

  return { supabase, user, enterprise: ent, enterprise_id, documentContent, moduleMap, deliverableMap };
}

export async function callAI(systemPrompt: string, userPrompt: string) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!aiResponse.ok) {
    const status = aiResponse.status;
    if (status === 429) throw { status: 429, message: "Trop de requêtes, réessayez dans quelques instants." };
    if (status === 402) throw { status: 402, message: "Crédits IA insuffisants." };
    const errText = await aiResponse.text();
    console.error("AI error:", status, errText);
    throw { status: 500, message: "Erreur IA" };
  }

  const aiResult = await aiResponse.json();
  const content = aiResult.choices?.[0]?.message?.content || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
  } catch {
    console.error("Failed to parse AI response:", content.substring(0, 500));
    throw { status: 500, message: "Erreur de parsing IA" };
  }
}

export async function saveDeliverable(supabase: any, enterprise_id: string, type: string, data: any, moduleCode: string, htmlContent?: string) {
  await supabase.from("deliverables").upsert({
    enterprise_id,
    type,
    data,
    score: data.score || data.score_global || null,
    html_content: htmlContent || null,
    ai_generated: true,
    version: 1,
  }, { onConflict: "enterprise_id,type" });

  await supabase.from("enterprise_modules")
    .update({ status: "completed", progress: 100, data })
    .eq("enterprise_id", enterprise_id)
    .eq("module", moduleCode);
}
