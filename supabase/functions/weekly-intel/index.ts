// weekly-intel — ESONO Weekly Intel brief stratégique hebdomadaire
// Scrape 8 sources → synthèse Claude → email à Philippe & Kadry
// Trigger : manuel ou cron (lundi 7h UTC)
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/helpers_v5.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = "claude-sonnet-4-6";

// Recipients
const RECIPIENTS = [
  Deno.env.get("WEEKLY_INTEL_EMAIL_1") || "philippeyace@hotmail.fr",
  Deno.env.get("WEEKLY_INTEL_EMAIL_2") || "",
].filter(Boolean);

// Sources to scrape
const SOURCES = [
  { id: "africape", name: "Africa Private Equity News", url: "https://www.africaprivateequitynews.com/feed", type: "rss" },
  { id: "africagf", name: "Africa Global Funds", url: "https://www.africaglobalfunds.com/news/private-equity/deals/", type: "html" },
  { id: "ecofin", name: "Ecofin Agency", url: "https://www.ecofinagency.com/finance", type: "html" },
  { id: "avca", name: "AVCA News", url: "https://www.avca.africa/news-insights/member-news/", type: "html" },
  { id: "proparco", name: "Proparco", url: "https://www.proparco.fr/en/news", type: "html" },
  { id: "financialafrik", name: "Financial Afrik", url: "https://www.financialafrik.com/", type: "html" },
  { id: "sikafinance", name: "Sikafinance", url: "https://www.sikafinance.com/marches", type: "html" },
  { id: "ifc", name: "IFC Africa", url: "https://pressroom.ifc.org/all/pages/PressDetail.aspx?ID=27702", type: "html" },
];

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ═══ Step 1: Scrape sources ═══
async function scrapeSource(source: typeof SOURCES[0]): Promise<{ id: string; name: string; content: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(source.url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": source.type === "rss" ? "application/rss+xml,application/xml,text/xml" : "text/html",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const text = await resp.text();

    // Extract useful content (strip HTML, keep text)
    let content = text;
    if (source.type === "html") {
      // Remove scripts, styles, nav, footer
      content = text
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000); // Cap at 8K chars per source
    } else if (source.type === "rss") {
      // Extract items from RSS
      const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 10);
      const extracted = items.map(m => {
        const title = m[1].match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] || "";
        const desc = m[1].match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i)?.[1] || "";
        const link = m[1].match(/<link>(.*?)<\/link>/i)?.[1] || "";
        const date = m[1].match(/<pubDate>(.*?)<\/pubDate>/i)?.[1] || "";
        return `${title}\n${desc.replace(/<[^>]+>/g, "").slice(0, 300)}\n${link}\n${date}`;
      });
      content = extracted.join("\n---\n");
    }

    return { id: source.id, name: source.name, content };
  } catch (err: any) {
    return { id: source.id, name: source.name, content: "", error: err.message };
  }
}

// ═══ Step 2: Generate brief with Claude ═══
async function generateBrief(sources: Record<string, string>, weekLabel: string): Promise<string> {
  const sourcesText = Object.entries(sources)
    .map(([name, content]) => `═══ ${name} ═══\n${content || "(source inaccessible)"}`)
    .join("\n\n");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      messages: [{
        role: "user",
        content: `Tu es un analyste stratégique spécialisé dans le Private Equity et le financement des PME en Afrique francophone. Tu travailles pour ESONO BIS Studio, une plateforme SaaS d'analyse financière automatisée pour les PME africaines.

Voici les actualités de la ${weekLabel}, extraites de 8 sources spécialisées :

${sourcesText}

Produis un brief stratégique structuré en 8 sections, en HTML propre (pas de markdown).

1. 🔥 LE FAIT DE LA SEMAINE — Le signal le plus important. Pourquoi c'est important pour un fonds PE ou un bailleur. Ce que ça signifie pour ESONO commercialement.

2. 💰 DEALS RÉCENTS AFRIQUE FRANCOPHONE — Liste détaillée de chaque transaction PE, fundraising ou exit cette semaine. Pour chaque deal : parties, montant si dispo, secteur, pays, contexte. Focus sur les fonds prospects ESONO : Adiwale, Comoé Capital, I&P, Joliba Capital, AfricInvest, Amethis, SPE Capital, Adenia Partners.

3. 🏛️ DFI & BAILLEURS — Mouvements de Proparco, IFC, AfDB, Enabel, GIZ, DEG cette semaine. Nouveaux programmes, garanties, facilities.

4. 📊 MACRO & MONÉTAIRE UEMOA — Décisions BCEAO, inflation, croissance, taux de change, événements macro impactant la zone FCFA. Si pas de news BCEAO, rappeler les derniers chiffres en vigueur.

5. 🔍 SECTEURS À SURVEILLER — Énergie, santé/pharma, fintech, agri, éducation. Quels deals confirment quelles tendances.

6. 🎯 INTELLIGENCE CONCURRENTIELLE — Nouveaux outils, startups, publications qui touchent le marché de l'analyse financière PE en Afrique.

7. 💬 ARGUMENTS COMMERCIAUX ESONO — 2-3 phrases prêtes à copier-coller dans un WhatsApp à un prospect. Un pour les prospects PE, un pour les opérateurs de programme, un pour les banques d'affaires.

8. 📅 CALENDRIER — Événements à venir (conférences, publications, deadlines).

RÈGLES :
- Ton professionnel mais direct, pas de langue de bois
- Français, avec les termes techniques PE en anglais (IRR, MOIC, EBITDA)
- Cite les sources entre parenthèses pour chaque fait
- Si une section n'a pas de news cette semaine, écris "Pas de mouvement notable cette semaine"
- Les arguments commerciaux doivent être des phrases que Philippe ou Kadry peuvent copier-coller directement
- Brief lisible en 5 minutes maximum
- Formate en HTML avec <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>
- Pas de <html>, <head>, <body> — juste le contenu`
      }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API error: ${resp.status} — ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text || "";
}

// ═══ Main ═══
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: super_admin or cron
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (user) {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        if (!(roles || []).some((r: any) => r.role === "super_admin")) {
          return errorResponse("Super admin required", 403);
        }
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const now = new Date();
    const friday = new Date(now);
    friday.setDate(friday.getDate() + 4);
    const weekLabel = `Semaine du ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${friday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    console.log(`[weekly-intel] Starting scrape for ${weekLabel}`);

    // ═══ Step 1: Scrape all sources in parallel ═══
    const scrapeResults = await Promise.all(SOURCES.map(s => scrapeSource(s)));

    const sourcesMap: Record<string, string> = {};
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const result of scrapeResults) {
      sourcesMap[result.name] = result.content;
      if (result.error) {
        errorCount++;
        errors.push(`${result.name}: ${result.error}`);
      } else if (result.content.length > 50) {
        successCount++;
      } else {
        errorCount++;
        errors.push(`${result.name}: contenu vide ou trop court`);
      }
    }

    console.log(`[weekly-intel] Scrape complete: ${successCount} OK, ${errorCount} errors`);

    // ═══ Step 2: Generate brief ═══
    let briefHtml: string;
    let warning = "";

    if (successCount < 3) {
      warning = `<div style="background:#FFF3CD;border:1px solid #FFEEBA;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
        <strong>⚠️ Certaines sources étaient inaccessibles cette semaine.</strong><br/>
        Le brief peut être incomplet. Sources en erreur : ${errors.join(", ")}
      </div>`;
    }

    try {
      briefHtml = await generateBrief(sourcesMap, weekLabel);
    } catch (claudeErr: any) {
      // Claude failed — send error email
      for (const email of RECIPIENTS) {
        await supabase.functions.invoke("send-email", {
          body: {
            to: email,
            subject: `⚠️ ESONO Weekly Intel — Échec de génération`,
            html: `<p>Le brief de la ${weekLabel} n'a pu être généré.</p><p>Erreur : ${claudeErr.message}</p><p>Sources OK : ${successCount}/${SOURCES.length}</p>`,
          },
        });
      }
      return jsonResponse({ success: false, error: claudeErr.message, sources_ok: successCount });
    }

    // ═══ Step 3: Format email ═══
    const emailHtml = `
      <div style="max-width:700px; margin:0 auto; font-family:'Segoe UI',Arial,sans-serif; color:#333; line-height:1.6;">
        <div style="background:#1B2A4A; padding:24px 30px; text-align:center; border-radius:8px 8px 0 0;">
          <h1 style="color:white; margin:0; font-size:22px; letter-spacing:1px;">ESONO WEEKLY INTEL</h1>
          <p style="color:#8BB8E8; margin:8px 0 0 0; font-size:13px;">
            ${weekLabel} — Confidentiel
          </p>
        </div>
        <div style="padding:30px; background:white;">
          ${warning}
          ${briefHtml}
        </div>
        <div style="background:#F5F5F5; padding:16px 30px; text-align:center; font-size:11px; color:#999; border-radius:0 0 8px 8px;">
          ESONO BIS Studio — Préparé automatiquement chaque lundi à 7h<br/>
          Sources : ${successCount}/${SOURCES.length} accessibles | ${briefHtml.length.toLocaleString()} caractères<br/>
          <em>Pour Philippe & Kadry — Prochain numéro lundi prochain</em>
        </div>
      </div>
    `;

    // ═══ Step 4: Send email ═══
    const emailResults: string[] = [];
    for (const email of RECIPIENTS) {
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            to: email,
            subject: `📊 ESONO Weekly Intel — ${weekLabel}`,
            html: emailHtml,
          },
        });
        emailResults.push(`${email}: OK`);
      } catch (emailErr: any) {
        emailResults.push(`${email}: FAILED (${emailErr.message})`);
      }
    }

    // ═══ Step 5: Log ═══
    const logEntry = {
      week_label: weekLabel,
      sources_ok: successCount,
      sources_error: errorCount,
      errors,
      brief_length: briefHtml.length,
      recipients: RECIPIENTS,
      email_results: emailResults,
      generated_at: now.toISOString(),
    };

    await supabase.from("activity_log").insert({
      action: "weekly_intel_sent",
      actor_role: "system",
      metadata: logEntry,
    }).catch(() => {});

    console.log("[weekly-intel] Complete:", logEntry);

    return jsonResponse({
      success: true,
      ...logEntry,
    });

  } catch (err: any) {
    console.error("[weekly-intel] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});
