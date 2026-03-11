import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { enterprise_id } = await req.json();
    if (!enterprise_id) {
      return new Response(JSON.stringify({ error: "enterprise_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify coach access
    const { data: ent } = await supabase
      .from("enterprises")
      .select("*")
      .eq("id", enterprise_id)
      .single();

    if (!ent || ent.coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "Accès refusé — vous n'êtes pas le coach de cette entreprise" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all deliverables
    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("*")
      .eq("enterprise_id", enterprise_id);

    // Fetch modules
    const { data: modules } = await supabase
      .from("enterprise_modules")
      .select("*")
      .eq("enterprise_id", enterprise_id);

    // Fetch coach profile
    const { data: coachProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .single();

    // Build deliverable summaries for the AI prompt
    const delivMap: Record<string, any> = {};
    (deliverables || []).forEach((d: any) => {
      delivMap[d.type] = d.data;
    });

    const moduleStatuses = (modules || []).map((m: any) => ({
      module: m.module,
      status: m.status,
      progress: m.progress,
    }));

    // Truncate large data fields to fit in context
    function summarize(data: any, maxLen = 3000): string {
      if (!data) return "Non disponible";
      const str = JSON.stringify(data, null, 0);
      return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
    }

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

=== BMC (Business Model Canvas) ===
${summarize(delivMap["bmc_analysis"], 2000)}

=== SIC (Social Impact Canvas) ===
${summarize(delivMap["sic_analysis"], 2000)}

=== INPUTS (Données financières historiques) ===
${summarize(delivMap["inputs_data"], 2000)}

=== FRAMEWORK (Analyse financière) ===
${summarize(delivMap["framework_data"], 2500)}

=== DIAGNOSTIC ===
${summarize(delivMap["diagnostic_data"], 2000)}

=== PLAN OVO (Projections financières 5 ans) ===
${summarize(delivMap["plan_ovo"], 2500)}

=== BUSINESS PLAN ===
${summarize(delivMap["business_plan"], 2500)}

=== ODD (Objectifs de Développement Durable) ===
${summarize(delivMap["odd_analysis"], 1500)}
`;

    const coachName = coachProfile?.full_name || coachProfile?.email || "Coach";
    const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const systemPrompt = `Tu es un consultant senior spécialisé dans l'accompagnement d'entreprises en Afrique francophone (zone UEMOA/CEMAC). 

Tu dois rédiger un RAPPORT D'ÉVALUATION COMPLET ET PROFESSIONNEL destiné à être transmis aux supérieurs hiérarchiques d'un coach d'accompagnement.

Le rapport doit être :
- ENTIÈREMENT RÉDIGÉ en français professionnel (pas de bullet points secs, mais des paragraphes narratifs bien rédigés)
- STRUCTURÉ avec des sections clairement identifiées
- ANALYTIQUE : ne pas juste restituer les données mais les analyser, les interpréter, donner du contexte
- ACTIONNABLE : chaque section doit se conclure par des observations/recommandations
- QUANTIFIÉ : citer les chiffres clés (chiffre d'affaires, marges, TRI, VAN, scores, etc.)
- PROFESSIONNEL : ton formel adapté à un rapport institutionnel

Tu dois retourner UNIQUEMENT le contenu HTML (pas de balises \`\`\`html, pas de commentaires). Le HTML doit être un document complet avec les balises <!DOCTYPE html>, <html>, <head> (avec CSS inline pour impression), et <body>.

STRUCTURE DU RAPPORT :
1. Page de garde avec nom de l'entreprise, secteur, pays, date, nom du coach, score global
2. Table des matières
3. Résumé exécutif (1-2 pages) — synthèse des forces, faiblesses, potentiel de l'entreprise
4. Section 1 : Présentation de l'entreprise — contexte, historique, positionnement
5. Section 2 : Analyse du modèle économique (BMC) — proposition de valeur, segments, canaux, partenaires, revenus
6. Section 3 : Impact social et développement durable (SIC + ODD) — mission sociale, théorie du changement, alignement ODD, recommandations ESG
7. Section 4 : Analyse financière historique — compte de résultat, bilan, ratios de rentabilité, liquidité, solvabilité, commentaires
8. Section 5 : Projections financières et scénarios — revenue 5 ans, scénarios (pessimiste/réaliste/optimiste), TRI, VAN, ROI, seuil de rentabilité
9. Section 6 : Business Plan — résumé exécutif, analyse de marché, stratégie commerciale, plan opérationnel
10. Section 7 : Diagnostic global et SWOT — forces, faiblesses, opportunités, menaces, score par dimension
11. Section 8 : Recommandations stratégiques et plan d'action — priorités court/moyen/long terme, KPIs de suivi
12. Annexe : Tableau récapitulatif des scores par module

STYLE CSS :
- Police : 'Georgia', 'Times New Roman', serif pour le corps, 'Segoe UI', sans-serif pour les titres
- Couleurs : bleu marine (#1e3a5f) pour les en-têtes, gris foncé (#1e293b) pour le texte
- Mise en page optimisée pour impression A4 (@media print)
- Tableaux avec bordures fines, alternance de couleurs de lignes
- Marges généreuses, espacement confortable
- Page de garde centrée avec un design sobre et institutionnel
- Numérotation des sections

Si certaines données ne sont pas disponibles, mentionne-le diplomatiquement ("Cette section n'a pas encore été complétée dans le parcours d'accompagnement") plutôt que de laisser un vide.`;

    const userPrompt = `Génère le rapport complet pour l'entreprise suivante.

Coach: ${coachName}
Date: ${today}

${dataContext}`;

    console.log("Generating coach report for enterprise:", ent.name);

    // Call Claude Sonnet via callAI
    // We need raw HTML, not JSON, so we'll use a special approach
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(55000),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erreur IA: " + errText.substring(0, 200) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    let htmlContent = aiResult.content?.[0]?.text || "";

    // Clean up any markdown wrappers
    htmlContent = htmlContent
      .replace(/^```html\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    // Ensure it starts with <!DOCTYPE
    if (!htmlContent.toLowerCase().startsWith("<!doctype")) {
      const idx = htmlContent.toLowerCase().indexOf("<!doctype");
      if (idx > 0) {
        htmlContent = htmlContent.substring(idx);
      }
    }

    console.log("Report generated successfully, length:", htmlContent.length);

    return new Response(JSON.stringify({ html: htmlContent, enterprise_name: ent.name }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("generate-coach-report error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erreur interne" }), {
      status: e.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
