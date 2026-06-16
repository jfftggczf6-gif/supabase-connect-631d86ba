/**
 * Adapts the plan_financier output format to the OVO Excel fill format.
 *
 * IMPORTANT: This function passes through the data as-is, keeping "produits"
 * in French. The Python adapter on Railway (plan_financier_adapter.py) handles
 * the actual v2→v1 conversion with per_year mapping.
 *
 * DO NOT convert produits→products here — it would bypass Railway's adapter
 * and lose the per_year data.
 */
// Valeurs EXACTES de la liste déroulante pays du template OVO
// (CountryList = TableReadMeCountry[Reference], noms FR majuscules). La cellule
// pays (J6) a une data-validation sur cette liste : toute autre valeur → #ERROR!.
// Couvre les pays présents dans le template. Les pays absents (Mali, Niger,
// Guinée, Gabon, Congo-Brazza…) ne sont PAS dans la liste → à étendre côté template.
const OVO_COUNTRY_LIST: Record<string, string> = {
  benin: "BÉNIN",
  "burkina faso": "BURKINA FASO", burkina: "BURKINA FASO",
  burundi: "BURUNDI",
  cameroun: "CAMEROUN", cameroon: "CAMEROUN",
  rdc: "RÉPUBLIQUE DÉMOCRATIQUE DU CONGO",
  "republique democratique du congo": "RÉPUBLIQUE DÉMOCRATIQUE DU CONGO",
  "rd congo": "RÉPUBLIQUE DÉMOCRATIQUE DU CONGO",
  "dr congo": "RÉPUBLIQUE DÉMOCRATIQUE DU CONGO",
  "congo (rdc)": "RÉPUBLIQUE DÉMOCRATIQUE DU CONGO",
  ethiopie: "ÉTHIOPIE", ethiopia: "ÉTHIOPIE",
  philippines: "PHILIPPINES",
  haiti: "HAÏTI",
  "cote d'ivoire": "CÔTE D'IVOIRE", "côte d'ivoire": "CÔTE D'IVOIRE", "cote divoire": "CÔTE D'IVOIRE", "ivory coast": "CÔTE D'IVOIRE",
  kenya: "KENYA",
  madagascar: "MADAGASCAR",
  malawi: "MALAWI",
  rwanda: "RWANDA",
  senegal: "SÉNÉGAL",
  tanzanie: "TANZANIE", tanzania: "TANZANIE",
  togo: "TOGO",
};

/** Normalise un nom de pays vers la valeur EXACTE du dropdown OVO. Si le pays
 *  n'est pas dans la liste du template, renvoie la valeur d'origine (et le front
 *  affichera une erreur de validation → signal qu'il faut étendre la liste). */
export function mapCountryToOvoList(country: string | null | undefined): string {
  const raw = (country || "").trim();
  if (!raw) return raw;
  const norm = raw.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // retire les accents pour le lookup
    .replace(/\s+/g, " ");
  return OVO_COUNTRY_LIST[norm] || raw;
}

export function adaptPlanFinancierToOvoFormat(plan: any): any {
  if (!plan || typeof plan !== 'object') return plan;
  // Pass through as-is — Railway's adapter handles the conversion.
  // Exception : on normalise le pays vers la valeur exacte du dropdown OVO
  // (sinon la data-validation de la cellule pays renvoie #ERROR!).
  return { ...plan, country: mapCountryToOvoList(plan.country) };
}
