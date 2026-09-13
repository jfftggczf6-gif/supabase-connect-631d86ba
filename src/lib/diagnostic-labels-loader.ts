// Chargement du référentiel de libellés depuis Supabase.
//
// Séparé de diagnostic-labels.ts pour que la logique pure (normalisation,
// comparaison, habillage) reste importable sans instancier de client Supabase —
// sinon le seul import du module déclenche un rafraîchissement de session et
// pollue les tests en environnement Node.

import { supabase } from '@/integrations/supabase/client';
import type { DiagnosticLabelRow } from './diagnostic-labels';

let cache: DiagnosticLabelRow[] | null = null;
let inflight: Promise<DiagnosticLabelRow[]> | null = null;

export async function loadDiagnosticLabels(): Promise<DiagnosticLabelRow[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = Promise.resolve(supabase
    .from('diagnostic_labels')
    .select('key, category, fr, en, match_fr')
    .then(({ data, error }) => {
      inflight = null;
      if (error) {
        console.warn('[diagnostic-labels] chargement échoué:', error.message);
        return [];
      }
      cache = (data as DiagnosticLabelRow[]) || [];
      return cache;
    }));
  return inflight;
}

/** Vide le cache — utile en test et après édition du référentiel. */
export function resetDiagnosticLabelsCache(): void {
  cache = null;
  inflight = null;
}

