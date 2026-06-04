// Brief 0.12 — QA inter-livrables : compare chaque deliverable vs canonical.
// Tolérance 0.5% → warning, > 10% → critical.
// Met à jour enterprise_financial_canonical.coherence_validated/warnings/last_check_at.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers_v5.ts";

interface Divergence {
  deliverable: string;
  field_path: string;
  value_in_deliverable: number;
  canonical_value: number;
  divergence_pct: number;
  severity: "warning" | "critical";
}

interface FieldCheck {
  field_path: string;
  canonical_field: string;
  value: number;
}

const TOLERANCE_PCT = 0.005; // 0.5%
const CRITICAL_PCT = 0.10; // 10%

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { enterprise_id } = body || {};
    if (!enterprise_id) {
      return new Response(
        JSON.stringify({ error: "enterprise_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Lire canonical
    const { data: canonical, error: canonicalErr } = await supabase
      .from("enterprise_financial_canonical")
      .select("*")
      .eq("enterprise_id", enterprise_id)
      .maybeSingle();

    if (canonicalErr) throw canonicalErr;
    if (!canonical) {
      return new Response(
        JSON.stringify({ error: "Fiche canonique absente", divergences: [] }),
        { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Lire tous les deliverables de l'entreprise
    const { data: deliverables, error: delivErr } = await supabase
      .from("deliverables")
      .select("type, data")
      .eq("enterprise_id", enterprise_id);

    if (delivErr) throw delivErr;

    const divergences: Divergence[] = [];

    // 3. Pour chaque livrable, extraire chiffres et comparer
    for (const deliv of deliverables || []) {
      const checks = extractFinancialMentions(deliv.type, deliv.data);
      for (const check of checks) {
        const canonicalValue = readCanonicalField(canonical, check.canonical_field);
        if (canonicalValue === null || canonicalValue === undefined) continue;
        if (check.value === null || check.value === undefined || !Number.isFinite(check.value)) continue;

        const div = canonicalValue !== 0
          ? Math.abs((check.value - canonicalValue) / canonicalValue)
          : (check.value === 0 ? 0 : 1);

        if (div > TOLERANCE_PCT) {
          divergences.push({
            deliverable: deliv.type,
            field_path: check.field_path,
            value_in_deliverable: check.value,
            canonical_value: canonicalValue,
            divergence_pct: Math.round(div * 1000) / 10,
            severity: div > CRITICAL_PCT ? "critical" : "warning",
          });
        }
      }
    }

    const criticalCount = divergences.filter((d) => d.severity === "critical").length;

    // 4. Update canonical (mapping vers schéma CoherenceWarning : rule/severity/message/fields)
    const coherenceWarnings = divergences.map((d) => ({
      rule: `inter_${d.deliverable}_${d.field_path}`,
      severity: d.severity === "critical" ? "error" : "warning",
      message: `${d.deliverable}.${d.field_path} = ${d.value_in_deliverable} vs canonical = ${d.canonical_value} (Δ ${d.divergence_pct}%)`,
      fields: [d.field_path],
    }));

    const { error: updErr } = await supabase
      .from("enterprise_financial_canonical")
      .update({
        coherence_validated: criticalCount === 0,
        coherence_warnings: coherenceWarnings,
        coherence_last_check_at: new Date().toISOString(),
      })
      .eq("enterprise_id", enterprise_id);

    if (updErr) {
      console.error("[validate-coherence] update canonical failed:", updErr);
    }

    console.log(
      `[validate-coherence] enterprise=${enterprise_id} divergences=${divergences.length} critical=${criticalCount}`,
    );

    return new Response(
      JSON.stringify({
        enterprise_id,
        canonical_version: canonical.version,
        divergences_count: divergences.length,
        critical_count: criticalCount,
        coherence_validated: criticalCount === 0,
        divergences,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[validate-coherence] error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Erreur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Lit un champ canonical, en supportant la notation pointée pour les JSONB
 * imbriqués (ex: `ca_projected.y1` → canonical.ca_projected?.y1).
 */
function readCanonicalField(canonical: any, key: string): number | null | undefined {
  if (!key) return undefined;
  if (!key.includes(".")) return canonical?.[key];
  const parts = key.split(".");
  let v: any = canonical;
  for (const p of parts) {
    if (v == null) return undefined;
    v = v[p];
  }
  return v;
}

/**
 * Extrait les chiffres financiers d'un deliverable et indique à quel champ
 * canonical ils doivent être comparés.
 */
function extractFinancialMentions(type: string, data: any): FieldCheck[] {
  const mentions: FieldCheck[] = [];
  if (!data || typeof data !== "object") return mentions;

  switch (type) {
    case "plan_financier": {
      const ind = data?.indicateurs_decision || {};
      if (ind.tri !== undefined && ind.tri !== null)
        mentions.push({ field_path: "indicateurs_decision.tri", canonical_field: "tri_pct", value: Number(ind.tri) });
      if (ind.van !== undefined && ind.van !== null)
        mentions.push({ field_path: "indicateurs_decision.van", canonical_field: "van", value: Number(ind.van) });
      if (ind.payback_years !== undefined && ind.payback_years !== null)
        mentions.push({ field_path: "indicateurs_decision.payback_years", canonical_field: "payback_years", value: Number(ind.payback_years) });
      if (ind.dscr_moyen !== undefined && ind.dscr_moyen !== null)
        mentions.push({ field_path: "indicateurs_decision.dscr_moyen", canonical_field: "dscr_moyen", value: Number(ind.dscr_moyen) });
      if (ind.roi !== undefined && ind.roi !== null)
        mentions.push({ field_path: "indicateurs_decision.roi", canonical_field: "roi_pct", value: Number(ind.roi) });
      if (ind.runway_mois !== undefined && ind.runway_mois !== null)
        mentions.push({ field_path: "indicateurs_decision.runway_mois", canonical_field: "runway_mois", value: Number(ind.runway_mois) });
      break;
    }

    case "valuation": {
      const dcf = data?.dcf || {};
      if (dcf.wacc_pct !== undefined && dcf.wacc_pct !== null)
        mentions.push({ field_path: "dcf.wacc_pct", canonical_field: "wacc_pct", value: Number(dcf.wacc_pct) });
      if (dcf.equity_value !== undefined && dcf.equity_value !== null)
        mentions.push({ field_path: "dcf.equity_value", canonical_field: "equity_value_dcf", value: Number(dcf.equity_value) });
      if (dcf.enterprise_value !== undefined && dcf.enterprise_value !== null)
        mentions.push({ field_path: "dcf.enterprise_value", canonical_field: "enterprise_value_dcf", value: Number(dcf.enterprise_value) });

      const synth = data?.synthese_valorisation || {};
      if (synth.valeur_mediane !== undefined && synth.valeur_mediane !== null)
        mentions.push({ field_path: "synthese_valorisation.valeur_mediane", canonical_field: "valorisation_mediane", value: Number(synth.valeur_mediane) });
      if (synth.valeur_basse !== undefined && synth.valeur_basse !== null)
        mentions.push({ field_path: "synthese_valorisation.valeur_basse", canonical_field: "valorisation_basse", value: Number(synth.valeur_basse) });
      if (synth.valeur_haute !== undefined && synth.valeur_haute !== null)
        mentions.push({ field_path: "synthese_valorisation.valeur_haute", canonical_field: "valorisation_haute", value: Number(synth.valeur_haute) });
      break;
    }

    case "investment_memo": {
      const val = data?.valorisation || {};
      if (val.wacc_utilise_pct !== undefined && val.wacc_utilise_pct !== null)
        mentions.push({ field_path: "valorisation.wacc_utilise_pct", canonical_field: "wacc_pct", value: Number(val.wacc_utilise_pct) });
      if (val.fourchette?.mediane !== undefined && val.fourchette?.mediane !== null)
        mentions.push({ field_path: "valorisation.fourchette.mediane", canonical_field: "valorisation_mediane", value: Number(val.fourchette.mediane) });
      if (val.fourchette?.basse !== undefined && val.fourchette?.basse !== null)
        mentions.push({ field_path: "valorisation.fourchette.basse", canonical_field: "valorisation_basse", value: Number(val.fourchette.basse) });
      if (val.fourchette?.haute !== undefined && val.fourchette?.haute !== null)
        mentions.push({ field_path: "valorisation.fourchette.haute", canonical_field: "valorisation_haute", value: Number(val.fourchette.haute) });
      if (val.equity_value_dcf !== undefined && val.equity_value_dcf !== null)
        mentions.push({ field_path: "valorisation.equity_value_dcf", canonical_field: "equity_value_dcf", value: Number(val.equity_value_dcf) });

      const ratios = data?.analyse_financiere?.ratios_cles || {};
      if (ratios && typeof ratios === "object") {
        if (ratios.tri_pct !== undefined && ratios.tri_pct !== null)
          mentions.push({ field_path: "analyse_financiere.ratios_cles.tri_pct", canonical_field: "tri_pct", value: Number(ratios.tri_pct) });
        if (ratios.van !== undefined && ratios.van !== null)
          mentions.push({ field_path: "analyse_financiere.ratios_cles.van", canonical_field: "van", value: Number(ratios.van) });
      }
      break;
    }

    case "business_plan": {
      const ca_y1 = parseFcfa(data?.financier_tableau?.annee1?.revenu);
      if (ca_y1 != null) mentions.push({ field_path: "financier_tableau.annee1.revenu", canonical_field: "ca_projected.y1", value: ca_y1 });
      const ca_y2 = parseFcfa(data?.financier_tableau?.annee2?.revenu);
      if (ca_y2 != null) mentions.push({ field_path: "financier_tableau.annee2.revenu", canonical_field: "ca_projected.y2", value: ca_y2 });
      const ca_y3 = parseFcfa(data?.financier_tableau?.annee3?.revenu);
      if (ca_y3 != null) mentions.push({ field_path: "financier_tableau.annee3.revenu", canonical_field: "ca_projected.y3", value: ca_y3 });
      const ebitda_y1 = parseFcfa(data?.financier_tableau?.annee1?.marge_brute);
      if (ebitda_y1 != null) mentions.push({ field_path: "financier_tableau.annee1.marge_brute", canonical_field: "ebitda_projected.y1", value: ebitda_y1 });
      const total_besoin = parseFcfa(data?.financier_tableau?.annee1?.total);
      if (total_besoin != null) mentions.push({ field_path: "financier_tableau.annee1.total", canonical_field: "besoin_financement_total", value: total_besoin });
      break;
    }

    case "onepager": {
      const kpis = data?.kpis_financiers || {};
      if (kpis.tri_pct !== undefined && kpis.tri_pct !== null)
        mentions.push({ field_path: "kpis_financiers.tri_pct", canonical_field: "tri_pct", value: Number(kpis.tri_pct) });
      if (kpis.van !== undefined && kpis.van !== null)
        mentions.push({ field_path: "kpis_financiers.van", canonical_field: "van", value: Number(kpis.van) });
      if (kpis.ca_actuel !== undefined && kpis.ca_actuel !== null)
        mentions.push({ field_path: "kpis_financiers.ca_actuel", canonical_field: "ca_y", value: Number(kpis.ca_actuel) });
      if (kpis.ebitda_actuel !== undefined && kpis.ebitda_actuel !== null)
        mentions.push({ field_path: "kpis_financiers.ebitda_actuel", canonical_field: "ebitda_y", value: Number(kpis.ebitda_actuel) });

      const vi = data?.valorisation_indicative || {};
      if (vi.fourchette_mediane !== undefined && vi.fourchette_mediane !== null)
        mentions.push({ field_path: "valorisation_indicative.fourchette_mediane", canonical_field: "valorisation_mediane", value: Number(vi.fourchette_mediane) });
      if (vi.fourchette_basse !== undefined && vi.fourchette_basse !== null)
        mentions.push({ field_path: "valorisation_indicative.fourchette_basse", canonical_field: "valorisation_basse", value: Number(vi.fourchette_basse) });
      if (vi.fourchette_haute !== undefined && vi.fourchette_haute !== null)
        mentions.push({ field_path: "valorisation_indicative.fourchette_haute", canonical_field: "valorisation_haute", value: Number(vi.fourchette_haute) });

      const fr = data?.financement_recherche || {};
      if (fr.montant !== undefined && fr.montant !== null)
        mentions.push({ field_path: "financement_recherche.montant", canonical_field: "besoin_financement_total", value: Number(fr.montant) });
      break;
    }
  }

  return mentions.filter((m) => Number.isFinite(m.value));
}

/** Parse "20 000 000 FCFA" → 20000000. Supporte virgule décimale française. */
function parseFcfa(str: string | number | undefined | null): number | null {
  if (str === null || str === undefined) return null;
  if (typeof str === "number") return Number.isFinite(str) ? str : null;
  const cleaned = String(str).replace(/[  \s]/g, "");
  const match = cleaned.match(/-?[\d.,]+/);
  if (!match) return null;
  const numStr = match[0].replace(/,/g, ".");
  const n = parseFloat(numStr);
  return Number.isFinite(n) ? n : null;
}
