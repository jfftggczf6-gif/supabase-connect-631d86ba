/**
 * canonical-financials.ts
 *
 * Helper d'accès à la table enterprise_financial_canonical (SSOT financière).
 *
 * Brief 0.5 — Refonte SSOT.
 *
 * Convention d'écriture STRICTE :
 * - generate-plan-financier écrit historique + projections + composition besoin
 * - generate-valuation écrit WACC + valorisations DCF/multiples + indicateurs
 *   décision (VAN, TRI, payback, DSCR, ROI)
 * - Tout autre agent qui appelle upsert avec une source non-autorisée lève.
 *
 * Lecture libre pour les agents en aval (memo, onepager, business_plan, etc.).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── PROJECTIONS Y+1 → Y+5 ───────────────────────────────────────────
export interface ProjectionsY5 {
  y1?: number;
  y2?: number;
  y3?: number;
  y4?: number;
  y5?: number;
}

// ─── COMPOSITION du besoin de financement (JSONB) ────────────────────
export interface CompositionBesoin {
  ovo?: number;
  banques_locales?: number;
  prets_etrangers?: number;
  apport_capital?: number;
  subventions?: number;
  autres?: number;
}

// ─── COMPOSANTS du WACC (JSONB) ──────────────────────────────────────
export interface WaccComponents {
  risk_free_rate?: number;
  equity_risk_premium?: number;
  size_premium?: number;
  illiquidity_premium?: number;
  country_risk_premium?: number;
  cost_of_equity?: number;
  cost_of_debt?: number;
  debt_to_capital?: number;
  tax_rate?: number;
  beta?: number;
}

// ─── SOURCE des deliverables ayant alimenté la fiche ────────────────
export interface SourceDeliverablesMeta {
  plan_financier_id?: string;
  plan_financier_at?: string;
  valuation_id?: string;
  valuation_at?: string;
}

// ─── COHÉRENCE (rempli par brief 0.12) ──────────────────────────────
export interface CoherenceWarning {
  rule: string;
  severity: "info" | "warning" | "error";
  message: string;
  fields?: string[];
}

/**
 * Représentation typée d'une ligne enterprise_financial_canonical.
 * Strictement alignée avec le schéma SQL — tout champ non-NOT NULL est nullable.
 */
export interface CanonicalFinancials {
  enterprise_id: string;

  // Devise & contexte
  currency: string;
  currency_iso: string;
  base_year: number;
  zone_monetaire: string | null;

  // Historique
  ca_y_minus_2: number | null;
  ca_y_minus_1: number | null;
  ca_y: number | null;
  ebitda_y_minus_2: number | null;
  ebitda_y_minus_1: number | null;
  ebitda_y: number | null;
  resultat_net_y_minus_2: number | null;
  resultat_net_y_minus_1: number | null;
  resultat_net_y: number | null;
  tresorerie_actuelle: number | null;
  dette_financiere_actuelle: number | null;
  capitaux_propres_actuels: number | null;

  // Projections
  ca_projected: ProjectionsY5 | null;
  ebitda_projected: ProjectionsY5 | null;
  cashflow_projected: ProjectionsY5 | null;
  resultat_net_projected: ProjectionsY5 | null;
  inflation_used: number | null;

  // Valorisation
  wacc_pct: number | null;
  wacc_components: WaccComponents | null;
  wacc_capped: boolean | null;
  wacc_raw: number | null;
  equity_value_dcf: number | null;
  enterprise_value_dcf: number | null;
  terminal_value: number | null;
  multiple_ebitda_retenu: number | null;
  multiple_ca_retenu: number | null;
  valeur_par_ebitda: number | null;
  valeur_par_ca: number | null;
  valorisation_basse: number | null;
  valorisation_mediane: number | null;
  valorisation_haute: number | null;
  methode_privilegiee: string | null;

  // Investissement
  besoin_financement_total: number | null;
  capex_prevu: number | null;
  bfr_initial: number | null;
  restructuration_dette: number | null;
  financement_deja_obtenu: number | null;
  composition_besoin: CompositionBesoin | null;

  // Indicateurs de décision
  van: number | null;
  tri_pct: number | null;
  payback_years: number | null;
  dscr_moyen: number | null;
  duree_pret_utilisee_dscr: number | null;
  roi_pct: number | null;
  runway_mois: number | null;
  couverture_interets: number | null;
  cycle_tresorerie_jours: number | null;

  // Métadonnées
  last_updated_by: string;
  last_updated_at: string;
  version: number;
  source_deliverables: SourceDeliverablesMeta | null;

  // Validation cohérence (brief 0.12)
  coherence_validated: boolean;
  coherence_warnings: CoherenceWarning[] | null;
  coherence_last_check_at: string | null;
}

/** Sources autorisées à écrire dans enterprise_financial_canonical. */
export type CanonicalSource = "generate-plan-financier" | "generate-valuation";

const ALLOWED_SOURCES: readonly CanonicalSource[] = [
  "generate-plan-financier",
  "generate-valuation",
] as const;

/**
 * Lit la fiche canonical d'une entreprise. Retourne null si aucune fiche
 * n'existe encore (entreprise non encore canonicalisée).
 */
export async function getCanonicalFinancials(
  supabase: SupabaseClient,
  enterpriseId: string,
): Promise<CanonicalFinancials | null> {
  if (!enterpriseId) return null;
  const { data, error } = await supabase
    .from("enterprise_financial_canonical")
    .select("*")
    .eq("enterprise_id", enterpriseId)
    .maybeSingle();
  if (error) {
    console.error("[canonical-financials] getCanonicalFinancials error:", error.message);
    return null;
  }
  return (data as CanonicalFinancials | null) ?? null;
}

/**
 * Upsert (insert ou update) la fiche canonical d'une entreprise.
 *
 * `source` contrôle qui écrit — toute autre valeur lève. Ce verrou empêche
 * un agent en aval (memo, onepager) de polluer la SSOT par accident.
 *
 * Le champ `last_updated_by` est forcé à la valeur de `source`. Le trigger
 * SQL `update_efc_timestamp` incrémente la version automatiquement.
 */
export async function upsertCanonicalFinancials(
  supabase: SupabaseClient,
  enterpriseId: string,
  data: Partial<Omit<CanonicalFinancials, "enterprise_id" | "last_updated_by" | "last_updated_at" | "version">>,
  source: CanonicalSource,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  if (!ALLOWED_SOURCES.includes(source)) {
    return { ok: false, error: `Source non autorisée: ${source}. Valides: ${ALLOWED_SOURCES.join(", ")}` };
  }
  if (!enterpriseId) {
    return { ok: false, error: "enterprise_id requis" };
  }

  const payload = {
    enterprise_id: enterpriseId,
    ...data,
    last_updated_by: source,
  };

  const { data: row, error } = await supabase
    .from("enterprise_financial_canonical")
    .upsert(payload, { onConflict: "enterprise_id" })
    .select("version")
    .single();

  if (error || !row) {
    return { ok: false, error: error?.message || "upsert failed" };
  }
  return { ok: true, version: (row as any).version as number };
}

/**
 * Formatte la fiche canonical en bloc texte injectable dans un prompt LLM.
 *
 * Inclut une consigne d'instruction ABSOLUE en tête : "NE PAS recalculer,
 * NE PAS inventer". C'est ce bloc que les agents memo/onepager/business-plan
 * insèrent dans leurs system prompts pour garantir la cohérence des chiffres
 * cités.
 *
 * Si la fiche est null (entreprise non encore canonicalisée), retourne un
 * message neutre invitant à régénérer plan_financier + valuation.
 */
export function formatCanonicalForPrompt(canonical: CanonicalFinancials | null): string {
  if (!canonical) {
    return [
      "══════ DONNÉES FINANCIÈRES CANONICAL ══════",
      "(aucune fiche canonical pour cette entreprise — régénérer plan_financier",
      "et valuation pour la peupler. En attendant, raisonner avec prudence sur",
      "les chiffres absolus et privilégier les ratios/proportions.)",
      "══════ FIN ══════",
    ].join("\n");
  }

  const cur = canonical.currency || canonical.currency_iso || "";
  const fmt = (n: number | null | undefined) =>
    n == null || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  const pct = (n: number | null | undefined) =>
    n == null || isNaN(Number(n)) ? "—" : `${Number(n).toFixed(1)}%`;

  const proj = (label: string, p: ProjectionsY5 | null) => {
    if (!p) return `${label}: —`;
    const parts = (["y1", "y2", "y3", "y4", "y5"] as const)
      .map((k) => (p[k] != null ? `${k.toUpperCase()}=${fmt(p[k]!)}` : null))
      .filter(Boolean);
    return parts.length ? `${label}: ${parts.join(" | ")}` : `${label}: —`;
  };

  const lines: string[] = [];
  lines.push("══════ DONNÉES FINANCIÈRES CANONICAL (SOURCE DE VÉRITÉ) ══════");
  lines.push(`⚠️ INSTRUCTION ABSOLUE : NE PAS recalculer ces chiffres. NE PAS inventer de variantes.`);
  lines.push(`   Cite ces valeurs EXACTEMENT. Toute divergence sera rejetée par la QA.`);
  lines.push("");
  lines.push(`Devise: ${cur} | Année de base: ${canonical.base_year}${canonical.zone_monetaire ? ` | Zone: ${canonical.zone_monetaire}` : ""}`);
  lines.push(`Version: ${canonical.version} | Dernière MAJ: ${canonical.last_updated_at} par ${canonical.last_updated_by}`);
  lines.push("");
  lines.push("── HISTORIQUE ──");
  lines.push(`CA       Y-2=${fmt(canonical.ca_y_minus_2)} | Y-1=${fmt(canonical.ca_y_minus_1)} | Y=${fmt(canonical.ca_y)} (${cur})`);
  lines.push(`EBITDA   Y-2=${fmt(canonical.ebitda_y_minus_2)} | Y-1=${fmt(canonical.ebitda_y_minus_1)} | Y=${fmt(canonical.ebitda_y)}`);
  lines.push(`Résultat Y-2=${fmt(canonical.resultat_net_y_minus_2)} | Y-1=${fmt(canonical.resultat_net_y_minus_1)} | Y=${fmt(canonical.resultat_net_y)}`);
  lines.push(`Trésorerie actuelle: ${fmt(canonical.tresorerie_actuelle)} | Dette: ${fmt(canonical.dette_financiere_actuelle)} | Cap. propres: ${fmt(canonical.capitaux_propres_actuels)}`);
  lines.push("");
  lines.push("── PROJECTIONS 5 ANS ──");
  lines.push(proj("CA       ", canonical.ca_projected));
  lines.push(proj("EBITDA   ", canonical.ebitda_projected));
  lines.push(proj("Cash flow", canonical.cashflow_projected));
  lines.push(proj("Résultat ", canonical.resultat_net_projected));
  if (canonical.inflation_used != null) lines.push(`Inflation utilisée: ${pct(canonical.inflation_used)}/an`);
  lines.push("");
  lines.push("── VALORISATION ──");
  lines.push(`WACC: ${pct(canonical.wacc_pct)}${canonical.wacc_capped ? " (CAPÉ — brut=" + pct(canonical.wacc_raw) + ")" : ""}`);
  lines.push(`DCF — Equity value: ${fmt(canonical.equity_value_dcf)} | Enterprise value: ${fmt(canonical.enterprise_value_dcf)} | Terminal: ${fmt(canonical.terminal_value)}`);
  lines.push(`Multiples — EV/EBITDA retenu: ${canonical.multiple_ebitda_retenu ?? "—"}× → ${fmt(canonical.valeur_par_ebitda)} | EV/CA: ${canonical.multiple_ca_retenu ?? "—"}× → ${fmt(canonical.valeur_par_ca)}`);
  lines.push(`Fourchette: bas=${fmt(canonical.valorisation_basse)} | médiane=${fmt(canonical.valorisation_mediane)} | haut=${fmt(canonical.valorisation_haute)}`);
  if (canonical.methode_privilegiee) lines.push(`Méthode privilégiée: ${canonical.methode_privilegiee}`);
  lines.push("");
  lines.push("── INVESTISSEMENT ──");
  lines.push(`Besoin total: ${fmt(canonical.besoin_financement_total)} | CAPEX: ${fmt(canonical.capex_prevu)} | BFR: ${fmt(canonical.bfr_initial)}`);
  lines.push(`Restructuration dette: ${fmt(canonical.restructuration_dette)} | Déjà obtenu: ${fmt(canonical.financement_deja_obtenu)}`);
  if (canonical.composition_besoin) {
    const cb = canonical.composition_besoin;
    const compo = (["ovo", "banques_locales", "prets_etrangers", "apport_capital", "subventions", "autres"] as const)
      .map((k) => (cb[k] != null ? `${k}=${fmt(cb[k]!)}` : null))
      .filter(Boolean)
      .join(" | ");
    if (compo) lines.push(`Composition: ${compo}`);
  }
  lines.push("");
  lines.push("── INDICATEURS DE DÉCISION ──");
  lines.push(`VAN: ${fmt(canonical.van)} | TRI: ${pct(canonical.tri_pct)} | Payback: ${canonical.payback_years != null ? canonical.payback_years.toFixed(1) + " ans" : "—"}`);
  lines.push(`DSCR moyen: ${canonical.dscr_moyen != null ? canonical.dscr_moyen.toFixed(2) + "×" : "—"} sur ${canonical.duree_pret_utilisee_dscr ?? "—"} ans | ROI: ${pct(canonical.roi_pct)}`);
  lines.push(`Runway: ${canonical.runway_mois != null ? canonical.runway_mois.toFixed(1) + " mois" : "—"} | Couverture intérêts: ${canonical.couverture_interets != null ? canonical.couverture_interets.toFixed(2) + "×" : "—"} | Cycle trésorerie: ${canonical.cycle_tresorerie_jours != null ? canonical.cycle_tresorerie_jours.toFixed(0) + " j" : "—"}`);
  lines.push("══════ FIN CANONICAL ══════");

  return lines.join("\n");
}
