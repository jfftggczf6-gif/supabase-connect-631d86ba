import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

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

// ===== DOCX PARSER =====
export async function parseDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) return "[DOCX: contenu introuvable]";

    // Extract text from XML paragraphs
    let text = "";
    const paragraphs = docXml.split(/<w:p[ >]/);
    for (const para of paragraphs) {
      const runs = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const lineText = runs.map(r => {
        const m = r.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
        return m ? m[1] : "";
      }).join("");
      if (lineText.trim()) text += lineText + "\n";
    }

    // Also try headers/footers
    for (const fileName of Object.keys(zip.files)) {
      if ((fileName.startsWith("word/header") || fileName.startsWith("word/footer")) && fileName.endsWith(".xml")) {
        const headerXml = await zip.file(fileName)?.async("string");
        if (headerXml) {
          const runs = headerXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
          const headerText = runs.map(r => {
            const m = r.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
            return m ? m[1] : "";
          }).join(" ");
          if (headerText.trim()) text = headerText + "\n---\n" + text;
        }
      }
    }

    return text.trim() || "[DOCX: document vide]";
  } catch (e) {
    console.error("DOCX parse error:", e);
    return "[DOCX: erreur de parsing]";
  }
}

// ===== XLSX PARSER =====
export async function parseXlsx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Read shared strings
    const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
    const sharedStrings: string[] = [];
    if (sharedStringsXml) {
      const matches = sharedStringsXml.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
      for (const m of matches) {
        const val = m.match(/<t[^>]*>([^<]*)<\/t>/);
        sharedStrings.push(val ? val[1] : "");
      }
    }

    // Read workbook to get sheet names
    const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
    const sheetNames: string[] = [];
    if (workbookXml) {
      const nameMatches = workbookXml.match(/<sheet[^>]*name="([^"]*)"[^>]*\/>/g) || [];
      for (const nm of nameMatches) {
        const n = nm.match(/name="([^"]*)"/);
        if (n) sheetNames.push(n[1]);
      }
    }

    let result = "";
    // Parse each sheet
    const sheetFiles = Object.keys(zip.files).filter(f => f.match(/^xl\/worksheets\/sheet\d+\.xml$/)).sort();

    for (let si = 0; si < sheetFiles.length; si++) {
      const sheetXml = await zip.file(sheetFiles[si])?.async("string");
      if (!sheetXml) continue;

      const sheetName = sheetNames[si] || `Feuille ${si + 1}`;
      result += `\n=== ${sheetName} ===\n`;

      // Parse rows
      const rows = sheetXml.split(/<row /);
      for (let ri = 1; ri < rows.length; ri++) {
        const rowContent = rows[ri];
        const cells = rowContent.split(/<c /);
        const rowValues: string[] = [];

        for (let ci = 1; ci < cells.length; ci++) {
          const cell = cells[ci];
          const typeMatch = cell.match(/t="([^"]*)"/);
          const valueMatch = cell.match(/<v>([^<]*)<\/v>/);

          if (!valueMatch) {
            // Check for inline string
            const inlineMatch = cell.match(/<is><t>([^<]*)<\/t><\/is>/);
            rowValues.push(inlineMatch ? inlineMatch[1] : "");
            continue;
          }

          const rawValue = valueMatch[1];
          if (typeMatch && typeMatch[1] === "s") {
            // Shared string reference
            const idx = parseInt(rawValue, 10);
            rowValues.push(sharedStrings[idx] || rawValue);
          } else {
            rowValues.push(rawValue);
          }
        }

        if (rowValues.some(v => v.trim())) {
          result += rowValues.join("\t") + "\n";
        }
      }
    }

    return result.trim() || "[XLSX: classeur vide]";
  } catch (e) {
    console.error("XLSX parse error:", e);
    return "[XLSX: erreur de parsing]";
  }
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

  // Get uploaded documents content with DOCX/XLSX parsing
  const { data: files } = await supabase.storage.from("documents").list(enterprise_id);
  let documentContent = "";
  if (files && files.length > 0) {
    for (const file of files.slice(0, 10)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const { data: fileData } = await supabase.storage.from("documents").download(`${enterprise_id}/${file.name}`);
      if (!fileData) continue;

      if (ext === "docx" || ext === "doc") {
        const buffer = await fileData.arrayBuffer();
        const text = await parseDocx(buffer);
        documentContent += `\n\n--- Document: ${file.name} ---\n${text.substring(0, 20000)}`;
      } else if (ext === "xlsx" || ext === "xls") {
        const buffer = await fileData.arrayBuffer();
        const text = await parseXlsx(buffer);
        documentContent += `\n\n--- Tableur: ${file.name} ---\n${text.substring(0, 20000)}`;
      } else if (ext === "csv") {
        const text = await fileData.text();
        documentContent += `\n\n--- CSV: ${file.name} ---\n${text.substring(0, 20000)}`;
      } else if (ext === "txt" || ext === "md") {
        const text = await fileData.text();
        documentContent += `\n\n--- Document: ${file.name} ---\n${text.substring(0, 15000)}`;
      } else if (ext === "pdf") {
        // PDF needs specialized parsing - provide metadata only
        documentContent += `\n\n--- Document: ${file.name} (PDF - ${(file.metadata?.size || 0) / 1024}KB) ---`;
      } else {
        documentContent += `\n\n--- Document: ${file.name} (format non supporté) ---`;
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
    // Clean markdown wrapping
    let cleaned = content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // Find JSON boundaries
    const jsonStart = cleaned.search(/[\{\[]/);
    const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("No JSON found in AI response:", cleaned.substring(0, 300));
      throw { status: 500, message: "Erreur de parsing IA - pas de JSON détecté" };
    }

    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

    try {
      return JSON.parse(cleaned);
    } catch {
      // Fix common issues: trailing commas, control chars
      cleaned = cleaned
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/[\x00-\x1F\x7F]/g, "");

      // Attempt to fix truncated JSON by closing open braces/brackets
      const openBraces = (cleaned.match(/{/g) || []).length;
      const closeBraces = (cleaned.match(/}/g) || []).length;
      const openBrackets = (cleaned.match(/\[/g) || []).length;
      const closeBrackets = (cleaned.match(/\]/g) || []).length;

      if (openBrackets > closeBrackets || openBraces > closeBraces) {
        console.warn("Truncated JSON detected, attempting repair...");
        // Remove trailing incomplete value
        cleaned = cleaned.replace(/,\s*"[^"]*"?\s*:?\s*[^}\]]*$/, "");
        for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) cleaned += "}";
      }

      return JSON.parse(cleaned);
    }
  } catch (e: any) {
    if (e.status) throw e;
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

// ===== UEMOA FISCAL PARAMETERS =====
export const FISCAL_PARAMS: Record<string, {
  tva: number; is: number; ir_max: number; smig: number;
  patente: string; cotisations_sociales: number; devise: string;
}> = {
  "Côte d'Ivoire": { tva: 18, is: 25, ir_max: 36, smig: 60000, patente: "0.5% CA", cotisations_sociales: 23.5, devise: "FCFA" },
  "Sénégal": { tva: 18, is: 30, ir_max: 40, smig: 52500, patente: "Variable", cotisations_sociales: 22, devise: "FCFA" },
  "Mali": { tva: 18, is: 30, ir_max: 40, smig: 40000, patente: "Variable", cotisations_sociales: 22, devise: "FCFA" },
  "Burkina Faso": { tva: 18, is: 27.5, ir_max: 35, smig: 34664, patente: "Variable", cotisations_sociales: 21.5, devise: "FCFA" },
  "Bénin": { tva: 18, is: 30, ir_max: 35, smig: 40000, patente: "Variable", cotisations_sociales: 22.4, devise: "FCFA" },
  "Togo": { tva: 18, is: 27, ir_max: 35, smig: 35000, patente: "Variable", cotisations_sociales: 21, devise: "FCFA" },
  "Niger": { tva: 19, is: 30, ir_max: 35, smig: 30047, patente: "Variable", cotisations_sociales: 21.5, devise: "FCFA" },
  "Guinée-Bissau": { tva: 17, is: 25, ir_max: 30, smig: 19030, patente: "Variable", cotisations_sociales: 18, devise: "FCFA" },
  "Cameroun": { tva: 19.25, is: 33, ir_max: 35, smig: 41875, patente: "Variable", cotisations_sociales: 18.5, devise: "FCFA" },
  "Gabon": { tva: 18, is: 30, ir_max: 35, smig: 150000, patente: "Variable", cotisations_sociales: 20.1, devise: "FCFA" },
  "Congo": { tva: 18.9, is: 28, ir_max: 40, smig: 90000, patente: "Variable", cotisations_sociales: 22.5, devise: "FCFA" },
  "RDC": { tva: 16, is: 30, ir_max: 40, smig: 7075, patente: "Variable", cotisations_sociales: 13.5, devise: "CDF" },
};

export function getFiscalParams(country: string) {
  return FISCAL_PARAMS[country] || FISCAL_PARAMS["Côte d'Ivoire"];
}
