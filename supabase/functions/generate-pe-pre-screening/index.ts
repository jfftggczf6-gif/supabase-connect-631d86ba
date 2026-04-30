import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildToneForAgent } from "../_shared/agent-tone.ts";
import {
  ensureInvestmentMemo,
  createMemoVersion,
  updateMemoVersion,
  insertMemoSections,
  fetchDealDocuments,
  nextVersionLabel,
  type MemoSectionCode,
} from "../_shared/memo-helpers.ts";

const SYSTEM_PROMPT_PE = `Tu produis un PRÉ-SCREENING 360° pour un deal de Private Equity.

═══ OBJECTIF ═══
Tu prépares un dossier d'investissement structuré en 12 sections fixes qui sera utilisé tel quel par le comité d'investissement. Chaque section doit être actionnable pour la décision d'investir ou non.

═══ FORMAT DE RÉPONSE ═══
Tu DOIS répondre avec un OBJET JSON STRICT respectant ce schéma :

{
  "overall_score": <number 0-100>,
  "classification": <string: 'go_conditionnel' | 'hold' | 'reject' | 'go_direct'>,
  "ai_synthesis": {
    "paragraph": <string narratif synthèse>,
    "strengths_tags": [<string>, ...],
    "weaknesses_tags": [<string>, ...]
  },
  "kpis_bandeau": [
    { "label": "CA 2025", "value": "2.8 Mds", "hint": "+18% YoY", "hint_color": "ok" },
    ...
  ],
  "context": {
    "activite": <string paragraphe>,
    "actionnariat": { "items": [{ "label": "M. Kouassi", "percent": 72, "subtitle": "Fondateur/DG" }, ...] },
    "management": { "items": [{ "name": "A. Kouassi", "role": "DG/Fondateur", "tag": "warning", "note": "Cumule DG+DAF — risque homme-clé" }, ...] }
  },
  "snapshot_3y": {
    "headers": ["2023", "2024", "2025"],
    "rows": [
      { "label": "Chiffre d'affaires", "values": ["2.0 Mds", "2.4 Mds", "2.8 Mds"] },
      { "label": "EBITDA déclaré", "values": ["250M", "340M", "420M"] },
      { "label": "EBITDA retraité", "values": ["n/d", "n/d", "320M"], "highlight": "warning" },
      { "label": "Résultat net", "values": ["120M", "180M", "230M"] },
      { "label": "Dette nette", "values": ["400M", "350M", "280M"] }
    ],
    "footnote": <string>
  },
  "use_of_proceeds": [
    { "label": "Nouvelle ligne de production", "percent": 60 },
    { "label": "Expansion régionale", "percent": 25 },
    { "label": "Fonds de roulement", "percent": 15 }
  ],
  "scenarios_returns": {
    "bear":  { "moic": "1.8x", "irr": "12%", "description": "..." },
    "base":  { "moic": "2.8x", "irr": "22%", "description": "..." },
    "bull":  { "moic": "4.1x", "irr": "33%", "description": "..." },
    "pre_money_indicatif": "10-14M EUR"
  },
  "thesis_match": {
    "criteria": [
      { "label": "Secteur cible", "status": "match" },
      { "label": "Ticket dans la fourchette", "status": "match" },
      { "label": "Géographie éligible", "status": "match" },
      { "label": "CA minimum requis", "status": "match" },
      { "label": "États financiers certifiés", "status": "partial" },
      { "label": "EBITDA positif exigé", "status": "match" }
    ],
    "match_count": 5,
    "total": 6,
    "score_percent": 83
  },
  "red_flags": [
    {
      "title": "Concentration client élevée",
      "severity": "high",
      "detail": "Top 3 clients = 62% du CA. Seuil d'alerte : 40%."
    },
    ...
  ],
  "doc_quality": {
    "categories": [
      {
        "name": "Financier",
        "level": "N2",
        "checklist": [
          { "label": "Liasses SYSCOHADA 3 ans", "status": "ok" },
          { "label": "Audit / certification", "status": "partial" }
        ]
      }
    ],
    "global_level": "N1.5",
    "summary": "8 documents fournis / 16 attendus"
  },
  "benchmark": {
    "headers": ["PharmaCi", "Médiane", "Quartile"],
    "rows": [
      { "ratio": "Marge brute", "company": "32%", "median": "28%", "quartile": "Q3" }
    ],
    "source": "knowledge_benchmarks pharma UEMOA · IFC 2024"
  },
  "recommendation": {
    "verdict": "go_conditionnel",
    "summary": <string narratif>,
    "conditions": [
      { "n": 1, "text": "Obtenir les liasses 2024-2025 certifiées" }
    ],
    "deal_breakers": ["Concentration client > 70%", "EBITDA retraité < 8%"],
    "conviction": "modéré"
  },
  "sections_md": {
    "executive_summary": <string markdown ~200 mots>,
    "shareholding_governance": <string markdown>,
    "top_management": <string markdown>,
    "services": <string markdown>,
    "competition_market": <string markdown>,
    "unit_economics": <string markdown>,
    "financials_pnl": <string markdown>,
    "financials_balance": <string markdown>,
    "investment_thesis": <string markdown>,
    "support_requested": <string markdown>,
    "esg_risks": <string markdown>,
    "annexes": <string markdown>
  }
}

═══ RÈGLES ═══
1. Chiffres EXACTS issus des documents. Pas d'invention.
2. Si une donnée manque : utilise "n/d" ou null, ne jamais inventer.
3. Cite les sources entre crochets : [Source: pitch.pdf p.3]
4. Le score global pondère : croissance, financier, thèse, ESG, qualité données, gouvernance.
5. Red flags : max 5, qualitatifs (sans points de pénalité).
6. Tu réponds UNIQUEMENT avec le JSON. Pas de préambule, pas de conclusion.`;

interface RequestBody {
  deal_id: string;
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
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    // 1) Vérifier que le user peut voir ce deal (RLS) + récupérer infos
    //    Note: pe_deals.name vient via enterprises; ticket = ticket_demande
    const { data: deal, error: dealErr } = await userClient
      .from("pe_deals")
      .select(`
        id, organization_id, enterprise_id, deal_ref, stage,
        ticket_demande, currency, source,
        enterprises!inner(name, sector, country)
      `)
      .eq("id", body.deal_id)
      .maybeSingle();
    if (dealErr || !deal) return errorResponse("Deal not found or not accessible", 404);

    const dealName = (deal.enterprises as any)?.name ?? "Sans nom";
    const dealSector = (deal.enterprises as any)?.sector ?? "n/d";
    const dealCountry = (deal.enterprises as any)?.country ?? "n/d";

    // 2) Récupérer les documents
    const docs = await fetchDealDocuments(adminClient, body.deal_id);
    if (docs.length === 0) return errorResponse("No documents to analyze", 400);

    // 3) Créer le memo + nouvelle version
    const memoId = await ensureInvestmentMemo(adminClient, body.deal_id, user.id);
    const { label, parent_id } = await nextVersionLabel(adminClient, memoId, "pre_screening");
    const versionId = await createMemoVersion(adminClient, {
      memo_id: memoId,
      label,
      parent_version_id: parent_id,
      stage: "pre_screening",
      status: "generating",
      generated_by_agent: "generate-pe-pre-screening",
      generated_by_user_id: user.id,
    });

    // 4) Auto-move stage si on est en sourcing
    const wasSourcing = deal.stage === "sourcing";
    if (wasSourcing) {
      await adminClient.from("pe_deals").update({ stage: "pre_screening" }).eq("id", deal.id);
    }

    try {
      // 5) Lire chaque document via Storage + parser Railway
      let docContents = "";
      for (const doc of docs) {
        const { data: file, error: dlErr } = await adminClient
          .storage.from("pe_deal_docs").download(doc.storage_path);
        if (dlErr || !file) {
          console.warn(`[generate-pe-pre-screening] download failed for ${doc.filename}: ${dlErr?.message}`);
          continue;
        }
        const arrayBuffer = await file.arrayBuffer();
        const text = await callRailwayParser(arrayBuffer, doc.filename, doc.mime_type ?? "application/octet-stream");
        if (text) {
          docContents += `\n\n=== ${doc.filename} ===\n${text}`;
        }
      }
      if (!docContents.trim()) throw new Error("Aucun document n'a pu être lu (parser Railway down ou docs vides)");

      // 6) Compose tone PE
      const toneBlock = await buildToneForAgent(adminClient, deal.organization_id);
      const finalSystemPrompt = `${toneBlock}\n\n${SYSTEM_PROMPT_PE}`;

      // 7) Appel Claude
      const userPrompt = `Voici les documents du deal "${dealName}" (deal_ref: ${deal.deal_ref ?? "n/d"}, ticket: ${deal.ticket_demande ?? "n/d"} ${deal.currency ?? "EUR"}, secteur: ${dealSector}, pays: ${dealCountry}).\n\n${docContents}\n\nProduis le pré-screening 360° au format JSON strict défini dans tes instructions système.`;

      const claudeJSON = await callAI(finalSystemPrompt, userPrompt, 24576, undefined, 0.2, {
        functionName: "generate-pe-pre-screening",
        enterpriseId: deal.id,
      });

      // 8) Parse JSON
      let parsed: any;
      try {
        parsed = typeof claudeJSON === "string" ? JSON.parse(claudeJSON) : claudeJSON;
      } catch (e: any) {
        throw new Error(`Claude response is not valid JSON: ${e.message}`);
      }

      // 9) Construire les 12 sections à partir du JSON Claude
      const sectionDocIds = docs.map(d => d.id);
      const sectionsMap: Partial<Record<MemoSectionCode, any>> = {
        executive_summary: {
          content_md: parsed.sections_md?.executive_summary ?? null,
          content_json: { kpis_bandeau: parsed.kpis_bandeau, ai_synthesis: parsed.ai_synthesis },
          source_doc_ids: sectionDocIds,
        },
        shareholding_governance: {
          content_md: parsed.sections_md?.shareholding_governance ?? null,
          content_json: { actionnariat: parsed.context?.actionnariat },
          source_doc_ids: sectionDocIds,
        },
        top_management: {
          content_md: parsed.sections_md?.top_management ?? null,
          content_json: { management: parsed.context?.management },
          source_doc_ids: sectionDocIds,
        },
        services: {
          content_md: parsed.sections_md?.services ?? null,
          content_json: { activite: parsed.context?.activite },
          source_doc_ids: sectionDocIds,
        },
        competition_market: {
          content_md: parsed.sections_md?.competition_market ?? null,
          content_json: { benchmark: parsed.benchmark },
          source_doc_ids: sectionDocIds,
        },
        unit_economics: {
          content_md: parsed.sections_md?.unit_economics ?? null,
          content_json: {},
          source_doc_ids: sectionDocIds,
        },
        financials_pnl: {
          content_md: parsed.sections_md?.financials_pnl ?? null,
          content_json: { snapshot_3y: parsed.snapshot_3y },
          source_doc_ids: sectionDocIds,
        },
        financials_balance: {
          content_md: parsed.sections_md?.financials_balance ?? null,
          content_json: {},
          source_doc_ids: sectionDocIds,
        },
        investment_thesis: {
          content_md: parsed.sections_md?.investment_thesis ?? null,
          content_json: {
            thesis_match: parsed.thesis_match,
            scenarios_returns: parsed.scenarios_returns,
            recommendation: parsed.recommendation,
          },
          source_doc_ids: sectionDocIds,
        },
        support_requested: {
          content_md: parsed.sections_md?.support_requested ?? null,
          content_json: { use_of_proceeds: parsed.use_of_proceeds },
          source_doc_ids: sectionDocIds,
        },
        esg_risks: {
          content_md: parsed.sections_md?.esg_risks ?? null,
          content_json: { red_flags: parsed.red_flags },
          source_doc_ids: sectionDocIds,
        },
        annexes: {
          content_md: parsed.sections_md?.annexes ?? null,
          content_json: { doc_quality: parsed.doc_quality },
          source_doc_ids: sectionDocIds,
        },
      };

      // 10) Insert sections + finalize version
      await insertMemoSections(adminClient, versionId, sectionsMap);
      await updateMemoVersion(adminClient, versionId, {
        status: "ready",
        overall_score: typeof parsed.overall_score === "number" ? parsed.overall_score : null,
        classification: parsed.classification ?? null,
        generated_at: new Date().toISOString(),
      });

      return jsonResponse({
        success: true,
        memo_id: memoId,
        version_id: versionId,
        overall_score: parsed.overall_score,
        classification: parsed.classification,
      });
    } catch (genErr: any) {
      // Marquer la version comme rejected + rollback stage si on était en sourcing
      console.error(`[generate-pe-pre-screening] generation failed: ${genErr.message}`);
      await updateMemoVersion(adminClient, versionId, {
        status: "rejected",
        error_message: genErr.message?.slice(0, 500) ?? "Unknown error",
      });
      if (wasSourcing) {
        await adminClient.from("pe_deals").update({ stage: "sourcing" }).eq("id", deal.id);
      }
      return errorResponse(`Generation failed: ${genErr.message}`, 500);
    }
  } catch (err: any) {
    console.error(`[generate-pe-pre-screening] outer error: ${err.message}`);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});

/** Appel proxy-parser pour extraire le texte d'un document. */
async function callRailwayParser(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const railwayUrl = Deno.env.get("RAILWAY_URL");
  const parserKey = Deno.env.get("PARSER_API_KEY");
  if (!railwayUrl || !parserKey) {
    console.warn("[generate-pe-pre-screening] RAILWAY_URL or PARSER_API_KEY not set, returning empty text");
    return "";
  }
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: mimeType }), filename);
  const resp = await fetch(`${railwayUrl}/parse`, {
    method: "POST",
    headers: { "x-api-key": parserKey },
    body: formData,
  });
  if (!resp.ok) {
    console.warn(`[generate-pe-pre-screening] parser returned ${resp.status} for ${filename}`);
    return "";
  }
  const data = await resp.json();
  return data.text ?? data.content ?? "";
}
