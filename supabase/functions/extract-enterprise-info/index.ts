// Extract enterprise info using Anthropic Claude Sonnet
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, parseDocx, parseXlsx, errorResponse, jsonResponse } from "../_shared/helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Non autorisé", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return errorResponse("Non autorisé", 401);

    const { enterprise_id } = await req.json();
    if (!enterprise_id) return errorResponse("enterprise_id requis", 400);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: ent } = await supabase.from("enterprises").select("*").eq("id", enterprise_id).single();
    if (!ent || (ent.user_id !== user.id && ent.coach_id !== user.id)) {
      return errorResponse("Entreprise non trouvée", 404);
    }

    // Read uploaded documents
    const { data: files } = await supabase.storage.from("documents").list(enterprise_id);
    let documentContent = "";
    if (files && files.length > 0) {
      for (const file of files.slice(0, 5)) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        const { data: fileData } = await supabase.storage.from("documents").download(`${enterprise_id}/${file.name}`);
        if (!fileData) continue;

        if (ext === "docx" || ext === "doc") {
          const buffer = await fileData.arrayBuffer();
          const text = await parseDocx(buffer);
          documentContent += `\n--- ${file.name} ---\n${text.substring(0, 10000)}`;
        } else if (ext === "xlsx" || ext === "xls") {
          const buffer = await fileData.arrayBuffer();
          const text = await parseXlsx(buffer);
          documentContent += `\n--- ${file.name} ---\n${text.substring(0, 10000)}`;
        } else if (ext === "csv" || ext === "txt" || ext === "md") {
          const text = await fileData.text();
          documentContent += `\n--- ${file.name} ---\n${text.substring(0, 10000)}`;
        }
      }
    }

    if (!documentContent.trim()) {
      return jsonResponse({ name: null, country: null, sector: null });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return errorResponse("ANTHROPIC_API_KEY not configured", 500);

    const systemPrompt = `Tu es un extracteur d'informations d'entreprise. Analyse les documents fournis et extrais :
1. Le nom exact de l'entreprise (tel qu'il apparaît dans les documents)
2. Le pays où l'entreprise est basée
3. Le secteur d'activité principal

Réponds UNIQUEMENT avec un JSON valide, sans markdown ni texte autour :
{"name": "NOM EXACT", "country": "Pays", "sector": "Secteur d'activité"}

Si une information n'est pas trouvable, mets null pour ce champ.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          { role: "user", content: `Extrais les informations de l'entreprise depuis ces documents :\n\n${documentContent.substring(0, 15000)}` }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error("Anthropic API error:", aiResponse.status, errBody);
      return errorResponse("Erreur d'extraction IA", 500);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.content?.[0]?.text || "";

    try {
      let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
      const parsed = JSON.parse(cleaned);
      return jsonResponse({
        name: parsed.name || null,
        country: parsed.country || null,
        sector: parsed.sector || null,
      });
    } catch {
      console.error("Failed to parse AI response:", content);
      return jsonResponse({ name: null, country: null, sector: null });
    }
  } catch (e: any) {
    console.error("extract-enterprise-info error:", e);
    return errorResponse(e.message || "Erreur serveur", e.status || 500);
  }
});
