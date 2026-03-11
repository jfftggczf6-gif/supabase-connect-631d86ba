import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, errorResponse, jsonResponse,
  verifyAndGetContext, callAI, saveDeliverable, buildRAGContext
} from "../_shared/helpers.ts";
import { normalizeOdd } from "../_shared/normalizers.ts";
import { fillOddExcelTemplate } from "../_shared/odd-excel-template.ts";

const SYSTEM_PROMPT = `Tu es un expert en Objectifs de Développement Durable (ODD) pour PME en Afrique de l'Ouest (UEMOA).
Tu évalues l'alignement des projets avec les 17 ODD de l'ONU à partir du Business Model Canvas (BMC) et du Social Impact Canvas (SIC).
RÈGLE ABSOLUE : L'évaluation se base UNIQUEMENT sur BMC + SIC. PAS sur les données financières.
IMPORTANT: Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.`;

// These are the EXACT 41 target IDs present in the ODD_template.xlsx
// They MUST match exactly for the Excel filling to work
const TEMPLATE_TARGETS = [
  "1.1", "1.4",
  "2.1", "2.4", "2.a",
  "3.3", "3.9",
  "4.1",
  "5.1",
  "6.3", "6.4", "6.a",
  "7.1", "7.2a", "7.2b", "7.3",
  "8.2", "8.3", "8.5", "8.6", "8.8", "8.9",
  "9.3", "9.4", "9.b", "9.c",
  "10.2",
  "11.6", "11.c",
  "12.2", "12.5",
  "13.3",
  "14.1",
  "15.2", "15.3",
  "16.5", "16.7",
  "17.1", "17.3", "17.16", "17.17"
];

function buildUserPrompt(
  name: string,
  sector: string,
  country: string,
  bmcData: unknown,
  sicData: unknown
): string {
  const bmcStr = JSON.stringify(bmcData || {}).slice(0, 3000);
  const sicStr = JSON.stringify(sicData || {}).slice(0, 3000);

  return `Évalue l'alignement du projet "${name}" (Secteur: ${sector}, Pays: ${country}) avec les ODD de l'ONU.

DONNÉES BMC (Business Model Canvas) :
${bmcStr}

DONNÉES SIC (Social Impact Canvas) :
${sicStr}

Génère l'analyse ODD COMPLÈTE en JSON. Les ${TEMPLATE_TARGETS.length} cibles ODD à évaluer sont EXACTEMENT :
ODD1: 1.1, 1.4
ODD2: 2.1, 2.4, 2.a
ODD3: 3.3, 3.9
ODD4: 4.1
ODD5: 5.1
ODD6: 6.3, 6.4, 6.a
ODD7: 7.1, 7.2a (point de vue fournisseur d'énergie), 7.2b (point de vue utilisateur d'énergie), 7.3
ODD8: 8.2, 8.3, 8.5, 8.6, 8.8, 8.9
ODD9: 9.3, 9.4, 9.b, 9.c
ODD10: 10.2
ODD11: 11.6, 11.c
ODD12: 12.2, 12.5
ODD13: 13.3
ODD14: 14.1
ODD15: 15.2, 15.3
ODD16: 16.5, 16.7
ODD17: 17.1, 17.3, 17.16, 17.17

IMPORTANT: Utilise EXACTEMENT les identifiants ci-dessus comme target_id (ex: "2.a", "7.2a", "7.2b", "9.b", "9.c", "11.c").

JSON à produire :
{
  "metadata": {
    "nom_entreprise": "${name}",
    "pays": "${country}",
    "secteur": "${sector}",
    "date_generation": "${new Date().toISOString().split('T')[0]}",
    "version": 2,
    "livrables_utilises": ["bmc", "sic"],
    "total_cibles_evaluees": ${TEMPLATE_TARGETS.length},
    "target_matrix_version": "v2_template_aligned"
  },
  "informations_projet": {
    "nom_entreprise": "${name}",
    "secteur": "${sector}",
    "pays": "${country}",
    "description_projet": "<résumé du projet en 2 phrases>"
  },
  "evaluation_cibles_odd": {
    "cibles": [
      {
        "target_id": "1.1",
        "target_description": "D'ici à 2030, éliminer complètement l'extrême pauvreté dans le monde",
        "evaluation": "positif",
        "justification": "<justification basée sur BMC/SIC>",
        "info_additionnelle": "<info complémentaire optionnelle>",
        "odd_parent": "1"
      }
    ],
    "resume_par_odd": {
      "odd_1": {
        "nom": "Éliminer la pauvreté",
        "cibles_positives": 2,
        "cibles_neutres": 0,
        "cibles_negatives": 0,
        "score": 100
      }
    }
  },
  "indicateurs_impact": {
    "indicateurs": [
      {
        "target_id": "1.1",
        "indicateur_officiel_onu": "Proportion de la population vivant sous le seuil de pauvreté",
        "indicateur_ovo": "<indicateur mesurable pour cette PME>",
        "valeur": "<valeur estimée ou N/A>",
        "source": "bmc_analysis"
      }
    ]
  },
  "circularite": {
    "evaluation": "<évaluation des pratiques d'économie circulaire>",
    "pratiques": ["<pratique 1>", "<pratique 2>"],
    "cibles_odd_liees": ["7.2a", "12.2", "12.5"]
  },
  "synthese": {
    "odd_prioritaires": ["1", "8", "12"],
    "contribution_globale": "<résumé de la contribution globale aux ODD>",
    "recommandations": ["<recommandation 1>", "<recommandation 2>", "<recommandation 3>"]
  }
}

RÈGLES :
1. Évalue CHACUNE des ${TEMPLATE_TARGETS.length} cibles listées ci-dessus avec les target_id EXACTEMENT comme indiqué
2. evaluation = "positif" | "neutre" | "negatif"
3. Justifie chaque évaluation à partir du BMC/SIC
4. Score par ODD = (cibles_positives / total_cibles_ODD) × 100, arrondi
5. odd_prioritaires = ODD avec score >= 50%`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    const bmcData = ctx.deliverableMap["bmc_analysis"] || ctx.deliverableMap["bmc"] || null;
    const sicData = ctx.deliverableMap["sic_analysis"] || ctx.deliverableMap["sic"] || null;

    if (!bmcData && !sicData) {
      return errorResponse(
        "Le Business Model Canvas (BMC) ou le Social Impact Canvas (SIC) est requis pour générer l'évaluation ODD.",
        400
      );
    }

    // RAG: enrichir avec données ODD
    const ragContext = await buildRAGContext(ctx.supabase, ent.country || "", ent.sector || "", ["odd", "bailleurs"]);

    const userPrompt = buildUserPrompt(
      ent.name,
      ent.sector || "PME",
      ent.country || "Côte d'Ivoire",
      bmcData,
      sicData
    ) + ragContext;

    console.log("[generate-odd] Calling Claude API via callAI (max_tokens: 16384)...");
    const rawData = await callAI(SYSTEM_PROMPT, userPrompt, 16384);
    const data = normalizeOdd(rawData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "odd_analysis", data, "odd");
    console.log(`[generate-odd] ✅ odd_analysis sauvegardé (${(data as any).metadata?.total_cibles_evaluees} cibles)`);

    // Generate Excel (non-blocking) — upload to storage instead of base64
    let excelGenerated = false;
    try {
      const xlsxBytes = await fillOddExcelTemplate(data, ent.name, ctx.supabase);
      const fileName = `odd_${ctx.enterprise_id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.xlsx`;

      const { error: uploadErr } = await ctx.supabase.storage
        .from("ovo-outputs")
        .upload(fileName, xlsxBytes, {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          cacheControl: "no-store",
          upsert: true,
        });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = ctx.supabase.storage.from("ovo-outputs").getPublicUrl(fileName);
      const fileUrl = urlData?.publicUrl
        ? urlData.publicUrl
        : `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/authenticated/ovo-outputs/${fileName}`;

      await ctx.supabase.from("deliverables").upsert({
        enterprise_id: ctx.enterprise_id,
        type: "odd_excel",
        data: {
          generated_at: new Date().toISOString(),
          template: "ODD_template.xlsx",
          size_bytes: xlsxBytes.byteLength,
          file_name: fileName,
        },
        file_url: fileUrl,
        ai_generated: true,
        version: 2,
      }, { onConflict: "enterprise_id,type" });

      excelGenerated = true;
      console.log(`[generate-odd] ✅ Excel uploadé: ${fileName} (${xlsxBytes.byteLength} bytes)`);
    } catch (xlsxErr: unknown) {
      console.warn("[generate-odd] Excel non-bloquant:", (xlsxErr as Error)?.message);
    }

    return jsonResponse({ success: true, data, excel_generated: excelGenerated });

  } catch (e: unknown) {
    console.error("generate-odd error:", e);
    const err = e as { message?: string; status?: number };
    return errorResponse(err.message || "Erreur inconnue", err.status || 500);
  }
});
