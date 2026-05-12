// v6 — rapport de FIN de coaching, format Ideal Vivrier monochrome
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers_v5.ts";
import { getSectorKnowledgePrompt, getDonorCriteriaPrompt } from "../_shared/financial-knowledge.ts";
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
      period_start,        // "Oct. 2025"
      period_end,          // "Avr. 2026"
      sessions_count,      // 8
      coach_names,         // "K. Diabaté / P. N'Guessan"
      coach_verdict,       // texte court : verdict global / éligibilité
      coach_recommendation // recommandation libre additionnelle
    } = await req.json();

    if (!enterprise_id) {
      return new Response(JSON.stringify({ error: "enterprise_id requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: ent } = await supabase.from("enterprises").select("*").eq("id", enterprise_id).single();
    if (!ent) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Permission : legacy coach_id / coach n-to-n actif / org manager.
    // Pas d'access entrepreneur ici — c'est un rapport DESTINÉ au coach,
    // pas à l'entrepreneur lui-même.
    let _allowed = ent.coach_id === user.id;
    if (!_allowed) {
      const { data: a } = await supabase.from("enterprise_coaches")
        .select("id").eq("enterprise_id", enterprise_id).eq("coach_id", user.id).eq("is_active", true).maybeSingle();
      _allowed = !!a;
    }
    if (!_allowed && ent.organization_id) {
      const { data: m } = await supabase.from("organization_members")
        .select("role").eq("user_id", user.id).eq("organization_id", ent.organization_id).eq("is_active", true).maybeSingle();
      _allowed = !!m && ['owner', 'admin', 'manager'].includes(m.role);
    }
    if (!_allowed) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tous les contextes
    const [delivRes, modRes, profileRes, notesRes, scoreHistRes] = await Promise.all([
      supabase.from("deliverables").select("type, data, score, version, updated_at").eq("enterprise_id", enterprise_id),
      supabase.from("enterprise_modules").select("*").eq("enterprise_id", enterprise_id),
      supabase.from("profiles").select("full_name, email").eq("user_id", user.id).single(),
      supabase.from("coaching_notes")
        .select("titre, resume_ia, infos_extraites, date_rdv, raw_content")
        .eq("enterprise_id", enterprise_id).order("date_rdv", { ascending: true }),
      supabase.from("score_history").select("score, scores_detail, created_at")
        .eq("enterprise_id", enterprise_id).order("created_at", { ascending: true }),
    ]);

    const deliverables = delivRes.data || [];
    const coachingNotes = notesRes.data || [];
    const scoreHistory = scoreHistRes.data || [];

    const delivMap: Record<string, any> = {};
    deliverables.forEach((d: any) => { delivMap[d.type] = d; });

    const scoreInitial = scoreHistory.length > 0 ? Number(scoreHistory[0].score) : 0;
    const scoreFinal = Number(ent.score_ir || 0);
    const scoreDelta = scoreFinal - scoreInitial;

    function summarize(data: any, maxLen = 2500): string {
      if (!data) return "—";
      const str = JSON.stringify(data);
      return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
    }

    const notesBlock = coachingNotes.map((n: any, i: number) =>
      `Session ${i + 1} · ${n.date_rdv || '?'} · ${n.titre || ''}\n${n.resume_ia || (n.raw_content || '').substring(0, 250)}`
    ).join('\n\n');

    const sectorBenchmarks = getSectorKnowledgePrompt(ent.sector || "services_b2b");
    const donorCriteria = getDonorCriteriaPrompt();
    const coachName = profileRes.data?.full_name || profileRes.data?.email || "Coach";

    // Métadonnées coach pour l'en-tête
    const periodFmt = period_start && period_end
      ? `${period_start} → ${period_end}`
      : (coachingNotes.length > 0
        ? `${formatPeriod(coachingNotes[0].date_rdv)} → ${formatPeriod(coachingNotes[coachingNotes.length - 1].date_rdv)}`
        : '—');
    const sessionsCountFmt = sessions_count || coachingNotes.length || '—';
    const coachesFmt = coach_names || coachName;

    const dataContext = `
=== ENTREPRISE ===
Nom: ${ent.name} | Secteur: ${ent.sector || "—"} | Pays: ${ent.country || "—"} | Effectifs: ${ent.employees_count || "?"}
Période d'accompagnement: ${periodFmt}
Sessions tenues: ${sessionsCountFmt}
Coachs: ${coachesFmt}

=== SCORES ===
Initial: ${scoreInitial} → Final: ${scoreFinal} (delta ${scoreDelta >= 0 ? '+' : ''}${scoreDelta})

=== HISTORIQUE SCORES PAR DIMENSION ===
${JSON.stringify((scoreHistory[0] as any)?.scores_detail || {}, null, 0)}
${JSON.stringify((scoreHistory[scoreHistory.length - 1] as any)?.scores_detail || {}, null, 0)}

=== LIVRABLES PRODUITS (${deliverables.length}) ===
${deliverables.map(d => `- ${d.type} v${d.version || 1} (${d.updated_at?.substring(0,7) || '?'}) score=${d.score || '—'}`).join('\n')}

=== DIAGNOSTIC ===
${summarize(delivMap.diagnostic_data?.data, 2000)}

=== PRE-SCREENING ===
${summarize(delivMap.pre_screening?.data, 2000)}

=== INPUTS FINANCIERS ===
${summarize(delivMap.inputs_data?.data, 1800)}

=== BMC ===
${summarize(delivMap.bmc_analysis?.data, 1500)}

=== SIC ===
${summarize(delivMap.sic_analysis?.data, 1500)}

=== PLAN FINANCIER ===
${summarize(delivMap.plan_financier?.data || delivMap.plan_ovo?.data, 1800)}

=== BUSINESS PLAN ===
${summarize(delivMap.business_plan?.data, 1800)}

=== ODD ===
${summarize(delivMap.odd_analysis?.data, 1200)}

=== VALUATION ===
${summarize(delivMap.valuation?.data, 1500)}

=== INVESTMENT MEMO ===
${summarize(delivMap.investment_memo?.data, 1800)}

=== HISTORIQUE SESSIONS COACHING ===
${notesBlock || '—'}

=== BENCHMARKS SECTORIELS ===
${sectorBenchmarks}

=== CRITÈRES BAILLEURS ===
${donorCriteria}
`;

    const systemPrompt = `Tu rédiges le RAPPORT DE FIN DE COACHING d'une PME africaine francophone. Destiné au chef de programme et aux bailleurs.

STRUCTURE STRICTE — 10 sections, dans cet ordre, avec les emojis exacts :

1) EN-TÊTE (déjà fourni par le système, ne pas le refaire)
2) ⭐ Verdict global — paragraphe (3-5 phrases) : ce qui a été accompli, là où ça reste imparfait, recommandation finale (éligibilité financement)
3) Évolution du score IR par dimension — TABLE HTML 5 cols (Dimension | Initial | Final | Delta | Tendance). Lignes : Équipe & RH, Financier, Commercial, Opérationnel, Légal & conformité, puis "SCORE GLOBAL". Tendance = "↑ forte" / "↑ solide" / "↑↑" / "→ stable" / "↓"
4) 2 BOÎTES CÔTE À CÔTE :
   - ✅ 3 accomplissements majeurs — UL avec 3 items courts et chiffrés
   - ⚠️ 3 chantiers restants — UL avec 3 items
5) 🎯 Diagnostic consolidé — avant / après — TABLE HTML 3 cols (Dimension | État initial | État final). Une ligne par dimension (Équipe & RH, Financier, Commercial, Opérationnel, Légal). Cellules contenant des bullets concrets et chiffrés.
6) Points d'attention résiduels à transmettre au bailleur — 3 ENCADRÉS distincts. Format : tag <strong>ATTENTION</strong> ou <strong>POSITIF</strong> + titre en italique + description chiffrée. Ex: "ATTENTION  Marge brute sous benchmark — à 24,1%, passage à 30%+ possible..."
7) 📊 Bilan qualitatif — 2 BOÎTES CÔTE À CÔTE :
   - ✅ Ce qui a bien fonctionné (4-5 bullets)
   - 🔄 Points d'amélioration (4-5 bullets)
8) 🎯 Recommandations — 3 horizons — TABLE HTML 3 cols (Court terme 0-3 mois | Moyen terme 3-12 mois | Long terme >12 mois). Bullets dans chaque cellule.
9) 💰 Éligibilité financement — matching actualisé — courte intro + TABLE HTML 4 cols (Programme/bailleur | Ticket | Match | Gap principal). 4 à 6 lignes. Match en %. Puis 1 phrase de recommandation de priorité.
10) 📎 Annexes — 2 BOÎTES CÔTE À CÔTE :
    - A. Livrables produits (N) — bullet list avec version + mois (ex: "Diagnostic initial v1 (10/2025)")
    - B. Historique des sessions — liste "S1 · DD/MM/YYYY · sujet"
11) Footer "ESONO Investment Readiness Platform © ${new Date().getFullYear()} — Confidentiel"

RÈGLES DE STYLE STRICTES — MONOCHROME :
- Texte NOIR uniquement (#111). Zéro couleur sur titres, tags, badges, bordures.
- Pas de fonds colorés. Pas de gradients.
- Tables : bordures fines 1px #333, en-têtes en gras noir.
- Boîtes côte-à-côte : 2 colonnes via display:table ou flex, bordure simple 1px #333.
- Police : "Inter", "Segoe UI", system-ui, sans-serif (corps), en gras pour les titres.
- HTML COMPLET avec <!DOCTYPE html>, <head> avec CSS inline. Optimisé impression A4 ET ouverture Microsoft Word.
- Force * { color: #111 !important } dans le CSS.
- Pas de styles externes, tout inline ou dans <style>.

Réponds avec le HTML pur du document, rien d'autre. Pas de \`\`\`html, pas de Markdown.`;

    const userPrompt = `Génère le rapport de FIN DE COACHING au format HTML monochrome.

EN-TÊTE À PLACER EN HAUT (utilise EXACTEMENT ce contenu) :
- H1 : "Rapport de fin de coaching"
- Sous-titre : ${ent.name}
- Métadonnées : "${periodFmt} · ${sessionsCountFmt} sessions · Coachs : ${coachesFmt}"
- Bloc "Score IR final" : ${scoreInitial} → ${scoreFinal} (↑ ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} pts en ${sessionsCountFmt} sessions)

VERDICT GLOBAL FOURNI PAR LE COACH (à intégrer/reformuler dans la section 2) :
${coach_verdict || '(aucun verdict fourni — déduis-le des données)'}

RECOMMANDATION COMPLÉMENTAIRE COACH :
${coach_recommendation || '(aucune)'}

CONTEXTE COMPLET :
${dataContext}

Important : sois chiffré, concret, et fidèle aux données. Si une dimension n'a pas de données, indique "n/d" plutôt que d'inventer.`;

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
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

function formatPeriod(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
