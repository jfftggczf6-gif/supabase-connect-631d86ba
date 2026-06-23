// v5 — Railway parsing + base64 input support 2026-03-26
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";

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

const RAILWAY_URL = "https://esono-parser-production-8f89.up.railway.app";
const RAILWAY_KEY = "esono-parser-2026-prod";

async function parseViaRailway(fileBase64: string, fileName: string): Promise<string> {
  console.log(`[extract-criteria] Parsing ${fileName} via Railway /parse (multipart)...`);

  // Decode base64 to binary
  const binaryStr = atob(fileBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes]);

  // Build multipart form data
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const resp = await fetch(`${RAILWAY_URL}/parse`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RAILWAY_KEY}`,
    },
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`[extract-criteria] Railway /parse failed:`, resp.status, errText.slice(0, 200));
    throw new Error(`Parsing échoué: ${resp.status}`);
  }

  const result = await resp.json();
  return result.text || result.content || "";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 32768;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Non autorisé", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    // Auth
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return errorResponse("Non autorisé", 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { storage_path, file_base64, file_name } = body;

    if (!storage_path && !file_base64) {
      return errorResponse("storage_path ou file_base64 + file_name requis", 400);
    }

    // Get file content
    let base64Data: string;
    let fileName: string;

    if (file_base64 && file_name) {
      // Option B: direct base64 upload
      base64Data = file_base64;
      fileName = file_name;
    } else {
      // Option A: download from Supabase Storage
      const { data: fileData, error: dlError } = await supabase.storage
        .from("documents")
        .download(storage_path);

      if (dlError || !fileData) {
        console.error("[extract-criteria] Download error:", dlError);
        return errorResponse("Impossible de télécharger le document", 500);
      }

      const ab = await fileData.arrayBuffer();
      base64Data = arrayBufferToBase64(ab);
      fileName = storage_path.split("/").pop() || "document";
    }

    // Detect format and parse
    const ext = fileName.toLowerCase().split(".").pop() || "";
    let rawText = "";

    if (ext === "txt" || ext === "md") {
      // Plain text — decode base64 directly
      rawText = atob(base64Data);
    } else if (["pdf", "docx", "xlsx", "xls", "jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      // Route to Railway for parsing
      rawText = await parseViaRailway(base64Data, fileName);
    } else {
      return errorResponse(`Format .${ext} non supporté. Utilisez PDF, DOCX, XLSX, TXT ou image.`, 400);
    }

    if (!rawText || rawText.trim().length < 30) {
      return errorResponse("Impossible d'extraire du texte du document. Essayez un autre format ou un fichier non scanné.", 400);
    }

    console.log(`[extract-criteria] Extracted ${rawText.length} chars from ${fileName}`);

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
        model: "claude-sonnet-4-6",
        max_tokens: 8192, // marge anti-troncature (Sonnet 4.6 verbeux, liste de critères) — ex-4096
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `DOCUMENT DU PROGRAMME :\n\n${rawText.substring(0, 50000)}` }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[extract-criteria] AI error:", aiResponse.status, errText.slice(0, 200));
      return errorResponse("Erreur lors de l'analyse IA", 500);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.content?.[0]?.text || "";

    // Parse JSON
    let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return errorResponse("L'IA n'a pas retourné de JSON valide", 500);
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

    let extracted: any;
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      cleaned = cleaned
        .replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")
        .replace(/[\x00-\x1F\x7F]/g, " ");
      const qc = (cleaned.match(/(?<!\\)"/g) || []).length;
      if (qc % 2 !== 0) cleaned = cleaned.replace(/"[^"]*$/, '""');
      let ob = (cleaned.match(/{/g) || []).length, cb = (cleaned.match(/}/g) || []).length;
      let oq = (cleaned.match(/\[/g) || []).length, cq = (cleaned.match(/]/g) || []).length;
      for (let i = 0; i < oq - cq; i++) cleaned += "]";
      for (let i = 0; i < ob - cb; i++) cleaned += "}";
      try {
        extracted = JSON.parse(cleaned);
      } catch {
        console.error("[extract-criteria] JSON repair failed:", cleaned.slice(0, 300));
        return errorResponse("JSON invalide retourné par l'IA", 500);
      }
    }

    // Token tracking
    const usage = aiResult.usage;
    if (usage) {
      console.log(`[extract-criteria] AI: ${usage.input_tokens} in + ${usage.output_tokens} out`);
    }

    return jsonResponse({
      success: true,
      extracted,
      raw_text_length: rawText.length,
      file_name: fileName,
    });

  } catch (e: any) {
    console.error("[extract-programme-criteria] error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
