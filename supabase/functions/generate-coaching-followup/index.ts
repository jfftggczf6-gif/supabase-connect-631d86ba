// Rapport de suivi (snapshot état actuel à un instant T) — généré par l'IA
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers_v5.ts";
import { getSectorKnowledgePrompt } from "../_shared/financial-knowledge.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      enterprise_id,
      coach_names,
      next_session_date,    // optionnel : date de la prochaine session prévue
      note_coach,           // optionnel : note privée du coach pour le chef de programme
    } = await req.json();

    if (!enterprise_id) {
      return new Response(JSON.stringify({ error: "enterprise_id requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: ent } = await supabase.from("enterprises").select("*").eq("id", enterprise_id).single();
    if (!ent) {
      return new Response(JSON.stringify({ error: "Entreprise introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vérification d'accès : coach assigné ou super_admin
    const isCoach = ent.coach_id === user.id;
    const { data: isCoachNN } = await supabase.from("enterprise_coaches")
      .select("id").eq("enterprise_id", enterprise_id).eq("coach_id", user.id).eq("is_active", true).limit(1);
    const { data: isSA } = await supabase.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
    if (!isCoach && !(isCoachNN && isCoachNN.length > 0) && !isSA) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch contexte
    const [delivRes, profileRes, notesRes, scoreHistRes] = await Promise.all([
      supabase.from("deliverables").select("type, data, score, version, updated_at").eq("enterprise_id", enterprise_id),
      supabase.from("profiles").select("full_name, email").eq("user_id", user.id).single(),
      supabase.from("coaching_notes")
        .select("titre, resume_ia, infos_extraites, date_rdv, raw_content, created_at")
        .eq("enterprise_id", enterprise_id).order("created_at", { ascending: false }).limit(5),
      supabase.from("score_history").select("score, scores_detail, created_at")
        .eq("enterprise_id", enterprise_id).order("created_at", { ascending: true }),
    ]);

    const deliverables = delivRes.data || [];
    const coachingNotes = notesRes.data || [];
    const scoreHistory = scoreHistRes.data || [];

    const delivMap: Record<string, any> = {};
    deliverables.forEach((d: any) => { delivMap[d.type] = d; });

    const scoreInitial = scoreHistory.length > 0 ? Number(scoreHistory[0].score) : 0;
    const scoreActuel = Number(ent.score_ir || 0);
    const scoreDelta = scoreActuel - scoreInitial;
    const classif = scoreActuel >= 70 ? 'AVANCER' : scoreActuel >= 40 ? 'ACCOMPAGNER' : scoreActuel >= 20 ? "COMPLETER D'ABORD" : 'REJETER';

    const coachName = profileRes.data?.full_name || profileRes.data?.email || "Coach";
    const coachesFmt = coach_names || coachName;
    const updateDate = new Date().toLocaleDateString("fr-FR", { day: 'numeric', month: 'long', year: 'numeric' });
    const nextSessionFmt = next_session_date
      ? new Date(next_session_date).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'à planifier';

    const summarize = (data: any, max = 2000) => data ? JSON.stringify(data).substring(0, max) : '—';

    const recentNotesBlock = coachingNotes.map((n: any) =>
      `[${n.date_rdv || n.created_at?.substring(0,10)}] ${n.titre || ''}\n${n.resume_ia || (n.raw_content || '').substring(0, 300)}`
    ).join('\n\n');

    const sectorBenchmarks = getSectorKnowledgePrompt(ent.sector || "services_b2b");

    const dataContext = `
=== ENTREPRISE ===
Nom: ${ent.name} | Secteur: ${ent.sector || "—"} | Pays: ${ent.country || "—"}
Effectifs: ${ent.employees_count || "?"}

=== SCORE IR ===
Initial: ${scoreInitial} | Actuel: ${scoreActuel} | Delta: ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}
Classification actuelle: ${classif}

=== LIVRABLES PRODUITS (${deliverables.length}) ===
${deliverables.map(d => `- ${d.type} v${d.version || 1} (${d.updated_at?.substring(0,10) || '?'}) score=${d.score || '—'}`).join('\n')}

=== DIAGNOSTIC ===
${summarize(delivMap.diagnostic_data?.data, 1500)}

=== PRE-SCREENING ===
${summarize(delivMap.pre_screening?.data, 1500)}

=== INPUTS FINANCIERS (état actuel) ===
${summarize(delivMap.inputs_data?.data, 1500)}

=== PLAN FINANCIER ===
${summarize(delivMap.plan_financier?.data || delivMap.plan_ovo?.data, 1200)}

=== BUSINESS PLAN ===
${summarize(delivMap.business_plan?.data, 1000)}

=== DERNIÈRES NOTES DE COACHING (5 max, plus récentes en haut) ===
${recentNotesBlock || '—'}

=== BENCHMARKS SECTORIELS ===
${sectorBenchmarks}
`;

    const systemPrompt = `Tu rédiges un RAPPORT DE SUIVI d'une PME africaine francophone. Ce rapport est une PHOTO DE L'ÉTAT ACTUEL à un instant T (pas un compte-rendu de session). Il sert à informer le chef de programme et les bailleurs sur où en est l'entreprise MAINTENANT.

STRUCTURE STRICTE — 8 sections, dans cet ordre exact, avec les emojis :

1) EN-TÊTE (déjà fourni par le système, ne pas le refaire)
2) Bloc "Score IR à date" (déjà fourni, ne pas le refaire)
3) 📌 Synthèse de l'état actuel — un paragraphe (4-7 phrases) : où en est l'entreprise aujourd'hui, ce qui s'est consolidé, ce qui reste fragile, le contexte global. Pas de bullet, pas de liste.
4) 🎯 Points clés à date — UL avec 3 à 5 items. Chaque item commence par un tag <strong>URGENT</strong> / <strong>ATTENTION</strong> / <strong>POSITIF</strong>, suivi de <em>titre court</em> et d'une description chiffrée et actionnable.
5) ✅ Chantiers en cours — TABLE HTML 3 colonnes : Sujet | Avancement | Statut. Statut = "En cours" / "Clos" / "Bloqué". 4 à 8 lignes typiquement.
6) 📋 Feuille de route 30 jours — TABLE HTML 4 colonnes : Prio. | Action | Resp. | Échéance. Prio = URGENT/HAUTE/MOYENNE/BASSE. Resp = Entrep./Coach/Coach+Compta. Échéance au format DD/MM. 3 à 6 lignes.
7) 📎 En attente & prochaine touche
   Sous-titre "📂 Documents à obtenir" : UL de 3 à 8 documents que l'on attend.
   Sous-titre "📅 Prochaine session" : Date (déjà fournie) + Objectifs (UL numérotés 1-3).
8) 💬 Note coach (visibilité chef de programme) — un paragraphe (3-6 phrases) reprenant la note fournie par le coach, ou si vide, observation neutre sur la posture/contexte. Style direct.
9) Footer "ESONO Investment Readiness Platform © ${new Date().getFullYear()} — Confidentiel"

RÈGLES DE STYLE STRICTES — MONOCHROME :
- Texte NOIR (#111). Zéro couleur sur titres, tags, badges, bordures.
- Pas de fonds colorés, pas de gradients.
- Tables : bordures fines 1px #333, en-têtes en gras noir.
- Police : "Inter", "Segoe UI", system-ui, sans-serif.
- HTML COMPLET avec <!DOCTYPE html>, <head> avec CSS inline. Optimisé impression A4 ET ouverture Microsoft Word.
- Force * { color: #111 !important } dans le CSS.
- Réponds avec le HTML pur, rien d'autre. Pas de \`\`\`html, pas de Markdown.`;

    const userPrompt = `Génère le RAPPORT DE SUIVI au format HTML monochrome.

EN-TÊTE À PLACER EN HAUT (utilise EXACTEMENT ce contenu) :
- H1 : "Rapport de suivi"
- Sous-titre : ${ent.name}
- Métadonnées : "Mise à jour : ${updateDate} — Coachs : ${coachesFmt}"
- Bloc "Score IR à date" : ${scoreActuel} (${scoreDelta >= 0 ? '↑ +' : '↓ '}${scoreDelta} pts depuis le début · ${classif})

PROCHAINE SESSION (à utiliser dans la section 7) :
- Date : ${nextSessionFmt}

NOTE COACH (à utiliser dans la section 8, garde le ton, reformule légèrement si besoin) :
${note_coach || '(aucune note fournie — observe le contexte général à partir des données)'}

CONTEXTE COMPLET DE L'ENTREPRISE À DATE :
${dataContext}

Important : le rapport reflète l'ÉTAT ACTUEL (snapshot), pas une session ponctuelle. Sois chiffré, concret, actionnable. Si une donnée manque, indique "n/d" plutôt que d'inventer.`;

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 12288,
        temperature: 0.3,
        system: injectGuardrails(systemPrompt),
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
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

    return new Response(JSON.stringify({ html: htmlContent, enterprise_name: ent.name }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-coaching-followup error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erreur interne" }), {
      status: e.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
