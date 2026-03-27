// risk-detector.ts — Détection de risques terrain à partir des données financières
// Les seuils et définitions viennent de la table knowledge_risk_factors (couche 2)

interface RiskFlag {
  code: string;
  severity: string;
  titre: string;
  constat: string;
  correction: string;
}

interface FinancialData {
  salaire_dirigeant?: number;
  ebitda?: number;
  ca?: number;
  marge_ebitda_pct?: number;
  tresorerie?: number;
  dettes_fournisseurs?: number;
  capitaux_propres?: number;
  capital_social?: number;
  top_client_pct?: number;
  top_3_clients_pct?: number;
  croissance_ca_pct?: number;
  has_audit_externe?: boolean;
  has_pv_ag?: boolean;
  has_conseil_admin?: boolean;
  has_daf?: boolean;
  country_risk_premium?: number;
  derniere_declaration_fiscale_mois?: number;
}

/**
 * Détecte les risques terrain à partir des données financières de l'entreprise
 * et des risk factors chargés depuis la BDD.
 */
export function detectRisks(
  data: FinancialData,
  riskFactors: Array<{ code: string; categorie: string; titre: string; description: string; signaux: any; correction: string; severity: string }>
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  for (const rf of riskFactors) {
    const detected = checkRiskFactor(rf.code, data);
    if (detected) {
      flags.push({
        code: rf.code,
        severity: rf.severity,
        titre: rf.titre,
        constat: detected,
        correction: rf.correction || '',
      });
    }
  }

  return flags.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
}

function severityOrder(s: string): number {
  switch (s) {
    case 'critical': return 0;
    case 'high': return 1;
    case 'medium': return 2;
    case 'low': return 3;
    default: return 4;
  }
}

function checkRiskFactor(code: string, d: FinancialData): string | null {
  switch (code) {
    case 'ebitda_no_salary':
      if ((d.salaire_dirigeant === 0 || d.salaire_dirigeant == null) && d.ebitda && d.ca && (d.ebitda / d.ca) > 0.15) {
        return `EBITDA de ${((d.ebitda / d.ca) * 100).toFixed(1)}% du CA sans rémunération dirigeant déclarée. L'EBITDA réel est potentiellement surévalué.`;
      }
      return null;

    case 'cash_invisible':
      if (d.tresorerie != null && d.ca && d.ca > 0 && d.tresorerie < d.ca * 0.02 && d.tresorerie >= 0) {
        return `Trésorerie très faible (${d.tresorerie?.toLocaleString('fr-FR')}) vs CA de ${d.ca?.toLocaleString('fr-FR')}. Possible cash non bancaire.`;
      }
      return null;

    case 'dette_cachee_fournisseurs':
      if (d.dettes_fournisseurs != null && d.ca && d.dettes_fournisseurs === 0 && d.ca > 50_000_000) {
        return `Aucune dette fournisseurs déclarée malgré un CA de ${d.ca?.toLocaleString('fr-FR')}. Suspect : vérifier les engagements hors bilan.`;
      }
      return null;

    case 'concentration_client':
      if (d.top_client_pct != null && d.top_client_pct > 40) {
        return `Client principal = ${d.top_client_pct}% du CA. Dépendance dangereuse.`;
      }
      if (d.top_3_clients_pct != null && d.top_3_clients_pct > 70) {
        return `Top 3 clients = ${d.top_3_clients_pct}% du CA. Diversification insuffisante.`;
      }
      return null;

    case 'croissance_artificielle':
      if (d.croissance_ca_pct != null && d.croissance_ca_pct > 50) {
        return `Croissance CA de ${d.croissance_ca_pct.toFixed(0)}%/an. Vérifier si organique ou artificielle.`;
      }
      return null;

    case 'homme_cle':
      if (d.has_daf === false) {
        return `Pas de DAF/DG distinct identifié. Risque homme-clé élevé.`;
      }
      return null;

    case 'gouvernance_faible':
      if (d.has_audit_externe === false && d.has_pv_ag === false) {
        return `Ni audit externe ni PV d'AG. Gouvernance minimale absente.`;
      }
      return null;

    case 'sous_capitalisation':
      if (d.capitaux_propres != null && d.capital_social != null && d.capitaux_propres < d.capital_social / 2) {
        return `Capitaux propres (${d.capitaux_propres?.toLocaleString('fr-FR')}) < 50% du capital social. Sous-capitalisation OHADA.`;
      }
      return null;

    case 'arrieres_fiscaux':
      if (d.derniere_declaration_fiscale_mois != null && d.derniere_declaration_fiscale_mois > 12) {
        return `Dernière déclaration fiscale il y a ${d.derniere_declaration_fiscale_mois} mois. Risque d'arriérés.`;
      }
      return null;

    case 'risque_pays':
      if (d.country_risk_premium != null && d.country_risk_premium > 12) {
        return `Prime de risque pays de ${d.country_risk_premium}%. Contexte sécuritaire/politique pesant.`;
      }
      return null;

    default:
      return null;
  }
}

/**
 * Construit un bloc texte de risques détectés pour injection dans un prompt IA
 */
export function buildRiskBlock(flags: RiskFlag[]): string {
  if (flags.length === 0) return '';

  const lines = flags.map(f =>
    `- [${f.severity.toUpperCase()}] ${f.titre}: ${f.constat}\n  → ${f.correction}`
  );

  return `\n══════ RISQUES TERRAIN DÉTECTÉS ══════\n${lines.join('\n')}\n══════ FIN RISQUES ══════\n`;
}
