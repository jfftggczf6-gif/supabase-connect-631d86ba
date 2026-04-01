import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSectorKnowledgePrompt, getDonorCriteriaPrompt, getValidationRulesPrompt } from "../_shared/financial-knowledge.ts";

/** Lightweight RAG: fetch relevant knowledge base entries without embedding search */
async function fetchRAGContext(supabase: any, country: string, sector: string): Promise<string> {
  try {
    const { data: entries } = await supabase
      .from("knowledge_base")
      .select("title, content, category, source")
      .in("category", ["benchmarks", "fiscal", "secteur", "bailleurs"])
      .limit(30);
    if (!entries?.length) return "";
    const countryLower = (country || "").toLowerCase();
    const sectorLower = (sector || "").toLowerCase();
    const relevant = entries.filter((e: any) => {
      const mc = !e.country || (e.country || "").toLowerCase().includes(countryLower) || countryLower.includes((e.country || "").toLowerCase());
      const ms = !e.sector || (e.sector || "").toLowerCase().includes(sectorLower) || sectorLower.includes((e.sector || "").toLowerCase());
      return mc || ms;
    });
    const final = relevant.length > 0 ? relevant.slice(0, 15) : entries.slice(0, 10);
    let text = "\n\n══════ BASE DE CONNAISSANCES ══════\n";
    for (const e of final) {
      text += `\n--- ${(e.category || "").toUpperCase()}: ${e.title} ---\n${(e.content || "").substring(0, 2000)}\n`;
      if (e.source) text += `(Source: ${e.source})\n`;
    }
    text += "══════════════════════════════════════════\n";
    return text;
  } catch { return ""; }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Screening prompt (same as screen-candidatures) ──
const SCREENING_SYSTEM_PROMPT = `Tu es un consultant senior en accompagnement PME en Afrique subsaharienne (15 ans, UEMOA/CEMAC). Tu travailles pour un bailleur de fonds et tu évalues des candidatures à un programme d'accompagnement.

Tu reçois :
- Les réponses du formulaire de candidature (données DÉCLARATIVES de l'entrepreneur)
- Les critères d'éligibilité du programme
- Le CONTENU EXTRAIT des documents joints quand disponible

Tu dois produire un DIAGNOSTIC COMPLET pour le comité de sélection.

RÈGLES :
- CHIFFRES PRÉCIS — pas "le CA est élevé" mais "CA 460M en 2024"
- Documents joints = source la plus fiable — privilégie-les sur le déclaratif
- Sois DIRECT et HONNÊTE
- Si une donnée manque, dis-le clairement
- L'analyse doit rester OBJECTIVE et FACTUELLE. Tu donnes un avis analytique, pas une décision. C'est le chef de programme qui décide.

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const SCREENING_SCHEMA = `{
  "score": <0-100>, "classification": "ÉLIGIBLE | POTENTIEL | HORS_CIBLE",
  "resume_executif": { "synthese": "string — 5-8 lignes", "points_forts": ["string"], "points_faibles": ["string"], "potentiel_estime": "string" },
  "matching_criteres": { "criteres_ok": [{"critere": "string", "detail": "string"}], "criteres_ko": [{"critere": "string", "detail": "string", "comment_corriger": "string"}], "criteres_partiels": [{"critere": "string", "detail": "string", "manque": "string"}] },
  "diagnostic_dimensions": {
    "maturite_business": { "score": <number>, "label": "string", "constats": ["string"], "donnees_manquantes": ["string"] },
    "capacite_financiere": { "score": <number>, "label": "string", "constats": ["string"], "donnees_manquantes": ["string"] },
    "potentiel_croissance": { "score": <number>, "label": "string", "constats": ["string"], "donnees_manquantes": ["string"] },
    "impact_social": { "score": <number>, "label": "string", "constats": ["string"], "donnees_manquantes": ["string"] },
    "qualite_dossier": { "score": <number>, "label": "string", "constats": ["string"] }
  },
  "fiche_entreprise": { "anciennete_ans": <number|null>, "stade": "string", "forme_juridique": "string|null", "ca_declare": <number|null>, "ca_devise": "string", "effectif_declare": <number|null>, "secteur_activite": "string", "pays": "string", "ville": "string|null", "description_activite": "string" },
  "contexte_entreprise": { "histoire": "string — 3-5 phrases avec chiffres", "marche": "string — 3-5 phrases", "activite": "string — 3-5 phrases" },
  "constats_par_scope": {
    "financier": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string", "source": "string" }],
    "commercial": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string", "source": "string" }],
    "operationnel": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string", "source": "string" }],
    "equipe_rh": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string", "source": "string" }],
    "legal_conformite": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string", "source": "string" }]
  },
  "indicateurs_financiers": { "ca_annuel": <number|null>, "croissance_ca_pct": <number|null>, "marge_estimee_pct": <number|null>, "rentabilite": "string", "tresorerie_estimee": "string", "niveau_endettement": "string", "source_donnees": "string", "fiabilite": "string", "commentaire": "string" },
  "sante_financiere": { "ca_estime": <number|null>, "marge_brute_pct": <number|null>, "marge_nette_pct": <number|null>, "ratio_endettement_pct": <number|null>, "tresorerie_nette": <number|null>, "benchmark_comparison": [{ "indicateur": "string", "valeur_entreprise": "string", "benchmark_secteur": "string", "verdict": "conforme | optimiste | alerte | critique", "source": "string" }], "health_label": "Saine | Fragile | Critique | Non evaluable", "health_detail": "string" },
  "cross_validation": { "ca_coherent": true|false, "ca_declared": <number|null>, "ca_from_documents": <number|null>, "ca_ecart_pct": <number|null>, "ca_detail": "string", "bilan_equilibre": true|false, "bilan_detail": "string", "charges_vs_effectifs": true|false, "charges_vs_effectifs_detail": "string", "tresorerie_coherent": true|false, "tresorerie_detail": "string", "dates_coherentes": true|false, "dates_detail": "string" },
  "qualite_dossier": { "score_qualite": <0-100>, "total_documents": <number>, "documents_exploitables": <number>, "documents_illisibles": <number>, "niveau_preuve": "N0 Declaratif | N1 Faible | N2 Intermediaire | N3 Solide", "couverture": { "finance": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] }, "legal": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] }, "commercial": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] }, "rh": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] } }, "note_qualite": "string" },
  "marche_positionnement": { "marche_cible": "string", "taille_estimee": "string", "positionnement": "string", "concurrence": "string", "avantage_competitif": "string|null", "barriere_entree": "string" },
  "equipe_gouvernance": { "profil_dirigeant": "string", "equipe_direction": "string", "gouvernance": "string", "key_man_risk": true|false, "commentaire": "string" },
  "impact_mesurable": { "emplois_actuels": <number|null>, "emplois_projetes": "string", "pct_femmes": <number|null>, "pct_jeunes": <number|null>, "beneficiaires_directs": "string", "odd_potentiels": ["string"], "mesurabilite": "string", "commentaire": "string" },
  "besoin_financement": { "montant_demande": <number|null>, "montant_devise": "string", "utilisation_prevue": ["string"], "coherence_vs_ca": "string", "type_adapte": "string", "capacite_absorption": "string", "commentaire": "string" },
  "risques_programme": [{ "risque": "string", "type": "string", "probabilite": "string", "impact_programme": "string", "mitigation": "string" }],
  "traction": { "anciennete": "string", "evolution_ca": "string", "preuves_tangibles": ["string"], "niveau_preuve": "string" },
  "benchmark_declaratif": { "position_vs_secteur": "string", "commentaire": "string" },
  "analyse_narrative": { "comparaison_sectorielle": { "positionnement_global": "string", "benchmark_detail": [{ "indicateur": "string", "valeur_entreprise": "string", "mediane_secteur": "string", "position": "string", "commentaire": "string" }] }, "scenarios_prospectifs": { "scenario_pessimiste": { "description": "string", "ca_estime": "string", "probabilite": "string" }, "scenario_base": { "description": "string", "ca_estime": "string", "probabilite": "string" }, "scenario_optimiste": { "description": "string", "ca_estime": "string", "probabilite": "string" } }, "verdict_analyste": { "synthese_pour_comite": "string", "deal_breakers": ["string"], "conditions_sine_qua_non": ["string"], "quick_wins": ["string"] } },
  "points_forts": [{"titre": "string", "detail": "string", "impact": "string"}],
  "points_vigilance": [{"titre": "string", "detail": "string", "risque": "string", "mitigation": "string"}],
  "incoherences_detectees": [{"observation": "string", "severite": "INFO | ATTENTION | BLOQUANT"}],
  "recommandation_accompagnement": { "avis": "FAVORABLE | FAVORABLE SOUS RÉSERVE | À APPROFONDIR | DÉFAVORABLE", "justification": "string", "priorites_si_selectionnee": ["string"], "conditions_prealables": ["string"], "potentiel_6_mois": "string", "profil_coach_ideal": "string" },
  "resume_comite": "string — 4-5 phrases pour décider en 30 secondes"
}`;

/** Download a file from Storage and parse it via Railway /parse endpoint */
async function parseDocFromStorage(supabase: any, storagePath: string, fileName: string): Promise<string> {
  const RAILWAY_URL = Deno.env.get("RAILWAY_URL") || "https://esono-parser-production-8f89.up.railway.app";
  const PARSER_API_KEY = Deno.env.get("PARSER_API_KEY") || "";
  const parts = storagePath.split("/");
  const bucket = parts[0];
  const filePath = parts.slice(1).join("/");
  const { data: fileData, error } = await supabase.storage.from(bucket).download(filePath);
  if (error || !fileData) { console.warn(`[parse-doc] Download failed ${storagePath}:`, error?.message); return ""; }
  const arrayBuf = await fileData.arrayBuffer();
  const blob = new Blob([new Uint8Array(arrayBuf)]);
  const formData = new FormData();
  formData.append("file", blob, fileName);
  const resp = await fetch(`${RAILWAY_URL}/parse`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${PARSER_API_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) { console.warn(`[parse-doc] Railway failed for ${fileName}: ${resp.status}`); return ""; }
  const result = await resp.json();
  return result.text || result.content || "";
}

async function autoScreen(supabase: any, candidatureId: string, candidature: any, programmeId: string) {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) { console.warn("[auto-screen] No ANTHROPIC_API_KEY"); return; }

  // Fetch programme + criteria
  const { data: programme } = await supabase
    .from("programmes")
    .select("name, organization, programme_criteria:criteria_id(*)")
    .eq("id", programmeId)
    .single();

  if (!programme) { console.warn("[auto-screen] Programme not found"); return; }
  const criteria = programme.programme_criteria;

  const docs = Array.isArray(candidature.documents)
    ? candidature.documents
    : Object.entries(candidature.documents || {}).map(([k, v]: any) => ({
        field_label: k, file_name: v?.filename || v?.file_name || k, file_size: v?.file_size || 0,
      }));

  // Extract document contents
  let documentContents = "";
  if (docs.length > 0 && docs.some((d: any) => d.storage_path)) {
    try {
      const results: string[] = [];
      for (const doc of docs) {
        if (!doc.storage_path) continue;
        const text = await parseDocFromStorage(supabase, doc.storage_path, doc.file_name || "document");
        if (text.trim()) results.push(`══════ ${doc.field_label || doc.file_name || 'Document'} ══════\n${text.slice(0, 15000)}`);
      }
      documentContents = results.join("\n\n");
      console.log(`[auto-screen] Extracted ${documentContents.length} chars from ${docs.length} doc(s)`);
    } catch (e: any) {
      console.warn("[auto-screen] Document extraction failed:", e.message);
    }
  }

  const userPrompt = `PROGRAMME : ${programme.name}
ORGANISATION : ${programme.organization || "Non spécifiée"}

CRITÈRES D'ÉLIGIBILITÉ :
${criteria ? JSON.stringify({
  min_revenue: criteria.min_revenue, sector_filter: criteria.sector_filter,
  country_filter: criteria.country_filter, max_debt_ratio: criteria.max_debt_ratio,
  min_margin: criteria.min_margin, custom_criteria: criteria.custom_criteria,
  raw_criteria_text: criteria.raw_criteria_text,
}, null, 2) : "Aucun critère spécifique défini"}

CANDIDATURE :
- Entreprise : ${candidature.company_name}
- Contact : ${candidature.contact_name || "Non fourni"} (${candidature.contact_email})

RÉPONSES AU FORMULAIRE :
${JSON.stringify(candidature.form_data || {}, null, 2)}

DOCUMENTS JOINTS : ${docs.length === 0
  ? '0 fichier(s)\n⚠️ AUCUN DOCUMENT FOURNI'
  : `${docs.length} fichier(s)\n${docs.map((d: any) => `- ${d.field_label || 'Document'}: ${d.file_name || d.filename} (${Math.round((d.file_size || 0)/1024)} KB)`).join('\n')}`
}

${documentContents ? `══════ CONTENU DES DOCUMENTS ══════\n${documentContents}\n══════ FIN DES DOCUMENTS ══════\n\nIMPORTANT : Compare les données du formulaire avec le contenu des documents. Signale toute incohérence.` : ''}

CONSTATS PAR SCOPE : regroupe TOUS tes constats par domaine (financier, commercial, opérationnel, RH, legal). Chaque constat classé par sévérité.

Produis le diagnostic complet selon ce schéma JSON :
${SCREENING_SCHEMA}`;

  // RAG context + benchmarks
  const sector = candidature.form_data?.sector || candidature.form_data?.secteur || "";
  const country = candidature.form_data?.country || candidature.form_data?.pays || "";
  const ragContext = await fetchRAGContext(supabase, country, sector);
  const sectorBenchmarks = getSectorKnowledgePrompt(sector || "services_b2b");
  const donorCriteria = getDonorCriteriaPrompt();
  const validationRules = getValidationRulesPrompt();

  const enrichedPrompt = userPrompt
    + `\n\n══════ BENCHMARKS SECTORIELS ══════\n${sectorBenchmarks}`
    + `\n\n══════ CRITÈRES BAILLEURS DE RÉFÉRENCE ══════\n${donorCriteria}`
    + `\n\n══════ RÈGLES DE VALIDATION CROISÉE ══════\n${validationRules}`
    + ragContext;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 24576,
      temperature: 0,
      system: SCREENING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: enrichedPrompt }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`[auto-screen] AI error ${resp.status}: ${errText.slice(0, 200)}`);
    return;
  }

  const result = await resp.json();
  const content = result.content?.[0]?.text || "";
  let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) { console.error("[auto-screen] No JSON in response"); return; }

  const diagnostic = JSON.parse(cleaned.substring(start, end + 1));

  await supabase.from("candidatures").update({
    screening_score: diagnostic.score || 0,
    screening_data: diagnostic,
    screening_date: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", candidatureId);

  console.log(`[auto-screen] ✅ ${candidature.company_name}: score=${diagnostic.score} (${diagnostic.classification})`);
}

// ── Main serve ──
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();

    // Handle document update (after initial submission) — re-trigger screening with docs
    if (body.action === 'update_documents' && body.candidature_id) {
      await supabase.from("candidatures").update({
        documents: body.documents || [],
        updated_at: new Date().toISOString(),
      }).eq("id", body.candidature_id);

      // Re-screen with documents info (non-blocking)
      // @ts-ignore
      EdgeRuntime.waitUntil((async () => {
        try {
          const { data: cand } = await supabase.from("candidatures").select("*").eq("id", body.candidature_id).single();
          if (cand) {
            await autoScreen(supabase, cand.id, cand, cand.programme_id);
            console.log(`[update_documents] Re-screened ${cand.company_name} with ${(body.documents || []).length} docs`);
          }
        } catch (e: any) {
          console.error("[update_documents] re-screen failed:", e.message);
          await supabase.from("candidatures").update({
            screening_data: { _error: e.message?.slice(0, 500), _at: new Date().toISOString(), _source: "update_documents" },
            updated_at: new Date().toISOString(),
          }).eq("id", body.candidature_id);
        }
      })());

      return jsonRes({ success: true });
    }

    const { programme_slug, company_name, contact_name, contact_email, contact_phone, form_data, documents } = body;

    // Validation
    if (!programme_slug) return jsonRes({ error: "programme_slug requis" }, 400);
    if (!company_name) return jsonRes({ error: "company_name requis" }, 400);
    if (!contact_email) return jsonRes({ error: "contact_email requis" }, 400);

    // Find programme by slug
    const { data: prog, error: progErr } = await supabase
      .from("programmes")
      .select("id, status, end_date, name")
      .eq("form_slug", programme_slug)
      .single();

    if (progErr || !prog) return jsonRes({ error: "Programme non trouvé" }, 404);
    if (prog.status !== "open") return jsonRes({ error: "Ce programme n'accepte plus de candidatures" }, 400);

    // Check end_date
    if (prog.end_date && new Date(prog.end_date) < new Date()) {
      return jsonRes({ error: "La date limite de candidature est dépassée" }, 400);
    }

    // Check duplicate (same email + same programme)
    const { data: existing } = await supabase
      .from("candidatures")
      .select("id")
      .eq("programme_id", prog.id)
      .eq("contact_email", contact_email)
      .maybeSingle();

    if (existing) {
      return jsonRes({ error: "Une candidature avec cet email existe déjà pour ce programme" }, 409);
    }

    // Create candidature
    const candidatureData = {
      programme_id: prog.id,
      enterprise_id: null,
      company_name,
      contact_name: contact_name || null,
      contact_email,
      contact_phone: contact_phone || null,
      form_data: form_data || {},
      documents: documents || [],
      status: "received",
      submitted_at: new Date().toISOString(),
    };

    const { data: candidature, error: insertErr } = await supabase
      .from("candidatures")
      .insert(candidatureData)
      .select("id")
      .single();

    if (insertErr) {
      console.error("[submit-candidature] insert error:", insertErr);
      return jsonRes({ error: insertErr.message }, 500);
    }

    console.log(`[submit-candidature] ✅ ${company_name} → ${prog.name} (${candidature.id})`);

    // Auto-screen in background
    // @ts-ignore
    EdgeRuntime.waitUntil((async () => {
      try {
        await autoScreen(supabase, candidature.id, { ...candidatureData, company_name, contact_name, contact_email }, prog.id);
      } catch (e: any) {
        console.error("[auto-screen] failed:", e.message);
        await supabase.from("candidatures").update({
          screening_data: { _error: e.message?.slice(0, 500), _at: new Date().toISOString(), _source: "auto_screen" },
          updated_at: new Date().toISOString(),
        }).eq("id", candidature.id);
      }
    })());

    return jsonRes({ success: true, candidature_id: candidature.id });

  } catch (e: any) {
    console.error("[submit-candidature] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
