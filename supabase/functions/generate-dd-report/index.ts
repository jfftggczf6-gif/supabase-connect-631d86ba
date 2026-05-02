// generate-dd-report — Analyse les pièces DD + le memo actuel pour produire :
//   1. Une checklist DD initiale (items à vérifier par catégorie)
//   2. Des findings préliminaires (problèmes potentiels détectés depuis les pièces)
//
// Le user pourra ensuite éditer la checklist + les findings, puis "apply" les findings
// au memo (Module E suite).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildToneForAgent } from "../_shared/agent-tone.ts";
import {
  fetchSections,
  fetchDealDocuments,
  getLatestVersion,
  type MemoSectionCode,
} from "../_shared/memo-helpers.ts";
import { SECTION_LABELS } from "../_shared/memo-section-schemas.ts";

interface RequestBody {
  deal_id: string;
}

type DDCategory = 'financier' | 'juridique' | 'commercial' | 'operationnel' | 'rh' | 'esg' | 'fiscal' | 'it';
type DDSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

interface ChecklistItem {
  category: DDCategory;
  item_label: string;
  item_description?: string;
  position?: number;
}

interface Finding {
  category: DDCategory;
  severity: DDSeverity;
  title: string;
  body: string;
  recommendation?: string;
  impacts_section_codes: MemoSectionCode[];
}

interface DDReport {
  checklist: ChecklistItem[];
  findings: Finding[];
}

const DD_REPORT_SCHEMA = `{
  "checklist": [
    {
      "category": "financier|juridique|commercial|operationnel|rh|esg|fiscal|it",
      "item_label": "<libellé court de l'item à vérifier>",
      "item_description": "<précisions méthodologiques + sources nécessaires>",
      "position": <number ordre>
    }
  ],
  "findings": [
    {
      "category": "<une des 8 catégories ci-dessus>",
      "severity": "Critical|High|Medium|Low",
      "title": "<titre du finding (court)>",
      "body": "<description détaillée + chiffres + citations source>",
      "recommendation": "<action recommandée pour mitiger / clarifier>",
      "impacts_section_codes": ["<codes parmi: executive_summary, shareholding_governance, top_management, services, competition_market, unit_economics, financials_pnl, financials_balance, investment_thesis, support_requested, esg_risks, annexes>"]
    }
  ]
}`;

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

    // 1) Récupérer le deal (RLS)
    const { data: deal } = await userClient
      .from("pe_deals")
      .select(`
        id, organization_id, deal_ref, stage,
        ticket_demande, currency,
        enterprises!inner(name, sector, country)
      `)
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);

    const dealName = (deal.enterprises as any)?.name ?? "Sans nom";
    const sector = (deal.enterprises as any)?.sector ?? "n/d";
    const country = (deal.enterprises as any)?.country ?? "n/d";

    // 2) Récupérer le memo actuel (sections enrichies en IC1) pour contexte DD
    const activeVersion = await getLatestVersion(adminClient, body.deal_id, "note_ic1", "ready")
      ?? await getLatestVersion(adminClient, body.deal_id, "pre_screening", "ready");
    if (!activeVersion) {
      return errorResponse("No active memo to base DD on. Generate pre-screening first.", 400);
    }
    const sections = await fetchSections(adminClient, activeVersion.id);
    const memoSummary = sections.map(s =>
      `## ${SECTION_LABELS[s.section_code as MemoSectionCode] ?? s.section_code}\n${s.content_md ?? '(vide)'}`,
    ).join('\n\n').slice(0, 30000);

    // 3) Récupérer les pièces uploadées
    const docs = await fetchDealDocuments(adminClient, body.deal_id);
    if (docs.length === 0) return errorResponse("No documents to analyze for DD", 400);

    // 4) Parse les pièces via Railway
    let docContents = "";
    for (const doc of docs) {
      const { data: file, error: dlErr } = await adminClient
        .storage.from("pe_deal_docs").download(doc.storage_path);
      if (dlErr || !file) continue;
      const buffer = await file.arrayBuffer();
      const text = await callRailwayParser(buffer, doc.filename, doc.mime_type ?? "application/octet-stream");
      if (text) docContents += `\n\n=== ${doc.filename} (cat: ${(doc as any).category ?? 'autre'}) ===\n${text}`;
    }
    if (!docContents.trim()) {
      return errorResponse("Aucune pièce parsable pour la DD", 400);
    }

    // 5) Compose tone PE (DD analyste)
    const toneBlock = await buildToneForAgent(adminClient, deal.organization_id);

    const systemPrompt = `${toneBlock}

Tu es un AUDITEUR Due Diligence pour un fonds Private Equity. Le deal "${dealName}" (deal_ref: ${deal.deal_ref}, secteur: ${sector}, pays: ${country}) est entré en phase DD après IC1 (verdict provisoire).

═══ MISSION ═══
Tu dois produire :
1. Une checklist d'items à vérifier en DD, organisés par catégorie (8 catégories : financier, juridique, commercial, operationnel, rh, esg, fiscal, it). Cible 4-8 items par catégorie pertinente.
2. Une liste de findings préliminaires : problèmes ou points d'attention détectés en lisant les pièces vs le memo IC1. Chaque finding doit pointer vers les sections du memo qu'il impacte (champ impacts_section_codes).

═══ DIFFÉRENCE ENTRE CHECKLIST ET FINDINGS ═══
- Checklist : "à vérifier" — items neutres, pas encore tranchés. Ex : "Auditer liasses fiscales 2024 par cabinet indépendant".
- Findings : déjà observés en lisant les pièces. Ex : "Convention bail commercial dirigeant à 42M FCFA/an = 15% au-dessus du marché Yopougon (estimation 30-35M)".

═══ CRITÈRES POUR LES FINDINGS ═══
- Sévérité Critical : deal breaker potentiel
- Severity High : pénalité significative ou red flag majeur
- Severity Medium : point d'attention nécessitant clarification
- Severity Low : observation mineure
- impacts_section_codes : 1-3 codes max parmi les 12 sections (cible où l'info doit être ajoutée)
- Cite TOUJOURS la source dans body : [Source: nom_fichier.pdf p.X]

═══ FORMAT DE RÉPONSE ═══
Tu DOIS répondre avec un OBJET JSON STRICT respectant ce schéma :

${DD_REPORT_SCHEMA}

═══ MEMO IC1 ACTUEL (contexte) ═══
${memoSummary}

═══ PIÈCES DEAL (à analyser pour findings) ═══
${docContents.slice(0, 80000)}

═══ RÈGLES ═══
1. Chiffres EXACTS issus des documents. Pas d'invention.
2. Si une donnée manque : utilise null ou n'invente pas.
3. Cite les sources [Source: pitch.pdf p.3] dans body et item_description.
4. Réponse = UN seul JSON {"checklist": [...], "findings": [...]}. Pas de texte avant/après, pas de markdown fences.
5. Respecte les enums exacts pour category et severity.
6. impacts_section_codes : codes valides parmi les 12 sections du memo.
7. Cible : 20-40 items checklist au total, 5-15 findings préliminaires.`;

    const userPrompt = `Produis maintenant le rapport DD initial (checklist + findings) en JSON strict.`;

    const claudeResponse = await callAI(systemPrompt, userPrompt, 16384, undefined, 0.2, {
      functionName: "generate-dd-report",
      enterpriseId: deal.id,
    });

    let parsed: DDReport;
    try {
      parsed = typeof claudeResponse === "string" ? JSON.parse(claudeResponse) : claudeResponse;
    } catch (e: any) {
      throw new Error(`Claude response is not valid JSON: ${e.message}`);
    }

    if (!Array.isArray(parsed.checklist) || !Array.isArray(parsed.findings)) {
      throw new Error('Claude response missing checklist or findings array');
    }

    // 6) INSERT checklist en batch
    const checklistRows = parsed.checklist.map((item, idx) => ({
      deal_id: body.deal_id,
      organization_id: deal.organization_id,
      category: item.category,
      item_label: item.item_label,
      item_description: item.item_description ?? null,
      position: item.position ?? idx,
      status: 'pending',
    }));
    if (checklistRows.length > 0) {
      const { error: cErr } = await adminClient.from('pe_dd_checklist').insert(checklistRows);
      if (cErr) console.error(`[generate-dd-report] checklist insert failed: ${cErr.message}`);
    }

    // 7) INSERT findings en batch
    const findingRows = parsed.findings.map(f => ({
      deal_id: body.deal_id,
      organization_id: deal.organization_id,
      category: f.category,
      severity: f.severity,
      title: f.title,
      body: f.body,
      recommendation: f.recommendation ?? null,
      impacts_section_codes: Array.isArray(f.impacts_section_codes) ? f.impacts_section_codes : [],
      created_by: user.id,
      source: 'ai',
      status: 'open',
    }));
    if (findingRows.length > 0) {
      const { error: fErr } = await adminClient.from('pe_dd_findings').insert(findingRows);
      if (fErr) console.error(`[generate-dd-report] findings insert failed: ${fErr.message}`);
    }

    return jsonResponse({
      success: true,
      checklist_count: checklistRows.length,
      findings_count: findingRows.length,
    });
  } catch (err: any) {
    console.error(`[generate-dd-report] error: ${err.message}`);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
