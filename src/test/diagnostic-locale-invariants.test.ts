// Invariance fr/en du diagnostic de candidature.
//
// Ce test DOIT passer trivialement. S'il échoue, ce n'est pas qu'il faut le
// corriger : c'est qu'un chemin regénère ou déplace une valeur déterministe
// lors d'un changement de langue.
//
// Le dispositif repose sur une seule idée : le déterministe n'est jamais transmis
// au modèle de rendu. `extractProse` ne retient que PROSE_PATHS ; `mergeProse` ne
// réécrit que ces mêmes chemins sur la source. Il n'existe donc aucun chemin par
// lequel un score, un montant ou un statut pourrait changer avec la langue.

import { describe, it, expect } from 'vitest';
import {
  PROSE_PATHS,
  DETERMINISTIC_PATHS,
  extractProse,
  mergeProse,
  diagnosticForLocale,
} from '@/lib/diagnostic-prose';
import { PROSE_PATHS as EDGE_PROSE_PATHS } from '../../supabase/functions/_shared/diagnostic-prose';
import { normalizeEnum, enumIs, enumIncludes, buildLookup } from '@/lib/diagnostic-labels';

/** Diagnostic de référence : structure réelle, valeurs déterministes marquées. */
const SCREENING = {
  score: 62,
  classification: 'POTENTIEL',
  resume_comite: 'Dossier solide porté par une dirigeante expérimentée. CA 22 289 209 FCFA en 2025.',
  resume_executif: {
    synthese: 'Entreprise agroalimentaire en croissance de 84,39 % sur deux ans.',
    points_forts: ['Croissance CA 84,39 %', 'Ancrage local fort'],
    points_faibles: ['Comptabilité externalisée'],
    potentiel_estime: 'Fort sur le marché sous-régional.',
  },
  fiche_entreprise: {
    anciennete_ans: 4, ca_declare: 22289209, ca_devise: 'XOF', effectif_declare: 12,
    stade: 'Croissance (2-5 ans)', description_activite: 'Transformation d\'épices locales.',
  },
  diagnostic_dimensions: {
    maturite_business: { score: 65, label: 'En croissance', constats: ['Trois exercices documentés'], donnees_manquantes: [] },
    capacite_financiere: { score: 58, label: 'Correcte', constats: ['Marge brute stable'], donnees_manquantes: ['Détail des charges'] },
  },
  indicateurs_financiers: {
    ca_annuel: 22289209, croissance_ca_pct: 33.8, marge_estimee_pct: 21.4,
    rentabilite: 'Rentable', tresorerie_estimee: 'Tendue', niveau_endettement: 'Modéré',
    fiabilite: 'Moyenne', source_donnees: 'États financiers 2023-2025',
    commentaire: 'Progression régulière mais trésorerie sous tension.',
  },
  cross_validation: {
    ca_coherent: true, ca_declared: 22289209, ca_from_documents: 22289209, ca_ecart_pct: 0,
    ca_detail: 'Le CA déclaré correspond aux états financiers.',
    bilan_equilibre: true, bilan_detail: 'Bilan équilibré.',
  },
  qualite_dossier: {
    score_qualite: 72, total_documents: 8, documents_exploitables: 7, documents_illisibles: 1,
    niveau_preuve: 'N2 Intermediaire', note_qualite: 'Dossier bien documenté côté financier.',
  },
  besoin_financement: {
    montant_demande: 15000000, montant_devise: 'XOF', coherence_vs_ca: 'Cohérent',
    type_adapte: 'Prêt', capacite_absorption: 'Bonne',
    utilisation_prevue: ['Équipements de séchage'], commentaire: 'Demande proportionnée.',
  },
  incoherences_detectees: [
    { observation: 'Effectif déclaré supérieur aux charges de personnel.', severite: 'ATTENTION' },
    { observation: 'Aucun justificatif de propriété du local.', severite: 'BLOQUANT' },
  ],
  risques_programme: [
    { risque: 'Concentration client', type: 'concentration', probabilite: 'moyenne', impact_programme: 'Modéré', mitigation: 'Diversifier' },
  ],
  traction: { anciennete: '4 ans', evolution_ca: '+84,39 %', preuves_tangibles: ['Factures 2025'], niveau_preuve: 'Partiel' },
  recommandation_accompagnement: {
    avis: 'FAVORABLE SOUS RÉSERVE', justification: 'Trésorerie à sécuriser avant décaissement.',
    priorites_si_selectionnee: ['Structurer la comptabilité'], conditions_prealables: [],
    potentiel_6_mois: 'Bon', profil_coach_ideal: 'Expert agroalimentaire',
  },
} as const;

/** Rendu anglais plausible : SEULE la prose est traduite. */
const RENDER_EN = {
  resume_comite: 'Solid application led by an experienced founder. Revenue XOF 22,289,209 in 2025.',
  resume_executif: {
    synthese: 'Food-processing business growing 84.39% over two years.',
    points_forts: ['Revenue growth 84.39%', 'Strong local roots'],
    points_faibles: ['Outsourced accounting'],
    potentiel_estime: 'Strong across the sub-regional market.',
  },
  fiche_entreprise: { description_activite: 'Processing of local spices.' },
  diagnostic_dimensions: {
    maturite_business: { constats: ['Three documented financial years'], donnees_manquantes: [] },
    capacite_financiere: { constats: ['Stable gross margin'], donnees_manquantes: ['Cost breakdown'] },
  },
  indicateurs_financiers: {
    source_donnees: 'Financial statements 2023-2025',
    commentaire: 'Steady growth but cash position under strain.',
  },
  cross_validation: {
    ca_detail: 'Declared revenue matches the financial statements.',
    bilan_detail: 'Balance sheet balanced.',
  },
  qualite_dossier: { note_qualite: 'Well documented on the financial side.' },
  besoin_financement: { utilisation_prevue: ['Drying equipment'], commentaire: 'Proportionate request.' },
  incoherences_detectees: [
    { observation: 'Declared headcount exceeds payroll costs.' },
    { observation: 'No proof of ownership for the premises.' },
  ],
  risques_programme: [{ risque: 'Customer concentration', impact_programme: 'Moderate', mitigation: 'Diversify' }],
  traction: { anciennete: '4 years', evolution_ca: '+84.39%', preuves_tangibles: ['2025 invoices'] },
  recommandation_accompagnement: {
    justification: 'Cash position to be secured before disbursement.',
    priorites_si_selectionnee: ['Formalise accounting'], conditions_prealables: [],
    potentiel_6_mois: 'Good', profil_coach_ideal: 'Food-processing expert',
  },
};

function get(obj: any, path: string): any {
  return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

describe('invariance fr/en du diagnostic', () => {
  const fr = diagnosticForLocale(SCREENING, 'fr', null);
  const en = diagnosticForLocale(SCREENING, 'en', { prose: RENDER_EN });

  it('score identique', () => {
    expect(en.score).toBe(fr.score);
    expect(en.score).toBe(62);
  });

  it('statut / classification / avis identiques', () => {
    expect(en.classification).toBe(fr.classification);
    expect(en.recommandation_accompagnement.avis).toBe(fr.recommandation_accompagnement.avis);
    expect(en.recommandation_accompagnement.avis).toBe('FAVORABLE SOUS RÉSERVE');
  });

  it('montants identiques', () => {
    expect(en.besoin_financement.montant_demande).toBe(15000000);
    expect(en.besoin_financement.montant_demande).toBe(fr.besoin_financement.montant_demande);
    expect(en.indicateurs_financiers.ca_annuel).toBe(fr.indicateurs_financiers.ca_annuel);
    expect(en.cross_validation.ca_from_documents).toBe(fr.cross_validation.ca_from_documents);
    expect(en.fiche_entreprise.ca_declare).toBe(fr.fiche_entreprise.ca_declare);
  });

  it('nombre de pièces identique', () => {
    expect(en.qualite_dossier.total_documents).toBe(8);
    expect(en.qualite_dossier.total_documents).toBe(fr.qualite_dossier.total_documents);
    expect(en.qualite_dossier.documents_exploitables).toBe(fr.qualite_dossier.documents_exploitables);
    expect(en.qualite_dossier.documents_illisibles).toBe(fr.qualite_dossier.documents_illisibles);
  });

  it('liste des codes d\'alerte identique, dans le même ordre', () => {
    const codes = (d: any) => (d.incoherences_detectees || []).map((i: any) => i.severite);
    expect(codes(en)).toEqual(['ATTENTION', 'BLOQUANT']);
    expect(codes(en)).toEqual(codes(fr));

    const proba = (d: any) => (d.risques_programme || []).map((r: any) => r.probabilite);
    expect(proba(en)).toEqual(proba(fr));
  });

  it('TOUS les chemins déterministes sont identiques', () => {
    for (const path of DETERMINISTIC_PATHS) {
      expect(get(en, path), `chemin déterministe divergent : ${path}`).toEqual(get(fr, path));
    }
  });

  it('la prose, elle, a bien changé — sinon le test ne prouverait rien', () => {
    expect(en.resume_comite).not.toBe(fr.resume_comite);
    expect(en.resume_executif.synthese).not.toBe(fr.resume_executif.synthese);
    expect(en.incoherences_detectees[0].observation).not.toBe(fr.incoherences_detectees[0].observation);
  });

  it('les tableaux gardent leur longueur et leur ordre', () => {
    expect(en.incoherences_detectees).toHaveLength(fr.incoherences_detectees.length);
    expect(en.resume_executif.points_forts).toHaveLength(fr.resume_executif.points_forts.length);
    expect(en.risques_programme).toHaveLength(fr.risques_programme.length);
  });
});

describe('frontière prose / déterministe', () => {
  it('aucun chemin n\'est à la fois prose et déterministe', () => {
    const overlap = PROSE_PATHS.filter((p) => (DETERMINISTIC_PATHS as readonly string[]).includes(p));
    expect(overlap, `chemins des deux côtés : ${overlap.join(', ')}`).toEqual([]);
  });

  it('extractProse ne laisse fuir aucune valeur déterministe', () => {
    const prose = extractProse(SCREENING);
    for (const path of DETERMINISTIC_PATHS) {
      expect(get(prose, path), `valeur déterministe transmise au modèle : ${path}`).toBeUndefined();
    }
  });

  it('mergeProse ignore les clés étrangères renvoyées par le modèle', () => {
    // Un modèle qui déborde et renvoie un score ne doit pas pouvoir l'imposer.
    const malicious = { ...RENDER_EN, score: 99, qualite_dossier: { note_qualite: 'x', total_documents: 999 } };
    const merged = mergeProse(SCREENING, malicious as any);
    expect(merged.score).toBe(62);
    expect(merged.qualite_dossier.total_documents).toBe(8);
    expect(merged.qualite_dossier.note_qualite).toBe('x');
  });

  it('le miroir edge porte exactement la même liste de chemins', () => {
    expect(EDGE_PROSE_PATHS).toEqual(PROSE_PATHS);
  });
});

describe('normalisation des énumérations', () => {
  it('absorbe accents, casse et espaces', () => {
    expect(normalizeEnum('  ÉLEVÉE ')).toBe('elevee');
    expect(normalizeEnum('Elevee')).toBe('elevee');
    expect(normalizeEnum('Déclaratif  uniquement')).toBe('declaratif uniquement');
  });

  it('enumIs reconnaît les variantes qui cassaient l\'égalité stricte', () => {
    expect(enumIs('Élevée', 'Élevée')).toBe(true);
    expect(enumIs('elevee', 'Élevée')).toBe(true);
    expect(enumIs('ÉLEVÉE ', 'Élevée')).toBe(true);
    expect(enumIs('Faible', 'Élevée')).toBe(false);
  });

  it('enumIs et enumIncludes ne lèvent pas sur null/undefined', () => {
    // Régression : `besoin.coherence_vs_ca.includes(...)` plantait quand la clé
    // manquait dans le diagnostic.
    expect(() => enumIs(undefined, 'Cohérent')).not.toThrow();
    expect(() => enumIncludes(null, 'Élevé')).not.toThrow();
    expect(enumIs(undefined, 'Cohérent')).toBe(false);
    expect(enumIncludes(null, 'Élevé')).toBe(false);
    expect(enumIncludes('Élevé vs CA', 'Élevé')).toBe(true);
  });
});

describe('référentiel de libellés', () => {
  const rows = [
    { key: 'fiabilite.elevee', category: 'fiabilite', fr: 'Élevée', en: 'High', match_fr: 'elevee' },
    { key: 'section.fiche', category: 'ui', fr: 'Fiche entreprise', en: 'Company profile', match_fr: null },
  ];

  it('habille une valeur stockée sans la remplacer dans les données', () => {
    const enL = buildLookup(rows as any, 'en');
    expect(enL.enumLabel('fiabilite', 'Élevée')).toBe('High');
    expect(enL.enumLabel('fiabilite', 'ELEVEE')).toBe('High');
    expect(enL.label('section.fiche')).toBe('Company profile');
  });

  it('retombe sur la valeur stockée si l\'énumération n\'est pas référencée', () => {
    const enL = buildLookup(rows as any, 'en');
    expect(enL.enumLabel('fiabilite', 'Inattendue')).toBe('Inattendue');
  });
});

describe('anti-dérive référentiel', () => {
  it('le repli TS reflète exactement le seed SQL (category=ui)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { DEFAULT_UI_LABELS } = await import('@/lib/diagnostic-labels');

    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20260910180000_diagnostic_labels.sql'),
      'utf-8',
    );
    const block = sql.split("insert into public.diagnostic_labels (key, category, fr, en) values")[1];
    const re = /\('([^']+)',\s*'ui',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\)/g;

    const fromSql: Record<string, { fr: string; en: string }> = {};
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      fromSql[m[1]] = { fr: m[2].replace(/''/g, "'"), en: m[3].replace(/''/g, "'") };
    }

    expect(Object.keys(fromSql).length).toBeGreaterThan(50);
    expect(DEFAULT_UI_LABELS).toEqual(fromSql);
  });
});
