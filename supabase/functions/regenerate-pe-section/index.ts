import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildToneForAgent } from "../_shared/agent-tone.ts";
import {
  fetchSections,
  fetchDealDocuments,
  type MemoSectionCode,
} from "../_shared/memo-helpers.ts";
import {
  SECTION_LABELS,
  SECTION_SCHEMAS,
  SECTION_DESCRIPTIONS,
} from "../_shared/memo-section-schemas.ts";

interface RequestBody {
  deal_id: string;
  section_code: MemoSectionCode;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Authorization required", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse("Not authenticated", 401);

    const body: RequestBody = await req.json();
    if (!body.deal_id || !body.section_code) {
      return errorResponse("deal_id and section_code required", 400);
    }
    if (!(body.section_code in SECTION_LABELS)) {
      return errorResponse(`Unknown section_code: ${body.section_code}`, 400);
    }

    // 1) Vérifier accès deal (RLS)
    const { data: deal } = await userClient
      .from("pe_deals")
      .select(`
        id, organization_id, deal_ref, stage,
        ticket_demande, currency, source,
        enterprises!inner(name, sector, country)
      `)
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);

    const dealName = (deal.enterprises as any)?.name ?? "Sans nom";
    const sector = (deal.enterprises as any)?.sector ?? "n/d";
    const country = (deal.enterprises as any)?.country ?? "n/d";

    // 2) Trouver la dernière version 'ready' (stage pre_screening / note_ic1 / note_ic_finale,
    //    on prend la version la plus récente quel que soit le stage — c'est sur celle-ci qu'on régénère)
    const { data: memo } = await adminClient
      .from("investment_memos").select("id").eq("deal_id", body.deal_id).maybeSingle();
    if (!memo) return errorResponse("No memo for this deal — generate pre-screening first", 400);

    const { data: vers } = await adminClient
      .from("memo_versions")
      .select("*")
      .eq("memo_id", memo.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1);
    const latestVersion = vers?.[0];
    if (!latestVersion) return errorResponse("No ready version to regenerate from", 400);

    // 3) Lire les autres sections de cette version (contexte) + les docs
    const sections = await fetchSections(adminClient, latestVersion.id);
    const targetSection = sections.find(s => s.section_code === body.section_code);
    if (!targetSection) return errorResponse(`Section ${body.section_code} not found in latest version`, 404);

    const otherSectionsSummary = sections
      .filter(s => s.section_code !== body.section_code)
      .map(s => `## ${SECTION_LABELS[s.section_code]}\n${s.content_md ?? '(vide)'}`)
      .join('\n\n');

    const docs = await fetchDealDocuments(adminClient, body.deal_id);
    let docContents = "";
    for (const doc of docs) {
      const { data: file } = await adminClient.storage.from("pe_deal_docs").download(doc.storage_path);
      if (!file) continue;
      const buf = await file.arrayBuffer();
      const text = await callRailwayParser(buf, doc.filename, doc.mime_type ?? "application/octet-stream");
      if (text) docContents += `\n\n=== ${doc.filename} ===\n${text}`;
    }

    // 4) Compose prompt focalisé sur LA section
    const toneBlock = await buildToneForAgent(adminClient, deal.organization_id);
    const sectionLabel = SECTION_LABELS[body.section_code];
    const sectionDescription = SECTION_DESCRIPTIONS[body.section_code];
    const jsonSchema = SECTION_SCHEMAS[body.section_code];

    const systemPrompt = `${toneBlock}

Tu RÉGÉNÈRES UNIQUEMENT la section "${sectionLabel}" du dossier d'investissement PE pour le deal "${dealName}" (${deal.deal_ref}, secteur ${sector}, pays ${country}).

═══ RÔLE DE LA SECTION ═══
${sectionDescription}

═══ SCHÉMA JSON STRICT ATTENDU pour content_json ═══
${jsonSchema}

═══ CHAMPS À PRODUIRE ═══
{
  "content_md": "<string markdown ~150-300 mots — le texte narratif de la section, complémentaire au content_json structuré>",
  "content_json": <objet conforme exactement au schéma ci-dessus>
}

═══ CONTEXTE — DOCUMENTS DEAL ═══
${docContents.slice(0, 60000) || '(aucun document parsable)'}

═══ CONTEXTE — AUTRES SECTIONS DU DOSSIER ═══
${otherSectionsSummary.slice(0, 30000)}

═══ RÈGLES ═══
1. Chiffres EXACTS issus des documents. Pas d'invention.
2. Si une donnée manque : utilise "n/d" ou null, JAMAIS d'invention.
3. Cite les sources [Source: pitch.pdf p.3] dans content_md ET dans les champs body/paragraphs du content_json.
4. Réponse = UN seul JSON {"content_md": "...", "content_json": {...}}. Pas de texte avant/après, pas de markdown fences.
5. Respecte les enums exacts : color = "ok"|"warning"|"danger"|"info" ; severity = "Critical"|"High"|"Medium"|"Low" ; status doc = "ok"|"partial"|"missing".`;

    // 5) Appel Claude
    const claudeJSON = await callAI(systemPrompt, `Régénère la section "${sectionLabel}" maintenant.`, 8192, undefined, 0.2, {
      functionName: "regenerate-pe-section",
      enterpriseId: deal.id,
    });

    let parsed: any;
    try {
      parsed = typeof claudeJSON === "string" ? JSON.parse(claudeJSON) : claudeJSON;
    } catch (e: any) {
      throw new Error(`Claude response is not valid JSON: ${e.message}`);
    }

    if (typeof parsed.content_md !== 'string') {
      throw new Error('Claude response missing content_md (must be string)');
    }

    // 6) UPDATE la section
    const { error: updErr } = await adminClient
      .from("memo_sections")
      .update({
        content_md: parsed.content_md,
        content_json: parsed.content_json ?? targetSection.content_json,
        last_edited_by: user.id,
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", targetSection.id);
    if (updErr) throw new Error(`UPDATE failed: ${updErr.message}`);

    return jsonResponse({
      success: true,
      section_id: targetSection.id,
      content_md: parsed.content_md,
      content_json: parsed.content_json ?? null,
    });
  } catch (err: any) {
    console.error(`[regenerate-pe-section] error: ${err.message}`);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});

async function callRailwayParser(buffer: ArrayBuffer, filename: string, mimeType: string): Promise<string> {
  const railwayUrl = Deno.env.get("RAILWAY_URL");
  const parserKey = Deno.env.get("PARSER_API_KEY");
  if (!railwayUrl || !parserKey) return "";
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: mimeType }), filename);
  const resp = await fetch(`${railwayUrl}/parse`, {
    method: "POST",
    headers: { "x-api-key": parserKey },
    body: formData,
  });
  if (!resp.ok) return "";
  const data = await resp.json();
  return data.text ?? data.content ?? "";
}
