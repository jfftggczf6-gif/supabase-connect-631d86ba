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

const SCREENING_SYSTEM_PROMPT = `Tu es un consultant senior en accompagnement PME en Afrique subsaharienne (15 ans, UEMOA/CEMAC). Tu travailles pour un bailleur de fonds et tu évalues des candidatures à un programme d'accompagnement.

Tu reçois :
- Les réponses du formulaire de candidature (données DÉCLARATIVES de l'entrepreneur)
- Les critères d'éligibilité du programme
- Le CONTENU EXTRAIT des documents joints (business plan, états financiers, etc.) quand disponible

Tu dois produire un DIAGNOSTIC COMPLET qui permet au chef de programme de DÉCIDER EN COMITÉ :
1. Cette entreprise mérite-t-elle d'être sélectionnée ?
2. Le financement est-il justifié et le risque acceptable ?
3. Quels sont les axes de travail prioritaires si sélectionnée ?

═══ TON APPROCHE ═══
1. ANALYSER CHAQUE DOCUMENT pour extraire les chiffres structurants (CA, marges, effectifs, investissements)
2. ANALYSER EN CONSULTANT — expliquer le POURQUOI, pas juste le QUOI
3. REGROUPER LES CONSTATS PAR SCOPE (financier, commercial, opérationnel, RH, legal)
4. COMPARER déclaratif vs documents — signaler toute incohérence

═══ RÈGLES ═══
- CHIFFRES PRÉCIS : pas "le CA est élevé" mais "CA 460M en 2024"
- HONNÊTETÉ : un dossier faible est un dossier faible
- Documents joints = source la plus fiable — privilégie-les sur le déclaratif
- Si une donnée manque, dis-le clairement

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const SCREENING_SCHEMA = `{
  "score": <number 0-100>,
  "classification": "ÉLIGIBLE | POTENTIEL | HORS_CIBLE",

  "resume_executif": {
    "synthese": "string — 5-8 lignes, résumé complet du dossier",
    "points_forts": ["string — 3-5 forces avec données chiffrées"],
    "points_faibles": ["string — 3-5 faiblesses avec données chiffrées"],
    "potentiel_estime": "string — 2-3 phrases sur le potentiel"
  },

  "matching_criteres": {
    "criteres_ok": [{"critere": "string", "detail": "string"}],
    "criteres_ko": [{"critere": "string", "detail": "string", "comment_corriger": "string"}],
    "criteres_partiels": [{"critere": "string", "detail": "string", "manque": "string"}]
  },

  "diagnostic_dimensions": {
    "maturite_business": { "score": <number 0-100>, "label": "Mature | En croissance | Démarrage | Pré-démarrage", "constats": ["string × 2-3"], "donnees_manquantes": ["string"] },
    "capacite_financiere": { "score": <number>, "label": "Solide | Correcte | Fragile | Insuffisante", "constats": ["string × 2-3"], "donnees_manquantes": ["string"] },
    "potentiel_croissance": { "score": <number>, "label": "Fort | Modéré | Limité", "constats": ["string × 2-3"], "donnees_manquantes": ["string"] },
    "impact_social": { "score": <number>, "label": "Significatif | Modéré | Faible | Non évaluable", "constats": ["string × 2-3"], "donnees_manquantes": ["string"] },
    "qualite_dossier": { "score": <number>, "label": "Excellent | Bon | Moyen | Insuffisant", "constats": ["string × 2-3"] }
  },

  "fiche_entreprise": {
    "anciennete_ans": <number ou null>, "stade": "Idée | Démarrage (<2 ans) | Croissance (2-5 ans) | Maturité (>5 ans)",
    "forme_juridique": "string ou null", "ca_declare": <number ou null>, "ca_devise": "string",
    "effectif_declare": <number ou null>, "secteur_activite": "string", "pays": "string", "ville": "string ou null",
    "description_activite": "string — 2-3 phrases"
  },

  "contexte_entreprise": {
    "histoire": "string — 3-5 phrases. Trajectoire factuelle avec chiffres (CA 3 ans, dates clés).",
    "marche": "string — 3-5 phrases. Taille, croissance, concurrence, positionnement.",
    "activite": "string — 3-5 phrases. Produits/services, modèle de revenu, poids relatif des activités."
  },

  "constats_par_scope": {
    "financier": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string — factuel, chiffré, 2-3 phrases", "piste": "string", "source": "string" }],
    "commercial": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string", "source": "string" }],
    "operationnel": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string", "source": "string" }],
    "equipe_rh": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string", "source": "string" }],
    "legal_conformite": [{ "titre": "string", "severite": "urgent | attention | positif", "constat": "string", "piste": "string", "source": "string" }]
  },

  "indicateurs_financiers": {
    "ca_annuel": <number ou null>, "croissance_ca_pct": <number ou null>, "marge_estimee_pct": <number ou null>,
    "rentabilite": "Rentable | Point mort | Déficitaire | Non évaluable",
    "tresorerie_estimee": "Confortable | Tendue | Critique | Non évaluable",
    "niveau_endettement": "Faible | Modéré | Élevé | Non évaluable",
    "source_donnees": "string", "fiabilite": "Élevée | Moyenne | Faible", "commentaire": "string"
  },

  "sante_financiere": {
    "ca_estime": <number ou null>, "marge_brute_pct": <number ou null>, "marge_nette_pct": <number ou null>,
    "ratio_endettement_pct": <number ou null>, "tresorerie_nette": <number ou null>,
    "benchmark_comparison": [{ "indicateur": "string", "valeur_entreprise": "string", "benchmark_secteur": "string", "verdict": "conforme | optimiste | alerte | critique", "source": "string" }],
    "health_label": "Saine | Fragile | Critique | Non evaluable", "health_detail": "string"
  },

  "cross_validation": {
    "ca_coherent": true|false, "ca_declared": <number ou null>, "ca_from_documents": <number ou null>,
    "ca_ecart_pct": <number ou null>, "ca_detail": "string",
    "bilan_equilibre": true|false, "bilan_detail": "string",
    "charges_vs_effectifs": true|false, "charges_vs_effectifs_detail": "string",
    "tresorerie_coherent": true|false, "tresorerie_detail": "string",
    "dates_coherentes": true|false, "dates_detail": "string"
  },

  "qualite_dossier": {
    "score_qualite": <0-100>, "total_documents": <number>, "documents_exploitables": <number>, "documents_illisibles": <number>,
    "niveau_preuve": "N0 Declaratif | N1 Faible | N2 Intermediaire | N3 Solide",
    "couverture": {
      "finance": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] },
      "legal": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] },
      "commercial": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] },
      "rh": { "couvert": true|false, "documents_trouves": ["string"], "manquants_critiques": ["string"] }
    },
    "note_qualite": "string"
  },

  "marche_positionnement": {
    "marche_cible": "string", "taille_estimee": "string", "positionnement": "string",
    "concurrence": "string", "avantage_competitif": "string ou null", "barriere_entree": "Faible | Modérée | Forte"
  },

  "equipe_gouvernance": {
    "profil_dirigeant": "string", "equipe_direction": "string",
    "gouvernance": "Formelle | Basique | Inexistante | Non évaluable", "key_man_risk": true|false, "commentaire": "string"
  },

  "impact_mesurable": {
    "emplois_actuels": <number ou null>, "emplois_projetes": "string",
    "pct_femmes": <number ou null>, "pct_jeunes": <number ou null>,
    "beneficiaires_directs": "string", "odd_potentiels": ["string"],
    "mesurabilite": "Forte | Moyenne | Faible", "commentaire": "string"
  },

  "besoin_financement": {
    "montant_demande": <number ou null>, "montant_devise": "string",
    "utilisation_prevue": ["string"], "coherence_vs_ca": "Cohérent | Élevé vs CA | Faible vs ambition | Non évaluable",
    "type_adapte": "Subvention | Prêt | Mixte | Equity", "capacite_absorption": "Bonne | Moyenne | Faible | Non évaluable",
    "commentaire": "string"
  },

  "risques_programme": [{ "risque": "string", "type": "financier | opérationnel | réputationnel | exécution | concentration", "probabilite": "faible | moyenne | élevée", "impact_programme": "string", "mitigation": "string" }],

  "traction": { "anciennete": "string", "evolution_ca": "string", "preuves_tangibles": ["string"], "niveau_preuve": "Solide | Partiel | Déclaratif uniquement" },

  "benchmark_declaratif": { "position_vs_secteur": "Au-dessus | Dans la norme | En-dessous | Non évaluable", "commentaire": "string" },

  "analyse_narrative": {
    "comparaison_sectorielle": {
      "positionnement_global": "string — 2-3 phrases",
      "benchmark_detail": [{ "indicateur": "string", "valeur_entreprise": "string", "mediane_secteur": "string", "top_quartile": "string", "bottom_quartile": "string", "position": "top | above_median | median | below_median | bottom", "commentaire": "string" }]
    },
    "scenarios_prospectifs": {
      "scenario_pessimiste": { "description": "string", "ca_estime": "string", "ebitda_estime": "string", "probabilite": "string" },
      "scenario_base": { "description": "string", "ca_estime": "string", "ebitda_estime": "string", "probabilite": "string" },
      "scenario_optimiste": { "description": "string", "ca_estime": "string", "ebitda_estime": "string", "probabilite": "string" }
    },
    "verdict_analyste": {
      "synthese_pour_comite": "string — 3-5 phrases de verdict final",
      "deal_breakers": ["string"], "conditions_sine_qua_non": ["string"], "quick_wins": ["string"]
    }
  },

  "points_forts": [{"titre": "string", "detail": "string", "impact": "string"}],
  "points_vigilance": [{"titre": "string", "detail": "string", "risque": "string", "mitigation": "string"}],
  "incoherences_detectees": [{"observation": "string", "severite": "INFO | ATTENTION | BLOQUANT"}],

  "recommandation_accompagnement": {
    "verdict": "SÉLECTIONNER | SÉLECTIONNER SOUS CONDITION | LISTE D'ATTENTE | REJETER",
    "justification": "string — 2-3 phrases", "priorites_si_selectionnee": ["string × 3-4"],
    "conditions_prealables": ["string"], "potentiel_6_mois": "string", "profil_coach_ideal": "string"
  },

  "resume_comite": "string — 4-5 phrases pour décider en 30 secondes. Verdict, chiffres clés, risque principal."
}`;

/** Download a file from Storage and parse it via Railway /parse endpoint */
async function parseDocumentFromStorage(supabase: any, storagePath: string, fileName: string): Promise<string> {
  const RAILWAY_URL = Deno.env.get("RAILWAY_URL") || "https://esono-parser-production-8f89.up.railway.app";
  const PARSER_API_KEY = Deno.env.get("PARSER_API_KEY") || "";

  // Extract bucket and path
  const parts = storagePath.split("/");
  const bucket = parts[0]; // "candidature-documents"
  const filePath = parts.slice(1).join("/");

  const { data: fileData, error } = await supabase.storage.from(bucket).download(filePath);
  if (error || !fileData) {
    console.warn(`[parse-doc] Failed to download ${storagePath}:`, error?.message);
    return "";
  }

  // Convert to proper Blob with arrayBuffer (Deno compatibility)
  const arrayBuf = await fileData.arrayBuffer();
  const blob = new Blob([new Uint8Array(arrayBuf)]);

  // Send to Railway /parse as multipart
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const resp = await fetch(`${RAILWAY_URL}/parse`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${PARSER_API_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    console.warn(`[parse-doc] Railway /parse failed for ${fileName}: ${resp.status} ${errText.slice(0, 100)}`);
    return "";
  }

  const result = await resp.json();
  return result.text || result.content || "";
}

/** Extract text from all candidature documents */
async function extractDocumentContents(supabase: any, documents: any[]): Promise<string> {
  if (!documents?.length) return "";

  const sorted = documents.filter((d: any) => d.storage_path);
  console.log(`[parse-doc] Will parse ${sorted.length} documents`);

  const results: string[] = [];
  for (const doc of sorted) {
    try {
      console.log(`[parse-doc] Parsing ${doc.file_name} (${Math.round((doc.file_size || 0) / 1024)} KB)...`);
      const text = await parseDocumentFromStorage(supabase, doc.storage_path, doc.file_name || "document");
      if (text.trim()) {
        results.push(`══════ ${doc.file_name || 'Document'} ══════\n${text.slice(0, 15000)}`);
        console.log(`[parse-doc] ✅ ${doc.file_name}: ${text.length} chars extracted`);
      } else {
        console.log(`[parse-doc] ⚠ ${doc.file_name}: empty result`);
      }
    } catch (e: any) {
      console.warn(`[parse-doc] ❌ Error parsing ${doc.file_name}:`, e.message);
    }
  }
  return results.join("\n\n");
}

function buildUserPrompt(programme: any, criteria: any, candidature: any, documentContents: string): string {
  const docs = Array.isArray(candidature.documents)
    ? candidature.documents
    : Object.entries(candidature.documents || {}).map(([k, v]: any) => ({
        field_label: k, file_name: v?.filename || v?.file_name || k, file_size: v?.file_size || 0,
      }));

  return `PROGRAMME : ${programme.name}
ORGANISATION : ${programme.organization || "Non spécifiée"}

CRITÈRES D'ÉLIGIBILITÉ :
${criteria ? JSON.stringify({
  min_revenue: criteria.min_revenue,
  sector_filter: criteria.sector_filter,
  country_filter: criteria.country_filter,
  max_debt_ratio: criteria.max_debt_ratio,
  min_margin: criteria.min_margin,
  custom_criteria: criteria.custom_criteria,
  raw_criteria_text: criteria.raw_criteria_text,
}, null, 2) : "Aucun critère spécifique défini"}

CANDIDATURE :
- Entreprise : ${candidature.company_name}
- Contact : ${candidature.contact_name || "Non fourni"} (${candidature.contact_email})
- Téléphone : ${candidature.contact_phone || "Non fourni"}

RÉPONSES AU FORMULAIRE :
${JSON.stringify(candidature.form_data || {}, null, 2)}

DOCUMENTS JOINTS : ${docs.length === 0
  ? '0 fichier(s)\n⚠️ AUCUN DOCUMENT FOURNI — signaler comme point de vigilance'
  : `${docs.length} fichier(s)\n${docs.map((d: any) => `- ${d.field_label || 'Document'}: ${d.file_name} (${Math.round((d.file_size || 0)/1024)} KB)`).join('\n')}`}

${documentContents ? `══════ CONTENU DES DOCUMENTS ══════\n${documentContents}\n══════ FIN DES DOCUMENTS ══════\n\nIMPORTANT : Compare les données du formulaire avec le contenu des documents. Signale toute incohérence.` : ''}

CONSTATS PAR SCOPE : regroupe TOUS tes constats par domaine. Chaque constat classé par sévérité (urgent d'abord). Cite des chiffres précis.

Produis le diagnostic complet selon ce schéma JSON :
${SCREENING_SCHEMA}`;
}

async function screenOne(anthropicKey: string, programme: any, criteria: any, candidature: any, supabase: any): Promise<any> {
  // Extract document contents
  const docs = Array.isArray(candidature.documents) ? candidature.documents : [];
  let documentContents = "";
  if (docs.length > 0 && docs.some((d: any) => d.storage_path)) {
    try {
      documentContents = await extractDocumentContents(supabase, docs);
      console.log(`[screen] Extracted ${documentContents.length} chars from ${docs.length} document(s) for ${candidature.company_name}`);
    } catch (e: any) {
      console.warn(`[screen] Document extraction failed for ${candidature.company_name}:`, e.message);
    }
  }

  // RAG context + benchmarks
  const sector = candidature.form_data?.sector || candidature.form_data?.secteur || "";
  const country = candidature.form_data?.country || candidature.form_data?.pays || "";
  const ragContext = await fetchRAGContext(supabase, country, sector);
  const sectorBenchmarks = getSectorKnowledgePrompt(sector || "services_b2b");
  const donorCriteria = getDonorCriteriaPrompt();
  const validationRules = getValidationRulesPrompt();

  const enrichedPrompt = buildUserPrompt(programme, criteria, candidature, documentContents)
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
    signal: AbortSignal.timeout(300_000),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`AI error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const result = await resp.json();
  const content = result.content?.[0]?.text || "";

  // Parse JSON
  let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in AI response");
  return JSON.parse(cleaned.substring(start, end + 1));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Non autorisé" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const isAdmin = roleData?.role === "super_admin";
    const isChef = roleData?.role === "chef_programme";
    if (!isAdmin && !isChef) return jsonRes({ error: "Accès refusé" }, 403);

    const body = await req.json();
    const { programme_id, candidature_ids } = body;
    if (!programme_id) return jsonRes({ error: "programme_id requis" }, 400);

    // Check programme ownership
    const { data: programme } = await supabase
      .from("programmes")
      .select("*, programme_criteria:criteria_id(*)")
      .eq("id", programme_id)
      .single();

    if (!programme) return jsonRes({ error: "Programme non trouvé" }, 404);
    if (isChef && programme.chef_programme_id !== user.id) return jsonRes({ error: "Accès refusé" }, 403);

    const criteria = programme.programme_criteria;

    // Get candidatures to screen
    let query = supabase
      .from("candidatures")
      .select("*")
      .eq("programme_id", programme_id);

    if (candidature_ids?.length) {
      query = query.in("id", candidature_ids);
    } else {
      query = query.in("status", ["received", "in_review"]);
    }

    const { data: candidatures } = await query;
    if (!candidatures?.length) return jsonRes({ success: true, screened: 0, message: "Aucune candidature à traiter" });

    // Return 202 immediately, process in background
    const requestId = crypto.randomUUID();

    const asyncWork = async () => {
      for (const cand of candidatures) {
        try {
          const docsCount = Array.isArray(cand.documents) ? cand.documents.filter((d: any) => d.storage_path).length : 0;
          console.log(`[screen] Screening ${cand.company_name} (${docsCount} docs)...`);
          const diagnostic = await screenOne(anthropicKey, programme, criteria, cand, supabase);

          await supabase.from("candidatures").update({
            screening_score: diagnostic.score || 0,
            screening_data: diagnostic,
            screening_date: new Date().toISOString(),
            status: "in_review",
            updated_at: new Date().toISOString(),
          }).eq("id", cand.id);

          console.log(`[screen] ✅ ${cand.company_name}: score=${diagnostic.score} (${diagnostic.classification})`);
        } catch (e: any) {
          console.error(`[screen] ❌ ${cand.company_name}:`, e.message);
          await supabase.from("candidatures").update({
            screening_data: { _error: e.message?.slice(0, 500), _at: new Date().toISOString() },
            updated_at: new Date().toISOString(),
          }).eq("id", cand.id);
        }
      }
    };

    // @ts-ignore
    EdgeRuntime.waitUntil(asyncWork());

    return jsonRes({
      accepted: true,
      request_id: requestId,
      candidatures_count: candidatures.length,
      message: `Screening de ${candidatures.length} candidature(s) lancé en arrière-plan`,
    }, 202);

  } catch (e: any) {
    console.error("[screen-candidatures] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
