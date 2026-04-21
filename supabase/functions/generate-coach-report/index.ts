// v5 — coaching notes + coach comment/recommendation 2026-03-21
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers_v5.ts";
import { getSectorKnowledgePrompt, getDonorCriteriaPrompt } from "../_shared/financial-knowledge.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";

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

    const {
      enterprise_id,
      coach_comment,
      coach_recommendation,
      session_number,
      session_date,
      coach_names,
      next_session_date,
      next_session_objectives,
    } = await req.json();
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

    // Fetch all data — + score_history pour calculer delta IR
    const [delivRes, modRes, profileRes, notesRes, scoreHistRes] = await Promise.all([
      supabase.from("deliverables").select("*").eq("enterprise_id", enterprise_id),
      supabase.from("enterprise_modules").select("*").eq("enterprise_id", enterprise_id),
      supabase.from("profiles").select("full_name, email").eq("user_id", user.id).single(),
      supabase.from("coaching_notes")
        .select("titre, resume_ia, infos_extraites, date_rdv, raw_content")
        .eq("enterprise_id", enterprise_id)
        .order("created_at", { ascending: false }),
      supabase.from("score_history")
        .select("score, created_at")
        .eq("enterprise_id", enterprise_id)
        .order("created_at", { ascending: true }),
    ]);

    const deliverables = delivRes.data || [];
    const modules = modRes.data || [];
    const coachProfile = profileRes.data;
    const coachingNotes = notesRes.data || [];
    const scoreHistory = scoreHistRes.data || [];

    // Delta score IR : prend le premier score connu (entrée du programme) et le score actuel
    const scoreIrDebut = scoreHistory.length > 0 ? Number(scoreHistory[0].score) : 0;
    const scoreIrActuel = Number(ent.score_ir || 0);
    const scoreIrDelta = scoreIrActuel - scoreIrDebut;
    const scoreIrClassification = scoreIrActuel >= 70 ? 'AVANCER' : scoreIrActuel >= 40 ? 'ACCOMPAGNER' : scoreIrActuel >= 20 ? 'COMPLETER D\'ABORD' : 'REJETER';

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
    const sessionDateFmt = session_date
      ? new Date(session_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : today;
    const sessionNumberFmt = session_number ? `n°${session_number}` : '';
    const coachesDisplay = coach_names || coachName;
    const nextSessionFmt = next_session_date
      ? new Date(next_session_date).toLocaleDateString("fr-FR", { weekday: 'long', day: "numeric", month: "long", year: "numeric" })
      : 'à planifier';

    const systemPrompt = `Tu rédiges un RAPPORT DE COACHING pour une PME africaine francophone, destiné au chef de programme et potentiellement aux bailleurs.

STRUCTURE EXACTE, 8 sections (respecter la numérotation et les titres d'icônes) :

1) EN-TÊTE (déjà fourni, ne pas le refaire) : Titre "Rapport de coaching", Nom entreprise, ligne "Session n°X — date — Coachs : xxx", bloc Score IR (before → after, delta, classification).

2) SECTION "📌 Synthèse de la session"
   Un seul paragraphe dense (4 à 7 phrases) qui décrit : ce qui a été fait pendant la session, les acquis concrets, les signaux d'alerte éventuels. Pas de bullet. Pas de liste.

3) SECTION "🎯 Points clés à retenir"
   Liste à puces (3 à 5 items max). Chaque item commence par un tag :
   - "URGENT" pour les blocages / actions impératives
   - "ATTENTION" pour les risques à surveiller
   - "POSITIF" pour les acquis à consolider
   Format : "<strong>TAG</strong> <em>Sujet</em> — description chiffrée et actionnable."

4) SECTION "✅ Sujets travaillés"
   Tableau HTML à 3 colonnes : Sujet | Avancement | Statut.
   Statut = une de ces 3 valeurs : "En cours", "Clos", "Bloqué". N'utilise pas d'emoji dans le statut (juste texte).

5) SECTION "📋 Feuille de route 30 jours"
   Tableau HTML à 4 colonnes : Prio | Action | Resp. | Échéance.
   Prio = "URGENT", "HAUTE", "MOYENNE", "BASSE".
   Resp. = "Entrep.", "Coach", "Coach+Compta", etc.
   Échéance au format DD/MM.

6) SECTION "📎 En attente & prochaine session"
   Sous-titre "📂 Documents à obtenir" : bullet list des documents attendus (5 à 8 items).
   Sous-titre "📅 Prochaine session" : Date + Objectifs (bullets numérotés 1-3).

7) SECTION "💬 Note coach (visibilité chef de programme)"
   Un seul paragraphe (3 à 6 phrases). Ton direct, observations du coach sur la posture de l'entrepreneur, vigilance, contexte psychologique. Visible par le chef de programme uniquement.

8) FOOTER : "ESONO Investment Readiness Platform © ${new Date().getFullYear()} — Confidentiel"

RÈGLES DE STYLE STRICTES :
- Monochrome total : TEXTE NOIR uniquement (#111). PAS de couleurs sur les textes ni sur les titres. Les tags (URGENT/ATTENTION/POSITIF/HAUTE…) sont en GRAS noir — pas de fond coloré, pas de texte coloré.
- Les tableaux : bordures fines 1px #333, en-têtes en gras, pas de fond coloré.
- Police : "Inter", "Segoe UI", system-ui, sans-serif pour tout le document.
- Retourne un document HTML COMPLET avec <!DOCTYPE html>, <head> avec CSS inline optimisé pour impression A4 ET pour ouverture dans Microsoft Word.
- Pas de blocs <style> colorés, pas de backgrounds, pas de borders colorées. Juste noir sur blanc avec hiérarchie typographique (tailles, graisses, italiques).`;

    const userPrompt = `Génère le rapport de coaching au format HTML, monochrome noir sur blanc.

EN-TÊTE À UTILISER TEL QUEL EN HAUT :
- Titre : "Rapport de coaching"
- Entreprise : ${ent.name}
- Session ${sessionNumberFmt} — ${sessionDateFmt} — Coachs : ${coachesDisplay}
- Score IR : ${scoreIrDebut} → ${scoreIrActuel} (${scoreIrDelta >= 0 ? '↑ +' : '↓ '}${scoreIrDelta} pts · ${scoreIrClassification})

PROCHAINE SESSION (à placer en section 6) :
- Date : ${nextSessionFmt}
- Objectifs fournis par le coach : ${next_session_objectives || '(à définir par le coach)'}

NOTE COACH POUR CHEF DE PROGRAMME (section 7, tel quel) :
${coach_comment || 'Aucune note fournie'}

RECOMMANDATION GLOBALE (à intégrer dans section 2 Synthèse) :
${coach_recommendation || '(aucune)'}

NOTES DES SESSIONS DE COACHING (source pour les sections Synthèse, Points clés, Sujets travaillés, Feuille de route) :
${notesBlock || 'Aucune note de coaching'}

${dataContext}

RAPPEL : retour en HTML complet, MONOCHROME noir sur blanc, ouvrable dans Word.`;

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
        system: injectGuardrails(systemPrompt),
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
