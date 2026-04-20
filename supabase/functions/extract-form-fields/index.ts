// v1 — Extract form fields from uploaded document 2026-03-26
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";

const RAILWAY_URL = "https://esono-parser-production-8f89.up.railway.app";
const RAILWAY_KEY = "esono-parser-2026-prod";

const SYSTEM_PROMPT = `Tu es un expert en extraction de formulaires. À partir du texte d'un document (formulaire de candidature, fiche d'inscription, appel à projets), extrais TOUS les champs que les candidats doivent remplir.

Retourne UNIQUEMENT un JSON valide :
{
  "form_fields": [
    {
      "label": "string — le libellé du champ",
      "type": "text | number | select | textarea | date | file | email | phone | checkbox",
      "required": true | false,
      "options": ["string — pour select uniquement"],
      "placeholder": "string — exemple de réponse attendue",
      "section": "string — nom de la section/rubrique"
    }
  ],
  "sections": ["string — les grandes rubriques identifiées"],
  "notes": "string — observations sur le formulaire"
}

RÈGLES :
- NE PAS inclure les champs standards (nom entreprise, nom contact, email, téléphone) — ils sont toujours présents par défaut
- Identifier le TYPE correct : montant → number, liste de choix → select avec options, paragraphe → textarea, date → date, fichier à joindre → file
- Si un champ a des choix multiples, les mettre dans "options"
- Marquer "required" les champs marqués * ou "obligatoire" dans le document
- Grouper par section si le formulaire est structuré
- Les options d'un select doivent être les choix réels extraits du document`;

async function parseViaRailway(fileBase64: string, fileName: string): Promise<string> {
  console.log(`[extract-form-fields] Parsing ${fileName} via Railway /parse...`);

  const binaryStr = atob(fileBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes]);

  const formData = new FormData();
  formData.append("file", blob, fileName);

  const resp = await fetch(`${RAILWAY_URL}/parse`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${RAILWAY_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`[extract-form-fields] Railway /parse failed:`, resp.status, errText.slice(0, 200));
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

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return errorResponse("Non autorisé", 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check role (legacy + org)
    const [{ data: roleData }, { data: orgMem }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("organization_members").select("role").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle(),
    ]);
    const orgRole = orgMem?.role;
    const isAdmin = roleData?.role === "super_admin";
    const isChef = roleData?.role === "chef_programme" || orgRole === "owner" || orgRole === "admin" || orgRole === "manager";
    if (!isAdmin && !isChef) return errorResponse("Accès refusé", 403);

    const body = await req.json();
    const { storage_path, file_base64, file_name } = body;

    if (!storage_path && !file_base64) {
      return errorResponse("storage_path ou file_base64 + file_name requis", 400);
    }

    // Get file content
    let base64Data: string;
    let fileName: string;

    if (file_base64 && file_name) {
      base64Data = file_base64;
      fileName = file_name;
    } else {
      const { data: fileData, error: dlError } = await supabase.storage
        .from("documents")
        .download(storage_path);
      if (dlError || !fileData) return errorResponse("Impossible de télécharger le document", 500);
      const ab = await fileData.arrayBuffer();
      base64Data = arrayBufferToBase64(ab);
      fileName = storage_path.split("/").pop() || "document";
    }

    // Parse
    const ext = fileName.toLowerCase().split(".").pop() || "";
    let rawText = "";

    if (ext === "txt" || ext === "md") {
      rawText = atob(base64Data);
    } else if (["pdf", "docx", "xlsx", "xls", "jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      rawText = await parseViaRailway(base64Data, fileName);
    } else {
      return errorResponse(`Format .${ext} non supporté.`, 400);
    }

    if (!rawText || rawText.trim().length < 30) {
      return errorResponse("Impossible d'extraire du texte du document.", 400);
    }

    console.log(`[extract-form-fields] Extracted ${rawText.length} chars from ${fileName}`);

    // Call AI
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
        messages: [{ role: "user", content: `DOCUMENT DU FORMULAIRE :\n\n${rawText.substring(0, 50000)}` }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[extract-form-fields] AI error:", aiResponse.status, errText.slice(0, 200));
      return errorResponse("Erreur lors de l'analyse IA", 500);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.content?.[0]?.text || "";

    let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return errorResponse("L'IA n'a pas retourné de JSON valide", 500);
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

    let extracted: any;
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      // Deep repair: fix trailing commas, unclosed brackets, control chars
      cleaned = cleaned
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/[\x00-\x1F\x7F]/g, " ");

      // Fix unclosed strings
      const quoteCount = (cleaned.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        cleaned = cleaned.replace(/"[^"]*$/, '""');
      }

      // Close unclosed brackets/braces
      let openBraces = (cleaned.match(/{/g) || []).length;
      let closeBraces = (cleaned.match(/}/g) || []).length;
      let openBrackets = (cleaned.match(/\[/g) || []).length;
      let closeBrackets = (cleaned.match(/]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += "]";
      for (let i = 0; i < openBraces - closeBraces; i++) cleaned += "}";

      try {
        extracted = JSON.parse(cleaned);
        console.log("[extract-form-fields] JSON repaired successfully");
      } catch (e2) {
        console.error("[extract-form-fields] JSON repair failed:", cleaned.slice(0, 300));
        return errorResponse("JSON invalide retourné par l'IA", 500);
      }
    }

    const usage = aiResult.usage;
    if (usage) {
      console.log(`[extract-form-fields] AI: ${usage.input_tokens} in + ${usage.output_tokens} out`);
    }

    console.log(`[extract-form-fields] ✅ ${extracted.form_fields?.length || 0} champs extraits`);

    return jsonResponse({
      success: true,
      form_fields: extracted.form_fields || [],
      sections: extracted.sections || [],
      notes: extracted.notes || "",
      file_name: fileName,
    });

  } catch (e: any) {
    console.error("[extract-form-fields] error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
