// Sector list matching the 20 guardrails in financial-knowledge.ts
// Labels are human-readable French names for display

export const SECTORS = [
  { value: 'agro_industrie', label: 'Agro-industrie' },
  { value: 'aviculture', label: 'Aviculture' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'agriculture_rente', label: "Agriculture de rente" },
  { value: 'commerce_detail', label: 'Commerce de détail' },
  { value: 'commerce_alimentaire', label: 'Commerce alimentaire' },
  { value: 'restauration', label: 'Restauration' },
  { value: 'services_b2b', label: 'Services B2B' },
  { value: 'tic', label: 'TIC / Télécommunications' },
  { value: 'services_it', label: 'Services IT' },
  { value: 'imprimerie', label: 'Imprimerie' },
  { value: 'energie', label: 'Énergie' },
  { value: 'sante', label: 'Santé' },
  { value: 'btp', label: 'BTP / Construction' },
  { value: 'industrie_manufacturiere', label: 'Industrie manufacturière' },
  { value: 'transport_logistique', label: 'Transport & Logistique' },
  { value: 'education_formation', label: 'Éducation & Formation' },
  { value: 'immobilier', label: 'Immobilier' },
  { value: 'textile_mode', label: 'Textile & Mode' },
  { value: 'mines_extraction', label: 'Mines & Extraction' },
] as const;

export type SectorValue = typeof SECTORS[number]['value'];
