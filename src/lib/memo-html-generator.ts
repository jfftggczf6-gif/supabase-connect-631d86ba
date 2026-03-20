// ── Investment Memo HTML Generator ──
// Produces a professional A4-ready HTML document matching the target format

const safe = (v: any, fb = '—'): string => (v != null && v !== '' ? String(v) : fb);
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const trunc = (s: string, max = 500): string => (s && s.length > max ? s.substring(0, max) + '…' : s || '');

const CSS = `
@page{size:A4;margin:18mm 16mm 22mm 16mm}
:root{--navy:#0F2B46;--blue:#1B5E8A;--teal:#0E7C6B;--gold:#C4841D;--red:#9B2C2C;--gray:#64748B;--dark:#1E293B;--light:#F8FAFC;--white:#FFF;--border:#E2E8F0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Segoe UI",system-ui,sans-serif;font-size:10pt;line-height:1.6;color:#2D3748;background:var(--light)}
.doc{max-width:210mm;margin:0 auto;background:var(--white);box-shadow:0 1px 12px rgba(0,0,0,.05)}
.cover{background:linear-gradient(155deg,var(--navy) 0%,#162E4A 55%,var(--blue) 100%);color:#fff;padding:60px 50px 50px;min-height:295mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;position:relative;overflow:hidden}
.cover::before{content:'';position:absolute;top:-60px;right:-60px;width:280px;height:280px;border:35px solid rgba(255,255,255,.03);border-radius:50%}
.cover .badge{display:inline-block;border:1px solid rgba(255,255,255,.3);padding:4px 16px;border-radius:3px;font-size:7.5pt;text-transform:uppercase;letter-spacing:2px;opacity:.6;margin-bottom:44px}
.cover h1{font-size:30pt;font-weight:700;letter-spacing:-.4px;margin-bottom:10px;line-height:1.12}
.cover .sub{font-size:14pt;font-weight:300;opacity:.75;margin-bottom:32px;line-height:1.4}
.cover .bar{width:50px;height:3px;background:rgba(255,255,255,.35);margin-bottom:24px}
.cover .meta{font-size:9.5pt;opacity:.6;line-height:2}
.cover .meta strong{opacity:1}
.cover .foot{display:flex;justify-content:space-between;align-items:flex-end;font-size:8pt;opacity:.4}
.toc{padding:44px 50px;page-break-after:always}
.toc h2{font-size:18pt;color:var(--navy);margin-bottom:24px;font-weight:700}
.toc-item{display:flex;align-items:baseline;padding:8px 0;border-bottom:1px dotted var(--border)}
.toc-n{width:28px;font-size:9.5pt;color:var(--blue);font-weight:700;flex-shrink:0}
.toc-t{flex:1;font-size:10pt}
.toc-p{font-size:9.5pt;color:var(--gray);margin-left:10px}
.c{padding:36px 50px}
h2{font-size:15pt;color:var(--navy);font-weight:700;margin:32px 0 12px;padding-bottom:7px;border-bottom:2px solid var(--blue);page-break-after:avoid}
h3{font-size:11pt;color:var(--blue);font-weight:600;margin:18px 0 6px}
h4{font-size:10pt;color:var(--dark);font-weight:600;margin:12px 0 4px}
p{margin-bottom:8px;text-align:justify}
ul{padding-left:18px;margin-bottom:8px}
li{margin:4px 0}
.sb{display:inline-flex;align-items:center;gap:12px;background:var(--navy);color:#fff;padding:12px 24px;border-radius:7px;margin:12px 0}
.sb .n{font-size:24pt;font-weight:700}
.sb .l{font-size:8.5pt;opacity:.65;line-height:1.2}
.vd{padding:14px 20px;border-radius:7px;margin:14px 0;font-weight:600;font-size:11pt;display:flex;align-items:center;gap:10px}
.vd-i{background:#F0FFF4;border:2px solid var(--teal);color:var(--teal)}
.vd-a{background:#FFFBEB;border:2px solid var(--gold);color:var(--gold)}
.vd-d{background:#FFF5F5;border:2px solid var(--red);color:var(--red)}
.co{background:#EBF8FF;border-left:4px solid var(--blue);padding:14px 18px;border-radius:0 7px 7px 0;margin:12px 0}
.co-w{background:#FFFBEB;border-left-color:var(--gold)}
.co-g{background:#F0FFF4;border-left-color:var(--teal)}
.co strong{display:block;font-size:9.5pt;margin-bottom:4px}
.ig{display:grid;grid-template-columns:1fr 1fr;gap:5px 24px;background:var(--light);padding:16px 20px;border-radius:7px;margin:12px 0;border:1px solid var(--border)}
.ig .fl{font-size:8pt;color:var(--gray);text-transform:uppercase;letter-spacing:.4px}
.ig .fv{font-size:10pt;font-weight:600;color:var(--dark)}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:9pt}
thead th{background:var(--navy);color:#fff;padding:7px 10px;text-align:left;font-weight:600;font-size:8.5pt;text-transform:uppercase;letter-spacing:.3px}
tbody td{padding:7px 10px;border-bottom:1px solid var(--border)}
tbody tr:nth-child(even) td{background:var(--light)}
.bd{display:inline-block;padding:2px 9px;border-radius:9px;font-size:8pt;font-weight:600}
.bd-l{background:#C6F6D5;color:#22543D}
.bd-m{background:#FEFCBF;color:#744210}
.bd-h{background:#FED7D7;color:#742A2A}
.tc{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:12px 0}
.cc{background:var(--light);border:1px solid var(--border);border-radius:7px;padding:16px}
.cc h4{margin:0 0 8px}
.cc-g h4{color:var(--teal)}
.cc-r h4{color:var(--red)}
.cond li{margin:6px 0;padding:8px 14px;background:#FFFBEB;border-left:3px solid var(--gold);border-radius:0 5px 5px 0;font-size:9.5pt}
.next li{margin:5px 0;padding:7px 14px;background:#EBF8FF;border-left:3px solid var(--blue);border-radius:0 5px 5px 0;font-size:9.5pt}
.pf{text-align:center;font-size:7.5pt;color:#A0AEC0;padding:24px 0 8px;border-top:1px solid var(--border);margin-top:32px}
.note{font-size:8.5pt;color:var(--gray);font-style:italic}
@media print{body{background:#fff}.doc{box-shadow:none}.cover{page-break-after:always}h2{page-break-after:avoid}table,.co,.ig{page-break-inside:avoid}}
`;

function igField(label: string, value: string): string {
  return `<div><div class="fl">${label}</div><div class="fv">${value}</div></div>`;
}

function probBadge(val: string): string {
  const v = (val || '').toLowerCase();
  const cls = v.includes('elev') || v.includes('fort') || v.includes('haute') ? 'bd-h' : v.includes('moyen') ? 'bd-m' : 'bd-l';
  return `<span class="bd ${cls}">${safe(val)}</span>`;
}

function renderGenericSection(d: any): string {
  if (!d) return '';
  if (typeof d === 'string') return `<p>${d}</p>`;
  if (Array.isArray(d)) return `<ul>${d.map(i => `<li>${typeof i === 'string' ? i : typeof i === 'object' ? Object.values(i).join(' — ') : String(i)}</li>`).join('')}</ul>`;
  return Object.entries(d).filter(([k]) => !k.startsWith('_')).map(([k, v]) => {
    const label = k.replace(/_/g, ' ');
    if (Array.isArray(v)) return `<h3>${label}</h3><ul>${(v as any[]).map(i => `<li>${typeof i === 'string' ? i : typeof i === 'object' ? Object.values(i as Record<string, unknown>).join(' — ') : String(i)}</li>`).join('')}</ul>`;
    if (typeof v === 'object' && v) return `<h3>${label}</h3>${renderGenericSection(v)}`;
    return `<p><strong>${label} :</strong> ${v}</p>`;
  }).join('');
}

export function generateMemoHtml(data: Record<string, any>): string {
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
  const annexes = data.annexes || {};

  const score = data.score || re.score_ir || 0;
  const verdict = reco.verdict || re.recommandation_preliminaire || '—';
  const vdClass = verdict === 'INVESTIR' ? 'vd-i' : verdict === 'APPROFONDIR' ? 'vd-a' : 'vd-d';
  const vdIcon = verdict === 'INVESTIR' ? '✅' : verdict === 'APPROFONDIR' ? '⚡' : '❌';
  const dateStr = safe(pg.date, new Date().toLocaleDateString('fr-FR'));
  const titre = safe(pg.titre, 'Investment Memorandum');

  const TOC_ITEMS = [
    'Résumé exécutif', 'Présentation de l\'entreprise', 'Analyse du marché',
    'Modèle économique', 'Analyse financière', 'Valorisation',
    'Besoins de financement', 'Équipe et gouvernance', 'ESG et impact',
    'Analyse des risques', 'Thèse d\'investissement', 'Structure proposée',
    'Recommandation finale', 'Annexes',
  ];

  // ── Cover ──
  const cover = `
<div class="cover">
  <div style="position:relative;z-index:1">
    <div class="badge">Confidentiel</div>
    <h1>Investment Memorandum</h1>
    <div class="sub">${safe(pg.sous_titre)}<br>${safe(pg.pays || ent.pays || ent.country)}</div>
    <div class="bar"></div>
    <div class="meta">
      <div><strong>Entreprise :</strong> ${safe(pg.entreprise || ent.raison_sociale || ent.nom)}</div>
      <div><strong>Secteur :</strong> ${safe(pg.secteur || ent.secteur)}</div>
      <div><strong>Pays :</strong> ${safe(pg.pays || ent.pays)}</div>
      <div><strong>Date :</strong> ${dateStr}</div>
      ${pg.reference ? `<div><strong>Référence :</strong> ${pg.reference}</div>` : ''}
    </div>
  </div>
  <div class="foot"><span style="font-weight:700;letter-spacing:3px">ESONO</span><span>Généré par ESONO Investment Readiness Platform</span></div>
</div>`;

  // ── TOC ──
  const toc = `
<div class="toc">
  <h2>Table des matières</h2>
  ${TOC_ITEMS.map((t, i) => `<div class="toc-item"><span class="toc-n">${i < 13 ? i + 1 : '—'}</span><span class="toc-t">${t}</span></div>`).join('\n  ')}
</div>`;

  // ── Section 1: Executive Summary ──
  const sec1 = `
<div class="c">
<h2>1. Résumé exécutif</h2>
${re.synthese ? `<p>${re.synthese}</p>` : ''}
${arr(re.points_cles).length > 0 ? `
<div class="co">
  <strong>Points clés de l'investissement :</strong>
  <ul>${arr(re.points_cles).map((p: string) => `<li>${p}</li>`).join('')}</ul>
</div>` : ''}
<div style="display:flex;gap:16px;align-items:center;margin:16px 0">
  <div class="sb"><span class="n">${score}</span><span class="l">Score Investment<br>Readiness /100</span></div>
  <div class="vd ${vdClass}">${vdIcon} Recommandation : ${verdict}${re.recommandation_preliminaire && re.recommandation_preliminaire !== verdict ? ` — ${re.recommandation_preliminaire}` : ''}</div>
</div>`;

  // ── Section 2: Company ──
  const sec2Fields = [
    ['Raison sociale', ent.raison_sociale || ent.nom || ent.name],
    ['Forme juridique', ent.forme_juridique || ent.legal_form],
    ['Date de création', ent.date_creation || ent.creation_date],
    ['Siège social', ent.siege_social || ent.ville || ent.city],
    ['Secteur', ent.secteur || ent.sector],
    ['Effectif', ent.effectif || ent.employees_count],
  ].filter(([, v]) => v);

  const sec2 = `
<h2>2. Présentation de l'entreprise</h2>
${sec2Fields.length > 0 ? `<div class="ig">${sec2Fields.map(([l, v]) => igField(l as string, safe(v))).join('')}</div>` : ''}
${ent.historique ? `<h3>Historique</h3><p>${ent.historique}</p>` : ''}
${ent.description || ent.activite ? `<h3>Activités</h3><p>${ent.description || ent.activite}</p>` : ''}
${ent.positionnement ? `<h3>Positionnement</h3><p>${ent.positionnement}</p>` : ''}
${arr(ent.avantages_competitifs).length > 0 ? `<h3>Avantages compétitifs</h3><ul>${arr(ent.avantages_competitifs).map((a: string) => `<li>${a}</li>`).join('')}</ul>` : ''}
${ent.gouvernance ? `<h3>Gouvernance</h3><p>${ent.gouvernance}</p>` : ''}`;

  // ── Section 3: Market ──
  const sec3 = `
<h2>3. Analyse du marché</h2>
${marche.contexte_macroeconomique ? `<h3>Contexte macroéconomique</h3><p>${marche.contexte_macroeconomique}</p>` : ''}
${marche.taille_marche ? `<h3>Taille du marché</h3><p>${marche.taille_marche}</p>` : ''}
${marche.croissance ? `<p><strong>Croissance :</strong> ${marche.croissance}</p>` : ''}
${marche.tendances ? `<h3>Tendances</h3><p>${marche.tendances}</p>` : ''}
${marche.positionnement_concurrentiel ? `<h3>Positionnement concurrentiel</h3><p>${marche.positionnement_concurrentiel}</p>` : ''}
${arr(marche.concurrents).length > 0 ? `<h3>Concurrents</h3><ul>${arr(marche.concurrents).map((c: any) => `<li>${typeof c === 'string' ? c : c.nom ? `<strong>${c.nom}</strong> — ${c.description || c.detail || ''}` : JSON.stringify(c)}</li>`).join('')}</ul>` : ''}
${marche.opportunites ? `<div class="co co-g"><strong>Opportunités</strong><p>${marche.opportunites}</p></div>` : ''}
${marche.menaces ? `<div class="co co-w"><strong>Menaces</strong><p>${marche.menaces}</p></div>` : ''}
${renderGenericSection(Object.fromEntries(Object.entries(marche).filter(([k]) => !['contexte_macroeconomique','taille_marche','croissance','tendances','positionnement_concurrentiel','concurrents','opportunites','menaces'].includes(k) && !k.startsWith('_'))))}`;

  // ── Section 4: Business Model ──
  const srcRevArr = arr(modele.sources_revenus);
  const sec4 = `
<h2>4. Modèle économique</h2>
${modele.description || modele.modele ? `<p>${modele.description || modele.modele}</p>` : ''}
${modele.proposition_valeur ? `<h3>Proposition de valeur</h3><p>${modele.proposition_valeur}</p>` : ''}
${srcRevArr.length > 0 ? `<h3>Sources de revenus</h3>
<table><thead><tr><th>Source</th><th>Détails</th></tr></thead><tbody>
${srcRevArr.map((s: any) => `<tr><td>${typeof s === 'string' ? s : s.nom || s.source || '—'}</td><td>${typeof s === 'string' ? '' : s.detail || s.pourcentage || s.description || ''}</td></tr>`).join('')}
</tbody></table>` : ''}
${modele.scalabilite ? `<h3>Scalabilité</h3><p>${modele.scalabilite}</p>` : ''}
${modele.structure_couts ? `<h3>Structure de coûts</h3><p>${typeof modele.structure_couts === 'string' ? modele.structure_couts : renderGenericSection(modele.structure_couts)}</p>` : ''}
${modele.unit_economics ? `<h3>Unit economics</h3><div class="ig">${Object.entries(modele.unit_economics as Record<string, any>).map(([k, v]) => igField(k.replace(/_/g, ' '), safe(v))).join('')}</div>` : ''}`;

  // ── Section 5: Financial Analysis ──
  const sec5 = `
<h2>5. Analyse financière</h2>
${fin.commentaire || fin.analyse ? `<p>${fin.commentaire || fin.analyse}</p>` : ''}
${fin.performance_historique ? `<h3>Performance historique</h3>${renderGenericSection(fin.performance_historique)}` : ''}
<div class="ig">
  ${igField('Chiffre d\'affaires', safe(fin.chiffre_affaires || fin.ca))}
  ${igField('Marge brute', safe(fin.marge_brute))}
  ${igField('EBITDA', safe(fin.ebitda))}
  ${igField('Résultat net', safe(fin.resultat_net))}
  ${igField('Trésorerie', safe(fin.tresorerie))}
  ${igField('Ratio dette', safe(fin.ratio_dette || fin.endettement))}
</div>
${fin.points_forts ? `<div class="co co-g"><strong>Points forts</strong><p>${fin.points_forts}</p></div>` : ''}
${fin.points_attention ? `<div class="co co-w"><strong>Points d'attention</strong><p>${fin.points_attention}</p></div>` : ''}
${fin.projections || fin.previsions ? (() => {
  const proj = fin.projections || fin.previsions || {};
  return `<h3>Projections financières</h3>
  <div class="ig">
    ${igField('CA projeté N+1', safe(proj.ca_n1))}
    ${igField('CA projeté N+3', safe(proj.ca_n3))}
    ${igField('EBITDA projeté', safe(proj.ebitda_projete))}
    ${igField('Point mort', safe(proj.point_mort || proj.breakeven))}
  </div>
  ${proj.commentaire ? `<p class="note">${proj.commentaire}</p>` : ''}`;
})() : ''}
${fin.ratios ? `<h3>Ratios clés</h3>${renderGenericSection(fin.ratios)}` : ''}
${fin.qualite_donnees ? `<h3>Qualité des données</h3><p class="note">${fin.qualite_donnees}</p>` : ''}`;

  // ── Section 6: Valuation ──
  const sec6 = `
<h2>6. Valorisation</h2>
${valo.description || valo.commentaire ? `<p>${valo.description || valo.commentaire}</p>` : ''}
${arr(valo.methodes_utilisees).length > 0 || valo.methodes ? `
<div class="tc">
${typeof valo.methodes === 'object' && !Array.isArray(valo.methodes) ? 
  Object.entries(valo.methodes as Record<string, any>).map(([k, v]) => `<div class="cc"><h4>${k.replace(/_/g, ' ')}</h4>${renderGenericSection(v)}</div>`).join('') :
  `<div class="cc"><h4>Méthodes utilisées</h4><ul>${arr(valo.methodes_utilisees).map((m: string) => `<li>${m}</li>`).join('')}</ul></div>
   <div class="cc"><h4>Résultat</h4>
     <p><strong>Fourchette :</strong> ${safe(valo.fourchette_valorisation)}</p>
     <p><strong>Médiane :</strong> ${safe(valo.valeur_mediane)}</p>
   </div>`
}
</div>` : `
<div class="ig">
  ${igField('Fourchette', safe(valo.fourchette_valorisation))}
  ${igField('Médiane', safe(valo.valeur_mediane))}
</div>`}
${valo.note_valorisation ? `<p class="note">${valo.note_valorisation}</p>` : ''}`;

  // ── Section 7: Funding ──
  const fundArr = arr(besoin.utilisation_fonds);
  const sec7 = `
<h2>7. Besoins de financement</h2>
<div class="ig">
  ${igField('Montant recherché', safe(besoin.montant_recherche))}
  ${igField('Retour attendu', safe(besoin.retour_attendu))}
  ${besoin.instrument ? igField('Instrument', safe(besoin.instrument)) : ''}
  ${besoin.horizon ? igField('Horizon', safe(besoin.horizon)) : ''}
</div>
${fundArr.length > 0 ? `<h3>Utilisation des fonds</h3>
<table><thead><tr><th>Poste</th><th>Montant</th><th>%</th></tr></thead><tbody>
${fundArr.map((u: any) => `<tr><td>${u.poste || u.libelle || '—'}</td><td>${u.montant || '—'}</td><td>${u.pourcentage || '—'}</td></tr>`).join('')}
</tbody></table>` : ''}
${besoin.calendrier_deploiement ? `<p>📅 <strong>Calendrier :</strong> ${besoin.calendrier_deploiement}</p>` : ''}`;

  // ── Section 8: Team ──
  const membresArr = arr(equipe.membres_cles);
  const sec8 = `
<h2>8. Équipe et gouvernance</h2>
${equipe.description || equipe.synthese ? `<p>${equipe.description || equipe.synthese}</p>` : ''}
${membresArr.length > 0 ? `<h3>Membres clés</h3>
<table><thead><tr><th>Nom</th><th>Rôle</th><th>Expérience</th></tr></thead><tbody>
${membresArr.map((m: any) => `<tr><td><strong>${m.nom || m.name || '—'}</strong></td><td>${m.role || m.poste || '—'}</td><td>${m.experience || m.bio || '—'}</td></tr>`).join('')}
</tbody></table>` : ''}
${equipe.gouvernance ? `<h3>Gouvernance</h3><p>${equipe.gouvernance}</p>` : ''}
${arr(equipe.gaps_identifies).length > 0 ? `<h3>Gaps identifiés</h3><ul>${arr(equipe.gaps_identifies).map((g: string) => `<li>${g}</li>`).join('')}</ul>` : ''}`;

  // ── Section 9: ESG ──
  const oddArr = arr(esg.odd_cibles || esg.odd_alignement);
  const sec9 = `
<h2>9. ESG et impact</h2>
${esg.description || esg.synthese ? `<p>${esg.description || esg.synthese}</p>` : ''}
${oddArr.length > 0 ? `<h3>Alignement ODD</h3>
<div class="co co-g"><ul>
${oddArr.map((o: any) => `<li><strong>${typeof o === 'string' ? o : o.odd || o.nom || '—'}</strong>${typeof o === 'object' && o.description ? ` : ${o.description}` : ''}</li>`).join('')}
</ul></div>` : ''}
${esg.impact_social ? `<h3>Impact social</h3><p>${esg.impact_social}</p>` : ''}
${esg.impact_environnemental ? `<h3>Impact environnemental</h3><p>${esg.impact_environnemental}</p>` : ''}
${esg.conformite_ifc ? `<h3>Conformité IFC</h3><p>${esg.conformite_ifc}</p>` : ''}`;

  // ── Section 10: Risks ──
  const risquesArr = arr(risques.risques_identifies);
  const sec10 = `
<h2>10. Analyse des risques</h2>
${risquesArr.length > 0 ? `
<table>
  <thead><tr><th style="width:28%">Risque</th><th>Cat.</th><th>Prob.</th><th>Impact</th><th style="width:32%">Mitigation</th></tr></thead>
  <tbody>
  ${risquesArr.map((r: any) => `<tr><td>${trunc(r.description || r.risque || '—', 120)}</td><td>${safe(r.categorie)}</td><td>${probBadge(r.probabilite)}</td><td>${probBadge(r.impact)}</td><td>${trunc(r.mitigation || '—', 120)}</td></tr>`).join('')}
  </tbody>
</table>` : ''}
${risques.matrice_risque_synthese || risques.commentaire || risques.analyse_globale ? `<p><strong>Synthèse :</strong> ${risques.matrice_risque_synthese || risques.commentaire || risques.analyse_globale}</p>` : ''}
${risques.risque_principal ? `<div class="co co-w"><strong>Risque principal</strong><p>${risques.risque_principal}</p></div>` : ''}`;

  // ── Section 11: Investment Thesis ──
  const sec11 = `
<h2>11. Thèse d'investissement</h2>
<div class="tc">
  <div class="cc cc-g">
    <h4>Thèse positive — Pourquoi investir</h4>
    ${these.these_positive || arr(these.arguments_pour).length > 0 ? 
      (these.these_positive ? `<p>${these.these_positive}</p>` : `<ul>${arr(these.arguments_pour).map((a: string) => `<li>${a}</li>`).join('')}</ul>`) : '<p>—</p>'}
  </div>
  <div class="cc cc-r">
    <h4>Thèse négative — Points de vigilance</h4>
    ${these.these_negative || arr(these.arguments_contre).length > 0 ? 
      (these.these_negative ? `<p>${these.these_negative}</p>` : `<ul>${arr(these.arguments_contre).map((a: string) => `<li>${a}</li>`).join('')}</ul>`) : '<p>—</p>'}
  </div>
</div>
${these.these || these.synthese ? `<p>${these.these || these.synthese}</p>` : ''}
${arr(these.facteurs_cles).length > 0 ? `<h3>Facteurs clés de succès</h3><ul>${arr(these.facteurs_cles).map((f: string) => `<li>${f}</li>`).join('')}</ul>` : ''}
${arr(these.scenarios_sortie).length > 0 ? `<h3>Scénarios de sortie</h3><ul>${arr(these.scenarios_sortie).map((s: any) => `<li>${typeof s === 'string' ? s : `<strong>${s.scenario || s.type || '—'}</strong> — ${s.description || s.detail || ''}`}</li>`).join('')}</ul>` : ''}`;

  // ── Section 12: Structure ──
  const structFields = [
    ['Instrument', structure.type_instrument || structure.instrument],
    ['Montant', structure.montant],
    ['Valorisation pré-money', structure.valorisation_premoney],
    ['Dilution estimée', structure.dilution],
    ['Horizon de sortie', structure.horizon_sortie || structure.calendrier],
    ['IRR cible', structure.irr_cible],
  ].filter(([, v]) => v);

  const sec12 = `
<h2>12. Structure proposée</h2>
${structFields.length > 0 ? `<div class="ig">${structFields.map(([l, v]) => igField(l as string, safe(v))).join('')}</div>` : ''}
${structure.conditions ? `<h3>Conditions</h3><p>${typeof structure.conditions === 'string' ? structure.conditions : renderGenericSection(structure.conditions)}</p>` : ''}
${arr(structure.droits_investisseur).length > 0 ? `<h3>Droits investisseur</h3><ul>${arr(structure.droits_investisseur).map((d: string) => `<li>${d}</li>`).join('')}</ul>` : ''}
${arr(structure.termes).length > 0 ? `<h3>Termes</h3><ul>${arr(structure.termes).map((t: any) => `<li>${typeof t === 'string' ? t : `<strong>${t.terme || t.label || '—'}</strong> : ${t.valeur || t.detail || '—'}`}</li>`).join('')}</ul>` : ''}
${arr(structure.conditions_prealables).length > 0 ? `<h3>Conditions préalables au closing</h3><ul class="cond">${arr(structure.conditions_prealables).map((c: string) => `<li>${c}</li>`).join('')}</ul>` : ''}`;

  // ── Section 13: Final Recommendation ──
  const sec13 = `
<h2>13. Recommandation finale</h2>
<div style="display:flex;gap:16px;align-items:center;margin:16px 0">
  <div class="sb"><span class="n">${score}</span><span class="l">Score IR<br>/100</span></div>
  <div class="vd ${vdClass}" style="flex:1">${vdIcon} ${verdict}</div>
</div>
${reco.justification ? `<p>${reco.justification}</p>` : ''}
${arr(reco.conditions).length > 0 ? `<h3>Conditions</h3><ul class="cond">${arr(reco.conditions).map((c: string) => `<li>${c}</li>`).join('')}</ul>` : ''}
${arr(reco.prochaines_etapes).length > 0 ? `<h3>Prochaines étapes</h3><ul class="next">${arr(reco.prochaines_etapes).map((s: string) => `<li>→ ${s}</li>`).join('')}</ul>` : ''}`;

  // ── Section 14: Annexes ──
  const sec14 = Object.keys(annexes).length > 0 ? `
<h2>14. Annexes</h2>
${renderGenericSection(annexes)}` : '';

  // ── Footer ──
  const footer = `<div class="pf">ESONO — Investment Readiness Platform · Document confidentiel · ${dateStr}</div>`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${titre}</title><style>${CSS}</style></head><body><div class="doc">
${cover}
${toc}
${sec1}
${sec2}
${sec3}
${sec4}
${sec5}
${sec6}
${sec7}
${sec8}
${sec9}
${sec10}
${sec11}
${sec12}
${sec13}
${sec14}
${footer}
</div></body></html>`;
}
