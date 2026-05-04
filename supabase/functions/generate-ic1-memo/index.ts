import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildAgentContext } from "../_shared/agent-context.ts";
import {
  updateMemoVersion,
  fetchSections,
  fetchDealDocuments,
  getLatestVersion,
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

/** Génère/enrichit une section IC1 à partir d'une version pre_screening précédente. */
async function enrichSectionForIC1(
  args: {
    sectionCode: MemoSectionCode;
    deal: DealContext;
    docContents: string;
    previousSection: SectionContent;
    otherSectionsContext?: string;
    contextPrefix: string;
    wrapWithGuardrails: (s: string) => string;
    enterpriseId: string;
  },
): Promise<SectionContent> {
  const { sectionCode, deal, docContents, previousSection, otherSectionsContext, contextPrefix, wrapWithGuardrails, enterpriseId } = args;
  const sectionLabel = SECTION_LABELS[sectionCode];
  const sectionNumber = SECTION_NUMBERS[sectionCode];
  const sectionDescription = SECTION_DESCRIPTIONS[sectionCode];
  const jsonSchema = SECTION_SCHEMAS[sectionCode];

  const previousBlock = previousSection.content_json
    ? `\n\n═══ VERSION PRE-SCREENING DE CETTE SECTION (à approfondir, ne pas régresser) ═══\nContent MD :\n${previousSection.content_md ?? '(vide)'}\n\nContent JSON :\n${JSON.stringify(previousSection.content_json, null, 2).slice(0, 10000)}\n`
    : '';

  const otherSectionsBlock = otherSectionsContext
    ? `\n\n═══ CONTEXTE — AUTRES SECTIONS IC1 DÉJÀ ENRICHIES ═══\n${otherSectionsContext.slice(0, 30000)}\n`
    : '';

  const systemPrompt = wrapWithGuardrails(`${contextPrefix}

Tu enrichis la section ${sectionNumber} — "${sectionLabel}" pour passer de la version PRE-SCREENING à la version NOTE IC1 du dossier d'investissement PE pour le deal "${deal.name}" (deal_ref: ${deal.ref}, secteur: ${deal.sector}, pays: ${deal.country}).

═══ DIFFÉRENCE PRE-SCREENING → IC1 ═══
- Pre-screening : analyse rapide initiale, données déclaratives.
- IC1 : approfondissement avant comité d'investissement. Tu RÉVISES le contenu pre-screening en :
  1. Intégrant les nouveaux documents fournis (docs additionnels depuis le pre-screening)
  2. Affinant les chiffres avec retraitements détaillés
  3. Renforçant l'analyse (citations, sources, benchmarks ajoutés)
  4. Si pertinent, ajustant le verdict / score / conditions
  5. NE PAS supprimer du contenu pertinent — enrichir, pas régresser
  6. meta.version_label = "IC1" (sans "(draft)")
  7. meta.version_note doit refléter l'évolution depuis pre-screening

═══ RÔLE DE LA SECTION ═══
${sectionDescription}

═══ SCHÉMA JSON STRICT ATTENDU pour content_json ═══
${jsonSchema}

═══ CHAMPS À PRODUIRE ═══
{
  "content_md": "<string markdown ~150-300 mots — texte narratif COMPLÉMENTAIRE au content_json structuré>",
  "content_json": <objet conforme exactement au schéma ci-dessus, enrichi vs pre-screening>
}

═══ CONTEXTE — DOCUMENTS DEAL ═══
${docContents.slice(0, 60000) || '(aucun document parsable)'}
${previousBlock}${otherSectionsBlock}
═══ RÈGLES ═══
1. Chiffres EXACTS issus des documents. Pas d'invention.
2. Si une donnée manque : utilise "n/d" ou null, JAMAIS d'invention.
3. Cite les sources [Source: pitch.pdf p.3] dans content_md ET dans les champs body/paragraphs du content_json.
4. Réponse = UN seul JSON {"content_md": "...", "content_json": {...}}. Pas de texte avant/après, pas de markdown fences.
5. Respecte les enums exacts : color = "ok"|"warning"|"danger"|"info" ; severity = "Critical"|"High"|"Medium"|"Low" ; status doc = "ok"|"partial"|"missing" ; verdict = "go_direct"|"go_conditionnel"|"hold"|"reject".`);

  const userPrompt = `Enrichis maintenant la section "${sectionLabel}" version IC1 en JSON strict.`;

  const claudeResponse = await callAI(systemPrompt, userPrompt, 8192, undefined, 0.2, {
    functionName: `generate-ic1-memo:${sectionCode}`,
    enterpriseId,
  });

  let parsed: any;
  try {
    parsed = typeof claudeResponse === "string" ? JSON.parse(claudeResponse) : claudeResponse;
  } catch (e: any) {
    throw new Error(`Section ${sectionCode}: invalid JSON from Claude: ${e.message}`);
  }

  if (typeof parsed.content_md !== 'string' && parsed.content_md !== null) {
    throw new Error(`Section ${sectionCode}: missing content_md`);
  }

  return {
    content_md: parsed.content_md ?? null,
    content_json: parsed.content_json ?? {},
  };
}

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

function summarizeSectionForContext(code: MemoSectionCode, content: SectionContent): string {
  const label = SECTION_LABELS[code];
  const num = SECTION_NUMBERS[code];
  const md = content.content_md?.slice(0, 1500) ?? '';
  const cj = content.content_json ?? {};
  const keyPoints: string[] = [];
  if (cj.red_flags?.length) keyPoints.push(`Red flags : ${cj.red_flags.map((rf: any) => rf.title).join(' / ')}`);
  if (cj.recommendation?.verdict) keyPoints.push(`Verdict : ${cj.recommendation.verdict}`);
  if (cj.synthesis) keyPoints.push(`Synthèse : ${String(cj.synthesis).slice(0, 400)}`);
  return `## ${num}. ${label}\n${md}${keyPoints.length ? '\n' + keyPoints.join('\n') : ''}`;
}

async function callRailwayParser(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<string> {
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

    // 1) Récupérer deal + verif RLS
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

    const dealCtx: DealContext = {
      name:    (deal.enterprises as any)?.name ?? "Sans nom",
      ref:     deal.deal_ref ?? "n/d",
      sector:  (deal.enterprises as any)?.sector ?? "n/d",
      country: (deal.enterprises as any)?.country ?? "n/d",
      ticket:  String(deal.ticket_demande ?? "n/d"),
      currency: deal.currency ?? "EUR",
    };

    // 2) Trouver la version active du deal (la dernière version ready, peu importe le stage)
    //    Living document : on UPDATE en place au lieu de cloner.
    const activeVersion = await getLatestVersion(adminClient, body.deal_id, "pre_screening", "ready")
      ?? await getLatestVersion(adminClient, body.deal_id, "note_ic1", "ready");
    if (!activeVersion) return errorResponse("No ready pre_screening version to enrich from", 400);

    // Si déjà en stage note_ic1 et le user veut re-enrichir : on permet (ré-enrichissement après nouvelle DD ou docs)
    // Pas de blocage "already_exists" — c'est un living document.

    // 3) Charger les sections actuelles (input pour enrichissement)
    const previousSections = await fetchSections(adminClient, activeVersion.id);
    const previousMap: Partial<Record<MemoSectionCode, SectionContent>> = {};
    const sectionIdByCode: Partial<Record<MemoSectionCode, string>> = {};
    for (const sec of previousSections) {
      previousMap[sec.section_code] = {
        content_md: sec.content_md,
        content_json: sec.content_json,
      };
      sectionIdByCode[sec.section_code] = sec.id;
    }

    // 4) Charger docs (peuvent inclure de nouveaux docs ajoutés depuis pre-screening)
    const docs = await fetchDealDocuments(adminClient, body.deal_id);
    const sectionDocIds = docs.map(d => d.id);

    // 5) Marquer la version comme 'generating' (on UPDATE l'existante, pas de nouvelle row)
    await updateMemoVersion(adminClient, activeVersion.id, {
      status: "generating",
    });
    const versionId = activeVersion.id;

    try {
      // 7) Parse docs
      let docContents = "";
      for (const doc of docs) {
        const { data: file, error: dlErr } = await adminClient
          .storage.from("pe_deal_docs").download(doc.storage_path);
        if (dlErr || !file) {
          console.warn(`[generate-ic1-memo] download failed for ${doc.filename}`);
          continue;
        }
        const buffer = await file.arrayBuffer();
        const text = await callRailwayParser(buffer, doc.filename, doc.mime_type ?? "application/octet-stream");
        if (text) docContents += `\n\n=== ${doc.filename} ===\n${text}`;
      }

      const agentCtx = await buildAgentContext(adminClient, deal.organization_id, {
        deliverableType: 'ic1_memo',
        country: dealCtx.country,
        sector: dealCtx.sector,
        enterpriseId: deal.id,
      });

      // 8) Phase 1 — enrichissement parallèle des 11 sections
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

      console.log(`[generate-ic1-memo] Phase 1 — enriching ${phase1Codes.length} sections in parallel for deal ${deal.id}`);
      const phase1Results = await Promise.allSettled(
        phase1Codes.map(code =>
          enrichSectionForIC1({
            sectionCode: code,
            deal: dealCtx,
            docContents,
            previousSection: previousMap[code] ?? { content_md: null, content_json: {} },
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
          // Fallback : on garde la version pre-screening si l'enrichissement échoue
          sectionsContent[code] = previousMap[code] ?? { content_md: null, content_json: {} };
        }
      }
      if (failures.length > 0) {
        console.warn(`[generate-ic1-memo] Phase 1 partial failure: ${failures.map(f => `${f.code}=${f.reason}`).join(' | ')}`);
      }

      // 9) Phase 2 — résumé exécutif IC1 avec contexte des 11 sections enrichies
      console.log(`[generate-ic1-memo] Phase 2 — enriching executive_summary`);
      const otherSectionsContext = phase1Codes
        .map(code => summarizeSectionForContext(code, sectionsContent[code]!))
        .join('\n\n');

      const execContent = await enrichSectionForIC1({
        sectionCode: 'executive_summary',
        deal: dealCtx,
        docContents,
        previousSection: previousMap.executive_summary ?? { content_md: null, content_json: {} },
        otherSectionsContext,
        contextPrefix: agentCtx.prefix,
        wrapWithGuardrails: agentCtx.wrapWithGuardrails,
        enterpriseId: deal.id,
      });
      sectionsContent.executive_summary = execContent;

      // 10) UPDATE des 12 sections en place (living document : pas de nouvelle row)
      //     Les sections passent en status='draft' car le contenu a changé — les validations
      //     précédentes restent en historique (memo_section_validations) mais re-validation requise.
      for (const code of Object.keys(sectionsContent) as MemoSectionCode[]) {
        const sectionId = sectionIdByCode[code];
        if (!sectionId) {
          console.warn(`[generate-ic1-memo] section ${code} not found in active version, skipping`);
          continue;
        }
        const { error: secUpdErr } = await adminClient
          .from('memo_sections')
          .update({
            content_md: sectionsContent[code]!.content_md,
            content_json: sectionsContent[code]!.content_json,
            source_doc_ids: sectionDocIds,
            status: 'draft',
            last_edited_by: user.id,
            last_edited_at: new Date().toISOString(),
          })
          .eq('id', sectionId);
        if (secUpdErr) {
          console.error(`[generate-ic1-memo] section ${code} update failed: ${secUpdErr.message}`);
        }
      }

      // 11) UPDATE la version : stage devient note_ic1, label aussi, score/classif rafraîchis
      const { overall_score, classification } = extractScoreAndClassification(execContent);

      await adminClient
        .from('memo_versions')
        .update({
          stage: 'note_ic1',
          label: 'note_ic1_v1',
          status: 'ready',
          overall_score,
          classification,
          generated_by_agent: 'generate-ic1-memo',
          generated_at: new Date().toISOString(),
          error_message: failures.length > 0
            ? `Partial: ${failures.length} sections échouées (${failures.map(f => f.code).join(', ')})`
            : null,
        })
        .eq('id', versionId);

      return jsonResponse({
        success: true,
        version_id: versionId,
        living_document: true,
        new_stage: 'note_ic1',
        overall_score,
        classification,
        sections_enriched: Object.keys(sectionsContent).length,
        sections_failed: failures.length,
        failures: failures.length > 0 ? failures : undefined,
      });
    } catch (genErr: any) {
      console.error(`[generate-ic1-memo] enrichment failed: ${genErr.message}`);
      await updateMemoVersion(adminClient, versionId, {
        status: "ready",  // revert à 'ready' (la version originale est intacte)
        error_message: genErr.message?.slice(0, 500) ?? "Unknown error",
      });
      return errorResponse(`IC1 enrichment failed: ${genErr.message}`, 500);
    }
  } catch (err: any) {
    console.error(`[generate-ic1-memo] outer error: ${err.message}`);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
