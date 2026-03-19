// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers.ts";

interface MacroEntry {
  category: string;
  title: string;
  content: string;
  source: string;
  country: string | null;
  sector: string | null;
  tags: string[];
  expires_at: string;
}

async function fetchWorldBankIndicator(indicator: string, countries: string[]): Promise<any[]> {
  const countryCodes = countries.join(";");
  const url = `https://api.worldbank.org/v2/country/${countryCodes}/indicator/${indicator}?format=json&date=2022:2025&per_page=100`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data[1] || [];
  } catch {
    return [];
  }
}

async function buildMacroEntries(): Promise<MacroEntry[]> {
  const entries: MacroEntry[] = [];
  const expiresIn3Months = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const expiresIn1Month = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const wbCountries = ["CIV", "SEN", "BFA", "MLI", "BEN", "TGO", "NER", "CMR", "COD", "GIN"];
  const countryNames: Record<string, string> = {
    CIV: "Côte d'Ivoire", SEN: "Sénégal", BFA: "Burkina Faso", MLI: "Mali",
    BEN: "Bénin", TGO: "Togo", NER: "Niger", CMR: "Cameroun", COD: "RDC", GIN: "Guinée"
  };

  // GDP growth
  const gdpGrowth = await fetchWorldBankIndicator("NY.GDP.MKTP.KD.ZG", wbCountries);
  if (gdpGrowth.length > 0) {
    const byCountry: Record<string, any[]> = {};
    for (const d of gdpGrowth) {
      if (!d.value) continue;
      const c = d.countryiso3code;
      if (!byCountry[c]) byCountry[c] = [];
      byCountry[c].push({ year: d.date, value: parseFloat(d.value).toFixed(1) });
    }
    for (const [code, values] of Object.entries(byCountry)) {
      const name = countryNames[code] || code;
      const sorted = values.sort((a: any, b: any) => b.year - a.year);
      entries.push({
        category: "benchmarks",
        title: `PIB et croissance — ${name} (auto-refresh)`,
        content: `Croissance PIB réel — ${name}:\n${sorted.map((v: any) => `  ${v.year}: ${v.value}%`).join("\n")}\nSource: Banque Mondiale, indicateur NY.GDP.MKTP.KD.ZG\nDernière mise à jour: ${new Date().toISOString().split("T")[0]}`,
        source: "World Bank Open Data API",
        country: name, sector: null,
        tags: ["macro", "pib", "croissance", "auto_refresh"],
        expires_at: expiresIn3Months,
      });
    }
  }

  // Inflation
  const inflation = await fetchWorldBankIndicator("FP.CPI.TOTL.ZG", wbCountries);
  if (inflation.length > 0) {
    const byCountry: Record<string, any[]> = {};
    for (const d of inflation) {
      if (!d.value) continue;
      const c = d.countryiso3code;
      if (!byCountry[c]) byCountry[c] = [];
      byCountry[c].push({ year: d.date, value: parseFloat(d.value).toFixed(1) });
    }
    for (const [code, values] of Object.entries(byCountry)) {
      const name = countryNames[code] || code;
      const sorted = values.sort((a: any, b: any) => b.year - a.year);
      entries.push({
        category: "benchmarks",
        title: `Inflation (IPC) — ${name} (auto-refresh)`,
        content: `Taux d'inflation annuel — ${name}:\n${sorted.map((v: any) => `  ${v.year}: ${v.value}%`).join("\n")}\nSource: Banque Mondiale, indicateur FP.CPI.TOTL.ZG`,
        source: "World Bank Open Data API",
        country: name, sector: null,
        tags: ["macro", "inflation", "auto_refresh"],
        expires_at: expiresIn3Months,
      });
    }
  }

  // BCEAO rates (static)
  entries.push({
    category: "fiscal",
    title: "Taux directeurs BCEAO/BEAC (auto-refresh)",
    content: `Taux directeurs — Mise à jour ${new Date().toISOString().split("T")[0]}:
BCEAO (UEMOA):
  Taux de prêt marginal: 5.50%
  Taux minimum de soumission: 3.50%
  Taux d'usure: ~15% (variable trimestriel)
  Réserves obligatoires: 3%

BEAC (CEMAC):
  Taux d'intérêt des appels d'offres: 5.00%
  Taux de la facilité de prêt marginal: 6.75%
  Taux de pénalité: 8.50%

Impact PME: Le taux bancaire PME typique est taux directeur + 5-9 points de spread.`,
    source: "BCEAO Bulletin statistique + BEAC rapports",
    country: null, sector: null,
    tags: ["taux", "bceao", "beac", "bancaire", "auto_refresh"],
    expires_at: expiresIn1Month,
  });

  // Commodity prices (static)
  entries.push({
    category: "benchmarks",
    title: "Cours matières premières Afrique Ouest (auto-refresh)",
    content: `Cours indicatifs — ${new Date().toISOString().split("T")[0]}:
Cacao: ~8000-10000 USD/tonne (marché historiquement haut depuis 2024)
Café robusta: ~4000-5500 USD/tonne
Coton: ~0.80-0.95 USD/livre
Or: ~2500-2800 USD/once
Caoutchouc naturel: ~1.60-2.10 USD/kg
Anacarde (cajou brut): ~1000-1500 USD/tonne
Huile de palme: ~900-1100 USD/tonne
Riz importé (brisure): ~450-550 USD/tonne CIF Abidjan

Impact PME:
- Agro-exportateurs: marges directement liées aux cours mondiaux
- Importateurs alimentaires: coûts intrants sensibles au USD/XOF
- Transformation locale: marge = prix local - cours mondial × taux change`,
    source: "World Bank Commodity Markets / Bloomberg indicatif",
    country: null, sector: null,
    tags: ["matieres_premieres", "cours", "cacao", "auto_refresh"],
    expires_at: expiresIn1Month,
  });

  return entries;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const newEntries = await buildMacroEntries();

    // Delete expired auto-refresh entries
    await sb.from("knowledge_base").delete().eq("auto_refresh", true).lt("expires_at", new Date().toISOString());

    let inserted = 0;
    let updated = 0;
    for (const entry of newEntries) {
      const { data: existing } = await sb.from("knowledge_base").select("id").eq("title", entry.title).maybeSingle();

      if (existing) {
        await sb.from("knowledge_base").update({
          content: entry.content,
          source: entry.source,
          metadata: { auto_refresh: true, refreshed_at: new Date().toISOString() },
          auto_refresh: true,
          expires_at: entry.expires_at,
          last_refreshed_at: new Date().toISOString(),
          embedding: null,
        }).eq("id", existing.id);
        updated++;
      } else {
        await sb.from("knowledge_base").insert({
          ...entry,
          auto_refresh: true,
          metadata: { auto_refresh: true, created_at: new Date().toISOString() },
        });
        inserted++;
      }
    }

    // Trigger embedding backfill
    try {
      await fetch(`${supabaseUrl}/functions/v1/generate-embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ mode: "backfill" }),
      });
    } catch (e) {
      console.warn("Embedding backfill trigger failed (non-blocking):", e);
    }

    return new Response(JSON.stringify({
      success: true, inserted, updated, total_entries: newEntries.length,
      refreshed_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("refresh-macro-data error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
