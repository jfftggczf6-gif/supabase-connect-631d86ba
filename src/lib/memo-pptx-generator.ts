import PptxGenJS from 'pptxgenjs';

// ── Colors ──
const NAVY = '0F2B46';
const _BLUE = '1B5E8A';
const TEAL = '0E7C6B';
const GOLD = 'C4841D';
const RED = '9B2C2C';
const WHITE = 'FFFFFF';
const LIGHT = 'F8FAFC';
const GRAY = '64748B';
const BORDER = 'E2E8F0';

// ── Helpers ──
const safe = (v: any, fallback = '—'): string => (v != null && v !== '' ? String(v) : fallback);
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const trunc = (s: string, max = 280): string => (s && s.length > max ? s.substring(0, max) + '…' : s || '');

function addTitleSlide(pres: PptxGenJS, title: string, subtitle: string, date: string) {
  const slide = pres.addSlide();
  slide.background = { fill: NAVY };
  slide.addText('INVESTMENT MEMORANDUM', { x: 0.8, y: 1.2, w: 8.4, h: 0.6, fontSize: 14, color: GOLD, fontFace: 'Calibri', bold: true });
  slide.addShape(pres.ShapeType.rect, { x: 0.8, y: 1.9, w: 2.5, h: 0.04, fill: { color: GOLD } });
  slide.addText(title, { x: 0.8, y: 2.2, w: 8.4, h: 1.2, fontSize: 32, color: WHITE, fontFace: 'Georgia', bold: true });
  slide.addText(subtitle, { x: 0.8, y: 3.5, w: 8.4, h: 0.6, fontSize: 14, color: LIGHT, fontFace: 'Calibri' });
  slide.addText(`Date : ${date}`, { x: 0.8, y: 4.5, w: 4, h: 0.4, fontSize: 10, color: GRAY, fontFace: 'Calibri' });
  slide.addText('CONFIDENTIEL', { x: 7.0, y: 4.8, w: 2.5, h: 0.35, fontSize: 9, color: WHITE, fontFace: 'Calibri', bold: true, fill: { color: RED }, align: 'center', rectRadius: 0.05 });
  slide.addText('ESONO', { x: 0.8, y: 4.9, w: 2, h: 0.3, fontSize: 10, color: GRAY, fontFace: 'Calibri', italic: true });
}

function _addSectionTitle(pres: PptxGenJS, num: string, title: string) {
  const slide = pres.addSlide();
  slide.background = { fill: NAVY };
  slide.addText(num, { x: 0.8, y: 2.0, w: 1.2, h: 1.0, fontSize: 48, color: GOLD, fontFace: 'Georgia', bold: true });
  slide.addText(title, { x: 2.2, y: 2.0, w: 7, h: 1.0, fontSize: 28, color: WHITE, fontFace: 'Georgia', bold: true, valign: 'middle' });
  slide.addShape(pres.ShapeType.rect, { x: 2.2, y: 3.1, w: 3, h: 0.04, fill: { color: GOLD } });
}

function addContentSlide(pres: PptxGenJS, title: string, bullets: string[], opts?: { twoCol?: boolean }) {
  const slide = pres.addSlide();
  slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 20, color: NAVY, fontFace: 'Georgia', bold: true });
  slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.85, w: 2, h: 0.03, fill: { color: TEAL } });

  if (opts?.twoCol && bullets.length > 4) {
    const mid = Math.ceil(bullets.length / 2);
    const col1 = bullets.slice(0, mid);
    const col2 = bullets.slice(mid);
    slide.addText(col1.map(b => ({ text: b, options: { bullet: true, fontSize: 12, color: '333333', lineSpacing: 22 } })), { x: 0.5, y: 1.2, w: 4.3, h: 3.8, fontFace: 'Calibri', valign: 'top' });
    slide.addText(col2.map(b => ({ text: b, options: { bullet: true, fontSize: 12, color: '333333', lineSpacing: 22 } })), { x: 5.0, y: 1.2, w: 4.3, h: 3.8, fontFace: 'Calibri', valign: 'top' });
  } else {
    slide.addText(bullets.map(b => ({ text: b, options: { bullet: true, fontSize: 13, color: '333333', lineSpacing: 24 } })), { x: 0.5, y: 1.2, w: 9, h: 3.8, fontFace: 'Calibri', valign: 'top' });
  }
}

function addKpiSlide(pres: PptxGenJS, title: string, kpis: { label: string; value: string }[], narrative?: string) {
  const slide = pres.addSlide();
  slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 20, color: NAVY, fontFace: 'Georgia', bold: true });
  slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.85, w: 2, h: 0.03, fill: { color: TEAL } });

  const cols = Math.min(kpis.length, 3);
  const cardW = 2.7;
  const gap = 0.3;
  const startX = (10 - (cols * cardW + (cols - 1) * gap)) / 2;

  kpis.slice(0, 6).forEach((kpi, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = startX + col * (cardW + gap);
    const y = 1.2 + row * 1.6;
    slide.addShape(pres.ShapeType.roundRect, { x, y, w: cardW, h: 1.3, fill: { color: LIGHT }, line: { color: BORDER, width: 1 }, rectRadius: 0.1 });
    slide.addText(kpi.value, { x, y: y + 0.15, w: cardW, h: 0.6, fontSize: 24, color: NAVY, fontFace: 'Georgia', bold: true, align: 'center' });
    slide.addText(kpi.label, { x, y: y + 0.75, w: cardW, h: 0.4, fontSize: 9, color: GRAY, fontFace: 'Calibri', align: 'center' });
  });

  if (narrative) {
    slide.addText(trunc(narrative, 400), { x: 0.5, y: 4.0, w: 9, h: 1.0, fontSize: 10, color: '555555', fontFace: 'Calibri', italic: true, valign: 'top' });
  }
}

function addTableSlide(pres: PptxGenJS, title: string, headers: string[], rows: string[][], note?: string) {
  const slide = pres.addSlide();
  slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 20, color: NAVY, fontFace: 'Georgia', bold: true });
  slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.85, w: 2, h: 0.03, fill: { color: TEAL } });

  const tableRows: PptxGenJS.TableRow[] = [
    headers.map(h => ({ text: h, options: { bold: true, fontSize: 10, color: WHITE, fill: { color: NAVY }, fontFace: 'Calibri', align: 'center' as const } })),
    ...rows.map((row, ri) =>
      row.map(cell => ({ text: safe(cell), options: { fontSize: 10, color: '333333', fill: { color: ri % 2 === 0 ? LIGHT : WHITE }, fontFace: 'Calibri', align: 'center' as const } }))
    ),
  ];

  const colW = 9 / headers.length;
  slide.addTable(tableRows, { x: 0.5, y: 1.1, w: 9, colW, border: { type: 'solid', color: BORDER, pt: 0.5 }, autoPage: false });

  if (note) {
    slide.addText(trunc(note, 300), { x: 0.5, y: 4.2, w: 9, h: 0.8, fontSize: 10, color: '555555', fontFace: 'Calibri', italic: true });
  }
}

function addVerdictSlide(pres: PptxGenJS, verdict: string, justification: string, conditions: string[], nextSteps: string[]) {
  const slide = pres.addSlide();
  slide.background = { fill: NAVY };
  const vColor = verdict === 'INVESTIR' ? TEAL : verdict === 'APPROFONDIR' ? GOLD : RED;
  slide.addText('Recommandation Finale', { x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 22, color: WHITE, fontFace: 'Georgia', bold: true });
  slide.addShape(pres.ShapeType.roundRect, { x: 3.0, y: 1.2, w: 4, h: 0.8, fill: { color: vColor }, rectRadius: 0.1 });
  slide.addText(verdict, { x: 3.0, y: 1.2, w: 4, h: 0.8, fontSize: 28, color: WHITE, fontFace: 'Georgia', bold: true, align: 'center', valign: 'middle' });
  slide.addText(trunc(justification, 350), { x: 0.8, y: 2.3, w: 8.4, h: 0.8, fontSize: 12, color: LIGHT, fontFace: 'Calibri', valign: 'top' });

  if (conditions.length > 0) {
    slide.addText('Conditions :', { x: 0.8, y: 3.3, w: 4, h: 0.3, fontSize: 11, color: GOLD, fontFace: 'Calibri', bold: true });
    slide.addText(conditions.slice(0, 4).map(c => ({ text: c, options: { bullet: true, fontSize: 10, color: LIGHT, lineSpacing: 18 } })), { x: 0.8, y: 3.6, w: 4, h: 1.4, fontFace: 'Calibri' });
  }
  if (nextSteps.length > 0) {
    slide.addText('Prochaines étapes :', { x: 5.3, y: 3.3, w: 4, h: 0.3, fontSize: 11, color: TEAL, fontFace: 'Calibri', bold: true });
    slide.addText(nextSteps.slice(0, 4).map(s => ({ text: s, options: { bullet: true, fontSize: 10, color: LIGHT, lineSpacing: 18 } })), { x: 5.3, y: 3.6, w: 4, h: 1.4, fontFace: 'Calibri' });
  }
}

// ── Main Generator ──
export async function generateMemoPptx(data: Record<string, any>): Promise<void> {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 — actually let's use standard 10x5.63
  pres.defineLayout({ name: 'A4_LANDSCAPE', width: 10, height: 5.63 });
  pres.layout = 'A4_LANDSCAPE';

  const pg = data.page_de_garde || {};
  const re = data.resume_executif || {};
  const ent = data.presentation_entreprise || {};
  const marche = data.analyse_marche || {};
  const modele = data.modele_economique || {};
  const fin = data.analyse_financiere || {};
  const valo = data.valorisation || {};
  const besoin = data.besoins_financement || {};
  const equipe = data.equipe_et_gouvernance || {};
  const esg = data.esg_impact || {};
  const risques = data.analyse_risques || {};
  const these = data.these_investissement || {};
  const structure = data.structure_proposee || {};
  const reco = data.recommandation_finale || {};

  // 1. Cover
  addTitleSlide(pres, safe(pg.titre, 'Investment Memorandum'), safe(pg.sous_titre), safe(pg.date, new Date().toLocaleDateString('fr-FR')));

  // 2. Table of Contents
  const tocSlide = pres.addSlide();
  tocSlide.addText('Table des Matières', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, color: NAVY, fontFace: 'Georgia', bold: true });
  const tocItems = [
    'Résumé Exécutif', 'Présentation', 'Marché', 'Modèle Économique',
    'Analyse Financière', 'Projections', 'Valorisation', 'Besoins Financement',
    'Équipe', 'ESG & Impact', 'Risques', 'Thèse d\'Investissement', 'Recommandation',
  ];
  tocSlide.addText(tocItems.map((t, i) => ({ text: `${i + 1}.  ${t}`, options: { fontSize: 12, color: '333333', lineSpacing: 26 } })), { x: 1.5, y: 1.1, w: 7, h: 4, fontFace: 'Calibri' });

  // 3. Executive Summary
  addContentSlide(pres, 'Résumé Exécutif', [
    safe(re.synthese, 'Synthèse non disponible'),
    ...arr(re.points_cles).slice(0, 5),
    re.recommandation_preliminaire ? `Recommandation : ${re.recommandation_preliminaire}` : '',
  ].filter(Boolean));

  // 4. Company Presentation
  const entBullets = [
    ent.description || ent.activite || '',
    ent.historique ? `Historique : ${trunc(ent.historique, 200)}` : '',
    ent.positionnement ? `Positionnement : ${trunc(ent.positionnement, 200)}` : '',
    ...arr(ent.avantages_competitifs).map((a: string) => `✓ ${a}`),
  ].filter(Boolean);
  addContentSlide(pres, 'Présentation de l\'Entreprise', entBullets, { twoCol: true });

  // 5. Market
  const marcheBullets = [
    marche.taille_marche ? `Taille du marché : ${marche.taille_marche}` : '',
    marche.croissance ? `Croissance : ${marche.croissance}` : '',
    marche.tendances ? `Tendances : ${trunc(marche.tendances, 200)}` : '',
    marche.positionnement_concurrentiel ? `Position concurrentielle : ${trunc(marche.positionnement_concurrentiel, 200)}` : '',
    ...arr(marche.concurrents).slice(0, 3).map((c: any) => `Concurrent : ${typeof c === 'string' ? c : c.nom || JSON.stringify(c)}`),
  ].filter(Boolean);
  addContentSlide(pres, 'Analyse de Marché', marcheBullets);

  // 6. Business Model
  const modeleBullets = [
    modele.description || modele.modele || '',
    modele.proposition_valeur ? `Proposition de valeur : ${trunc(modele.proposition_valeur, 200)}` : '',
    ...arr(modele.sources_revenus).map((s: any) => `💰 ${typeof s === 'string' ? s : s.nom || JSON.stringify(s)}`),
    modele.scalabilite ? `Scalabilité : ${trunc(modele.scalabilite, 150)}` : '',
  ].filter(Boolean);
  addContentSlide(pres, 'Modèle Économique', modeleBullets);

  // 7. Financial Analysis — KPIs
  const finKpis = [
    { label: 'Chiffre d\'affaires', value: safe(fin.chiffre_affaires || fin.ca) },
    { label: 'Marge brute', value: safe(fin.marge_brute) },
    { label: 'EBITDA', value: safe(fin.ebitda) },
    { label: 'Résultat net', value: safe(fin.resultat_net) },
    { label: 'Trésorerie', value: safe(fin.tresorerie) },
    { label: 'Ratio dette', value: safe(fin.ratio_dette || fin.endettement) },
  ];
  addKpiSlide(pres, 'Analyse Financière — Indicateurs Clés', finKpis, fin.commentaire || fin.analyse);

  // 8. Financial Analysis — Commentary
  const finCommentary = [
    fin.analyse || fin.commentaire || '',
    fin.points_forts ? `Points forts : ${trunc(fin.points_forts, 200)}` : '',
    fin.points_attention ? `Points d'attention : ${trunc(fin.points_attention, 200)}` : '',
    fin.evolution ? `Évolution : ${trunc(fin.evolution, 200)}` : '',
  ].filter(Boolean);
  if (finCommentary.length > 0) {
    addContentSlide(pres, 'Analyse Financière — Commentaires', finCommentary);
  }

  // 9. Projections — Data
  if (fin.projections || fin.previsions) {
    const proj = fin.projections || fin.previsions || {};
    const projKpis = [
      { label: 'CA projeté N+1', value: safe(proj.ca_n1) },
      { label: 'CA projeté N+3', value: safe(proj.ca_n3) },
      { label: 'EBITDA projeté', value: safe(proj.ebitda_projete) },
      { label: 'Point mort', value: safe(proj.point_mort || proj.breakeven) },
    ];
    addKpiSlide(pres, 'Projections Financières', projKpis, proj.commentaire);
  }

  // 10. Valuation — Methods
  const valoKpis = [
    { label: 'Fourchette', value: safe(valo.fourchette_valorisation) },
    { label: 'Médiane', value: safe(valo.valeur_mediane) },
    ...arr(valo.methodes_utilisees).slice(0, 3).map((m: string) => ({ label: m, value: '✓' })),
  ];
  addKpiSlide(pres, 'Valorisation', valoKpis, valo.note_valorisation);

  // 11. Funding Needs
  if (besoin.montant_recherche || besoin.utilisation_fonds) {
    const fundKpis = [
      { label: 'Montant recherché', value: safe(besoin.montant_recherche) },
      { label: 'Retour attendu', value: safe(besoin.retour_attendu) },
    ];
    const fundBullets = arr(besoin.utilisation_fonds).map((u: any) => `${u.poste || u.libelle || '—'} : ${u.montant || '—'} (${u.pourcentage || '—'})`);
    if (fundBullets.length > 0) {
      addKpiSlide(pres, 'Besoins de Financement', fundKpis);
      addContentSlide(pres, 'Utilisation des Fonds', fundBullets);
    } else {
      addKpiSlide(pres, 'Besoins de Financement', fundKpis, besoin.calendrier_deploiement);
    }
  }

  // 12. Team
  const equipeBullets = [
    equipe.description || equipe.synthese || '',
    ...arr(equipe.membres_cles).slice(0, 5).map((m: any) => `${m.nom || m.name || '—'} — ${m.role || m.poste || '—'}`),
    equipe.gouvernance ? `Gouvernance : ${trunc(equipe.gouvernance, 200)}` : '',
  ].filter(Boolean);
  if (equipeBullets.length > 0) {
    addContentSlide(pres, 'Équipe & Gouvernance', equipeBullets);
  }

  // 13. ESG & Impact
  const esgBullets = [
    esg.description || esg.synthese || '',
    ...arr(esg.odd_cibles).slice(0, 5).map((o: any) => `🌍 ${typeof o === 'string' ? o : o.odd || JSON.stringify(o)}`),
    esg.impact_social ? `Impact social : ${trunc(esg.impact_social, 150)}` : '',
    esg.impact_environnemental ? `Impact environnemental : ${trunc(esg.impact_environnemental, 150)}` : '',
  ].filter(Boolean);
  if (esgBullets.length > 0) {
    addContentSlide(pres, 'ESG & Impact', esgBullets, { twoCol: true });
  }

  // 14. Risks — Matrix
  const risquesArr = arr(risques.risques_identifies);
  if (risquesArr.length > 0) {
    const riskHeaders = ['Risque', 'Catégorie', 'Probabilité', 'Impact', 'Mitigation'];
    const riskRows = risquesArr.slice(0, 6).map((r: any) => [
      trunc(r.description || r.risque || '—', 60),
      safe(r.categorie),
      safe(r.probabilite),
      safe(r.impact),
      trunc(r.mitigation || '—', 60),
    ]);
    addTableSlide(pres, 'Matrice des Risques', riskHeaders, riskRows, risques.matrice_risque_synthese);
  }

  // 15. Risk commentary
  if (risques.commentaire || risques.analyse_globale) {
    addContentSlide(pres, 'Analyse des Risques — Commentaires', [
      risques.commentaire || risques.analyse_globale || '',
      risques.risque_principal ? `Risque principal : ${trunc(risques.risque_principal, 200)}` : '',
    ].filter(Boolean));
  }

  // 16. Investment Thesis
  const theseBullets = [
    these.these || these.synthese || '',
    ...arr(these.arguments_pour).slice(0, 4).map((a: string) => `✅ ${a}`),
    ...arr(these.arguments_contre).slice(0, 3).map((a: string) => `⚠️ ${a}`),
  ].filter(Boolean);
  if (theseBullets.length > 0) {
    addContentSlide(pres, 'Thèse d\'Investissement', theseBullets, { twoCol: true });
  }

  // 17. Proposed Structure
  const structBullets = [
    structure.type_instrument ? `Instrument : ${structure.type_instrument}` : '',
    structure.montant ? `Montant : ${structure.montant}` : '',
    structure.conditions ? `Conditions : ${trunc(structure.conditions, 200)}` : '',
    structure.calendrier ? `Calendrier : ${trunc(structure.calendrier, 200)}` : '',
    ...arr(structure.termes).slice(0, 4).map((t: any) => typeof t === 'string' ? t : `${t.terme || t.label || '—'} : ${t.valeur || t.detail || '—'}`),
  ].filter(Boolean);
  if (structBullets.length > 0) {
    addContentSlide(pres, 'Structure Proposée', structBullets);
  }

  // 18. Final Recommendation
  addVerdictSlide(pres,
    safe(reco.verdict, 'APPROFONDIR'),
    safe(reco.justification),
    arr(reco.conditions).slice(0, 4),
    arr(reco.prochaines_etapes).slice(0, 4),
  );

  // 19. Disclaimer
  const disclaimerSlide = pres.addSlide();
  disclaimerSlide.background = { fill: LIGHT };
  disclaimerSlide.addText('Disclaimer', { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 18, color: NAVY, fontFace: 'Georgia', bold: true });
  disclaimerSlide.addText(
    'Ce document est strictement confidentiel et destiné uniquement aux parties autorisées. Les informations contenues dans ce mémorandum sont fournies à titre indicatif et ne constituent pas une offre d\'investissement. Les projections financières sont basées sur les données disponibles et comportent un degré d\'incertitude inhérent. ESONO décline toute responsabilité quant aux décisions prises sur la base de ce document.',
    { x: 0.5, y: 1.2, w: 9, h: 2.5, fontSize: 11, color: GRAY, fontFace: 'Calibri', lineSpacing: 22 }
  );
  disclaimerSlide.addText('ESONO — Plateforme d\'analyse d\'investissement', { x: 0.5, y: 4.5, w: 9, h: 0.4, fontSize: 10, color: GRAY, fontFace: 'Calibri', italic: true });

  // Download
  const fileName = `InvestmentMemo_${pg.titre?.replace(/[^a-zA-Z0-9]/g, '_') || 'memo'}.pptx`;
  await pres.writeFile({ fileName });
}

// Slide metadata for preview grid
export const SLIDE_TITLES = [
  'Page de garde',
  'Table des matières',
  'Résumé exécutif',
  'Présentation entreprise',
  'Analyse de marché',
  'Modèle économique',
  'Analyse financière — KPIs',
  'Analyse financière — Commentaires',
  'Projections financières',
  'Valorisation',
  'Besoins de financement',
  'Utilisation des fonds',
  'Équipe & Gouvernance',
  'ESG & Impact',
  'Matrice des risques',
  'Analyse des risques',
  'Thèse d\'investissement',
  'Structure proposée',
  'Recommandation finale',
  'Disclaimer',
];
