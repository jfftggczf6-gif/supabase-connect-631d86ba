// apply-dd-findings-to-memo — Pousse les findings DD validés dans les sections du memo,
// crée un snapshot "pré-DD" pour l'audit/comparatif, et fait passer le memo en stage note_ic_finale.
//
// Flow :
//   1. SNAPSHOT du memo actuel (avant mutation) → snapshot_label = "Pré-DD"
//   2. Pour chaque section impactée par des findings :
//      - Lire la section actuelle + findings concernés
//      - Appel Claude pour réécrire la section en intégrant les findings (red flags + ajustements chiffres)
//      - UPDATE memo_sections.content_md/content_json
//      - status = 'draft' (re-validation IM/MD requise)
//   3. UPDATE memo_versions.stage = 'note_ic_finale', label = 'note_ic_finale_v1'
//   4. Marquer les findings comme applied_to_memo_at = now()

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildToneForAgent } from "../_shared/agent-tone.ts";
import {
  fetchSections,
  getLatestVersion,
  type MemoSectionCode,
} from "../_shared/memo-helpers.ts";
import {
  SECTION_LABELS,
  SECTION_SCHEMAS,
} from "../_shared/memo-section-schemas.ts";

interface RequestBody {
  deal_id: string;
  // Optionnel : ne pousser que certains findings (par défaut: tous les 'open')
  finding_ids?: string[];
}

interface FindingRow {
  id: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  recommendation: string | null;
  impacts_section_codes: string[];
  status: string;
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
        id, organization_id, deal_ref,
        enterprises!inner(name, sector, country)
      `)
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);

    const dealName = (deal.enterprises as any)?.name ?? "Sans nom";

    // 2) Trouver la version active (note_ic1 attendu, fallback pre_screening)
    const activeVersion = await getLatestVersion(adminClient, body.deal_id, "note_ic1", "ready")
      ?? await getLatestVersion(adminClient, body.deal_id, "pre_screening", "ready");
    if (!activeVersion) {
      return errorResponse("No active memo to apply findings to. Generate IC1 first.", 400);
    }

    // 3) Récupérer les findings à appliquer
    let findingsQuery = adminClient
      .from('pe_dd_findings')
      .select('id, category, severity, title, body, recommendation, impacts_section_codes, status')
      .eq('deal_id', body.deal_id)
      .eq('status', 'open')
      .is('applied_to_memo_at', null);
    if (body.finding_ids && body.finding_ids.length > 0) {
      findingsQuery = findingsQuery.in('id', body.finding_ids);
    }
    const { data: findingsData } = await findingsQuery;
    const findings: FindingRow[] = (findingsData ?? []) as FindingRow[];

    if (findings.length === 0) {
      return errorResponse("Aucun finding 'open' à appliquer", 400);
    }

    // 4) Identifier les sections impactées (union des impacts_section_codes)
    const impactedSections = new Set<MemoSectionCode>();
    findings.forEach(f => {
      (f.impacts_section_codes ?? []).forEach(code => {
        if (code in SECTION_LABELS) impactedSections.add(code as MemoSectionCode);
      });
    });
    if (impactedSections.size === 0) {
      return errorResponse("Aucune section identifiée comme impactée par les findings", 400);
    }

    // 5) SNAPSHOT du memo actuel AVANT mutation
    const snapshotLabel = `${activeVersion.stage === 'note_ic1' ? 'IC1' : 'Pre-screening'} pré-DD (${new Date().toLocaleDateString('fr-FR')})`;
    const { data: snapshotData, error: snapErr } = await adminClient
      .rpc('pe_create_memo_snapshot', {
        p_version_id: activeVersion.id,
        p_label: snapshotLabel,
        p_user_id: user.id,
      });
    if (snapErr) {
      console.error(`[apply-dd-findings-to-memo] snapshot failed: ${snapErr.message}`);
      return errorResponse(`Snapshot pré-DD échoué : ${snapErr.message}`, 500);
    }
    const snapshotId = snapshotData as string;

    // 6) Charger les sections actuelles
    const sections = await fetchSections(adminClient, activeVersion.id);
    const sectionsByCode: Partial<Record<MemoSectionCode, any>> = {};
    sections.forEach(s => { sectionsByCode[s.section_code] = s; });

    // 7) Compose tone PE
    const toneBlock = await buildToneForAgent(adminClient, deal.organization_id);

    // 8) Pour chaque section impactée → appel Claude pour intégrer les findings
    const updatedSections: { code: MemoSectionCode; success: boolean; error?: string }[] = [];

    for (const code of impactedSections) {
      const section = sectionsByCode[code];
      if (!section) continue;

      const findingsForThisSection = findings.filter(f =>
        (f.impacts_section_codes ?? []).includes(code),
      );

      const findingsBlock = findingsForThisSection.map((f, i) => `
[${i + 1}] ${f.severity} · ${f.category} · ${f.title}
Body : ${f.body}
${f.recommendation ? `Recommandation : ${f.recommendation}` : ''}
`).join('\n');

      const sectionLabel = SECTION_LABELS[code];
      const jsonSchema = SECTION_SCHEMAS[code];
      const currentContent = JSON.stringify(section.content_json ?? {}, null, 2).slice(0, 10000);

      const systemPrompt = `${toneBlock}

Tu mets à jour la section "${sectionLabel}" du memo PE pour le deal "${dealName}" (${deal.deal_ref}) en INTÉGRANT les findings DD ci-dessous.

═══ CONTENU ACTUEL DE LA SECTION (état pré-DD) ═══
Content MD :
${section.content_md ?? '(vide)'}

Content JSON :
${currentContent}

═══ FINDINGS DD À INTÉGRER DANS CETTE SECTION ═══
${findingsBlock}

═══ INSTRUCTIONS ═══
- Tu RÉÉCRIS la section en intégrant les findings DD dans le content_json :
  - Pour les retraitements de chiffres : ajuste les KPIs/tables concernés
  - Pour les nouveaux red flags : ajoute-les aux red_flags / red_flags_synthesis si la section en a
  - Pour les confirmations : renforce le narratif existant
  - Pour les infirmations : retire/corrige les éléments invalidés
- Ajoute mention "[Source DD: rapport DD]" pour chaque modification
- meta.version_note doit refléter le passage post-DD (ex: "Post-DD — findings intégrés le ${new Date().toLocaleDateString('fr-FR')}")
- Conserve TOUT le contenu pertinent qui n'est pas concerné par les findings

═══ SCHÉMA JSON STRICT ATTENDU pour content_json ═══
${jsonSchema}

═══ FORMAT RÉPONSE ═══
{
  "content_md": "<markdown narratif mis à jour 150-300 mots>",
  "content_json": <objet content_json mis à jour conforme au schéma>
}

Pas de texte avant/après, pas de markdown fences. JSON strict.`;

      try {
        const claudeResponse = await callAI(systemPrompt, `Réécris la section "${sectionLabel}" en intégrant les findings DD.`, 8192, undefined, 0.2, {
          functionName: `apply-dd-findings-to-memo:${code}`,
          enterpriseId: deal.id,
        });
        const parsed = typeof claudeResponse === "string" ? JSON.parse(claudeResponse) : claudeResponse;

        if (typeof parsed.content_md !== 'string' && parsed.content_md !== null) {
          throw new Error('Missing content_md');
        }

        const { error: updErr } = await adminClient
          .from('memo_sections')
          .update({
            content_md: parsed.content_md ?? null,
            content_json: parsed.content_json ?? section.content_json,
            status: 'draft',  // re-validation requise post-DD
            last_edited_by: user.id,
            last_edited_at: new Date().toISOString(),
          })
          .eq('id', section.id);

        if (updErr) {
          updatedSections.push({ code, success: false, error: updErr.message });
        } else {
          updatedSections.push({ code, success: true });
        }
      } catch (e: any) {
        console.error(`[apply-dd-findings-to-memo] section ${code} failed: ${e.message}`);
        updatedSections.push({ code, success: false, error: e.message?.slice(0, 200) });
      }
    }

    // 9) UPDATE memo_versions : passe en stage note_ic_finale
    await adminClient
      .from('memo_versions')
      .update({
        stage: 'note_ic_finale',
        label: 'note_ic_finale_v1',
        generated_by_agent: 'apply-dd-findings-to-memo',
        generated_at: new Date().toISOString(),
      })
      .eq('id', activeVersion.id);

    // 10) Marquer les findings comme appliqués
    const findingIds = findings.map(f => f.id);
    await adminClient
      .from('pe_dd_findings')
      .update({
        applied_to_memo_at: new Date().toISOString(),
        applied_to_memo_by: user.id,
      })
      .in('id', findingIds);

    const successCount = updatedSections.filter(s => s.success).length;
    const failCount = updatedSections.length - successCount;

    return jsonResponse({
      success: true,
      snapshot_id: snapshotId,
      snapshot_label: snapshotLabel,
      version_id: activeVersion.id,
      new_stage: 'note_ic_finale',
      sections_updated: successCount,
      sections_failed: failCount,
      findings_applied: findingIds.length,
      details: updatedSections,
    });
  } catch (err: any) {
    console.error(`[apply-dd-findings-to-memo] error: ${err.message}`);
    return errorResponse(err.message ?? "Internal error", 500);
  }
});
