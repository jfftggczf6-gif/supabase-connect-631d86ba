// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, parseDocx, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";

const SYSTEM_PROMPT = `Tu es un analyste spécialisé dans l'extraction de critères de programmes de financement à partir de documents officiels (appels à projets, termes de référence, guides de candidature).

À partir du document fourni, extrais TOUS les critères d'éligibilité et de sélection sous forme structurée JSON.

IMPORTANT :
- Extrais les seuils financiers quand ils sont mentionnés (CA minimum, ratio dette, marge, etc.)
- Identifie les secteurs ciblés et les pays éligibles
- Identifie les livrables ou documents requis
- Capture les critères qualitatifs dans custom_criteria
- Si un critère n'est pas mentionné, utilise les valeurs par défaut indiquées
- Le nom du programme doit être extrait du document

Réponds UNIQUEMENT en JSON valide selon ce schéma :
{
  "name": "string — nom du programme extrait du document",
  "description": "string — résumé en 2-3 phrases du programme",
  "min_score_ir": <0-100, défaut 0>,
  "max_score_ir": <0-100, défaut 100>,
  "min_revenue": <number en FCFA, défaut 0>,
  "max_debt_ratio": <number %, défaut 100>,
  "min_margin": <number %, défaut 0>,
  "sector_filter": ["string — secteurs ciblés"],
  "country_filter": ["string — pays éligibles"],
  "required_deliverables": ["string — parmi: bmc_analysis, sic_analysis, inputs_data, framework_data, diagnostic_data, plan_ovo, business_plan, odd_analysis, screening_report"],
  "custom_criteria": {
    "criteres_eligibilite": ["string — critères d'éligibilité textuels"],
    "criteres_selection": ["string — critères de sélection/notation"],
    "conditions_specifiques": ["string — conditions particulières"],
    "objectifs_programme": ["string — objectifs du programme"],
    "montant_financement": "string — montant ou fourchette de financement",
    "duree_programme": "string — durée du programme",
    "date_limite": "string — date limite de candidature si mentionnée"
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Non autorisé", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return errorResponse("Non autorisé", 401);
    const userId = claimsData.claims.sub as string;

    const { storage_path } = await req.json();
    if (!storage_path) return errorResponse("storage_path requis", 400);

    // Download the file from storage
    const { data: fileData, error: dlError } = await supabase.storage
      .from("documents")
      .download(storage_path);

    if (dlError || !fileData) {
      console.error("Download error:", dlError);
      return errorResponse("Impossible de télécharger le document", 500);
    }

    // Parse the document
    let rawText = "";
    const lowerPath = storage_path.toLowerCase();

    if (lowerPath.endsWith(".docx")) {
      const ab = await fileData.arrayBuffer();
      rawText = await parseDocx(ab);
    } else if (lowerPath.endsWith(".pdf")) {
      // For PDFs, extract text using basic method
      const text = await fileData.text();
      // PDF binary — try to extract readable strings
      const readable = text.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, " ").replace(/\s{3,}/g, "\n");
      if (readable.trim().length > 100) {
        rawText = readable.substring(0, 50000);
      } else {
        // Use Claude Vision for PDF
        const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
        if (anthropicKey) {
          const ab = await fileData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(ab.slice(0, 5 * 1024 * 1024))));
          const visionRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 8192,
              messages: [{
                role: "user",
                content: [
                  { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
                  { type: "text", text: "Extrais le texte complet de ce document. Retourne uniquement le texte brut, sans commentaire." }
                ]
              }]
            }),
          });
          if (visionRes.ok) {
            const vr = await visionRes.json();
            rawText = vr.content?.[0]?.text || "";
          }
        }
      }
    } else if (lowerPath.endsWith(".txt") || lowerPath.endsWith(".md")) {
      rawText = await fileData.text();
    } else {
      return errorResponse("Format non supporté. Utilisez PDF, DOCX ou TXT.", 400);
    }

    if (!rawText || rawText.trim().length < 50) {
      return errorResponse("Impossible d'extraire du texte du document. Essayez un autre format.", 400);
    }

    // Call AI to extract structured criteria
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `DOCUMENT DU PROGRAMME :\n\n${rawText.substring(0, 30000)}` }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return errorResponse("Erreur lors de l'analyse IA", 500);
    }

    const aiResult = await aiResponse.json();
    let content = aiResult.content?.[0]?.text || "";

    // Parse JSON from AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return errorResponse("L'IA n'a pas retourné de JSON valide", 500);

    let extracted: any;
    try {
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      return errorResponse("JSON invalide retourné par l'IA", 500);
    }

    return jsonResponse({
      success: true,
      extracted,
      raw_text: rawText.substring(0, 100000),
    });
  } catch (e: any) {
    console.error("extract-programme-criteria error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
