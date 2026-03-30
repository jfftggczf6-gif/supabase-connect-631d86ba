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

const SCREENING_SYSTEM_PROMPT = `Tu es un analyste senior qui évalue des candidatures à un programme d'accompagnement de PME en Afrique francophone. Tu travailles pour un bailleur de fonds (DFI, ONG, fonds d'impact).

Tu reçois :
- Les réponses du formulaire de candidature (données DÉCLARATIVES de l'entrepreneur)
- Les critères d'éligibilité du programme

Tu dois produire un DIAGNOSTIC COMPLET qui permet au chef de programme de DÉCIDER EN COMITÉ :
1. Cette entreprise mérite-t-elle d'être sélectionnée ?
2. Le financement est-il justifié et le risque acceptable ?
3. Quels sont les axes de travail prioritaires si sélectionnée ?
4. Comment briefer le coach assigné ?

IMPORTANT :
- Les données sont DÉCLARATIVES (pas vérifiées). Signale les incohérences.
- Sois DIRECT et HONNÊTE — le bailleur préfère "ce dossier est insuffisant car..." plutôt qu'un avis diplomatique.
- Le diagnostic doit être actionnable, pas juste descriptif.
- Chaque affirmation doit être chiffrée quand possible.
- Si une donnée manque, dis-le clairement plutôt que de deviner.

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

  "fiche_entreprise": {
    "anciennete_ans": <number ou null>,
    "stade": "Idée | Démarrage (<2 ans) | Croissance (2-5 ans) | Maturité (>5 ans)",
    "forme_juridique": "string ou null",
    "ca_declare": <number ou null>,
    "ca_devise": "string",
    "effectif_declare": <number ou null>,
    "secteur_activite": "string",
    "pays": "string",
    "ville": "string ou null",
    "description_activite": "string — 2-3 phrases résumant ce que fait l'entreprise"
  },

  "indicateurs_financiers": {
    "ca_annuel": <number ou null>,
    "croissance_ca_pct": <number ou null — si historique disponible>,
    "marge_estimee_pct": <number ou null>,
    "rentabilite": "Rentable | Point mort | Déficitaire | Non évaluable",
    "tresorerie_estimee": "Confortable | Tendue | Critique | Non évaluable",
    "niveau_endettement": "Faible | Modéré | Élevé | Non évaluable",
    "source_donnees": "Formulaire déclaratif — non vérifié",
    "fiabilite": "Élevée | Moyenne | Faible",
    "commentaire": "string — 1-2 phrases sur la qualité des données financières"
  },

  "marche_positionnement": {
    "marche_cible": "string — description du marché adressé",
    "taille_estimee": "string — ex: 'Marché local estimé à ~2Mds (devise locale)'",
    "positionnement": "string — comment l'entreprise se différencie",
    "concurrence": "string — niveau de concurrence et principaux acteurs",
    "avantage_competitif": "string ou null",
    "barriere_entree": "Faible | Modérée | Forte"
  },

  "equipe_gouvernance": {
    "profil_dirigeant": "string — formation, expérience, parcours en 2-3 phrases",
    "equipe_direction": "string — composition, compétences clés, lacunes",
    "gouvernance": "Formelle | Basique | Inexistante | Non évaluable",
    "key_man_risk": true | false,
    "commentaire": "string — 1-2 phrases"
  },

  "impact_mesurable": {
    "emplois_actuels": <number ou null>,
    "emplois_projetes": "string — ex: 'de 15 à 30 en 24 mois'",
    "pct_femmes": <number ou null>,
    "pct_jeunes": <number ou null>,
    "beneficiaires_directs": "string — qui bénéficie et combien",
    "odd_potentiels": ["string — ex: 'ODD 8 — Travail décent'"],
    "mesurabilite": "Forte | Moyenne | Faible",
    "commentaire": "string"
  },

  "besoin_financement": {
    "montant_demande": <number ou null>,
    "montant_devise": "string",
    "utilisation_prevue": ["string — postes de dépense principaux"],
    "coherence_vs_ca": "Cohérent | Élevé vs CA | Faible vs ambition | Non évaluable",
    "type_adapte": "Subvention | Prêt | Mixte | Equity",
    "capacite_absorption": "Bonne | Moyenne | Faible | Non évaluable",
    "commentaire": "string — 1-2 phrases"
  },

  "risques_programme": [
    {
      "risque": "string",
      "type": "financier | opérationnel | réputationnel | exécution | concentration",
      "probabilite": "faible | moyenne | élevée",
      "impact_programme": "string — conséquence pour le bailleur",
      "mitigation": "string"
    }
  ],

  "traction": {
    "anciennete": "string — ex: '4 ans d'activité'",
    "evolution_ca": "string — ex: 'CA en hausse de 15% déclaré'",
    "preuves_tangibles": ["string — contrats, clients, partenariats, certifications mentionnés"],
    "niveau_preuve": "Solide | Partiel | Déclaratif uniquement"
  },

  "benchmark_declaratif": {
    "position_vs_secteur": "Au-dessus | Dans la norme | En-dessous | Non évaluable",
    "commentaire": "string — 1-2 phrases comparant aux PME du même secteur/pays"
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
    "conditions_prealables": ["string — ce qui DOIT être vérifié/fait AVANT tout financement"],
    "potentiel_6_mois": "string",
    "profil_coach_ideal": "string"
  },

  "resume_comite": "string — 4-5 phrases pour décider en 30 secondes. Commence par le verdict, puis les chiffres clés, puis le risque principal."
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

DOCUMENTS JOINTS : ${(() => {
  const docs = Array.isArray(candidature.documents)
    ? candidature.documents
    : Object.entries(candidature.documents || {}).map(([k, v]: any) => ({
        field_label: k, file_name: v?.filename || v?.file_name || k, file_size: v?.file_size || 0,
      }));
  if (docs.length === 0) return '0 fichier(s)\n⚠️ AUCUN DOCUMENT FOURNI — signaler comme point de vigilance';
  return `${docs.length} fichier(s)\n${docs.map((d: any) => `- ${d.field_label || 'Document'}: ${d.file_name} (${Math.round((d.file_size || 0)/1024)} KB)`).join('\n')}`;
})()}

Produis le diagnostic complet pour le comité de sélection.`;
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
      max_tokens: 8192,
      system: SCREENING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(programme, criteria, candidature) }],
    }),
    signal: AbortSignal.timeout(60_000),
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
