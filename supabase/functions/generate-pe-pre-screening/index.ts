import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildAgentContext } from "../_shared/agent-context.ts";
import {
  ensureInvestmentMemo,
  createMemoVersion,
  updateMemoVersion,
  insertMemoSections,
  fetchDealDocuments,
  nextVersionLabel,
  type MemoSectionCode,
} from "../_shared/memo-helpers.ts";
import {
  SECTION_LABELS,
  SECTION_NUMBERS,
  SECTION_SCHEMAS,
  SECTION_DESCRIPTIONS,
} from "../_shared/memo-section-schemas.ts";

interface RequestBody {
  deal_id: string;
}

interface SectionContent {
  content_md: string | null;
  content_json: any;
}

interface DealContext {
  name: string;
  ref: string;
  sector: string;
  country: string;
  ticket: string;
  currency: string;
}

/** Appel Claude pour générer une section avec son schéma rich. */
async function generateSection(
  args: {
    sectionCode: MemoSectionCode;
    deal: DealContext;
    docContents: string;
    otherSectionsContext?: string;
    contextPrefix: string;
    wrapWithGuardrails: (s: string) => string;
    enterpriseId: string;
  },
): Promise<SectionContent> {
  const { sectionCode, deal, docContents, otherSectionsContext, contextPrefix, wrapWithGuardrails, enterpriseId } = args;
  const sectionLabel = SECTION_LABELS[sectionCode];
  const sectionNumber = SECTION_NUMBERS[sectionCode];
  const sectionDescription = SECTION_DESCRIPTIONS[sectionCode];
  const jsonSchema = SECTION_SCHEMAS[sectionCode];

  const otherSectionsBlock = otherSectionsContext
    ? `\n\n═══ CONTEXTE — AUTRES SECTIONS DÉJÀ RÉDIGÉES (utilise pour synthèse cohérente) ═══\n${otherSectionsContext.slice(0, 30000)}\n`
    : '';

  const systemPrompt = wrapWithGuardrails(`${contextPrefix}

Tu produis la section ${sectionNumber} — "${sectionLabel}" du dossier d'investissement PE pour le deal "${deal.name}" (deal_ref: ${deal.ref}, secteur: ${deal.sector}, pays: ${deal.country}, ticket demandé: ${deal.ticket} ${deal.currency}).

═══ RÔLE DE LA SECTION ═══
${sectionDescription}

═══ SCHÉMA JSON STRICT ATTENDU pour content_json ═══
${jsonSchema}

═══ CHAMPS À PRODUIRE ═══
{
  "content_md": "<string markdown LONG-FORM 500-1000 mots — voir spec ci-dessous>",
  "content_json": <objet conforme exactement au schéma ci-dessus>
}

═══ SPEC content_md — STYLE MEMO IC INSTITUTIONNEL ═══
Le content_md est le LIVRABLE PRINCIPAL — ce texte sera lu par le comité d'investissement et les co-investisseurs DFI dans le memo Word/PDF final. Il doit ressembler à un memo de banque d'affaires de premier rang. À ce stade pré-screening, le memo sera ensuite enrichi en IC1 (donc pas besoin d'aller au maximum de détail, mais déjà rédactionnel propre).

LONGUEUR : 500 à 1000 mots (sauf annexes : 300-500 mots).

STRUCTURE :
- Pas de titre H1 (rendu par le viewer).
- 2 à 4 sous-sections en H3 (### Sous-titre) adaptées au sujet de la section.
- Paragraphes denses de 5 à 10 lignes, prose continue. Pas de bullet points sauf liste explicite type "Points clés".

STYLE D'ÉCRITURE :
- Chaque chiffre/affirmation factuelle est justifié dans la même phrase ou le paragraphe immédiat.
- Sources inline : "(source: pitch deck p.3)", "(source: SYSCOHADA 2024)", "(source: I&P IPAE 2023-2024)". Préférer cette forme aux crochets [Source: ...].
- Vocabulaire institutionnel : "la cible", "le dirigeant", "le deal", "la trajectoire".
- Connecteurs logiques entre paragraphes ("Par ailleurs", "Cependant", "À noter que").

EXEMPLE (extrait financials_pnl) :
"### Croissance et marges

PharmaCi affiche un chiffre d'affaires de 2,82 milliards FCFA en 2024, en croissance de 18% sur 3 ans (CAGR — source: liasses SYSCOHADA 2023-2025), portée principalement par l'extension du canal AO publics passé de 45% à 60% du mix. La marge brute consolidée ressort à 32%, supérieure de 4 points à la médiane sectorielle UEMOA (28% — source: I&P IPAE Africa 2023-2024)..."

═══ CONTEXTE — DOCUMENTS DEAL ═══
${docContents.slice(0, 60000) || '(aucun document parsable)'}
${otherSectionsBlock}
═══ RÈGLES ═══
1. Chiffres EXACTS issus des documents. Pas d'invention.
2. Si une donnée manque : "n/d" dans content_json, et **mention explicite** dans content_md ("Le DSCR n'est pas reconstituable en l'état des données fournies — à clarifier en DD."). Pas d'invention.
3. Sources inline DANS content_md ET dans les champs body/paragraphs du content_json.
4. Réponse = UN seul JSON {"content_md": "...", "content_json": {...}}. Pas de texte avant/après, pas de markdown fences.
5. Respecte les enums exacts : color = "ok"|"warning"|"danger"|"info" ; severity = "Critical"|"High"|"Medium"|"Low" ; status doc = "ok"|"partial"|"missing" ; verdict = "go_direct"|"go_conditionnel"|"hold"|"reject".
6. Si la section nécessite un tableau (rows), produis 3-15 lignes RÉELLES — pas de placeholders "...".
7. Le content_md doit pouvoir se lire SEUL (sans le content_json à côté) — un IC qui lit uniquement la prose comprend toute l'analyse.`);

  const userPrompt = `Produis maintenant la section "${sectionLabel}" en JSON strict.`;

  // Long-form : ~1000 mots = ~2000 tokens pour content_md + JSON → 12k tokens minimum
  const claudeResponse = await callAI(systemPrompt, userPrompt, 12288, undefined, 0.3, {
    functionName: `generate-pe-pre-screening:${sectionCode}`,
    enterpriseId,
  });

  let parsed: any;
  try {
    parsed = typeof claudeResponse === "string" ? JSON.parse(claudeResponse) : claudeResponse;
  } catch (e: any) {
    throw new Error(`Section ${sectionCode}: invalid JSON from Claude: ${e.message}`);
  }

  if (typeof parsed.content_md !== 'string' && parsed.content_md !== null) {
    throw new Error(`Section ${sectionCode}: missing content_md (must be string or null)`);
  }

  return {
    content_md: parsed.content_md ?? null,
    content_json: parsed.content_json ?? {},
  };
}

/** Extrait score global et classification depuis le content_json du résumé exécutif. */
function extractScoreAndClassification(executiveSummary: SectionContent): {
  overall_score: number | null;
  classification: string | null;
} {
  const cj = executiveSummary.content_json ?? {};
  const reco = cj.recommendation ?? {};
  const score = typeof reco.score_esono === 'number' ? reco.score_esono
              : typeof cj.score_memo === 'number' ? cj.score_memo
              : null;
  const verdict = typeof reco.verdict === 'string' ? reco.verdict : null;
  return { overall_score: score, classification: verdict };
}

/** Construit un résumé compact d'une section pour la passer en contexte d'une autre génération. */
function summarizeSectionForContext(code: MemoSectionCode, content: SectionContent): string {
  const label = SECTION_LABELS[code];
  const num = SECTION_NUMBERS[code];
  const md = content.content_md?.slice(0, 1500) ?? '';
  // Extraire quelques champs structurés clés selon la section
  const cj = content.content_json ?? {};
  const keyPoints: string[] = [];
  if (cj.red_flags?.length) keyPoints.push(`Red flags : ${cj.red_flags.map((rf: any) => rf.title).join(' / ')}`);
  if (cj.recommendation?.verdict) keyPoints.push(`Verdict : ${cj.recommendation.verdict}`);
  if (cj.synthesis) keyPoints.push(`Synthèse : ${String(cj.synthesis).slice(0, 400)}`);

  return `## ${num}. ${label}\n${md}${keyPoints.length ? '\n' + keyPoints.join('\n') : ''}`;
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

    // 1) Récupérer le deal (RLS + infos enrichies)
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

    const dealCtx: DealContext = {
      name:    (deal.enterprises as any)?.name ?? "Sans nom",
      ref:     deal.deal_ref ?? "n/d",
      sector:  (deal.enterprises as any)?.sector ?? "n/d",
      country: (deal.enterprises as any)?.country ?? "n/d",
      ticket:  String(deal.ticket_demande ?? "n/d"),
      currency: deal.currency ?? "EUR",
    };

    // 2) Documents
    const docs = await fetchDealDocuments(adminClient, body.deal_id);
    if (docs.length === 0) return errorResponse("No documents to analyze", 400);
    const sectionDocIds = docs.map(d => d.id);

    // 3) Memo + version 'generating'
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

    // 4) Auto-move stage sourcing → pre_screening
    const wasSourcing = deal.stage === "sourcing";
    if (wasSourcing) {
      await adminClient.from("pe_deals").update({ stage: "pre_screening" }).eq("id", deal.id);
    }

    try {
      // 5) Parse docs via Railway
      let docContents = "";
      for (const doc of docs) {
        const { data: file, error: dlErr } = await adminClient
          .storage.from("pe_deal_docs").download(doc.storage_path);
        if (dlErr || !file) {
          console.warn(`[generate-pe-pre-screening] download failed for ${doc.filename}: ${dlErr?.message}`);
          continue;
        }
        const buffer = await file.arrayBuffer();
        const text = await callRailwayParser(buffer, doc.filename, doc.mime_type ?? "application/octet-stream");
        if (text) docContents += `\n\n=== ${doc.filename} ===\n${text}`;
      }
      if (!docContents.trim()) throw new Error("Aucun document n'a pu être lu (parser Railway down ou docs vides)");

      const agentCtx = await buildAgentContext(adminClient, deal.organization_id, {
        deliverableType: 'pre_screening',
        country: deal.country,
        sector: deal.sector,
        enterpriseId: deal.id,
      });

      // 6) Phase 1 — génération parallèle des 11 sections (sauf executive_summary)
      const phase1Codes: MemoSectionCode[] = [
        'shareholding_governance',
        'top_management',
        'services',
        'competition_market',
        'unit_economics',
        'financials_pnl',
        'financials_balance',
        'investment_thesis',
        'support_requested',
        'esg_risks',
        'annexes',
      ];

      console.log(`[generate-pe-pre-screening] Phase 1 — generating ${phase1Codes.length} sections in parallel for deal ${deal.id}`);
      const phase1Results = await Promise.allSettled(
        phase1Codes.map(code =>
          generateSection({
            sectionCode: code,
            deal: dealCtx,
            docContents,
            contextPrefix: agentCtx.prefix,
            wrapWithGuardrails: agentCtx.wrapWithGuardrails,
            enterpriseId: deal.id,
          }).then(content => ({ code, content })),
        ),
      );

      const sectionsContent: Partial<Record<MemoSectionCode, SectionContent>> = {};
      const failures: { code: MemoSectionCode; reason: string }[] = [];
      for (let i = 0; i < phase1Results.length; i++) {
        const result = phase1Results[i];
        const code = phase1Codes[i];
        if (result.status === 'fulfilled') {
          sectionsContent[code] = result.value.content;
        } else {
          failures.push({ code, reason: String(result.reason).slice(0, 300) });
          // Section vide en fallback pour ne pas bloquer Phase 2
          sectionsContent[code] = { content_md: null, content_json: {} };
        }
      }
      if (failures.length > 0) {
        console.warn(`[generate-pe-pre-screening] Phase 1 partial failure: ${failures.map(f => `${f.code}=${f.reason}`).join(' | ')}`);
      }

      // 7) Phase 2 — résumé exécutif avec contexte des 11 sections
      console.log(`[generate-pe-pre-screening] Phase 2 — generating executive_summary with context of ${Object.keys(sectionsContent).length} sections`);
      const otherSectionsContext = phase1Codes
        .map(code => summarizeSectionForContext(code, sectionsContent[code]!))
        .join('\n\n');

      const execContent = await generateSection({
        sectionCode: 'executive_summary',
        deal: dealCtx,
        docContents,
        otherSectionsContext,
        contextPrefix: agentCtx.prefix,
        wrapWithGuardrails: agentCtx.wrapWithGuardrails,
        enterpriseId: deal.id,
      });
      sectionsContent.executive_summary = execContent;

      // 8) Insertion 12 sections en batch
      const sectionsMap: Partial<Record<MemoSectionCode, any>> = {};
      for (const code of Object.keys(sectionsContent) as MemoSectionCode[]) {
        sectionsMap[code] = {
          content_md: sectionsContent[code]!.content_md,
          content_json: sectionsContent[code]!.content_json,
          source_doc_ids: sectionDocIds,
        };
      }
      await insertMemoSections(adminClient, versionId, sectionsMap);

      // 9) Extract score + classification depuis le résumé exécutif
      const { overall_score, classification } = extractScoreAndClassification(execContent);

      await updateMemoVersion(adminClient, versionId, {
        status: "ready",
        overall_score,
        classification,
        generated_at: new Date().toISOString(),
        // Si certaines sections ont échoué, on garde une note dans error_message (pas un échec complet)
        error_message: failures.length > 0
          ? `Partial: ${failures.length} sections échouées (${failures.map(f => f.code).join(', ')})`
          : null,
      });

      return jsonResponse({
        success: true,
        memo_id: memoId,
        version_id: versionId,
        overall_score,
        classification,
        sections_generated: Object.keys(sectionsContent).length,
        sections_failed: failures.length,
        failures: failures.length > 0 ? failures : undefined,
      });
    } catch (genErr: any) {
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

/** Appel proxy-parser Railway pour extraire le texte d'un document. */
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
