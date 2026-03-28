import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
const SCREENING_SYSTEM_PROMPT = `Tu es un analyste senior qui évalue des candidatures à un programme d'accompagnement de PME en Afrique francophone. Tu travailles pour un bailleur de fonds (DFI, ONG, fonds d'impact).

Tu reçois :
- Les réponses du formulaire de candidature (données DÉCLARATIVES de l'entrepreneur)
- Les critères d'éligibilité du programme

Tu dois produire un DIAGNOSTIC COMPLET qui permet au chef de programme de DÉCIDER EN COMITÉ.

IMPORTANT :
- Les données sont DÉCLARATIVES (pas vérifiées). Signale les incohérences.
- Sois DIRECT et HONNÊTE.
- Chaque affirmation doit être chiffrée quand possible.
- Si une donnée manque, dis-le clairement.

Réponds UNIQUEMENT en JSON valide :
{
  "score": <number 0-100>,
  "classification": "ÉLIGIBLE" | "POTENTIEL" | "HORS_CIBLE",
  "matching_criteres": {
    "criteres_ok": [{"critere": "string", "detail": "string"}],
    "criteres_ko": [{"critere": "string", "detail": "string", "comment_corriger": "string"}],
    "criteres_partiels": [{"critere": "string", "detail": "string", "manque": "string"}]
  },
  "diagnostic_dimensions": {
    "maturite_business": { "score": <number>, "label": "string", "constats": ["string"], "donnees_manquantes": ["string"] },
    "capacite_financiere": { "score": <number>, "label": "string", "constats": ["string"], "donnees_manquantes": ["string"] },
    "potentiel_croissance": { "score": <number>, "label": "string", "constats": ["string"], "donnees_manquantes": ["string"] },
    "impact_social": { "score": <number>, "label": "string", "constats": ["string"], "donnees_manquantes": ["string"] },
    "qualite_dossier": { "score": <number>, "label": "string", "constats": ["string"] }
  },
  "fiche_entreprise": { "anciennete_ans": <number|null>, "stade": "string", "forme_juridique": "string|null", "ca_declare": <number|null>, "ca_devise": "string", "effectif_declare": <number|null>, "secteur_activite": "string", "pays": "string", "ville": "string|null", "description_activite": "string" },
  "indicateurs_financiers": { "ca_annuel": <number|null>, "croissance_ca_pct": <number|null>, "marge_estimee_pct": <number|null>, "rentabilite": "string", "tresorerie_estimee": "string", "niveau_endettement": "string", "source_donnees": "string", "fiabilite": "string", "commentaire": "string" },
  "marche_positionnement": { "marche_cible": "string", "taille_estimee": "string", "positionnement": "string", "concurrence": "string", "avantage_competitif": "string|null", "barriere_entree": "string" },
  "equipe_gouvernance": { "profil_dirigeant": "string", "equipe_direction": "string", "gouvernance": "string", "key_man_risk": true|false, "commentaire": "string" },
  "impact_mesurable": { "emplois_actuels": <number|null>, "emplois_projetes": "string", "pct_femmes": <number|null>, "pct_jeunes": <number|null>, "beneficiaires_directs": "string", "odd_potentiels": ["string"], "mesurabilite": "string", "commentaire": "string" },
  "besoin_financement": { "montant_demande": <number|null>, "montant_devise": "string", "utilisation_prevue": ["string"], "coherence_vs_ca": "string", "type_adapte": "string", "capacite_absorption": "string", "commentaire": "string" },
  "risques_programme": [{ "risque": "string", "type": "string", "probabilite": "string", "impact_programme": "string", "mitigation": "string" }],
  "traction": { "anciennete": "string", "evolution_ca": "string", "preuves_tangibles": ["string"], "niveau_preuve": "string" },
  "benchmark_declaratif": { "position_vs_secteur": "string", "commentaire": "string" },
  "points_forts": [{"titre": "string", "detail": "string", "impact": "string"}],
  "points_vigilance": [{"titre": "string", "detail": "string", "risque": "string", "mitigation": "string"}],
  "incoherences_detectees": [{"observation": "string", "severite": "INFO | ATTENTION | BLOQUANT"}],
  "recommandation_accompagnement": { "verdict": "SÉLECTIONNER | SÉLECTIONNER SOUS CONDITION | LISTE D'ATTENTE | REJETER", "justification": "string", "priorites_si_selectionnee": ["string"], "conditions_prealables": ["string"], "potentiel_6_mois": "string", "profil_coach_ideal": "string" },
  "resume_comite": "string — 4-5 phrases pour décider en 30 secondes"
}`;

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

Produis le diagnostic complet pour le comité de sélection.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SCREENING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(60_000),
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
    status: "in_review",
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
    EdgeRuntime.waitUntil(
      autoScreen(supabase, candidature.id, { ...candidatureData, company_name, contact_name, contact_email }, prog.id)
        .catch(e => console.error("[auto-screen] failed:", e.message))
    );

    return jsonRes({ success: true, candidature_id: candidature.id });

  } catch (e: any) {
    console.error("[submit-candidature] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
