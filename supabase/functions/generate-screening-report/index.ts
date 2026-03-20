// v3 — force redeploy 2026-03-19
// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse, getDocumentContentForAgent,
} from "../_shared/helpers_v5.ts";
import { normalizeScreeningReport } from "../_shared/normalizers.ts";
import { validateAndEnrich } from "../_shared/post-validator.ts";
import { getSectorKnowledgePrompt, getDonorCriteriaPrompt, getValidationRulesPrompt } from "../_shared/financial-knowledge.ts";

const SYSTEM_PROMPT = `Tu es un analyste financier senior spécialisé dans le screening de PME africaines pour des programmes de financement (DFI, fonds d'impact, incubateurs, banques).

TON RÔLE :
1. Détecter les INCOHÉRENCES FINANCIÈRES dans les documents et données fournis
2. Évaluer la QUALITÉ DOCUMENTAIRE du dossier
3. Produire un VERDICT de screening rapide pour un bailleur
4. Comparer le dossier aux CRITÈRES DU PROGRAMME si fournis
5. Évaluer le PROFIL DE RISQUE complet de l'entreprise
6. Proposer un PLAN D'ACTION PRIORITAIRE avec actions concrètes
7. Recommander un PATHWAY DE FINANCEMENT adapté

TYPES D'INCOHÉRENCES À DÉTECTER :
- Bilan déséquilibré (Total Actif ≠ Total Passif, écart > 2%)
- CA déclaré vs relevés bancaires (écart > 20% = red flag)
- Charges personnel à 0 avec effectif > 0 déclaré
- Marges irréalistes pour le secteur (marge brute > 80% en commerce par ex.)
- Résultat net positif mais trésorerie négative sans explication
- Créances clients > 50% du CA (risque d'impayés)
- Ratio d'endettement > 80% sans plan de remboursement
- Incohérence entre dates des documents et exercice déclaré
- CA en croissance mais effectif en baisse (contradictoire)
- Chiffres ronds suspects (tout en millions exacts = probable estimation)
- Documents datés de périodes différentes présentés comme un même exercice

CROSS-VALIDATION ENTRE DOCUMENTS :
- Comparer le CA du bilan/CdR avec la somme des factures uploadées
- Comparer les charges personnel avec les bulletins de paie si présents
- Comparer la trésorerie du bilan avec le solde du dernier relevé bancaire
- Vérifier que le RCCM correspond au nom de l'entreprise et au pays

CLASSIFICATION DES ANOMALIES :
- 🔴 BLOQUANT : incohérence qui invalide le dossier (fraude possible, données contradictoires majeures)
- 🟡 ATTENTION : anomalie à vérifier mais pas bloquante (estimation probable, données partielles)
- 🟢 NOTE : observation mineure, information contextuelle

PROFIL DE RISQUE À ÉVALUER :
- Risque opérationnel : dépendance à un fournisseur, un client, une personne clé, une infrastructure
- Risque financier : tension de trésorerie, surendettement, absence de fonds de roulement, BFR excessif
- Risque de marché : concentration sectorielle, concurrence, barrières à l'entrée, saisonnalité non provisionnée
- Risque juridique : conformité RCCM, statuts, licences sectorielles, contrats de travail
- Risque de gouvernance : absence de PV d'AG, confusion patrimoine personnel/professionnel, pas de comptabilité séparée
- Risque pays : instabilité politique, inflation, risque de change, problèmes sécuritaires régionaux

RECOMMANDATIONS PRIORITAIRES :
- Classer par priorité (1 = urgent/bloquant, 5 = amélioration)
- Chaque recommandation doit être ACTIONNABLE (pas "améliorer la gouvernance" mais "rédiger un PV d'AG annuel et le faire signer par tous les associés")
- Estimer l'impact sur le score si l'action est réalisée
- Indiquer si c'est l'entrepreneur ou le coach qui doit agir

PATHWAY DE FINANCEMENT :
- Recommander le type de financement adapté au stade actuel de l'entreprise
- Lister les bailleurs potentiels concrets (pas des catégories génériques)
- Estimer le montant éligible en fourchette
- Lister les conditions préalables (ex: "obtenir un bilan certifié N-1")
- Donner une timeline réaliste pour atteindre le niveau requis

RÉSUMÉ EXÉCUTIF :
- Le résumé doit être écrit comme si un analyste présentait le dossier à son directeur
- Inclure les chiffres clés (CA, marge, score)
- Identifier clairement les 3-5 forces ET les 3-5 faiblesses
- Le decision_rationale explique la logique du verdict

BENCHMARK :
- Pour CHAQUE ratio financier, comparer avec le benchmark du secteur
- Indiquer si la valeur est conforme, optimiste (au-dessus du benchmark), en alerte (en dessous), ou critique (très en dessous)
- Si pas de données pour un ratio, indiquer "Non évaluable" plutôt que 0

DÉTAIL DES CROSS-VALIDATIONS :
- Pour chaque vérification (CA, bilan, charges, trésorerie, dates), rédiger 1-2 phrases expliquant le calcul et la conclusion
- Citer les documents sources utilisés pour la comparaison

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const SCREENING_SCHEMA = `{
  "screening_score": <0-100>,
  "verdict": "ELIGIBLE | CONDITIONNEL | NON_ELIGIBLE | INSUFFISANT",
  "verdict_summary": "string — 3-5 phrases résumant le verdict de manière détaillée et argumentée",

  "resume_executif": {
    "synthese": "string — paragraphe de 5-8 lignes résumant l'ensemble du dossier comme un analyste le ferait pour son supérieur",
    "points_forts": ["string — 3-5 forces principales identifiées"],
    "points_faibles": ["string — 3-5 faiblesses principales identifiées"],
    "decision_rationale": "string — 2-3 phrases expliquant pourquoi ce verdict et pas un autre"
  },

  "anomalies": [
    {
      "severity": "bloquant | attention | note",
      "category": "finance | documents | coherence | completude | gouvernance | legal",
      "title": "string — titre court",
      "detail": "string — explication détaillée avec chiffres précis",
      "impact": "string — conséquence concrète de cette anomalie pour un investisseur",
      "source_documents": ["string"],
      "recommendation": "string — action corrective précise",
      "effort": "facile | moyen | difficile"
    }
  ],

  "cross_validation": {
    "ca_coherent": true|false,
    "ca_declared": <number ou null>,
    "ca_from_documents": <number ou null>,
    "ca_ecart_pct": <number ou null>,
    "ca_detail": "string — explication du calcul et de la comparaison",
    "bilan_equilibre": true|false,
    "bilan_ecart": <number ou null>,
    "bilan_detail": "string",
    "charges_personnel_coherent": true|false,
    "charges_personnel_detail": "string — masse salariale vs effectifs vs SMIG",
    "tresorerie_coherent": true|false,
    "tresorerie_detail": "string — comparaison bilan vs relevés bancaires",
    "dates_coherentes": true|false,
    "dates_detail": "string — cohérence des exercices entre documents",
    "notes": ["string"]
  },

  "document_quality": {
    "total_documents": <number>,
    "documents_exploitables": <number>,
    "documents_illisibles": <number>,
    "couverture": {
      "legal": { "present": true|false, "documents": ["string — docs trouvés"], "manquants": ["string — docs attendus mais absents"] },
      "finance": { "present": true|false, "documents": ["string"], "manquants": ["string"] },
      "commercial": { "present": true|false, "documents": ["string"], "manquants": ["string"] },
      "rh": { "present": true|false, "documents": ["string"], "manquants": ["string"] },
      "esg": { "present": true|false, "documents": ["string"], "manquants": ["string"] }
    },
    "documents_manquants_critiques": ["string"],
    "anciennete_documents": "string",
    "niveau_preuve_global": "N0 Declaratif | N1 Faible | N2 Intermediaire | N3 Solide",
    "note_qualite": "string — 2-3 phrases évaluant la qualité documentaire globale"
  },

  "financial_health": {
    "compte_resultat_resume": {
      "chiffre_affaires": <number ou null>,
      "marge_brute": <number ou null>,
      "ebitda": <number ou null>,
      "resultat_net": <number ou null>,
      "source": "string — d'où viennent ces chiffres (documents, reconstruction, déclaration)"
    },
    "marge_brute_pct": <number ou null>,
    "marge_nette_pct": <number ou null>,
    "ratio_endettement_pct": <number ou null>,
    "ratio_liquidite": <number ou null>,
    "bfr_jours": <number ou null>,
    "dscr": <number ou null>,
    "tresorerie_nette": <number ou null>,
    "benchmark_comparison": [
      {
        "indicateur": "string — ex: Marge brute",
        "valeur_entreprise": "string — ex: 45%",
        "benchmark_secteur": "string — ex: 30-50% (Agriculture)",
        "verdict": "conforme | optimiste | alerte | critique"
      }
    ],
    "health_label": "Saine | Fragile | Critique | Non evaluable",
    "health_detail": "string — paragraphe détaillant la santé financière avec chiffres"
  },

  "profil_risque": {
    "score_risque": <0-100 — 0=très risqué, 100=très sûr>,
    "risques_identifies": [
      {
        "type": "operationnel | financier | marche | legal | gouvernance | pays",
        "description": "string",
        "probabilite": "faible | moyenne | elevee",
        "impact": "faible | moyen | fort",
        "mitigation": "string — mesure d'atténuation suggérée"
      }
    ],
    "concentration_client": "string — % CA du top client si connu, sinon 'Non évalué'",
    "dependance_fournisseur": "string — risque de dépendance identifié ou 'Non évalué'",
    "risque_pays": "string — contexte politique/économique/sécuritaire du pays"
  },

  "recommandations_prioritaires": [
    {
      "priorite": 1|2|3|4|5,
      "action": "string — action concrète et précise",
      "responsable": "entrepreneur | coach | les deux",
      "delai": "string — ex: 2 semaines, 1 mois, 3 mois",
      "impact_score": "string — ex: +10 à +15 points sur le score si réalisé"
    }
  ],

  "pathway_financement": {
    "type_recommande": "string — type de financement recommandé",
    "bailleurs_potentiels": ["string — noms de bailleurs avec ticket range"],
    "montant_eligible_estime": "string — fourchette en FCFA ou EUR",
    "conditions_prealables": ["string — ce qui doit être résolu avant de postuler"],
    "timeline_estimee": "string — ex: 3-6 mois pour atteindre le niveau requis"
  },

  "programme_match": null | {
    "programme_name": "string",
    "match_score": <0-100>,
    "criteres_ok": [{ "critere": "string", "detail": "string — comment c'est satisfait" }],
    "criteres_ko": [{ "critere": "string", "detail": "string — pourquoi pas satisfait", "comment_corriger": "string" }],
    "criteres_partiels": [{ "critere": "string", "detail": "string", "manque": "string — ce qu'il reste à faire" }],
    "recommandation": "string — verdict détaillé"
  }
}`;

serve(async (req) => {
  console.log("[generate-screening-report] v3 loaded");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Clone BEFORE verifyAndGetContext consumes req.json()
    let programmeCriteria: any = null;
    try {
      const bodyClone = await req.clone().json().catch(() => ({}));
      programmeCriteria = bodyClone.programme_criteria || null;
    } catch (_) { /* ignore */ }

    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    // Gather existing deliverables for cross-validation
    const { data: existingDeliverables } = await ctx.supabase
      .from("deliverables")
      .select("type, data, score")
      .eq("enterprise_id", ctx.enterprise_id);

    const getDelivData = (type: string) => {
      const d = existingDeliverables?.find((del: any) => del.type === type);
      return d?.data && typeof d.data === "object" ? d.data : null;
    };

    const inputsData = getDelivData("inputs_data");
    const bmcData = getDelivData("bmc_analysis");
    const sicData = getDelivData("sic_analysis");
    const frameworkData = getDelivData("framework_data");
    const planOvoData = getDelivData("plan_ovo");
    const diagnosticData = getDelivData("diagnostic_data");

    const ragContext = await buildRAGContext(
      ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"], "screening_report"
    );

    // Build deliverables summary for context
    const delivSummary = [];
    if (inputsData) delivSummary.push(`DONNÉES FINANCIÈRES (inputs_data):\n${JSON.stringify(inputsData).substring(0, 5000)}`);
    if (bmcData) delivSummary.push(`BMC:\n${JSON.stringify(bmcData).substring(0, 2000)}`);
    if (sicData) delivSummary.push(`SIC:\n${JSON.stringify(sicData).substring(0, 2000)}`);
    if (frameworkData) delivSummary.push(`FRAMEWORK FINANCIER:\n${JSON.stringify(frameworkData).substring(0, 3000)}`);
    if (planOvoData) delivSummary.push(`PLAN OVO:\n${JSON.stringify(planOvoData).substring(0, 3000)}`);
    if (diagnosticData) delivSummary.push(`DIAGNOSTIC:\n${JSON.stringify(diagnosticData).substring(0, 2000)}`);

    const programmeSection = programmeCriteria
      ? `\n══════ CRITÈRES DU PROGRAMME ══════\n${JSON.stringify(programmeCriteria, null, 2)}\nCompare le dossier à ces critères et remplis la section programme_match.`
      : `\nAucun critère programme fourni — laisse programme_match à null.`;

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Côte d'Ivoire"}
EFFECTIFS DÉCLARÉS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}
DATE CRÉATION : ${ent.creation_date || "Non spécifié"}
DESCRIPTION : ${ent.description || "Non spécifié"}

══════ DOCUMENTS UPLOADÉS ══════
${getDocumentContentForAgent(ent, "screening", 80_000) || "(Aucun document uploadé)"}

══════ LIVRABLES EXISTANTS ══════
${delivSummary.length > 0 ? delivSummary.join("\n\n") : "(Aucun livrable généré)"}

══════ BENCHMARKS SECTORIELS ══════
${getSectorKnowledgePrompt(ent.sector || "services_b2b")}

══════ CRITÈRES BAILLEURS DE RÉFÉRENCE ══════
${getDonorCriteriaPrompt()}

══════ RÈGLES DE VALIDATION CROISÉE ══════
${getValidationRulesPrompt()}

${ragContext}
${programmeSection}

══════ INSTRUCTIONS ══════
Analyse TOUT le dossier ci-dessus. Détecte les incohérences, évalue la qualité documentaire, produis un verdict de screening.
Cross-valide les données entre les différentes sources (documents vs livrables vs déclarations).
Le screening_score reflète la fiabilité globale du dossier pour un bailleur.
Évalue le profil de risque complet. Propose des recommandations prioritaires actionnables.
Recommande un pathway de financement adapté au stade de l'entreprise.
Rédige un résumé exécutif détaillé comme un analyste le ferait pour son directeur.

Réponds en JSON selon ce schéma :
${SCREENING_SCHEMA}`;

    const rawData = await callAI(SYSTEM_PROMPT, prompt, 16384);
    const normalizedData = normalizeScreeningReport(rawData);
    const validatedData = validateAndEnrich(normalizedData, ent.country, ent.sector);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "screening_report", validatedData, "diagnostic");

    // Update enterprise score_ir
    if (normalizedData.screening_score) {
      await ctx.supabase.from("enterprises").update({
        score_ir: normalizedData.screening_score,
        last_activity: new Date().toISOString(),
      }).eq("id", ctx.enterprise_id);
    }

    return jsonResponse({ success: true, data: normalizedData, score: normalizedData.screening_score || 0 });
  } catch (e: any) {
    console.error("generate-screening-report error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
