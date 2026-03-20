import PptxGenJS from 'pptxgenjs';

// ── Colors ──
const NAVY = '0F2B46';
const BLUE = '1B5E8A';
const TEAL = '0E7C6B';
const GOLD = 'C4841D';
const RED = '9B2C2C';
const WHITE = 'FFFFFF';
const LIGHT = 'F8FAFC';
const GRAY = '64748B';
const BORDER = 'E2E8F0';
const DARK = '1E293B';

// ── Helpers ──
const safe = (v: any, fallback = '—'): string => (v != null && v !== '' ? String(v) : fallback);
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const trunc = (s: string, max = 280): string => (s && s.length > max ? s.substring(0, max) + '…' : s || '');

// ── Common footer on every content slide ──
function addFooter(slide: PptxGenJS.Slide, pres: PptxGenJS, companyName: string, slideNum: number) {
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 5.33, w: 10, h: 0.3, fill: { color: LIGHT } });
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 5.3, w: 10, h: 0.01, fill: { color: BORDER } });
  slide.addText(`ESONO — Investment Memorandum — ${companyName} — Confidentiel`, {
    x: 0.5, y: 5.33, w: 8, h: 0.3, fontSize: 7, color: GRAY, fontFace: 'Calibri', valign: 'middle',
  });
  slide.addText(String(slideNum), {
    x: 9, y: 5.33, w: 0.8, h: 0.3, fontSize: 7, color: GRAY, fontFace: 'Calibri', align: 'right', valign: 'middle',
  });
}

function addTitleSlide(pres: PptxGenJS, title: string, subtitle: string, date: string, meta: Record<string, string>) {
  const slide = pres.addSlide();
  slide.background = { fill: NAVY };

  // Decorative circle
  slide.addShape(pres.ShapeType.ellipse, {
    x: 7.5, y: -1.2, w: 5, h: 5,
    line: { color: WHITE, width: 2, transparency: 90 },
    fill: { type: 'solid', color: WHITE, transparency: 97 },
  });

  // Confidential badge
  slide.addText('CONFIDENTIEL', {
    x: 0.8, y: 0.6, w: 1.8, h: 0.35, fontSize: 7, color: WHITE, fontFace: 'Calibri',
    align: 'center', line: { color: WHITE, width: 0.5, transparency: 60 }, rectRadius: 0.03,
  });

  // Title
  slide.addText('Investment Memorandum', {
    x: 0.8, y: 1.5, w: 8.4, h: 0.9, fontSize: 30, color: WHITE, fontFace: 'Georgia', bold: true,
  });

  // Subtitle
  slide.addText(subtitle, {
    x: 0.8, y: 2.4, w: 8.4, h: 0.6, fontSize: 14, color: LIGHT, fontFace: 'Calibri',
  });

  // Bar
  slide.addShape(pres.ShapeType.rect, { x: 0.8, y: 3.1, w: 1.0, h: 0.04, fill: { color: WHITE, transparency: 60 } });

  // Meta
  const metaLines = [
    meta.entreprise ? `Entreprise : ${meta.entreprise}` : '',
    meta.secteur ? `Secteur : ${meta.secteur}` : '',
    meta.pays ? `Pays : ${meta.pays}` : '',
    `Date : ${date}`,
    meta.reference ? `Référence : ${meta.reference}` : '',
  ].filter(Boolean);
  slide.addText(metaLines.join('\n'), {
    x: 0.8, y: 3.3, w: 5, h: 1.6, fontSize: 9.5, color: GRAY, fontFace: 'Calibri', lineSpacing: 20,
  });

  // Footer
  slide.addText('ESONO', { x: 0.8, y: 5.0, w: 2, h: 0.3, fontSize: 8, color: WHITE, fontFace: 'Calibri', bold: true, charSpacing: 3, transparency: 50 });
  slide.addText('Généré par ESONO Investment Readiness Platform', { x: 5.5, y: 5.0, w: 4, h: 0.3, fontSize: 7, color: WHITE, fontFace: 'Calibri', align: 'right', transparency: 50 });
}


function addContentSlide(pres: PptxGenJS, title: string, bullets: string[], companyName: string, slideNum: number, opts?: { twoCol?: boolean }) {
  const slide = pres.addSlide();
  slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 20, color: NAVY, fontFace: 'Georgia', bold: true });

  if (opts?.twoCol && bullets.length > 4) {
    const mid = Math.ceil(bullets.length / 2);
    const col1 = bullets.slice(0, mid);
    const col2 = bullets.slice(mid);
    slide.addText(col1.map(b => ({ text: b, options: { bullet: true, fontSize: 12, color: '333333', lineSpacing: 22 } })), { x: 0.5, y: 1.1, w: 4.3, h: 3.5, fontFace: 'Calibri', valign: 'top' });
    slide.addText(col2.map(b => ({ text: b, options: { bullet: true, fontSize: 12, color: '333333', lineSpacing: 22 } })), { x: 5.0, y: 1.1, w: 4.3, h: 3.5, fontFace: 'Calibri', valign: 'top' });
  } else {
    slide.addText(bullets.map(b => ({ text: b, options: { bullet: true, fontSize: 13, color: '333333', lineSpacing: 24 } })), { x: 0.5, y: 1.1, w: 9, h: 3.5, fontFace: 'Calibri', valign: 'top' });
  }
  addFooter(slide, pres, companyName, slideNum);
}

function addKpiSlide(pres: PptxGenJS, title: string, kpis: { label: string; value: string }[], companyName: string, slideNum: number, narrative?: string) {
  const slide = pres.addSlide();
  slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 20, color: NAVY, fontFace: 'Georgia', bold: true });

  const cols = Math.min(kpis.length, 3);
  const cardW = 2.7;
  const gap = 0.3;
  const startX = (10 - (cols * cardW + (cols - 1) * gap)) / 2;

  kpis.slice(0, 6).forEach((kpi, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = startX + col * (cardW + gap);
    const y = 1.1 + row * 1.6;
    slide.addShape(pres.ShapeType.roundRect, { x, y, w: cardW, h: 1.3, fill: { color: LIGHT }, line: { color: BORDER, width: 1 }, rectRadius: 0.1 });
    slide.addText(kpi.value, { x, y: y + 0.15, w: cardW, h: 0.6, fontSize: 24, color: NAVY, fontFace: 'Georgia', bold: true, align: 'center' });
    slide.addText(kpi.label, { x, y: y + 0.75, w: cardW, h: 0.4, fontSize: 9, color: GRAY, fontFace: 'Calibri', align: 'center' });
  });

  if (narrative) {
    slide.addText(trunc(narrative, 400), { x: 0.5, y: 3.8, w: 9, h: 1.0, fontSize: 10, color: '555555', fontFace: 'Calibri', italic: true, valign: 'top' });
  }
  addFooter(slide, pres, companyName, slideNum);
}

function addTableSlide(pres: PptxGenJS, title: string, headers: string[], rows: string[][], companyName: string, slideNum: number, note?: string) {
  const slide = pres.addSlide();
  slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 20, color: NAVY, fontFace: 'Georgia', bold: true });

  const tableRows: PptxGenJS.TableRow[] = [
    headers.map(h => ({ text: h, options: { bold: true, fontSize: 10, color: WHITE, fill: { color: NAVY }, fontFace: 'Calibri', align: 'center' as const } })),
    ...rows.map((row, ri) =>
      row.map(cell => ({ text: safe(cell), options: { fontSize: 10, color: '333333', fill: { color: ri % 2 === 0 ? LIGHT : WHITE }, fontFace: 'Calibri', align: 'center' as const } }))
    ),
  ];

  const colW = 9 / headers.length;
  slide.addTable(tableRows, { x: 0.5, y: 1.0, w: 9, colW, border: { type: 'solid', color: BORDER, pt: 0.5 }, autoPage: false });

  if (note) {
    slide.addText(trunc(note, 300), { x: 0.5, y: 4.0, w: 9, h: 0.8, fontSize: 10, color: '555555', fontFace: 'Calibri', italic: true });
  }
  addFooter(slide, pres, companyName, slideNum);
}

function addExecSummarySlide(pres: PptxGenJS, re: Record<string, any>, score: number, verdict: string, companyName: string, slideNum: number) {
  const slide = pres.addSlide();
  slide.addText('Résumé Exécutif', { x: 0.5, y: 0.3, w: 7, h: 0.5, fontSize: 20, color: NAVY, fontFace: 'Georgia', bold: true });

  // Main text
  const synthese = trunc(re.synthese || '', 500);
  slide.addText(synthese, { x: 0.5, y: 1.0, w: 6.5, h: 2.0, fontSize: 11, color: DARK, fontFace: 'Calibri', valign: 'top', lineSpacing: 18 });

  // Points clés
  const points = arr(re.points_cles).slice(0, 5);
  if (points.length > 0) {
    slide.addText(points.map((p: string) => ({ text: p, options: { bullet: true, fontSize: 10, color: '333333', lineSpacing: 18 } })), { x: 0.5, y: 3.1, w: 6.5, h: 1.8, fontFace: 'Calibri', valign: 'top' });
  }

  // Score sidebar
  const vColor = verdict === 'INVESTIR' ? TEAL : verdict === 'APPROFONDIR' ? GOLD : RED;
  slide.addShape(pres.ShapeType.roundRect, { x: 7.5, y: 1.0, w: 2.2, h: 1.5, fill: { color: NAVY }, rectRadius: 0.1 });
  slide.addText(String(score), { x: 7.5, y: 1.05, w: 2.2, h: 0.8, fontSize: 36, color: WHITE, fontFace: 'Georgia', bold: true, align: 'center' });
  slide.addText('Score IR /100', { x: 7.5, y: 1.8, w: 2.2, h: 0.4, fontSize: 8, color: GRAY, fontFace: 'Calibri', align: 'center' });

  // Verdict sidebar
  slide.addShape(pres.ShapeType.roundRect, { x: 7.5, y: 2.7, w: 2.2, h: 0.7, fill: { color: vColor }, rectRadius: 0.1 });
  slide.addText(verdict, { x: 7.5, y: 2.7, w: 2.2, h: 0.7, fontSize: 14, color: WHITE, fontFace: 'Georgia', bold: true, align: 'center', valign: 'middle' });

  addFooter(slide, pres, companyName, slideNum);
}

function addVerdictSlide(pres: PptxGenJS, verdict: string, justification: string, conditions: string[], nextSteps: string[], score: number, companyName: string, slideNum: number) {
  const slide = pres.addSlide();
  slide.background = { fill: NAVY };
  const vColor = verdict === 'INVESTIR' ? TEAL : verdict === 'APPROFONDIR' ? GOLD : RED;

  slide.addText('Recommandation Finale', { x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 22, color: WHITE, fontFace: 'Georgia', bold: true });

  // Score + verdict row
  slide.addShape(pres.ShapeType.ellipse, { x: 2.5, y: 1.1, w: 1.2, h: 1.2, fill: { color: WHITE, transparency: 90 }, line: { color: WHITE, width: 2 } });
  slide.addText(String(score), { x: 2.5, y: 1.1, w: 1.2, h: 1.2, fontSize: 28, color: WHITE, fontFace: 'Georgia', bold: true, align: 'center', valign: 'middle' });

  slide.addShape(pres.ShapeType.roundRect, { x: 4.2, y: 1.2, w: 3.5, h: 0.9, fill: { color: vColor }, rectRadius: 0.1 });
  slide.addText(verdict, { x: 4.2, y: 1.2, w: 3.5, h: 0.9, fontSize: 26, color: WHITE, fontFace: 'Georgia', bold: true, align: 'center', valign: 'middle' });

  slide.addText(trunc(justification, 350), { x: 0.8, y: 2.5, w: 8.4, h: 0.7, fontSize: 11, color: LIGHT, fontFace: 'Calibri', valign: 'top' });

  if (conditions.length > 0) {
    slide.addText('Conditions :', { x: 0.8, y: 3.3, w: 4, h: 0.3, fontSize: 11, color: GOLD, fontFace: 'Calibri', bold: true });
    slide.addText(conditions.slice(0, 4).map(c => ({ text: c, options: { bullet: true, fontSize: 10, color: LIGHT, lineSpacing: 18 } })), { x: 0.8, y: 3.6, w: 4, h: 1.3, fontFace: 'Calibri' });
  }
  if (nextSteps.length > 0) {
    slide.addText('Prochaines étapes :', { x: 5.3, y: 3.3, w: 4, h: 0.3, fontSize: 11, color: TEAL, fontFace: 'Calibri', bold: true });
    slide.addText(nextSteps.slice(0, 4).map(s => ({ text: s, options: { bullet: true, fontSize: 10, color: LIGHT, lineSpacing: 18 } })), { x: 5.3, y: 3.6, w: 4, h: 1.3, fontFace: 'Calibri' });
  }
}

// ── Main Generator ──
export async function generateMemoPptx(data: Record<string, any>): Promise<void> {
  const pres = new PptxGenJS();
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

  const score = data.score || re.score_ir || 0;
  const verdict = safe(reco.verdict, 'APPROFONDIR');
  const companyName = safe(pg.entreprise || ent.raison_sociale || ent.nom || pg.titre, 'Entreprise');
  let slideNum = 1;

  // 1. Cover
  addTitleSlide(pres, safe(pg.titre, 'Investment Memorandum'), safe(pg.sous_titre), safe(pg.date, new Date().toLocaleDateString('fr-FR')), {
    entreprise: companyName,
    secteur: safe(pg.secteur || ent.secteur),
    pays: safe(pg.pays || ent.pays),
    reference: pg.reference || '',
  });
  slideNum++;

  // 2. Table of Contents
  const tocSlide = pres.addSlide();
  tocSlide.addText('Table des Matières', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, color: NAVY, fontFace: 'Georgia', bold: true });
  const tocItems = [
    'Résumé Exécutif', 'Présentation', 'Marché', 'Modèle Économique',
    'Analyse Financière', 'Projections', 'Valorisation', 'Besoins Financement',
    'Équipe', 'ESG & Impact', 'Risques', 'Thèse d\'Investissement', 'Recommandation',
  ];
  tocSlide.addText(tocItems.map((t, i) => ({ text: `${i + 1}.  ${t}`, options: { fontSize: 12, color: '333333', lineSpacing: 26 } })), { x: 1.5, y: 1.1, w: 7, h: 4, fontFace: 'Calibri' });
  addFooter(tocSlide, pres, companyName, slideNum);
  slideNum++;

  // 3. Executive Summary (enhanced with score sidebar)
  addExecSummarySlide(pres, re, score, verdict, companyName, slideNum);
  slideNum++;

  // 4. Company Presentation
  const entBullets = [
    ent.description || ent.activite || '',
    ent.historique ? `Historique : ${trunc(ent.historique, 200)}` : '',
    ent.positionnement ? `Positionnement : ${trunc(ent.positionnement, 200)}` : '',
    ...arr(ent.avantages_competitifs).map((a: string) => `✓ ${a}`),
  ].filter(Boolean);
  addContentSlide(pres, 'Présentation de l\'Entreprise', entBullets, companyName, slideNum, { twoCol: true });
  slideNum++;

  // 5. Market
  const marcheBullets = [
    marche.taille_marche ? `Taille du marché : ${marche.taille_marche}` : '',
    marche.croissance ? `Croissance : ${marche.croissance}` : '',
    marche.tendances ? `Tendances : ${trunc(marche.tendances, 200)}` : '',
    marche.positionnement_concurrentiel ? `Position concurrentielle : ${trunc(marche.positionnement_concurrentiel, 200)}` : '',
    ...arr(marche.concurrents).slice(0, 3).map((c: any) => `Concurrent : ${typeof c === 'string' ? c : c.nom || JSON.stringify(c)}`),
  ].filter(Boolean);
  addContentSlide(pres, 'Analyse de Marché', marcheBullets, companyName, slideNum);
  slideNum++;

  // 6. Business Model
  const modeleBullets = [
    modele.description || modele.modele || '',
    modele.proposition_valeur ? `Proposition de valeur : ${trunc(modele.proposition_valeur, 200)}` : '',
    ...arr(modele.sources_revenus).map((s: any) => `💰 ${typeof s === 'string' ? s : s.nom || JSON.stringify(s)}`),
    modele.scalabilite ? `Scalabilité : ${trunc(modele.scalabilite, 150)}` : '',
  ].filter(Boolean);
  addContentSlide(pres, 'Modèle Économique', modeleBullets, companyName, slideNum);
  slideNum++;

  // 7. Financial Analysis — KPIs
  const finKpis = [
    { label: 'Chiffre d\'affaires', value: safe(fin.chiffre_affaires || fin.ca) },
    { label: 'Marge brute', value: safe(fin.marge_brute) },
    { label: 'EBITDA', value: safe(fin.ebitda) },
    { label: 'Résultat net', value: safe(fin.resultat_net) },
    { label: 'Trésorerie', value: safe(fin.tresorerie) },
    { label: 'Ratio dette', value: safe(fin.ratio_dette || fin.endettement) },
  ];
  addKpiSlide(pres, 'Analyse Financière — Indicateurs Clés', finKpis, companyName, slideNum, fin.commentaire || fin.analyse);
  slideNum++;

  // 8. Financial commentary
  const finCommentary = [
    fin.analyse || fin.commentaire || '',
    fin.points_forts ? `Points forts : ${trunc(fin.points_forts, 200)}` : '',
    fin.points_attention ? `Points d'attention : ${trunc(fin.points_attention, 200)}` : '',
    fin.evolution ? `Évolution : ${trunc(fin.evolution, 200)}` : '',
  ].filter(Boolean);
  if (finCommentary.length > 0) {
    addContentSlide(pres, 'Analyse Financière — Commentaires', finCommentary, companyName, slideNum);
    slideNum++;
  }

  // 9. Projections
  if (fin.projections || fin.previsions) {
    const proj = fin.projections || fin.previsions || {};
    const projKpis = [
      { label: 'CA projeté N+1', value: safe(proj.ca_n1) },
      { label: 'CA projeté N+3', value: safe(proj.ca_n3) },
      { label: 'EBITDA projeté', value: safe(proj.ebitda_projete) },
      { label: 'Point mort', value: safe(proj.point_mort || proj.breakeven) },
    ];
    addKpiSlide(pres, 'Projections Financières', projKpis, companyName, slideNum, proj.commentaire);
    slideNum++;
  }

  // 10. Valuation
  const valoKpis = [
    { label: 'Fourchette', value: safe(valo.fourchette_valorisation) },
    { label: 'Médiane', value: safe(valo.valeur_mediane) },
    ...arr(valo.methodes_utilisees).slice(0, 3).map((m: string) => ({ label: m, value: '✓' })),
  ];
  addKpiSlide(pres, 'Valorisation', valoKpis, companyName, slideNum, valo.note_valorisation);
  slideNum++;

  // 11. Funding Needs
  if (besoin.montant_recherche || besoin.utilisation_fonds) {
    const fundKpis = [
      { label: 'Montant recherché', value: safe(besoin.montant_recherche) },
      { label: 'Retour attendu', value: safe(besoin.retour_attendu) },
    ];
    const fundBullets = arr(besoin.utilisation_fonds).map((u: any) => `${u.poste || u.libelle || '—'} : ${u.montant || '—'} (${u.pourcentage || '—'})`);
    if (fundBullets.length > 0) {
      addKpiSlide(pres, 'Besoins de Financement', fundKpis, companyName, slideNum);
      slideNum++;
      addContentSlide(pres, 'Utilisation des Fonds', fundBullets, companyName, slideNum);
      slideNum++;
    } else {
      addKpiSlide(pres, 'Besoins de Financement', fundKpis, companyName, slideNum, besoin.calendrier_deploiement);
      slideNum++;
    }
  }

  // 12. Team
  const equipeBullets = [
    equipe.description || equipe.synthese || '',
    ...arr(equipe.membres_cles).slice(0, 5).map((m: any) => `${m.nom || m.name || '—'} — ${m.role || m.poste || '—'}`),
    equipe.gouvernance ? `Gouvernance : ${trunc(equipe.gouvernance, 200)}` : '',
  ].filter(Boolean);
  if (equipeBullets.length > 0) {
    addContentSlide(pres, 'Équipe & Gouvernance', equipeBullets, companyName, slideNum);
    slideNum++;
  }

  // 13. ESG
  const esgBullets = [
    esg.description || esg.synthese || '',
    ...arr(esg.odd_cibles).slice(0, 5).map((o: any) => `🌍 ${typeof o === 'string' ? o : o.odd || JSON.stringify(o)}`),
    esg.impact_social ? `Impact social : ${trunc(esg.impact_social, 150)}` : '',
    esg.impact_environnemental ? `Impact environnemental : ${trunc(esg.impact_environnemental, 150)}` : '',
  ].filter(Boolean);
  if (esgBullets.length > 0) {
    addContentSlide(pres, 'ESG & Impact', esgBullets, companyName, slideNum, { twoCol: true });
    slideNum++;
  }

  // 14. Risks
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
    addTableSlide(pres, 'Matrice des Risques', riskHeaders, riskRows, companyName, slideNum, risques.matrice_risque_synthese);
    slideNum++;
  }

  // 15. Risk commentary
  if (risques.commentaire || risques.analyse_globale) {
    addContentSlide(pres, 'Analyse des Risques — Commentaires', [
      risques.commentaire || risques.analyse_globale || '',
      risques.risque_principal ? `Risque principal : ${trunc(risques.risque_principal, 200)}` : '',
    ].filter(Boolean), companyName, slideNum);
    slideNum++;
  }

  // 16. Investment Thesis
  const theseBullets = [
    these.these || these.synthese || '',
    ...arr(these.arguments_pour).slice(0, 4).map((a: string) => `✅ ${a}`),
    ...arr(these.arguments_contre).slice(0, 3).map((a: string) => `⚠️ ${a}`),
  ].filter(Boolean);
  if (theseBullets.length > 0) {
    addContentSlide(pres, 'Thèse d\'Investissement', theseBullets, companyName, slideNum, { twoCol: true });
    slideNum++;
  }

  // 17. Proposed Structure
  const structBullets = [
    structure.type_instrument ? `Instrument : ${structure.type_instrument}` : '',
    structure.montant ? `Montant : ${structure.montant}` : '',
    structure.conditions ? `Conditions : ${trunc(typeof structure.conditions === 'string' ? structure.conditions : JSON.stringify(structure.conditions), 200)}` : '',
    structure.calendrier ? `Calendrier : ${trunc(structure.calendrier, 200)}` : '',
    ...arr(structure.termes).slice(0, 4).map((t: any) => typeof t === 'string' ? t : `${t.terme || t.label || '—'} : ${t.valeur || t.detail || '—'}`),
  ].filter(Boolean);
  if (structBullets.length > 0) {
    addContentSlide(pres, 'Structure Proposée', structBullets, companyName, slideNum);
    slideNum++;
  }

  // 18. Final Recommendation
  addVerdictSlide(pres, verdict, safe(reco.justification), arr(reco.conditions).slice(0, 4), arr(reco.prochaines_etapes).slice(0, 4), score, companyName, slideNum);
  slideNum++;

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
  const fileName = `InvestmentMemo_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
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
