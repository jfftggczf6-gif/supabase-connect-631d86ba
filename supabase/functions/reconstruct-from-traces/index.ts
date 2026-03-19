import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
} from "../_shared/helpers.ts";
import { normalizeReconstruction } from "../_shared/normalizers.ts";
import { validateAndEnrich } from "../_shared/post-validator.ts";
import { getSectorKnowledgePrompt, getExtractionKnowledgePrompt } from "../_shared/financial-knowledge.ts";

const SYSTEM_PROMPT = `Tu es un expert-comptable et analyste financier senior spécialisé dans la reconstitution de données financières de PME africaines (normes SYSCOHADA 2017).

TON RÔLE : À partir de fragments documentaires hétérogènes (relevés bancaires, factures, photos de reçus, tableurs partiels, notes manuscrites, extraits comptables), tu dois RECONSTITUER un jeu de données financières cohérent et exploitable.

MÉTHODOLOGIE DE RECONSTRUCTION :
1. Identifier chaque fragment documentaire et son type (relevé, facture, bilan partiel, etc.)
2. Extraire toutes les données chiffrées disponibles
3. Recouper les données entre sources pour valider la cohérence
4. Quand une donnée manque, formuler une hypothèse raisonnable basée sur :
   - Les benchmarks sectoriels fournis
   - Les ratios SYSCOHADA standards
   - Les autres données disponibles dans le dossier
5. Documenter CHAQUE hypothèse et son fondement

RÈGLES ABSOLUES :
- Toutes les valeurs monétaires en FCFA (pas d'abréviation : 50000000 et non 50M)
- Exercice fiscal : janvier-décembre (ajuster si les documents montrent un autre cycle)
- Distinguer clairement "donnée extraite" vs "hypothèse estimée"
- Score de confiance global basé sur le ratio données réelles / hypothèses
- Si un document est illisible ou vide, l'indiquer clairement

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const OUTPUT_SCHEMA = `{
  "score_confiance": <0-100, basé sur ratio données réelles vs hypothèses>,
  "score": <0-100, qualité globale des données reconstituées>,

  "compte_resultat": {
    "chiffre_affaires": <number>,
    "achats_matieres": <number>,
    "charges_personnel": <number>,
    "charges_externes": <number>,
    "dotations_amortissements": <number>,
    "impots_taxes": <number>,
    "resultat_exploitation": <number>,
    "charges_financieres": <number>,
    "resultat_net": <number>,
    "source": "reconstruction"
  },

  "bilan": {
    "immobilisations": <number>,
    "stocks": <number>,
    "creances_clients": <number>,
    "tresorerie_actif": <number>,
    "total_actif": <number>,
    "capitaux_propres": <number>,
    "dettes_financieres": <number>,
    "dettes_fournisseurs": <number>,
    "total_passif": <number>
  },

  "effectifs": {
    "total": <number>,
    "cadres": <number>,
    "employes": <number>,
    "temporaires": <number>
  },

  "kpis": {
    "marge_brute_pct": <number>,
    "marge_nette_pct": <number>,
    "ratio_endettement_pct": <number>,
    "bfr_jours": <number>,
    "ca_par_employe": <number>
  },

  "reconstruction_report": {
    "source_documents": ["string — liste des documents identifiés et utilisés"],
    "hypotheses": ["string — chaque hypothèse formulée avec justification"],
    "donnees_manquantes": ["string — données impossibles à reconstituer"],
    "note_analyste": "string — résumé en 3-4 phrases de la qualité du dossier"
  },

  "_confidence": {
    "chiffre_affaires": { "level": <0-100>, "source": "string — d'où vient cette valeur" },
    "achats_matieres": { "level": <0-100>, "source": "string" },
    "charges_personnel": { "level": <0-100>, "source": "string" },
    "charges_externes": { "level": <0-100>, "source": "string" },
    "tresorerie": { "level": <0-100>, "source": "string" },
    "capitaux_propres": { "level": <0-100>, "source": "string" },
    "resultat_net": { "level": <0-100>, "source": "string" },
    "effectif_total": { "level": <0-100>, "source": "string" }
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    if (!ctx.documentContent || ctx.documentContent.trim().length < 50) {
      throw { status: 400, message: "Aucun contenu documentaire. Veuillez d'abord uploader et analyser des documents." };
    }

    // Cap document content to 80K chars to avoid Deno memory limits
    const MAX_PROMPT_CHARS = 80_000;
    const docContent = ctx.documentContent.length > MAX_PROMPT_CHARS
      ? ctx.documentContent.substring(0, MAX_PROMPT_CHARS) + "\n[... contenu tronqué à 80K caractères]"
      : ctx.documentContent;

    console.log("[reconstruct] Docs cache length:", ctx.documentContent.length, "→ prompt length:", docContent.length);

    // Build RAG context for sector benchmarks (protected)
    let ragContext = "";
    try {
      ragContext = await buildRAGContext(
        ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"], "inputs_data"
      );
    } catch (e) {
      console.warn("[reconstruct] RAG context failed, continuing without:", e);
    }

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Côte d'Ivoire"}
EFFECTIFS DÉCLARÉS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}
DESCRIPTION : ${ent.description || "Non spécifié"}

══════ DOCUMENTS DISPONIBLES ══════
${docContent}

══════ INVARIANTS COMPTABLES & BENCHMARKS ══════
${getExtractionKnowledgePrompt()}

${getSectorKnowledgePrompt(ent.sector || "services_b2b")}

${ragContext}

══════ INSTRUCTIONS ══════
Analyse TOUS les documents ci-dessus. Reconstitue un compte de résultat, un bilan et les KPIs.
Pour chaque valeur, indique dans reconstruction_report.hypotheses si c'est une donnée extraite ou une estimation.
Le score_confiance reflète le % de données réellement extraites vs estimées.

CONFIDENCE PAR CHAMP :
Pour CHAQUE valeur financière, évalue ta confiance (0-100) dans le champ _confidence :
- 80-100 : donnée directement extraite d'un document fiable (bilan certifié, relevé bancaire officiel)
- 60-79 : donnée extraite d'un document non certifié (facture, tableau Excel, photo)
- 40-59 : donnée estimée à partir de données partielles + benchmarks sectoriels
- 20-39 : donnée largement estimée, peu de base documentaire
- 0-19 : hypothèse pure, aucune base documentaire
Indique la source de chaque valeur (nom du document ou "estimation benchmark").

Réponds en JSON selon ce schéma :
${OUTPUT_SCHEMA}`;

    const rawData = await callAI(SYSTEM_PROMPT, prompt, 8192);
    const normalizedData = normalizeReconstruction(rawData);

    if (normalizedData.compte_resultat && !normalizedData.compte_resultat.source) {
      normalizedData.compte_resultat.source = "reconstruction";
    }

    const validatedData = validateAndEnrich(normalizedData, ent.country, ent.sector);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "inputs_data", validatedData, "inputs");

    return new Response(JSON.stringify({ success: true, data: normalizedData, score: normalizedData.score || normalizedData.score_confiance || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("reconstruct-from-traces error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erreur" }), {
      status: e.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
