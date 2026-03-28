// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext, getDocumentContentForAgent, getKnowledgeForAgent, getCoachingContext } from "../_shared/helpers_v5.ts";
import { normalizeSic } from "../_shared/normalizers.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";

const SYSTEM_PROMPT = `Tu es un expert en Impact Investing et évaluation ESG spécialisé dans les PME en Afrique de l'Ouest (UEMOA).

MISSION : Analyser le Social Impact Canvas et produire un JSON scoré.

STYLE : ÉQUILIBRÉ — informatif mais lisible, pas de pavés de texte.
- Chaque champ texte = 3-5 phrases avec explications claires
- Listes = 4-6 éléments, chacun en 1 phrase explicative
- Scores chiffrés avec justification en 1-2 phrases
- Cite la source entre parenthèses quand pertinent

══════════════════════════════════════
SCORING — 5 DIMENSIONS
══════════════════════════════════════

Évalue chaque dimension de 0 à 100. Le score global = moyenne pondérée.

DIMENSION 1 — PROBLÈME & VISION (poids : 25%)
  Agrège : Problème sociétal + Outcomes
  Tu évalues :
    - Le problème est-il clairement défini ? (1 seul, pas 3)
    - Est-il documenté avec des données ? (chiffres, sources)
    - Est-il ancré localement ? (zones géographiques précises)
    - Les outcomes sont-ils progressifs et crédibles ? (court/moyen/long terme)
    - La phrase de transformation est-elle percutante ?
  Barème :
    80-100 = Problème clair, documenté, outcomes crédibles
    50-79  = Problème identifié mais données imprécises ou outcomes vagues
    30-49  = Problème vague, pas de données, outcomes non définis
    0-29   = Pas de problème social identifiable

DIMENSION 2 — BÉNÉFICIAIRES (poids : 20%)
  Agrège : Bénéficiaires + Solution
  Tu évalues :
    - Les bénéficiaires directs sont-ils QUANTIFIÉS ?
    - Les bénéficiaires indirects sont-ils identifiés ?
    - Les vulnérabilités sont-elles décrites concrètement ?
    - La solution atteint-elle bien les bénéficiaires visés ?
    - Le nombre est-il RÉALISTE ?
  Barème :
    80-100 = Quantifiés + vulnérables + atteignables
    50-79  = Identifiés mais pas tous quantifiés
    30-49  = Vagues
    0-29   = Non identifiés

DIMENSION 3 — MESURE D'IMPACT (poids : 20%)
  ATTENTION CRITIQUE — distingue :
    OUTPUT = résultat direct (ex: "500 personnes formées")
    OUTCOME = changement pour bénéficiaires (ex: "70% ont un emploi")
    IMPACT = effet sociétal long terme (ex: "recul du chômage")
  Pour CHAQUE indicateur, indique si c'est un output, outcome ou impact.
  Barème :
    80-100 = ≥3 KPIs SMART d'impact/outcome + méthode documentée
    50-79  = KPIs présents mais confusion output/outcome
    30-49  = 1-2 indicateurs vagues
    0-29   = Aucun indicateur mesurable

DIMENSION 4 — ALIGNEMENT ODD (poids : 20%)
  IDENTIFIE les ODD même si l'entrepreneur ne les mentionne PAS.
  Table de déduction par secteur :
    Agriculture → ODD 1, 2, 8, 12, 15 | Énergie → ODD 7, 13 | Éducation → ODD 4, 8, 10
    Santé → ODD 3, 6 | Tech → ODD 4, 9, 10 | BTP → ODD 9, 11 | Recyclage → ODD 12, 13, 15
    Emploi femmes → ODD 5, 8, 10 | Eau → ODD 6, 14
  Pour chaque ODD : numéro, nom officiel, alignement (fort/moyen/faible), justification.
  Barème :
    80-100 = 3-5 ODD justifiés + impact = cœur du modèle
    50-79  = ODD listés + impact croissant
    30-49  = ODD vaguement mentionnés
    0-29   = Aucun alignement ODD

DIMENSION 5 — GESTION DES RISQUES (poids : 15%)
  Barème :
    80-100 = Risques identifiés + mitigation crédible + ressources dédiées
    50-79  = Risques listés mais mitigation incomplète
    30-49  = Risques partiellement identifiés
    0-29   = Aucune gestion des risques

══════════════════════════════════════
SCORE GLOBAL
══════════════════════════════════════
score_global = (probleme_vision × 0.25) + (beneficiaires × 0.20) + (mesure_impact × 0.20) + (alignement_odd × 0.20) + (gestion_risques × 0.15)

Paliers :
  0-30   → palier: "non_demontre",  label: "Impact Non Démontré"
  31-50  → palier: "a_structurer",  label: "Impact à Structurer"
  51-70  → palier: "en_construction", label: "Impact Social : En Construction"
  71-85  → palier: "solide",        label: "Impact Solide — Prêt pour Bailleurs"
  86-100 → palier: "exemplaire",    label: "Impact Exemplaire"

══════════════════════════════════════
THÉORIE DU CHANGEMENT
══════════════════════════════════════
Construis : PROBLÈME → ACTIVITÉS → OUTPUTS → OUTCOMES → IMPACT (1 phrase chacune).

══════════════════════════════════════
CROISEMENT BMC ↔ SIC (si BMC disponible)
══════════════════════════════════════
Vérifie cohérence : Segments/Bénéficiaires, Proposition de Valeur/Solution, Revenus/Impact, Partenaires/Parties Prenantes.

══════════════════════════════════════
RECOMMANDATIONS : TOP 3 avec titre, détail, impact estimé sur le score.
══════════════════════════════════════

COULEURS ODD :
ODD 1:#E5243B ODD 2:#DDA63A ODD 3:#4C9F38 ODD 4:#C5192D ODD 5:#FF3A21 ODD 6:#26BDE2 ODD 7:#FCC30B ODD 8:#A21942 ODD 9:#FD6925 ODD 10:#DD1367 ODD 11:#FD9D24 ODD 12:#BF8B2E ODD 13:#3F7E44 ODD 14:#0A97D9 ODD 15:#56C02B ODD 16:#00689D ODD 17:#19486A

RÉPONDS UNIQUEMENT EN JSON VALIDE avec cette structure EXACTE.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, bmcData: any) => `
Analyse l'entreprise "${name}" (Secteur: ${sector}, Pays: ${country}).

${bmcData?.canvas ? `DONNÉES BMC EXISTANTES:\n${JSON.stringify(bmcData, null, 2)}` : ""}
${docs ? `DOCUMENTS UPLOADÉS:\n${docs}` : ""}

Génère un Social Impact Canvas COMPLET en JSON avec EXACTEMENT cette structure :
{
  "score_global": <0-100>,
  "palier": "en_construction",
  "label": "Impact Social : En Construction",
  "dimensions": {
    "probleme_vision": { "score": 0, "label": "Problème & Vision", "commentaire": "..." },
    "beneficiaires": { "score": 0, "label": "Bénéficiaires", "commentaire": "..." },
    "mesure_impact": { "score": 0, "label": "Mesure d'Impact", "commentaire": "..." },
    "alignement_odd": { "score": 0, "label": "Alignement ODD", "commentaire": "..." },
    "gestion_risques": { "score": 0, "label": "Gestion des Risques", "commentaire": "..." }
  },
  "synthese_impact": "paragraphe de synthèse...",
  "chiffres_cles": {
    "beneficiaires_directs": { "nombre": 0, "horizon": "3 ans" },
    "beneficiaires_indirects": { "nombre": 0 },
    "impact_total_projete": { "nombre": 0 },
    "odd_adresses": { "nombre": 0 }
  },
  "canvas_blocs": {
    "probleme_social": { "titre": "PROBLÈME SOCIAL", "points": ["..."] },
    "transformation_visee": { "titre": "TRANSFORMATION VISÉE", "points": ["..."] },
    "beneficiaires": { "titre": "BÉNÉFICIAIRES", "points": ["..."] },
    "solution_activites": { "titre": "SOLUTION & ACTIVITÉS À IMPACT", "points": ["..."] },
    "indicateurs_mesure": {
      "titre": "INDICATEURS & MESURE",
      "indicateurs": [{ "nom": "...", "type": "output|outcome|impact" }],
      "cible_1_an": "...", "methode": "...", "frequence": "..."
    },
    "odd_cibles": {
      "titre": "ODD CIBLÉS",
      "odds": [{ "numero": 2, "nom": "Faim zéro", "couleur": "#DDA63A", "alignement": "fort", "justification": "..." }]
    }
  },
  "risques_attenuation": {
    "risques": [{ "risque": "...", "mitigation": "..." }]
  },
  "theorie_du_changement": {
    "probleme": "...", "activites": "...", "outputs": "...", "outcomes": "...", "impact": "..."
  },
  "changements": { "court_terme": "...", "moyen_terme": "...", "long_terme": "..." },
  "croisement_bmc": { "disponible": ${bmcData?.canvas ? 'true' : 'false'}, "coherences": [], "incoherences": [] },
  "recommandations": [
    { "priorite": 1, "titre": "...", "detail": "...", "impact_score": "+X points sur ..." }
  ],
  "alignement_modele": {
    "impact_position": "coeur_du_modele|effet_secondaire|activite_annexe",
    "correlation_croissance": "augmente|stagne|diminue",
    "conflit_rentabilite": "faible|moyen|fort",
    "commentaire": "..."
  },
  "swot": {
    "forces": ["force 1", "force 2"],
    "faiblesses": ["faiblesse 1"],
    "opportunites": ["opportunité 1"],
    "menaces": ["menace 1"]
  },
  "parties_prenantes": [
    { "nom": "Bénéficiaires", "role": "...", "implication": "Élevé|Moyen|Faible" }
  ],
  "odd_detail": [
    { "numero": 2, "nom": "Faim zéro", "couleur": "#DDA63A", "alignement": "fort", "contribution": "contribution concrète..." }
  ],
  "evolution_score": [
    { "critere": "Problème & Vision", "score_actuel": 80, "score_apres": 90, "action": "action clé..." }
  ],
  "niveau_maturite": "idee|test_pilote|deploye|mesure|scale"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const bmcData = ctx.deliverableMap["bmc_analysis"] || ctx.moduleMap["bmc"] || {};
    const requestId = crypto.randomUUID();

    // Mark as processing
    const { data: existingDeliv } = await ctx.supabase.from("deliverables")
      .select("data").eq("enterprise_id", ctx.enterprise_id).eq("type", "sic_analysis").maybeSingle();
    if (existingDeliv?.data && Object.keys(existingDeliv.data).length > 5) {
      await ctx.supabase.from("deliverables").update({
        data: { ...existingDeliv.data, _processing: true, _request_id: requestId },
      }).eq("enterprise_id", ctx.enterprise_id).eq("type", "sic_analysis");
    } else {
      await ctx.supabase.from("deliverables").upsert({
        enterprise_id: ctx.enterprise_id, type: "sic_analysis",
        data: { status: "processing", request_id: requestId, started_at: new Date().toISOString() },
      }, { onConflict: "enterprise_id,type" });
    }

    const asyncWork = async () => {
    try {

    // RAG: enrichir avec données ODD et impact social
    const ragContext = await buildRAGContext(ctx.supabase, ent.country || "", ent.sector || "", ["odd", "bailleurs", "secteurs"], "sic_analysis");
    const kbContext = await getKnowledgeForAgent(ctx.supabase, ent.country || "", ent.sector || "", "sic");

    const agentDocs = getDocumentContentForAgent(ent, "sic", 20_000);
    const coachingContext = await getCoachingContext(ctx.supabase, ctx.enterprise_id);

    // Inject inputs + pre-screening for richer impact analysis
    let impactContext = "";
    const inputsData = ctx.deliverableMap["inputs_data"];
    if (inputsData && typeof inputsData === "object") {
      if (inputsData.equipe?.length) {
        const totalEmployees = inputsData.equipe.reduce((s: number, e: any) => s + (e.nombre || 0), 0);
        impactContext += `\nEMPLOIS DIRECTS: ${totalEmployees} employés\n`;
        impactContext += inputsData.equipe.map((e: any) => `  - ${e.poste}: ${e.nombre} pers.`).join("\n") + "\n";
      }
      if (inputsData.compte_resultat?.chiffre_affaires) {
        impactContext += `CA: ${inputsData.compte_resultat.chiffre_affaires.toLocaleString("fr-FR")} FCFA\n`;
      }
      if (inputsData.produits_services?.length) {
        impactContext += `Activités: ${inputsData.produits_services.map((p: any) => p.nom).join(", ")}\n`;
      }
    }
    const preScreen = ctx.deliverableMap["pre_screening"];
    if (preScreen && typeof preScreen === "object") {
      if (preScreen.impact_social) impactContext += `\nImpact social (pré-screening): ${JSON.stringify(preScreen.impact_social).slice(0, 500)}\n`;
      if (preScreen.activites_identifiees?.length) impactContext += `Activités identifiées: ${preScreen.activites_identifiees.map((a: any) => typeof a === 'string' ? a : a.nom || a).join(", ")}\n`;
    }
    if (impactContext) impactContext = `\n══════ DONNÉES STRUCTURÉES (pour calibrer l'impact) ══════\n${impactContext}`;

    const rawAiData = await callAI(injectGuardrails(SYSTEM_PROMPT, ent.country), userPrompt(
      ent.name, ent.sector || "", ent.country || "", agentDocs, bmcData
    ) + ragContext + kbContext + coachingContext + impactContext, 16384, "claude-sonnet-4-20250514", 0.3);

    // Normalize AI response
    const sicData = normalizeSic(rawAiData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "sic_analysis", sicData, "sic");

    console.log(`[sic] ✅ DONE ${requestId}`);
    } catch (innerErr: any) {
      console.error("[sic] Background error:", innerErr);
      const { data: curr } = await ctx.supabase.from("deliverables")
        .select("data").eq("enterprise_id", ctx.enterprise_id).eq("type", "sic_analysis").maybeSingle();
      const safeData = (curr?.data && Object.keys(curr.data).length > 5)
        ? { ...curr.data, _error: innerErr.message?.slice(0, 500), _request_id: requestId }
        : { status: "error", error: innerErr.message?.slice(0, 500), request_id: requestId };
      await ctx.supabase.from("deliverables").update({ data: safeData })
        .eq("enterprise_id", ctx.enterprise_id).eq("type", "sic_analysis");
    }
    };
    // @ts-ignore
    EdgeRuntime.waitUntil(asyncWork());
    return new Response(JSON.stringify({ accepted: true, request_id: requestId }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-sic error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
