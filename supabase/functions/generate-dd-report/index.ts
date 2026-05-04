// generate-dd-report — Analyse les RAPPORTS DD EXTERNES uploadés et les compare au memo IC1
// pour produire des findings (écarts détectés) et une checklist d'items à vérifier.
//
// La DD est externalisée (cabinet d'expertise produit son propre rapport DD). L'IA ne fait pas
// la DD elle-même — elle compare le rapport DD externe avec le memo IC1 actuel et identifie
// les écarts factuels et les nouveaux red flags.
//
// Le user pourra ensuite éditer / valider les findings, puis "apply" au memo (apply-dd-findings-to-memo).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildAgentContext } from "../_shared/agent-context.ts";
import {
  fetchSections,
  getLatestVersion,
  type MemoSectionCode,
} from "../_shared/memo-helpers.ts";
import { SECTION_LABELS } from "../_shared/memo-section-schemas.ts";

interface RequestBody {
  deal_id: string;
}

type DDCategory = 'financier' | 'juridique' | 'commercial' | 'operationnel' | 'rh' | 'esg' | 'fiscal' | 'it';
type DDSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
type DDFindingType = 'confirmation' | 'adjustment' | 'red_flag' | 'informative';

interface ChecklistItem {
  category: DDCategory;
  item_label: string;
  item_description?: string;
  position?: number;
}

interface Finding {
  category: DDCategory;
  finding_type: DDFindingType;
  severity: DDSeverity;
  title: string;
  body: string;
  recommendation?: string;
  source_paragraph?: string;       // ex: "§4.3.2"
  source_page?: number;             // ex: 28
  source_filename?: string;         // ex: "DD_KPMG.pdf" (pour mapper source_doc_id côté serveur)
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
      "finding_type": "confirmation|adjustment|red_flag|informative",
      "severity": "Critical|High|Medium|Low",
      "title": "<titre du finding (court)>",
      "body": "<description détaillée + chiffres>",
      "recommendation": "<action recommandée pour mitiger / clarifier>",
      "source_paragraph": "<référence paragraphe, ex: '§4.3.2' ou '4.3.2' ou 'Section 4.3'>",
      "source_page": <number page (ex: 28) ou null si non précis>,
      "source_filename": "<nom exact du rapport DD source, ex: 'DD_KPMG_PharmaCi.pdf' — doit matcher un des fichiers fournis>",
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

    // 3) Récupérer SEULEMENT les rapports DD externes (is_dd_report = true)
    const { data: ddDocs } = await adminClient
      .from('pe_deal_documents')
      .select('id, filename, storage_path, mime_type, category')
      .eq('deal_id', body.deal_id)
      .eq('is_dd_report', true)
      .order('created_at', { ascending: false });
    if (!ddDocs || ddDocs.length === 0) {
      return errorResponse(
        "Aucun rapport DD externe uploadé. Upload d'abord le rapport du cabinet de DD via la zone dédiée.",
        400,
      );
    }

    // 4) Parse les rapports DD via Railway
    let ddReportContents = "";
    for (const doc of ddDocs) {
      const { data: file, error: dlErr } = await adminClient
        .storage.from("pe_deal_docs").download(doc.storage_path);
      if (dlErr || !file) continue;
      const buffer = await file.arrayBuffer();
      const text = await callRailwayParser(buffer, doc.filename, doc.mime_type ?? "application/octet-stream");
      if (text) ddReportContents += `\n\n=== RAPPORT DD : ${doc.filename} ===\n${text}`;
    }
    if (!ddReportContents.trim()) {
      return errorResponse("Rapport DD non parsable (parser Railway down ou docs corrompus)", 400);
    }

    // 5) Contexte agent complet (tone PE + benchmarks + RAG + guardrails)
    const agentCtx = await buildAgentContext(adminClient, deal.organization_id, {
      deliverableType: 'dd_report',
      country,
      sector,
      enterpriseId: (deal as any).enterprise_id ?? null,
    });

    const taskPrompt = `Tu es un ANALYSTE PE qui compare le RAPPORT DD EXTERNE (produit par un cabinet d'expertise indépendant) avec le MEMO IC1 ACTUEL du deal "${dealName}" (deal_ref: ${deal.deal_ref}, secteur: ${sector}, pays: ${country}).

═══ MISSION ═══
Tu LIS le rapport DD externe et tu identifies :
1. Les FINDINGS = écarts factuels, nouveaux red flags, confirmations ou infirmations vs le memo IC1.
   Chaque finding pointe vers les sections du memo qu'il impacte (champ impacts_section_codes).
2. Une CHECKLIST d'items résiduels que la DD n'a pas couverts ou qui méritent vérification additionnelle (par exemple : visite site complémentaire, analyse environnementale spécifique).

═══ 4 TYPES DE FINDINGS (finding_type) ═══
- "confirmation" (vert) : la DD CONFIRME une affirmation du memo IC1, renforce
  Ex : "Le rapport DD confirme la concentration client 62% top 3 mentionnée en memo IC1"
- "adjustment" (orange) : la DD AJUSTE un chiffre / fait du memo IC1
  Ex : "EBITDA retraité revu de 520M à 475M (-8.7%) — KPMG identifie 45M de charges perso supplémentaires"
- "red_flag" (rouge) : la DD identifie un NOUVEAU red flag non détecté en IC1
  Ex : "Litige fournisseur Pentair 180M FCFA non provisionné, découvert par KPMG"
- "informative" (gris) : observation contextuelle, ni confirmation ni ajustement
  Ex : "Le cabinet recommande un audit complémentaire sur la chaîne d'approvisionnement"

═══ CRITÈRES SÉVÉRITÉ (severity, indépendant du finding_type) ═══
- "Critical" : deal breaker (red flag bloquant ou retraitement matériel >15%)
- "High" : retraitement matériel chiffres 5-15% ou red flag impact fort
- "Medium" : ajustement nécessaire mais non bloquant (<5%)
- "Low" : observation mineure
- impacts_section_codes : 1-3 codes max parmi les 12 sections du memo

═══ SOURCE PRÉCISE OBLIGATOIRE ═══
Chaque finding DOIT avoir :
- source_filename : nom exact du rapport DD source (depuis les rapports listés ci-dessous)
- source_paragraph : référence paragraphe exact (ex: "§4.3.2") — vu dans le rapport
- source_page : numéro de page (integer, ex: 28) — vu dans le rapport
Si tu ne peux pas localiser précisément, utilise null pour page mais essaie toujours de trouver le paragraphe.

═══ DIFFÉRENCE FINDING vs CHECKLIST RÉSIDUELLE ═══
- Finding : conclusion DÉJÀ posée par le rapport DD que tu transcris
- Checklist résiduelle : action additionnelle à faire CAR le rapport DD ne l'a pas couvert

═══ FORMAT DE RÉPONSE ═══
Tu DOIS répondre avec un OBJET JSON STRICT respectant ce schéma :

${DD_REPORT_SCHEMA}

═══ MEMO IC1 ACTUEL (état avant DD) ═══
${memoSummary}

═══ RAPPORT DD EXTERNE (à analyser pour identifier les findings) ═══
${ddReportContents.slice(0, 80000)}

═══ RÈGLES ═══
1. Tu RAPPORTES ce que le rapport DD a trouvé — tu n'inventes RIEN.
2. Si le rapport DD ne mentionne pas un sujet → ne crée pas de finding sur ce sujet.
3. Cite TOUJOURS la source [Source: nom_rapport_dd.pdf p.X] dans body.
4. Réponse = UN seul JSON {"checklist": [...], "findings": [...]}. Pas de texte avant/après, pas de markdown fences.
5. Respecte les enums exacts pour category et severity.
6. impacts_section_codes : codes valides parmi les 12 sections du memo.
7. Cible : 8-25 findings (selon richesse rapport DD), 0-15 items checklist résiduelle.`;

    const systemPrompt = agentCtx.composeSystemPrompt(taskPrompt);
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

    // 7) INSERT findings en batch — résoudre source_doc_id depuis source_filename
    const docByFilename: Record<string, string> = {};
    ddDocs.forEach(d => { docByFilename[d.filename] = d.id; });
    const findingRows = parsed.findings.map(f => {
      // Best-effort match du source_filename → source_doc_id
      let source_doc_id: string | null = null;
      if (f.source_filename) {
        source_doc_id = docByFilename[f.source_filename] ?? null;
        if (!source_doc_id) {
          // Fuzzy : on cherche un fichier dont le nom contient/est contenu dans source_filename
          const match = ddDocs.find(d => d.filename.includes(f.source_filename!) || f.source_filename!.includes(d.filename));
          if (match) source_doc_id = match.id;
        }
      }
      return {
        deal_id: body.deal_id,
        organization_id: deal.organization_id,
        category: f.category,
        finding_type: f.finding_type ?? 'informative',
        severity: f.severity,
        title: f.title,
        body: f.body,
        recommendation: f.recommendation ?? null,
        source_paragraph: f.source_paragraph ?? null,
        source_page: typeof f.source_page === 'number' ? f.source_page : null,
        source_doc_id,
        impacts_section_codes: Array.isArray(f.impacts_section_codes) ? f.impacts_section_codes : [],
        created_by: user.id,
        source: 'ai',
        status: 'open',
      };
    });
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
