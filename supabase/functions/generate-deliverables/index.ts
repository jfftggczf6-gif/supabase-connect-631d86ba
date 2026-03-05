import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;

    const { enterprise_id } = await req.json();
    if (!enterprise_id) {
      return new Response(JSON.stringify({ error: "enterprise_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify ownership
    const { data: ent, error: entErr } = await supabase.from("enterprises").select("*").eq("id", enterprise_id).single();
    if (entErr || !ent || (ent.user_id !== userId && ent.coach_id !== userId)) {
      return new Response(JSON.stringify({ error: "Enterprise not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get uploaded file contents from storage
    const { data: files } = await supabase.storage.from("documents").list(enterprise_id);
    let documentContent = "";

    if (files && files.length > 0) {
      for (const file of files.slice(0, 5)) {
        const { data: fileData } = await supabase.storage.from("documents").download(`${enterprise_id}/${file.name}`);
        if (fileData) {
          const text = await fileData.text();
          documentContent += `\n\n--- Document: ${file.name} ---\n${text.substring(0, 10000)}`;
        }
      }
    }

    // Get existing module data
    const { data: modules } = await supabase.from("enterprise_modules").select("*").eq("enterprise_id", enterprise_id);
    const moduleData = (modules || []).reduce((acc: any, m: any) => {
      acc[m.module] = m.data || {};
      return acc;
    }, {});

    const prompt = `Tu es un expert en analyse d'entreprises africaines et en investment readiness. 
Analyse les données suivantes pour l'entreprise "${ent.name}" (secteur: ${ent.sector || "non spécifié"}).

${documentContent ? `DOCUMENTS UPLOADÉS:\n${documentContent}` : ""}

DONNÉES DES MODULES:
${JSON.stringify(moduleData, null, 2)}

Génère une analyse complète avec les livrables suivants. Réponds en JSON avec cette structure exacte:
{
  "bmc_analysis": {
    "score": <number 0-100>,
    "analysis": "<analyse détaillée du Business Model Canvas>",
    "recommendations": ["<recommandation 1>", "<recommandation 2>"]
  },
  "sic_analysis": {
    "score": <number 0-100>,
    "analysis": "<analyse de l'impact social et alignement ODD>",
    "odd_alignment": ["<ODD 1>", "<ODD 2>"]
  },
  "framework_data": {
    "score": <number 0-100>,
    "ratios": {"<ratio>": "<valeur>"},
    "analysis": "<analyse financière>"
  },
  "diagnostic_data": {
    "score": <number 0-100>,
    "strengths": ["<force>"],
    "weaknesses": ["<faiblesse>"],
    "opportunities": ["<opportunité>"],
    "threats": ["<menace>"]
  },
  "plan_ovo": {
    "score": <number 0-100>,
    "scenarios": {
      "optimistic": "<description>",
      "realistic": "<description>",
      "pessimistic": "<description>"
    }
  },
  "business_plan": {
    "score": <number 0-100>,
    "executive_summary": "<résumé exécutif>",
    "market_analysis": "<analyse de marché>",
    "strategy": "<stratégie>"
  },
  "odd_analysis": {
    "score": <number 0-100>,
    "readiness_level": "<niveau>",
    "checklist": [{"item": "<critère>", "status": "pass|fail|partial", "comment": "<commentaire>"}]
  },
  "global_score": <number 0-100>
}`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Tu es un analyste expert en entreprises africaines. Réponds uniquement en JSON valide." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      return new Response(JSON.stringify({ error: "Erreur IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    let analysis: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content.substring(0, 500));
      return new Response(JSON.stringify({ error: "Erreur de parsing IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Save deliverables
    const deliverableTypes = [
      "bmc_analysis", "sic_analysis", "framework_data", 
      "diagnostic_data", "plan_ovo", "business_plan", "odd_analysis"
    ];

    for (const type of deliverableTypes) {
      if (analysis[type]) {
        await supabase.from("deliverables").upsert({
          enterprise_id,
          type,
          data: analysis[type],
          score: analysis[type].score || null,
          ai_generated: true,
          version: 1,
        }, { onConflict: "enterprise_id,type" });
      }
    }

    // Update module statuses
    const moduleMapping: Record<string, string> = {
      bmc_analysis: "bmc",
      sic_analysis: "sic",
      framework_data: "framework",
      diagnostic_data: "diagnostic",
      plan_ovo: "plan_ovo",
      business_plan: "business_plan",
      odd_analysis: "odd",
    };

    for (const [delivType, modCode] of Object.entries(moduleMapping)) {
      if (analysis[delivType]) {
        await supabase.from("enterprise_modules")
          .update({ status: "completed", progress: 100, data: analysis[delivType] })
          .eq("enterprise_id", enterprise_id)
          .eq("module", modCode);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      global_score: analysis.global_score || 0,
      deliverables_count: deliverableTypes.filter(t => analysis[t]).length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("generate-deliverables error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
