/**
 * Post-generation validator — vérifie la cohérence des données AVANT sauvegarde.
 * Pas d'appel IA — vérifie uniquement les invariants mathématiques/SYSCOHADA.
 * Retourne les données corrigées + un rapport de validation.
 */

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  auto_corrected: boolean;
  original_value?: any;
  corrected_value?: any;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  corrections_applied: number;
  confidence_adjustment: number;
}

export function validateFinancialData(data: any, _country?: string, _sector?: string): ValidationReport {
  const issues: ValidationIssue[] = [];
  let corrections = 0;

  // ═══ INVARIANT 1: Bilan équilibré ═══
  if (data.bilan) {
    const b = data.bilan;
    const totalActif = (b.immobilisations || 0) + (b.stocks || 0) + (b.creances_clients || 0) + (b.tresorerie_actif || b.tresorerie || 0);
    const totalPassif = (b.capitaux_propres || 0) + (b.dettes_financieres || b.dettes_lt || 0) + (b.dettes_fournisseurs || b.fournisseurs || 0) + (b.dettes_ct || 0);

    if (totalActif > 0 && totalPassif > 0) {
      const ecart = Math.abs(totalActif - totalPassif);
      const ecartPct = (ecart / Math.max(totalActif, totalPassif)) * 100;
      if (ecartPct > 2) {
        issues.push({
          severity: 'error',
          field: 'bilan',
          message: `Bilan déséquilibré : Actif ${totalActif.toLocaleString()} ≠ Passif ${totalPassif.toLocaleString()} (écart ${ecartPct.toFixed(1)}%)`,
          auto_corrected: false,
        });
      }
    }
  }

  // ═══ INVARIANT 2: Marge brute ≤ CA ═══
  if (data.compte_resultat) {
    const cr = data.compte_resultat;
    const ca = cr.chiffre_affaires || 0;
    const achats = cr.achats_matieres || 0;
    const margeBrute = ca - achats;

    if (ca > 0 && margeBrute > ca) {
      issues.push({
        severity: 'error',
        field: 'compte_resultat.achats_matieres',
        message: `Marge brute (${margeBrute.toLocaleString()}) supérieure au CA (${ca.toLocaleString()}) — achats négatifs impossibles`,
        auto_corrected: false,
      });
    }

    if (ca > 0 && achats < 0) {
      data.compte_resultat.achats_matieres = 0;
      corrections++;
      issues.push({
        severity: 'warning',
        field: 'compte_resultat.achats_matieres',
        message: 'Achats négatifs corrigés à 0',
        auto_corrected: true,
        original_value: achats,
        corrected_value: 0,
      });
    }

    // Résultat net > EBITDA = impossible
    const ebitda = (cr.resultat_exploitation || 0) + (cr.dotations_amortissements || 0);
    const resultatNet = cr.resultat_net || 0;
    if (ebitda > 0 && resultatNet > ebitda * 1.05) {
      issues.push({
        severity: 'error',
        field: 'compte_resultat.resultat_net',
        message: `Résultat net (${resultatNet.toLocaleString()}) supérieur à l'EBITDA (${ebitda.toLocaleString()}) — IS et charges financières non déduits`,
        auto_corrected: false,
      });
    }
  }

  // ═══ INVARIANT 3: Marges dans les bornes ═══
  if (data.kpis || data.sante_financiere) {
    const margeBrute = data.kpis?.marge_brute_pct || data.sante_financiere?.marge_brute_pct;
    if (margeBrute != null) {
      if (margeBrute > 95) {
        issues.push({
          severity: 'warning',
          field: 'kpis.marge_brute_pct',
          message: `Marge brute de ${margeBrute}% irréaliste (>95%)`,
          auto_corrected: false,
        });
      }
      if (margeBrute < 0) {
        issues.push({
          severity: 'error',
          field: 'kpis.marge_brute_pct',
          message: `Marge brute négative (${margeBrute}%) — vérifier CA et coûts`,
          auto_corrected: false,
        });
      }
    }
  }

  // ═══ INVARIANT 4: Valorisation cohérente ═══
  if (data.dcf && data.multiples) {
    const dcfValue = data.dcf.equity_value || 0;
    const multiplesValue = data.multiples.valeur_moyenne_multiples || 0;
    if (dcfValue > 0 && multiplesValue > 0) {
      const ratio = dcfValue / multiplesValue;
      if (ratio > 3 || ratio < 0.33) {
        issues.push({
          severity: 'warning',
          field: 'valorisation',
          message: `Écart >3× entre DCF (${dcfValue.toLocaleString()}) et Multiples (${multiplesValue.toLocaleString()}) — vérifier hypothèses`,
          auto_corrected: false,
        });
      }
    }

    // WACC minimum pour PME Afrique
    const wacc = data.dcf.wacc_pct || 0;
    if (wacc > 0 && wacc < 14) {
      const correctedWacc = 16;
      data.dcf.wacc_pct = correctedWacc;
      corrections++;
      issues.push({
        severity: 'error',
        field: 'dcf.wacc_pct',
        message: `WACC de ${wacc}% trop bas pour PME Afrique — corrigé à ${correctedWacc}%`,
        auto_corrected: true,
        original_value: wacc,
        corrected_value: correctedWacc,
      });
    }
  }

  // ═══ INVARIANT 5: Charges personnel vs effectifs ═══
  if (data.compte_resultat && data.effectifs) {
    const chargesPerso = data.compte_resultat.charges_personnel || 0;
    const effectifTotal = data.effectifs.total || 0;
    if (effectifTotal > 0 && chargesPerso === 0) {
      issues.push({
        severity: 'warning',
        field: 'compte_resultat.charges_personnel',
        message: `${effectifTotal} employés déclarés mais charges personnel à 0`,
        auto_corrected: false,
      });
    }
    if (effectifTotal > 0 && chargesPerso > 0) {
      const salaireParEmploye = chargesPerso / effectifTotal / 12;
      if (salaireParEmploye < 30000) {
        issues.push({
          severity: 'warning',
          field: 'compte_resultat.charges_personnel',
          message: `Salaire moyen mensuel ${Math.round(salaireParEmploye).toLocaleString()} FCFA — inférieur au SMIG`,
          auto_corrected: false,
        });
      }
    }
  }

  // ═══ INVARIANT 6: Valeurs négatives impossibles ═══
  const nonNegativeFields = [
    'compte_resultat.chiffre_affaires',
    'effectifs.total',
    'bilan.immobilisations',
    'bilan.stocks',
  ];
  for (const fieldPath of nonNegativeFields) {
    const parts = fieldPath.split('.');
    let val: any = data;
    for (const p of parts) val = val?.[p];
    if (val != null && val < 0) {
      issues.push({
        severity: 'warning',
        field: fieldPath,
        message: `Valeur négative (${val}) corrigée à 0`,
        auto_corrected: true,
        original_value: val,
        corrected_value: 0,
      });
      let ref: any = data;
      for (let i = 0; i < parts.length - 1; i++) ref = ref[parts[i]];
      ref[parts[parts.length - 1]] = 0;
      corrections++;
    }
  }

  // ═══ INVARIANT 7: Projections cascade P&L ═══
  if (data.scenarios) {
    for (const scenarioKey of ['realiste', 'optimiste', 'pessimiste']) {
      const scenario = data.scenarios?.[scenarioKey];
      if (!scenario) continue;
      for (const yearKey of ['an1', 'an2', 'an3', 'an4', 'an5']) {
        const y = scenario[yearKey];
        if (!y) continue;
        const ca = y.ca_total || y.chiffre_affaires || 0;
        const mb = y.marge_brute || 0;
        if (ca > 0 && mb > ca * 1.05) {
          issues.push({
            severity: 'error',
            field: `scenarios.${scenarioKey}.${yearKey}.marge_brute`,
            message: `${scenarioKey}/${yearKey}: Marge brute (${mb.toLocaleString()}) > CA (${ca.toLocaleString()})`,
            auto_corrected: false,
          });
        }
      }
    }
  }

  const confidenceAdjustment = -(
    issues.filter(i => i.severity === 'error').length * 10 +
    issues.filter(i => i.severity === 'warning').length * 3
  );

  return {
    valid: issues.filter(i => i.severity === 'error' && !i.auto_corrected).length === 0,
    issues,
    corrections_applied: corrections,
    confidence_adjustment: confidenceAdjustment,
  };
}

/**
 * Validate and attach report to deliverable data.
 * Called by every agent between callAI and saveDeliverable.
 */
export function validateAndEnrich(data: any, country?: string, sector?: string): any {
  const report = validateFinancialData(data, country, sector);

  data._validation = {
    valid: report.valid,
    issues_count: report.issues.length,
    errors: report.issues.filter(i => i.severity === 'error').length,
    warnings: report.issues.filter(i => i.severity === 'warning').length,
    corrections_applied: report.corrections_applied,
    issues: report.issues,
    validated_at: new Date().toISOString(),
  };

  if (data.score != null && report.confidence_adjustment !== 0) {
    data._validation.original_score = data.score;
    data.score = Math.max(0, Math.min(100, data.score + report.confidence_adjustment));
  }

  return data;
}
