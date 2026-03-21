// v5 — coaching notes + coach comment/recommendation 2026-03-21
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers_v5.ts";
import { getSectorKnowledgePrompt, getDonorCriteriaPrompt } from "../_shared/financial-knowledge.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { enterprise_id, coach_comment, coach_recommendation } = await req.json();
    if (!enterprise_id) {
      return new Response(JSON.stringify({ error: "enterprise_id requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: ent } = await supabase
      .from("enterprises").select("*").eq("id", enterprise_id).single();

    if (!ent || ent.coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all data
    const [delivRes, modRes, profileRes, notesRes] = await Promise.all([
      supabase.from("deliverables").select("*").eq("enterprise_id", enterprise_id),
      supabase.from("enterprise_modules").select("*").eq("enterprise_id", enterprise_id),
      supabase.from("profiles").select("full_name, email").eq("user_id", user.id).single(),
      supabase.from("coaching_notes")
        .select("titre, resume_ia, infos_extraites, date_rdv, raw_content")
        .eq("enterprise_id", enterprise_id)
        .order("created_at", { ascending: false }),
    ]);

    const deliverables = delivRes.data || [];
    const modules = modRes.data || [];
    const coachProfile = profileRes.data;
    const coachingNotes = notesRes.data || [];

    const delivMap: Record<string, any> = {};
    deliverables.forEach((d: any) => { delivMap[d.type] = d.data; });

    const moduleStatuses = modules.map((m: any) => ({
      module: m.module, status: m.status, progress: m.progress,
    }));

    function summarize(data: any, maxLen = 3000): string {
      if (!data) return "Non disponible";
      const str = JSON.stringify(data, null, 0);
      return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
    }

    // Format coaching notes for prompt
    const notesBlock = coachingNotes.map((n: any) =>
      `${n.date_rdv ? `[RDV ${n.date_rdv}]` : '[Note]'} ${n.titre || ''}\n${n.resume_ia || n.raw_content?.substring(0, 300) || ''}`
    ).join('\n\n');

    const sectorBenchmarks = getSectorKnowledgePrompt(ent.sector || "services_b2b");
    const donorCriteria = getDonorCriteriaPrompt();

    const dataContext = `
=== INFORMATIONS ENTREPRISE ===
Nom: ${ent.name}
Secteur: ${ent.sector || "Non renseigné"}
Pays: ${ent.country || "Non renseigné"}
Ville: ${ent.city || "Non renseigné"}
Forme juridique: ${ent.legal_form || "Non renseigné"}
Description: ${ent.description || "Non renseigné"}
Date de création: ${ent.creation_date || "Non renseigné"}
Effectifs: ${ent.employees_count || "Non renseigné"}
Contact: ${ent.contact_name || ""} — ${ent.contact_email || ""} — ${ent.contact_phone || ""}
Score IR actuel: ${ent.score_ir || 0}/100
Phase: ${ent.phase || "identite"}

=== STATUT DES MODULES ===
${JSON.stringify(moduleStatuses, null, 2)}

=== BMC ===
${summarize(delivMap["bmc_analysis"], 2000)}

=== SIC ===
${summarize(delivMap["sic_analysis"], 2000)}

=== INPUTS ===
${summarize(delivMap["inputs_data"], 2000)}

=== FRAMEWORK ===
${summarize(delivMap["framework_data"], 2500)}

=== DIAGNOSTIC ===
${summarize(delivMap["diagnostic_data"], 2000)}

=== PLAN OVO ===
${summarize(delivMap["plan_ovo"], 2500)}

=== BUSINESS PLAN ===
${summarize(delivMap["business_plan"], 2500)}

=== ODD ===
${summarize(delivMap["odd_analysis"], 1500)}

=== BENCHMARKS SECTORIELS ===
${sectorBenchmarks}

=== CRITÈRES BAILLEURS ===
${donorCriteria}
`;

    const coachName = coachProfile?.full_name || coachProfile?.email || "Coach";
    const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const systemPrompt = `Tu rédiges un RAPPORT FINAL DE COACHING professionnel. Le rapport est destiné au chef de programme et aux bailleurs de fonds.

STRUCTURE EXACTE (respecter cet ordre) :

1. EN-TÊTE — Entreprise, coach, programme, période, nombre de sessions
2. COMMENTAIRE ET RECOMMANDATION DU COACH — Le texte fourni par le coach, tel quel, en premier (en citation visuelle)
3. RÉSUMÉ EXÉCUTIF — 1 paragraphe synthèse : l'entreprise, ce qu'on a fait, les résultats, la recommandation
4. L'ENTREPRISE À L'ENTRÉE — État au début de l'accompagnement (depuis le diagnostic initial)
5. LE TRAVAIL RÉALISÉ — Les sessions de coaching, documents collectés, actions menées (depuis les notes)
6. ÉTAT DU BUSINESS AUJOURD'HUI — 6 blocs :
   - Modèle économique (comment la boîte gagne de l'argent)
   - Santé financière (CA, marges, trésorerie, ratios vs benchmarks)
   - Projections (crédibilité, scénarios)
   - Impact social (emplois, ODD)
   - Gouvernance (structuration, équipe)
   - Risques principaux
7. RÉSULTATS MESURABLES — Tableau avant/après sur les indicateurs clés
8. ANNEXE — Scores des livrables

STYLE : Formel mais accessible. Chiffré. Narratif (paragraphes, pas de bullet points secs). Le commentaire du coach est en citation visuelle en haut du rapport.

Retourne le HTML complet (<!DOCTYPE html>...) avec CSS inline pour impression A4.
Police : 'Segoe UI', system-ui, sans-serif pour les titres, Georgia pour le corps.
Couleurs : bleu marine (#0F2B46) pour les en-têtes. Mise en page A4 optimisée.`;

    const userPrompt = `Génère le rapport final.

Coach: ${coachName}
Date: ${today}

COMMENTAIRE DU COACH (à mettre EN PREMIER dans le rapport, tel quel) :
${coach_comment || 'Aucun commentaire fourni'}

RECOMMANDATION DU COACH :
${coach_recommendation || 'Aucune recommandation'}

NOTES DE COACHING (sessions réalisées) :
${notesBlock || 'Aucune note de coaching'}

${dataContext}`;

    console.log("Generating coach report for enterprise:", ent.name);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16384,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erreur IA: " + errText.substring(0, 200) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    let htmlContent = aiResult.content?.[0]?.text || "";
    htmlContent = htmlContent.replace(/^```html\s*/i, "").replace(/```\s*$/, "").trim();
    if (!htmlContent.toLowerCase().startsWith("<!doctype")) {
      const idx = htmlContent.toLowerCase().indexOf("<!doctype");
      if (idx > 0) htmlContent = htmlContent.substring(idx);
    }

    console.log("Report generated successfully, length:", htmlContent.length);

    return new Response(JSON.stringify({ html: htmlContent, enterprise_name: ent.name }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-coach-report error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erreur interne" }), {
      status: e.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
