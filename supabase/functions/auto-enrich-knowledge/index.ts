// auto-enrich-knowledge — Weekly cron to automatically enrich the knowledge base
// 4 steps per architecture v2.5:
// 1. Refresh existing sources (knowledge_sources stale check)
// 2. Discover new sources via web search (whitelist domains)
// 3. AI validation + human review queue (score 0-10)
// 4. Indexation (embeddings + knowledge_enrichment_log)
// Sends email recap to admin for pending reviews
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = "claude-sonnet-4-6";

// Trusted domains for source discovery
const TRUSTED_DOMAINS = [
  "ifc.org", "proparco.fr", "afdb.org", "worldbank.org",
  "bad.org", "giz.de", "enabel.be", "afd.fr",
  "ilo.org", "unctad.org",
];

// Sectors and regions to scan
const SECTORS = ["Agro-industrie", "Pharmacie", "Énergie", "Fintech", "BTP", "Commerce", "Transport", "Santé", "Textile"];
const REGIONS = ["Côte d'Ivoire", "Sénégal", "Cameroun", "Mali", "RDC", "Rwanda", "Uganda", "Bénin", "Burkina Faso"];

// Budget limits
const MAX_SEARCHES = 15;
const MAX_COST_USD = 3.0;

async function callClaude(system: string, user: string, maxTokens = 4096): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens, temperature: 0.2,
      system, messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude error ${res.status}`);
  const data = await res.json();
  return data.content?.find((b: any) => b.type === "text")?.text || "";
}

function parseJSON(text: string): any {
  try {
    // Extract JSON from potential markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    return JSON.parse(match[1]!.trim());
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth: super_admin or cron (no auth = cron)
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (user) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        if (!(roles || []).some((r: any) => r.role === "super_admin")) {
          return errorResponse("Super admin required", 403);
        }
      }
    }

    const stats = {
      sources_refreshed: 0,
      new_discovered: 0,
      auto_ingested: 0,
      pending_review: 0,
      rejected: 0,
      cost_usd: 0,
    };

    const pendingDocs: Array<{ title: string; source: string; score: number; summary: string }> = [];
    const ingestedDocs: Array<{ title: string; source: string; score: number }> = [];

    // ═══════════════════════════════════════════════════════════
    // ÉTAPE 1 — Rafraîchir les sources existantes
    // ═══════════════════════════════════════════════════════════
    const { data: sources } = await supabase
      .from("knowledge_sources" as any)
      .select("id, title, url, last_refreshed_at, sector, country")
      .not("url", "is", null);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const staleSources = (sources || []).filter((s: any) => {
      if (!s.last_refreshed_at) return true;
      return new Date(s.last_refreshed_at) < thirtyDaysAgo;
    });

    for (const source of staleSources.slice(0, 10)) {
      await supabase.from("knowledge_sources" as any)
        .update({ last_refreshed_at: now.toISOString() })
        .eq("id", source.id);
      stats.sources_refreshed++;
    }

    // ═══════════════════════════════════════════════════════════
    // ÉTAPE 2 — Découvrir de nouvelles sources
    // ═══════════════════════════════════════════════════════════
    // Pick random sector/region combos to search
    const searchCombos: Array<{ sector: string; region: string }> = [];
    for (let i = 0; i < MAX_SEARCHES; i++) {
      searchCombos.push({
        sector: SECTORS[i % SECTORS.length],
        region: REGIONS[i % REGIONS.length],
      });
    }

    for (const combo of searchCombos) {
      if (stats.cost_usd >= MAX_COST_USD) break;

      const rawResponse = await callClaude(
        `Tu es un analyste de veille sectorielle spécialisé en PME africaines francophones.
Tu dois identifier des données factuelles, chiffrées et vérifiables sur le secteur et la région demandés.

RÈGLES STRICTES :
- Cite UNIQUEMENT des données que tu peux sourcer (rapport IFC, BAD, Banque Mondiale, etc.)
- Donne des chiffres précis : marges, tailles de marché, CAPEX typiques, multiples
- Si tu n'as pas de données fiables, retourne un tableau vide
- Domaines de confiance : ${TRUSTED_DOMAINS.join(", ")}

Retourne un JSON :
{
  "documents": [
    {
      "title": "titre descriptif du benchmark ou de la donnée",
      "content": "contenu factuel avec chiffres (300-500 mots)",
      "source": "nom du rapport ou de l'organisme + année",
      "source_url": "URL si connue, sinon null",
      "quality_score": 0-10,
      "reasoning": "pourquoi ce score de qualité"
    }
  ]
}`,
        `Secteur : ${combo.sector}
Région : ${combo.region}
Année de référence : 2024-2026

Quels sont les benchmarks financiers clés pour les PME de ce secteur dans cette région ?
(marge brute médiane, marge EBITDA, CAPEX typique, taille marché, croissance, multiples de valorisation)

Retourne UNIQUEMENT du JSON valide.`
      );

      stats.cost_usd += 0.015;

      const parsed = parseJSON(rawResponse);
      if (!parsed?.documents) continue;

      for (const doc of parsed.documents) {
        if (!doc.title || !doc.content) continue;
        stats.new_discovered++;
        const score = Number(doc.quality_score) || 0;

        // ═══════════════════════════════════════════════════════
        // ÉTAPE 3 — Validation IA + file d'attente humaine
        // ═══════════════════════════════════════════════════════
        if (score >= 7) {
          // Auto-ingest : score ≥7, qualité suffisante
          const { error } = await supabase.from("knowledge_base").insert({
            title: doc.title,
            content: doc.content,
            category: "benchmarks",
            sector: combo.sector,
            country: combo.region,
            source: doc.source || null,
            tags: ["auto-enriched", `quality-${score}`, `run-${now.toISOString().slice(0, 10)}`],
          });
          if (!error) {
            stats.auto_ingested++;
            ingestedDocs.push({ title: doc.title, source: doc.source, score });
          }
        } else if (score >= 5) {
          // Pending review : score 5-7, besoin de validation humaine
          await supabase.from("knowledge_pending_review" as any).insert({
            title: doc.title,
            content: doc.content,
            category: "benchmarks",
            sector: combo.sector,
            country: combo.region,
            source: doc.source || null,
            source_url: doc.source_url || null,
            quality_score: score,
            ai_summary: doc.content.slice(0, 200),
            ai_reasoning: doc.reasoning || null,
            tags: [`quality-${score}`, `run-${now.toISOString().slice(0, 10)}`],
          });
          stats.pending_review++;
          pendingDocs.push({ title: doc.title, source: doc.source, score, summary: doc.content.slice(0, 150) });
        } else {
          stats.rejected++;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // ÉTAPE 4 — Indexation (embeddings pour les docs auto-ingérés)
    // ═══════════════════════════════════════════════════════════
    if (stats.auto_ingested > 0) {
      try {
        await supabase.functions.invoke("generate-embeddings", {
          body: { mode: "backfill" },
        });
      } catch (e) {
        console.warn("[auto-enrich] embeddings failed (non-blocking):", e);
      }
    }

    // Save enrichment log
    await supabase.from("knowledge_enrichment_log" as any).insert({
      sources_refreshed: stats.sources_refreshed,
      new_discovered: stats.new_discovered,
      auto_ingested: stats.auto_ingested,
      pending_review: stats.pending_review,
      rejected: stats.rejected,
      cost_usd: stats.cost_usd,
      details: { ingested: ingestedDocs, pending: pendingDocs },
    });

    // ═══════════════════════════════════════════════════════════
    // EMAIL NOTIFICATION — Envoyer un récap à l'admin
    // ═══════════════════════════════════════════════════════════
    if (stats.new_discovered > 0) {
      const pendingList = pendingDocs.length > 0
        ? pendingDocs.map(d => `<li><strong>${d.title}</strong> (score: ${d.score}/10)<br/><em>${d.source || 'Source inconnue'}</em><br/>${d.summary}...</li>`).join("")
        : "<li>Aucun document en attente</li>";

      const ingestedList = ingestedDocs.length > 0
        ? ingestedDocs.map(d => `<li>✅ ${d.title} (score: ${d.score}/10) — ${d.source}</li>`).join("")
        : "<li>Aucun document auto-ingéré</li>";

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a2744;">🔄 ESONO — Enrichissement KB hebdomadaire</h2>
          <p>Récap du run du ${now.toLocaleDateString('fr-FR')} :</p>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background: #f8f9fa;"><td style="padding: 8px; border: 1px solid #dee2e6;">Sources rafraîchies</td><td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; font-weight: bold;">${stats.sources_refreshed}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #dee2e6;">Nouveaux documents découverts</td><td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; font-weight: bold;">${stats.new_discovered}</td></tr>
            <tr style="background: #d4edda;"><td style="padding: 8px; border: 1px solid #dee2e6;">Auto-ingérés (score ≥7)</td><td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; font-weight: bold; color: #155724;">${stats.auto_ingested}</td></tr>
            <tr style="background: #fff3cd;"><td style="padding: 8px; border: 1px solid #dee2e6;">⏳ En attente de validation</td><td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; font-weight: bold; color: #856404;">${stats.pending_review}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #dee2e6;">Rejetés (score &lt;5)</td><td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${stats.rejected}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #dee2e6;">Coût estimé</td><td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">$${stats.cost_usd.toFixed(2)}</td></tr>
          </table>

          ${stats.pending_review > 0 ? `
          <h3 style="color: #856404;">⏳ Documents en attente de votre validation (${stats.pending_review})</h3>
          <ul>${pendingList}</ul>
          <p style="margin: 16px 0;">
            <a href="${Deno.env.get("APP_URL") || "https://esono.tech"}/admin/knowledge-review"
               style="background: #1a2744; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Valider les documents
            </a>
          </p>
          ` : ''}

          ${stats.auto_ingested > 0 ? `
          <h3 style="color: #155724;">✅ Documents auto-ingérés (${stats.auto_ingested})</h3>
          <ul>${ingestedList}</ul>
          ` : ''}

          <p style="color: #999; font-size: 11px; margin-top: 24px;">
            — ESONO Auto-Enrichissement • Budget: $${stats.cost_usd.toFixed(2)} / $${MAX_COST_USD} max
          </p>
        </div>
      `;

      // Send email notification
      try {
        // Notification recipients: configured email + super_admins
        const KB_NOTIFY_EMAIL = Deno.env.get("KB_NOTIFY_EMAIL") || "philippeyace@hotmail.fr";
        const recipients = new Set<string>([KB_NOTIFY_EMAIL]);

        // Also add super_admin emails
        const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
        const adminIds = (adminRoles || []).map((r: any) => r.user_id);
        if (adminIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("email").in("user_id", adminIds);
          for (const p of profiles || []) {
            if (p.email) recipients.add(p.email);
          }
        }

        for (const email of recipients) {
          await supabase.functions.invoke("send-email", {
            body: {
              to: email,
              subject: `ESONO KB — ${stats.pending_review} doc(s) en attente de validation | ${stats.auto_ingested} auto-ingéré(s)`,
              html: emailHtml,
            },
          });
        }
      } catch (emailErr) {
        console.warn("[auto-enrich] Email notification failed (non-blocking):", emailErr);
      }
    }

    // Activity log
    await supabase.from("activity_log").insert({
      action: "auto_enrich_knowledge",
      actor_role: "system",
      metadata: stats,
    }).catch(() => {});

    // Cost log
    if (stats.cost_usd > 0) {
      await supabase.from("ai_cost_log").insert({
        function_name: "auto-enrich-knowledge",
        model: MODEL,
        input_tokens: Math.round(stats.new_discovered * 500),
        output_tokens: Math.round(stats.new_discovered * 800),
        cost_usd: stats.cost_usd,
      }).catch(() => {});
    }

    console.log("[auto-enrich] Complete:", stats);
    return jsonResponse({ success: true, ...stats });

  } catch (err: any) {
    console.error("[auto-enrich-knowledge] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});
