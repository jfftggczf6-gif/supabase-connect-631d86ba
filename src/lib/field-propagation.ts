import { supabase } from '@/integrations/supabase/client';

/**
 * Maps a correction in one deliverable to equivalent fields in other deliverables.
 * Key = "sourceType.fieldPath", Value = array of { type, fieldPath } targets.
 *
 * Only numerical/structured fields are mapped here.
 * Text fields are handled separately via stale text detection.
 */
export const FIELD_PROPAGATION_MAP: Record<string, { type: string; fieldPath: string }[]> = {
  // ── CA (Chiffre d'Affaires) ──
  'inputs_data.compte_resultat.chiffre_affaires': [
    { type: 'plan_financier', fieldPath: 'compte_resultat_reel.chiffre_affaires' },
    { type: 'valuation', fieldPath: 'dcf.chiffre_affaires' },
    { type: 'business_plan', fieldPath: 'financier_tableau.annee1.revenu' },
  ],
  // ── Marge brute ──
  'inputs_data.compte_resultat.marge_brute': [
    { type: 'plan_financier', fieldPath: 'compte_resultat_reel.marge_brute' },
    { type: 'valuation', fieldPath: 'dcf.marge_brute' },
    { type: 'business_plan', fieldPath: 'financier_tableau.annee1.marge_brute' },
  ],
  // ── Résultat net ──
  'inputs_data.compte_resultat.resultat_net': [
    { type: 'plan_financier', fieldPath: 'compte_resultat_reel.resultat_net' },
    { type: 'business_plan', fieldPath: 'financier_tableau.annee1.benefice_net' },
  ],
  // ── Charges d'exploitation ──
  'inputs_data.compte_resultat.charges_exploitation': [
    { type: 'plan_financier', fieldPath: 'compte_resultat_reel.charges_exploitation' },
    { type: 'business_plan', fieldPath: 'financier_tableau.annee1.depenses' },
  ],
  // ── Effectifs ──
  'inputs_data.effectifs.nombre_total': [
    { type: 'plan_financier', fieldPath: 'staff.total' },
  ],
  // ── Bilan ──
  'inputs_data.bilan.total_actif': [
    { type: 'valuation', fieldPath: 'dcf.total_actif' },
  ],
  'inputs_data.bilan.capitaux_propres': [
    { type: 'valuation', fieldPath: 'dcf.capitaux_propres' },
  ],
  'inputs_data.bilan.dettes_financieres': [
    { type: 'valuation', fieldPath: 'dcf.dettes_financieres' },
  ],
  // ── Plan financier → aval ──
  'plan_financier.scenarios.optimiste.ca_annee1': [
    { type: 'business_plan', fieldPath: 'financier_tableau.annee1.revenu' },
  ],
  'plan_financier.seuil_rentabilite.montant': [
    { type: 'valuation', fieldPath: 'dcf.seuil_rentabilite' },
  ],
  // ── Valuation → aval ──
  'valuation.synthese_valorisation.valeur_centrale': [
    { type: 'onepager', fieldPath: 'valorisation_indicative.valeur' },
    { type: 'investment_memo', fieldPath: 'valorisation.valeur_centrale' },
  ],
  'valuation.synthese_valorisation.fourchette_basse': [
    { type: 'investment_memo', fieldPath: 'valorisation.fourchette_basse' },
  ],
  'valuation.synthese_valorisation.fourchette_haute': [
    { type: 'investment_memo', fieldPath: 'valorisation.fourchette_haute' },
  ],
};

/**
 * Fields that contain narrative text which may cite numerical values.
 * When a number changes, we scan these fields for the old value to flag them as stale.
 */
const TEXT_FIELDS_TO_SCAN: { type: string; fieldPaths: string[] }[] = [
  {
    type: 'business_plan',
    fieldPaths: [
      'resume_gestion', 'description_generale', 'historique',
      'modele_revenus_depenses', 'investissement_plan', 'financement_plan',
      'avenir', 'impact_economique',
    ],
  },
  {
    type: 'investment_memo',
    fieldPaths: [
      'resume_executif', 'these_investissement',
      'analyse_financiere', 'recommandation_finale',
    ],
  },
  {
    type: 'onepager',
    fieldPaths: [
      'presentation_entreprise', 'proposition_valeur',
      'traction_finances', 'besoin_financement',
    ],
  },
];

/** Resolve a nested field path to get its value */
function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let ref = obj;
  for (const part of parts) {
    if (ref == null || typeof ref !== 'object') return undefined;
    ref = ref[part];
  }
  return ref;
}

/** Set a nested field path value */
function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let ref = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!ref[parts[i]] || typeof ref[parts[i]] !== 'object') ref[parts[i]] = {};
    ref = ref[parts[i]];
  }
  ref[parts[parts.length - 1]] = value;
}

/** Format a number for text search (handles "30 000 000", "30000000", "30M") */
function numberVariants(val: any): string[] {
  const n = Number(val);
  if (isNaN(n) || n === 0) return [];
  const variants: string[] = [
    String(n),
    n.toLocaleString('fr-FR'),
  ];
  if (n >= 1_000_000) {
    variants.push(`${(n / 1_000_000).toFixed(0)}M`);
    variants.push(`${(n / 1_000_000).toFixed(1)}M`);
    variants.push(`${(n / 1_000_000).toLocaleString('fr-FR')} millions`);
  }
  if (n >= 1_000) {
    variants.push(`${(n / 1_000).toFixed(0)} 000`);
  }
  return variants;
}

export interface PropagationResult {
  /** Champs numériques mis à jour directement */
  propagated: { type: string; fieldPath: string }[];
  /** Champs texte contenant l'ancienne valeur (à reformuler) */
  staleTexts: { type: string; fieldPath: string; deliverableId: string; excerpt: string }[];
}

/**
 * Propagates a correction from one deliverable to all related fields in other deliverables.
 * Returns which fields were updated and which texts are stale.
 */
export async function propagateCorrection(
  enterpriseId: string,
  sourceType: string,
  fieldPath: string,
  oldValue: any,
  newValue: any,
): Promise<PropagationResult> {
  const mapKey = `${sourceType}.${fieldPath}`;
  const targets = FIELD_PROPAGATION_MAP[mapKey] || [];
  const result: PropagationResult = { propagated: [], staleTexts: [] };

  if (targets.length === 0 && typeof oldValue === 'number') {
    // Even without explicit mapping, scan text fields for old value
  }

  // Fetch all deliverables for this enterprise
  const { data: allDeliverables } = await supabase
    .from('deliverables')
    .select('id, type, data')
    .eq('enterprise_id', enterpriseId);

  if (!allDeliverables) return result;

  const delivByType = new Map(allDeliverables.map((d: any) => [d.type, d]));

  // 1. Propagate numerical values to mapped fields
  for (const target of targets) {
    const deliv = delivByType.get(target.type);
    if (!deliv?.data) continue;

    const newData = { ...(deliv.data as any) };
    setNestedValue(newData, target.fieldPath, newValue);

    await supabase.from('deliverables')
      .update({ data: newData })
      .eq('id', deliv.id);

    // Also record as a correction for traceability
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('deliverable_corrections').insert({
      enterprise_id: enterpriseId,
      deliverable_id: deliv.id,
      deliverable_type: target.type,
      corrected_by: user?.id,
      field_path: target.fieldPath,
      original_value: getNestedValue(deliv.data as any, target.fieldPath),
      corrected_value: newValue,
      correction_reason: `Propagation automatique depuis ${sourceType}.${fieldPath}`,
    } as any).catch(() => {});

    result.propagated.push({ type: target.type, fieldPath: target.fieldPath });
  }

  // 2. Scan text fields for old value references
  const oldVariants = numberVariants(oldValue);
  if (oldVariants.length > 0) {
    for (const textConfig of TEXT_FIELDS_TO_SCAN) {
      const deliv = delivByType.get(textConfig.type);
      if (!deliv?.data) continue;

      for (const fp of textConfig.fieldPaths) {
        const textVal = getNestedValue(deliv.data as any, fp);
        if (typeof textVal !== 'string') continue;

        const found = oldVariants.some(v => textVal.includes(v));
        if (found) {
          // Extract a short excerpt around the old value
          const variant = oldVariants.find(v => textVal.includes(v)) || '';
          const idx = textVal.indexOf(variant);
          const start = Math.max(0, idx - 40);
          const end = Math.min(textVal.length, idx + variant.length + 40);
          const excerpt = (start > 0 ? '...' : '') + textVal.slice(start, end) + (end < textVal.length ? '...' : '');

          result.staleTexts.push({
            type: textConfig.type,
            fieldPath: fp,
            deliverableId: deliv.id,
            excerpt,
          });
        }
      }
    }
  }

  return result;
}
