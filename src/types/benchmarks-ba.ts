// src/types/benchmarks-ba.ts
// Types pour la feature benchmarks_sectoriels BA (Ordre 10).

export interface SectorBenchmark {
  id: string;
  secteur: string;
  pays: string | null;
  zone: string | null;
  marge_brute_min: number | null;
  marge_brute_max: number | null;
  marge_brute_mediane: number | null;
  marge_ebitda_min: number | null;
  marge_ebitda_max: number | null;
  marge_nette_min: number | null;
  marge_nette_max: number | null;
  ratio_personnel_ca_min: number | null;
  ratio_personnel_ca_max: number | null;
  ratio_charges_fixes_ca_min: number | null;
  ratio_charges_fixes_ca_max: number | null;
  croissance_ca_max: number | null;
  multiple_ebitda_min: number | null;
  multiple_ebitda_max: number | null;
  multiple_ca_min: number | null;
  multiple_ca_max: number | null;
  source: string | null;
  source_url: string | null;
  source_type: string | null;
  date_source: string | null;
  perimetre: string | null;
  notes: string | null;
  date_mise_a_jour: string | null;
}

/** Position du deal vs médiane sectorielle. */
export type RatioStatus = 'above' | 'around' | 'below' | 'unknown';

export interface RatioRow {
  label: string;
  /** Valeur entreprise (null si pas encore saisie via §7/§8 Memo). */
  company: number | null;
  /** Médiane sectorielle (null si pas dans knowledge_benchmarks). */
  median: number | null;
  min: number | null;
  max: number | null;
  /** Format affichage : %, x (multiple), absolu. */
  format: 'pct' | 'multiple' | 'absolute';
  status: RatioStatus;
}

/** Helper : compare valeur entreprise à fourchette sectorielle. */
export function computeRatioStatus(
  company: number | null,
  min: number | null,
  max: number | null,
): RatioStatus {
  if (company == null || (min == null && max == null)) return 'unknown';
  if (max != null && company > max) return 'above';
  if (min != null && company < min) return 'below';
  return 'around';
}

/** Construit les 5 ratios standards depuis un benchmark + données entreprise (optionnelles). */
export function buildRatioRows(
  benchmark: SectorBenchmark | null,
  companyFinancials?: {
    marge_brute_pct?: number | null;
    marge_ebitda_pct?: number | null;
    marge_nette_pct?: number | null;
    croissance_ca_pct?: number | null;
    ratio_personnel_ca_pct?: number | null;
  },
): RatioRow[] {
  const cf = companyFinancials ?? {};
  return [
    {
      label: 'Marge brute',
      company: cf.marge_brute_pct ?? null,
      median: benchmark?.marge_brute_mediane ?? null,
      min: benchmark?.marge_brute_min ?? null,
      max: benchmark?.marge_brute_max ?? null,
      format: 'pct',
      status: computeRatioStatus(cf.marge_brute_pct ?? null, benchmark?.marge_brute_min ?? null, benchmark?.marge_brute_max ?? null),
    },
    {
      label: 'Marge EBITDA',
      company: cf.marge_ebitda_pct ?? null,
      median: null,
      min: benchmark?.marge_ebitda_min ?? null,
      max: benchmark?.marge_ebitda_max ?? null,
      format: 'pct',
      status: computeRatioStatus(cf.marge_ebitda_pct ?? null, benchmark?.marge_ebitda_min ?? null, benchmark?.marge_ebitda_max ?? null),
    },
    {
      label: 'Marge nette',
      company: cf.marge_nette_pct ?? null,
      median: null,
      min: benchmark?.marge_nette_min ?? null,
      max: benchmark?.marge_nette_max ?? null,
      format: 'pct',
      status: computeRatioStatus(cf.marge_nette_pct ?? null, benchmark?.marge_nette_min ?? null, benchmark?.marge_nette_max ?? null),
    },
    {
      label: 'Croissance CA',
      company: cf.croissance_ca_pct ?? null,
      median: null,
      min: null,
      max: benchmark?.croissance_ca_max ?? null,
      format: 'pct',
      status: computeRatioStatus(cf.croissance_ca_pct ?? null, null, benchmark?.croissance_ca_max ?? null),
    },
    {
      label: 'Ratio personnel / CA',
      company: cf.ratio_personnel_ca_pct ?? null,
      median: null,
      min: benchmark?.ratio_personnel_ca_min ?? null,
      max: benchmark?.ratio_personnel_ca_max ?? null,
      format: 'pct',
      status: computeRatioStatus(cf.ratio_personnel_ca_pct ?? null, benchmark?.ratio_personnel_ca_min ?? null, benchmark?.ratio_personnel_ca_max ?? null),
    },
  ];
}
