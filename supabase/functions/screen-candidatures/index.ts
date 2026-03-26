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

const SCREENING_SYSTEM_PROMPT = `Tu es un analyste senior qui évalue des candidatures à un programme d'accompagnement de PME en Afrique francophone.

Tu reçois :
- Les réponses du formulaire de candidature (données DÉCLARATIVES de l'entrepreneur)
- Les critères d'éligibilité du programme

Tu dois produire un DIAGNOSTIC INITIAL complet — pas juste un score, mais une analyse qui permet au chef de programme de :
1. Décider si cette entreprise mérite d'être sélectionnée
2. Savoir à l'avance quels sont les axes de travail si elle est sélectionnée
3. Briefer le coach assigné pour qu'il sache par où commencer

IMPORTANT :
- Les données sont DÉCLARATIVES (pas vérifiées). Signale les incohérences.
- Sois DIRECT et HONNÊTE — le bailleur préfère "ce dossier est insuffisant car..." plutôt qu'un avis diplomatique.
- Le diagnostic doit être actionnable, pas juste descriptif.

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
    "maturite_business": {
      "score": <number 0-100>,
      "label": "Mature | En croissance | Démarrage | Pré-démarrage",
      "constats": ["string × 2-3"],
      "donnees_manquantes": ["string"]
    },
    "capacite_financiere": {
      "score": <number>,
      "label": "Solide | Correcte | Fragile | Insuffisante",
      "constats": ["string × 2-3"],
      "donnees_manquantes": ["string"]
    },
    "potentiel_croissance": {
      "score": <number>,
      "label": "Fort | Modéré | Limité",
      "constats": ["string × 2-3"],
      "donnees_manquantes": ["string"]
    },
    "impact_social": {
      "score": <number>,
      "label": "Significatif | Modéré | Faible | Non évaluable",
      "constats": ["string × 2-3"],
      "donnees_manquantes": ["string"]
    },
    "qualite_dossier": {
      "score": <number>,
      "label": "Excellent | Bon | Moyen | Insuffisant",
      "constats": ["string × 2-3"]
    }
  },

  "points_forts": [
    {"titre": "string", "detail": "string", "impact": "string"}
  ],

  "points_vigilance": [
    {"titre": "string", "detail": "string", "risque": "string", "mitigation": "string"}
  ],

  "incoherences_detectees": [
    {"observation": "string", "severite": "INFO | ATTENTION | BLOQUANT"}
  ],

  "recommandation_accompagnement": {
    "verdict": "SÉLECTIONNER | SÉLECTIONNER SOUS CONDITION | LISTE D'ATTENTE | REJETER",
    "justification": "string — 2-3 phrases",
    "priorites_si_selectionnee": ["string × 3-4"],
    "potentiel_6_mois": "string",
    "profil_coach_ideal": "string"
  },

  "resume_comite": "string — 3-4 phrases pour décider en 30 secondes"
}`;

function buildUserPrompt(programme: any, criteria: any, candidature: any): string {
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

DOCUMENTS JOINTS : ${candidature.documents?.length || 0} fichier(s)
${(candidature.documents || []).map((d: any) => `- ${d.field_label || 'Document'}: ${d.file_name} (${Math.round((d.file_size || 0)/1024)} KB)`).join('\n')}

Produis le diagnostic initial complet.`;
}

async function screenOne(anthropicKey: string, programme: any, criteria: any, candidature: any): Promise<any> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SCREENING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(programme, criteria, candidature) }],
    }),
    signal: AbortSignal.timeout(45_000),
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
      query = query.eq("status", "received");
    }

    const { data: candidatures } = await query;
    if (!candidatures?.length) return jsonRes({ success: true, screened: 0, message: "Aucune candidature à traiter" });

    // Return 202 immediately, process in background
    const requestId = crypto.randomUUID();

    const asyncWork = async () => {
      const results: { id: string; company: string; score: number; classification: string; error?: string }[] = [];

      for (const cand of candidatures) {
        try {
          console.log(`[screen] Screening ${cand.company_name}...`);
          const diagnostic = await screenOne(anthropicKey, programme, criteria, cand);

          await supabase.from("candidatures").update({
            screening_score: diagnostic.score || 0,
            screening_data: diagnostic,
            screening_date: new Date().toISOString(),
            status: "in_review",
            updated_at: new Date().toISOString(),
          }).eq("id", cand.id);

          results.push({
            id: cand.id,
            company: cand.company_name,
            score: diagnostic.score,
            classification: diagnostic.classification,
          });
          console.log(`[screen] ✅ ${cand.company_name}: score=${diagnostic.score} (${diagnostic.classification})`);
        } catch (e: any) {
          console.error(`[screen] ❌ ${cand.company_name}:`, e.message);
          results.push({ id: cand.id, company: cand.company_name, score: 0, classification: "ERREUR", error: e.message });
        }
      }

      console.log(`[screen] Done: ${results.filter(r => !r.error).length}/${candidatures.length} screened`);
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
