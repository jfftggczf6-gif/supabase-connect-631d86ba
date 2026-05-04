// ingest-deal-learnings — Capitalisation post-deal pour la KB propriétaire du fonds
//
// Déclenchement : automatiquement au passage de stage `note_ic_finale → closing`
// (cf. update-pe-deal-stage), ou manuellement via une route admin.
//
// Pipeline :
//   1. Charger le deal + memo final + DD findings + valuation finale
//   2. Synthétiser une fiche deal-learning structurée via Claude
//   3. Insérer dans organization_knowledge avec category='deal_learning'
//   4. Chunker + indexer dans knowledge_chunks (embeddings Voyage AI)
//   5. Disponible dès le prochain buildRAGContext sur un deal du même fonds
//
// La fiche contient :
//   - Thèse validée (vs initiale)
//   - Valuation finale + écart v1/v2
//   - Red flags confirmés/levés par DD
//   - Corrections DD section par section
//   - Conditions closing
//   - Multiple EBITDA payé (benchmark propriétaire)
//   - Leçons clés pour deals comparables (free text par Claude)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { fetchSections, getLatestVersion } from "../_shared/memo-helpers.ts";
import { SECTION_LABELS } from "../_shared/memo-section-schemas.ts";

interface RequestBody {
  deal_id: string;
  /** Si true, force la régénération même si une fiche existe déjà pour ce deal. */
  force?: boolean;
}

const VOYAGE_MODEL = "voyage-3";
const CHUNK_TARGET_TOKENS = 600; // tokens par chunk (≈ 2400 caractères)
const CHUNK_OVERLAP_CHARS = 400;

/**
 * Découpe un texte long en chunks avec recouvrement, en cherchant les
 * frontières de paragraphes pour ne pas couper au milieu d'une phrase.
 */
function chunkText(text: string, targetChars = CHUNK_TARGET_TOKENS * 4, overlap = CHUNK_OVERLAP_CHARS): string[] {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const end = Math.min(cursor + targetChars, text.length);
    let cut = end;
    if (end < text.length) {
      // Cherche un \n\n proche pour couper proprement
      const slice = text.slice(cursor, end);
      const lastBreak = slice.lastIndexOf('\n\n');
      if (lastBreak > targetChars * 0.6) cut = cursor + lastBreak;
    }
    chunks.push(text.slice(cursor, cut).trim());
    if (cut >= text.length) break;
    cursor = cut - overlap;
    if (cursor < 0) cursor = 0;
  }
  return chunks.filter(c => c.length > 50);
}

/**
 * Génère un embedding Voyage AI pour un texte (input_type='document').
 * Retourne null si la clé n'est pas configurée ou si l'API échoue (non-bloquant).
 */
async function embedDocument(text: string): Promise<number[] | null> {
  try {
    const voyageKey = Deno.env.get("VOYAGE_API_KEY");
    if (!voyageKey) return null;
    const resp = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${voyageKey}` },
      body: JSON.stringify({
        input: text.slice(0, 32000),
        model: VOYAGE_MODEL,
        input_type: "document",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      console.warn("[ingest-deal-learnings] voyage error:", resp.status, (await resp.text()).slice(0, 200));
      return null;
    }
    const data = await resp.json();
    return data.data?.[0]?.embedding || null;
  } catch (e: any) {
    console.warn("[ingest-deal-learnings] voyage exception:", e.message);
    return null;
  }
}

const SYNTHESIS_SCHEMA = `{
  "thèse_initiale": "<string — thèse au moment de l'IC1, ce qui devait fonctionner>",
  "thèse_validée_par_DD": "<string — ce que la DD a confirmé ou infirmé>",
  "écart_valuation_v1_vs_v2_pct": <number — pourcentage de variation, positif ou négatif>,
  "valuation_finale_pre_money": <number — montant en devise locale>,
  "devise_valuation": "<string — code ISO>",
  "ticket_invest": <number — montant en devise du ticket>,
  "devise_ticket": "<string>",
  "ebitda_multiple_payé": <number — ratio EV/EBITDA réellement payé, ou null>,
  "red_flags_confirmés_par_DD": [
    { "title": "<string>", "description": "<string courte>", "section_impactée": "<code section>" }
  ],
  "red_flags_levés_par_DD": [
    { "title": "<string>", "description": "<string courte>" }
  ],
  "corrections_DD_majeures": [
    { "section": "<code section>", "champ": "<string>", "v1": "<string>", "v2": "<string>", "motif": "<string>" }
  ],
  "conditions_closing": ["<string>"],
  "leçons_clés_pour_deals_comparables": [
    "<string — phrase actionnable, démarrant par un verbe à l'infinitif>"
  ],
  "tags_recherche": ["<string — mots-clés sectoriels et géographiques pour faciliter la recherche>"]
}`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body: RequestBody = await req.json();
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    // 1) Charger le deal + entreprise
    const { data: deal, error: dealErr } = await adminClient
      .from("pe_deals")
      .select(`
        id, organization_id, deal_ref, stage, ticket_demande, currency,
        enterprises!inner(id, name, sector, country)
      `)
      .eq("id", body.deal_id)
      .maybeSingle();
    if (dealErr || !deal) return errorResponse("Deal introuvable", 404);

    const enterprise = (deal as any).enterprises;
    const dealName = enterprise?.name ?? deal.deal_ref;
    const sector = enterprise?.sector ?? "n/d";
    const country = enterprise?.country ?? "n/d";

    // 2) Idempotence : si une fiche existe déjà pour ce deal et force=false, skip
    if (!body.force) {
      const { data: existing } = await adminClient
        .from("organization_knowledge")
        .select("id")
        .eq("organization_id", deal.organization_id)
        .eq("category", "deal_learning")
        .contains("metadata", { deal_id: deal.id })
        .maybeSingle();
      if (existing) {
        return jsonResponse({
          success: true,
          skipped: true,
          reason: "Fiche deal-learning existe déjà (passe force=true pour régénérer)",
          existing_id: existing.id,
        });
      }
    }

    // 3) Charger memo final (note_ic_finale en priorité, sinon note_ic1)
    const finalVersion =
      await getLatestVersion(adminClient, deal.id, "note_ic_finale", "ready") ??
      await getLatestVersion(adminClient, deal.id, "note_ic_finale", "validated") ??
      await getLatestVersion(adminClient, deal.id, "note_ic1", "ready") ??
      await getLatestVersion(adminClient, deal.id, "note_ic1", "validated");
    if (!finalVersion) {
      return errorResponse("Aucune version de memo finale disponible — clôture nécessite IC finale ou IC1 ready", 400);
    }

    const sections = await fetchSections(adminClient, finalVersion.id);
    const memoBlock = sections.map(s => {
      const label = (SECTION_LABELS as any)[s.section_code] ?? s.section_code;
      return `### ${label}\n${s.content_md ?? '(vide)'}\n${s.content_json ? JSON.stringify(s.content_json, null, 2).slice(0, 6000) : ''}`;
    }).join('\n\n');

    // 4) Charger version pre-screening pour comparaison v1 vs final
    const preScreeningVersion =
      await getLatestVersion(adminClient, deal.id, "pre_screening", "ready") ??
      await getLatestVersion(adminClient, deal.id, "pre_screening", "validated");
    let preScreeningBlock = '';
    if (preScreeningVersion) {
      const preSecs = await fetchSections(adminClient, preScreeningVersion.id);
      preScreeningBlock = preSecs.map(s => {
        const label = (SECTION_LABELS as any)[s.section_code] ?? s.section_code;
        return `### [PRE-SCREENING v1] ${label}\n${s.content_md?.slice(0, 1500) ?? '(vide)'}`;
      }).join('\n\n');
    }

    // 5) Charger valuation finale + DD findings
    const { data: valuation } = await adminClient
      .from("pe_valuations")
      .select("currency, dcf_outputs, multiples_outputs, ancc_outputs, synthesis_outputs")
      .eq("deal_id", deal.id)
      .maybeSingle();
    const valuationBlock = valuation ? `### VALUATION FINALE\n${JSON.stringify(valuation, null, 2).slice(0, 8000)}` : '(pas de valuation enregistrée)';

    const { data: ddFindings } = await adminClient
      .from("pe_dd_findings")
      .select("title, body, severity, finding_type, impacts_section_codes, recommendation")
      .eq("deal_id", deal.id);
    const ddBlock = (ddFindings ?? []).length > 0
      ? `### DD FINDINGS (${(ddFindings ?? []).length})\n${(ddFindings ?? []).map((f: any) => `[${f.severity} · ${f.finding_type}] ${f.title}\n${f.body?.slice(0, 500)}\n→ ${f.recommendation ?? ''}`).join('\n\n')}`
      : '(pas de findings DD enregistrés)';

    // 6) Synthèse Claude — extrait une fiche structurée à partir de toutes les sources
    const taskPrompt = `Tu es un analyste senior d'un fonds de Private Equity en Afrique. Tu produis une fiche deal-learning structurée pour le deal "${dealName}" (${sector}, ${country}, deal_ref ${deal.deal_ref}) qui vient d'être validé pour closing.

Cette fiche sera ARCHIVÉE dans la base de connaissances propriétaire du fonds. Elle servira au scoring et à l'analyse des FUTURS deals comparables. Sois donc précis, factuel, et surtout : tire des LEÇONS qui resteront actionnables.

═══ MEMO FINAL (post-DD) ═══
${memoBlock.slice(0, 50000)}

═══ MEMO PRE-SCREENING (v1, à titre de comparaison) ═══
${preScreeningBlock.slice(0, 25000)}

${valuationBlock}

${ddBlock}

═══ FORMAT DE SORTIE — JSON STRICT, RIEN D'AUTRE ═══
${SYNTHESIS_SCHEMA}

═══ RÈGLES ═══
1. Tu RAPPORTES factuellement ce qui s'est passé entre v1 et le closing — pas d'extrapolation.
2. Les leçons doivent être actionnables et générales (applicables à un autre deal du même secteur), pas spécifiques à MARKOTIN.
3. Format : 5-10 leçons clés, 5-15 tags de recherche, sois exhaustif sur red flags / corrections.
4. tags_recherche : utilise des mots-clés que l'IA d'un futur agent rechercherait (ex: "agro-industrie", "Côte d'Ivoire", "charges familiales", "EBITDA retraitement").
5. JSON strict — pas de markdown fences, pas de texte avant/après.`;

    const aiResponse = await callAI(
      taskPrompt,
      `Produis la fiche deal-learning JSON pour ${dealName}.`,
      8192,
      undefined,
      0.2,
      { functionName: "ingest-deal-learnings", enterpriseId: enterprise?.id },
    );

    let synthesis: any;
    try {
      const cleaned = aiResponse.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      synthesis = JSON.parse(cleaned);
    } catch (e: any) {
      console.error("[ingest-deal-learnings] JSON parse error:", e.message, aiResponse.slice(0, 500));
      return errorResponse(`Synthèse IA non parsable : ${e.message}`, 500);
    }

    // 7) Format texte pour l'indexation (humain + IA)
    const fichesText = [
      `# Deal-learning : ${dealName} (${sector}, ${country})`,
      `Deal ref : ${deal.deal_ref}`,
      `Ticket : ${deal.ticket_demande ?? 'n/d'} ${deal.currency ?? ''}`,
      `Valuation finale pre-money : ${synthesis.valuation_finale_pre_money ?? 'n/d'} ${synthesis.devise_valuation ?? ''}`,
      `Multiple EBITDA payé : ${synthesis.ebitda_multiple_payé ?? 'n/d'}`,
      `Écart valuation v1 vs finale : ${synthesis.écart_valuation_v1_vs_v2_pct ?? 'n/d'} %`,
      ``,
      `## Thèse initiale`,
      synthesis.thèse_initiale ?? '',
      ``,
      `## Thèse validée par DD`,
      synthesis.thèse_validée_par_DD ?? '',
      ``,
      `## Red flags confirmés par DD (${(synthesis.red_flags_confirmés_par_DD ?? []).length})`,
      ...(synthesis.red_flags_confirmés_par_DD ?? []).map((rf: any) => `- ${rf.title} (${rf.section_impactée}) : ${rf.description}`),
      ``,
      `## Red flags levés par DD (${(synthesis.red_flags_levés_par_DD ?? []).length})`,
      ...(synthesis.red_flags_levés_par_DD ?? []).map((rf: any) => `- ${rf.title} : ${rf.description}`),
      ``,
      `## Corrections DD majeures`,
      ...(synthesis.corrections_DD_majeures ?? []).map((c: any) => `- [${c.section}] ${c.champ} : ${c.v1} → ${c.v2} (${c.motif})`),
      ``,
      `## Conditions closing`,
      ...(synthesis.conditions_closing ?? []).map((c: string) => `- ${c}`),
      ``,
      `## Leçons clés pour deals comparables`,
      ...(synthesis.leçons_clés_pour_deals_comparables ?? []).map((l: string, i: number) => `${i + 1}. ${l}`),
    ].join('\n');

    // 8) Insert dans organization_knowledge
    const { data: orgEntry, error: insertErr } = await adminClient
      .from("organization_knowledge")
      .insert({
        organization_id: deal.organization_id,
        category: "deal_learning",
        title: `Deal-learning : ${dealName} (${sector}, ${country})`,
        content: fichesText,
        country,
        sector,
        source: `Deal closing ${new Date().toISOString().slice(0, 10)} · ${deal.deal_ref}`,
        tags: synthesis.tags_recherche ?? [sector, country],
        metadata: {
          deal_id: deal.id,
          deal_ref: deal.deal_ref,
          deal_outcome: "closing",
          synthesis,
          ingested_at: new Date().toISOString(),
        },
        is_active: true,
      })
      .select()
      .single();

    if (insertErr || !orgEntry) {
      return errorResponse(`Insert organization_knowledge échoué : ${insertErr?.message}`, 500);
    }

    // 9) Chunker + générer embeddings + insérer dans knowledge_chunks
    const chunks = chunkText(fichesText);
    let chunksIndexed = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await embedDocument(chunk);
      const { error: chunkErr } = await adminClient
        .from("knowledge_chunks")
        .insert({
          org_entry_id: orgEntry.id,
          chunk_index: i,
          content: chunk,
          token_count: Math.round(chunk.length / 4),
          title: orgEntry.title,
          source: orgEntry.source,
          country,
          sector,
          category: "deal_learning",
          embedding: embedding ? `[${embedding.join(',')}]` : null,
        });
      if (chunkErr) {
        console.warn(`[ingest-deal-learnings] chunk ${i} insert failed:`, chunkErr.message);
      } else {
        chunksIndexed++;
      }
    }

    return jsonResponse({
      success: true,
      organization_knowledge_id: orgEntry.id,
      chunks_indexed: chunksIndexed,
      synthesis,
    });

  } catch (e: any) {
    console.error("[ingest-deal-learnings] error:", e);
    return errorResponse(e.message || "Erreur interne", 500);
  }
});
