// Reporting de candidatures (PDF) — AGRÉGATEUR côté client.
// Ne recalcule rien : compile screening_score / screening_data / form_data déjà
// en mémoire (array `candidatures` de ProgrammeDetailPage). Réutilise le pipeline
// d'export existant (exportToPdf → proxy-parser /generate-pdf → WeasyPrint) et la
// charte des exports existants (export-report-pdf.ts).
//
// Structure : Page 1 = tableau de bord (agrégats + table triée par Score IA).
//             Pages 2..N = une fiche par candidature (miroir du drawer de détail).

import { exportToPdf } from './export-pdf';
import { safeText, fmt, escapeHtml } from './candidature-format';

const NAVY = '#1B2A4A';

const STATUS_LABELS: Record<string, string> = {
  received: 'Reçue',
  in_review: 'En revue',
  pre_selected: 'Pré-sélectionnée',
  selected: 'Sélectionnée',
  rejected: 'Rejetée',
  waitlisted: "Liste d'attente",
};
const statusLabel = (s: string) => STATUS_LABELS[s] || s || '—';

// Mêmes seuils que le drawer (CandidatureDetailDrawer ~L157).
function scoreColor(score: any): string {
  const n = Number(score);
  return n >= 70 ? '#10b981' : n >= 40 ? '#f59e0b' : '#ef4444';
}

const esc = escapeHtml;

// ── Helpers de rendu ──────────────────────────────────────────────
function card(title: string, inner: string): string {
  if (!inner || !inner.trim()) return '';
  return `<div class="card"><h4>${esc(title)}</h4>${inner}</div>`;
}

function tile(value: string, label: string): string {
  return `<div class="tile"><p class="tile-v">${value}</p><p class="tile-l">${esc(label)}</p></div>`;
}

function kvLine(label: string, value: any): string {
  const v = value == null || String(value).trim() === '' ? '' : String(value);
  if (!v) return '';
  return `<p class="kv"><strong>${esc(label)} :</strong> <span>${esc(v)}</span></p>`;
}

function bulletList(items: any[]): string {
  const li = (items || [])
    .map((x) => (x == null || String(x).trim() === '' ? '' : `<li>${esc(safeText(x))}</li>`))
    .filter(Boolean)
    .join('');
  return li ? `<ul>${li}</ul>` : '';
}

// ── Blocs de fiche (miroir du drawer) ─────────────────────────────
function blockFicheEntreprise(f: any): string {
  if (!f) return '';
  const tiles = [
    f.ca_declare != null ? tile(esc(fmt(f.ca_declare)), `CA ${f.ca_devise || ''}`.trim()) : '',
    f.effectif_declare != null ? tile(esc(String(f.effectif_declare)), 'Employés') : '',
    f.anciennete_ans != null ? tile(esc(`${f.anciennete_ans} ans`), 'Ancienneté') : '',
    f.pays ? tile(esc(f.pays), f.ville || 'Pays') : '',
  ].filter(Boolean).join('');
  const inner =
    (f.stade ? `<span class="pill">${esc(f.stade)}</span>` : '') +
    (tiles ? `<div class="tiles">${tiles}</div>` : '') +
    (f.description_activite ? `<p class="muted">${esc(f.description_activite)}</p>` : '');
  return card('Fiche entreprise', inner);
}

function blockDimensions(dims: any): string {
  if (!dims || typeof dims !== 'object' || Object.keys(dims).length === 0) return '';
  const rows = Object.entries(dims).map(([k, v]: [string, any]) => {
    const score = typeof v === 'number' ? v : (v?.score ?? 0);
    const label = (v && v.label) ? ` — ${esc(v.label)}` : '';
    const pct = Math.max(0, Math.min(100, Number(score) || 0));
    return `<div class="dim">
      <div class="dim-head"><span>${esc(k.replace(/_/g, ' '))}${label}</span><span class="dim-score">${esc(String(score))}/100</span></div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
  return card('Dimensions diagnostiques', `<div class="dims">${rows}</div>`);
}

function blockIndicateurs(ind: any): string {
  if (!ind) return '';
  const tiles = [
    ind.ca_annuel != null ? tile(esc(fmt(ind.ca_annuel)), 'CA annuel') : '',
    ind.croissance_ca_pct != null ? tile(esc(`${ind.croissance_ca_pct}%`), 'Croissance') : '',
    ind.marge_estimee_pct != null ? tile(esc(`${ind.marge_estimee_pct}%`), 'Marge') : '',
    ind.rentabilite ? tile(esc(ind.rentabilite), 'Rentabilité') : '',
    ind.tresorerie_estimee ? tile(esc(ind.tresorerie_estimee), 'Trésorerie') : '',
    ind.niveau_endettement ? tile(esc(ind.niveau_endettement), 'Endettement') : '',
  ].filter(Boolean).join('');
  const inner =
    (ind.fiabilite ? `<span class="pill">Fiabilité : ${esc(ind.fiabilite)}</span>` : '') +
    (tiles ? `<div class="tiles">${tiles}</div>` : '') +
    (ind.commentaire ? `<p class="muted">${esc(ind.commentaire)}</p>` : '') +
    (ind.source_donnees ? `<p class="tiny">${esc(ind.source_donnees)}</p>` : '');
  return card('Indicateurs financiers', inner);
}

function blockMarche(m: any): string {
  if (!m) return '';
  const inner =
    (m.barriere_entree ? `<span class="pill">Barrière : ${esc(m.barriere_entree)}</span>` : '') +
    kvLine('Marché', m.marche_cible) +
    kvLine('Taille', m.taille_estimee) +
    kvLine('Positionnement', m.positionnement) +
    kvLine('Concurrence', m.concurrence) +
    kvLine('Avantage', m.avantage_competitif);
  return card('Marché & positionnement', inner);
}

function blockEquipe(e: any): string {
  if (!e) return '';
  const pills =
    (e.gouvernance ? `<span class="pill">${esc(e.gouvernance)}</span>` : '') +
    (e.key_man_risk ? `<span class="pill danger">Key-man risk</span>` : '');
  const inner =
    pills +
    kvLine('Dirigeant', e.profil_dirigeant) +
    kvLine('Équipe', e.equipe_direction) +
    (e.commentaire ? `<p class="muted">${esc(e.commentaire)}</p>` : '');
  return card('Équipe & gouvernance', inner);
}

function blockImpact(im: any): string {
  if (!im) return '';
  const tiles = [
    im.emplois_actuels != null ? tile(esc(String(im.emplois_actuels)), 'Emplois actuels') : '',
    im.pct_femmes != null ? tile(esc(`${im.pct_femmes}%`), 'Femmes') : '',
    im.pct_jeunes != null ? tile(esc(`${im.pct_jeunes}%`), 'Jeunes') : '',
  ].filter(Boolean).join('');
  const odd = Array.isArray(im.odd_potentiels) && im.odd_potentiels.length
    ? `<div class="pills">${im.odd_potentiels.map((o: string) => `<span class="pill">${esc(o)}</span>`).join('')}</div>`
    : '';
  const inner =
    (im.mesurabilite ? `<span class="pill">Mesurabilité : ${esc(im.mesurabilite)}</span>` : '') +
    (tiles ? `<div class="tiles">${tiles}</div>` : '') +
    kvLine('Projection', im.emplois_projetes) +
    kvLine('Bénéficiaires', im.beneficiaires_directs) +
    odd +
    (im.commentaire ? `<p class="muted">${esc(im.commentaire)}</p>` : '');
  return card('Impact mesurable', inner);
}

function blockBesoin(b: any): string {
  if (!b) return '';
  const tiles = [
    b.montant_demande != null ? tile(esc(fmt(b.montant_demande)), `Montant ${b.montant_devise || ''}`.trim()) : '',
    b.type_adapte ? tile(esc(b.type_adapte), 'Type adapté') : '',
    b.coherence_vs_ca ? tile(esc(b.coherence_vs_ca), 'vs CA') : '',
    b.capacite_absorption ? tile(esc(b.capacite_absorption), 'Absorption') : '',
  ].filter(Boolean).join('');
  const util = Array.isArray(b.utilisation_prevue) && b.utilisation_prevue.length
    ? `<p class="kv"><strong>Utilisation prévue :</strong></p>${bulletList(b.utilisation_prevue)}`
    : '';
  const inner =
    (tiles ? `<div class="tiles">${tiles}</div>` : '') +
    util +
    (b.commentaire ? `<p class="muted">${esc(b.commentaire)}</p>` : '');
  return card('Besoin de financement', inner);
}

function blockRisques(risques: any[]): string {
  if (!Array.isArray(risques) || risques.length === 0) return '';
  const items = risques.map((r: any) => `
    <div class="risk">
      <p><span class="pill">${esc(r.probabilite || '?')}</span> <strong>${esc(r.risque || '')}</strong>${r.type ? ` <span class="pill">${esc(r.type)}</span>` : ''}</p>
      ${r.impact_programme ? `<p class="muted">Impact : ${esc(r.impact_programme)}</p>` : ''}
      ${r.mitigation ? `<p class="mitig">Mitigation : ${esc(r.mitigation)}</p>` : ''}
    </div>`).join('');
  return card('Risques programme', items);
}

function blockTraction(t: any): string {
  if (!t) return '';
  const inner =
    (t.niveau_preuve ? `<span class="pill">${esc(t.niveau_preuve)}</span>` : '') +
    kvLine('Ancienneté', t.anciennete) +
    kvLine('Évolution CA', t.evolution_ca) +
    (Array.isArray(t.preuves_tangibles) && t.preuves_tangibles.length
      ? `<p class="kv"><strong>Preuves :</strong></p>${bulletList(t.preuves_tangibles)}` : '');
  return card('Traction & preuves', inner);
}

function blockBenchmark(bk: any): string {
  if (!bk) return '';
  const inner =
    (bk.position_vs_secteur ? `<span class="pill">${esc(bk.position_vs_secteur)}</span>` : '') +
    (bk.commentaire ? `<p class="muted">${esc(bk.commentaire)}</p>` : '');
  return card('Benchmark sectoriel', inner);
}

// Matching critères programme — 3 colonnes (validés / partiels / non remplis),
// miroir du drawer. Bloc pleine largeur (3 colonnes internes).
function blockMatching(m: any): string {
  if (!m) return '';
  const col = (title: string, items: any[], cls: string, mark: string): string => {
    if (!Array.isArray(items) || items.length === 0) return '';
    const li = items
      .map((it) => `<div class="mc-item ${cls}"><span class="mc-mark">${mark}</span><span>${esc(safeText(it))}</span></div>`)
      .join('');
    return `<div class="mc-col"><p class="mc-h ${cls}">${esc(title)} (${items.length})</p>${li}</div>`;
  };
  const cols = [
    col('Validés', m.criteres_ok, 'ok', '✓'),
    col('Partiels', m.criteres_partiels, 'partial', '~'),
    col('Non remplis', m.criteres_ko, 'ko', '✗'),
  ].filter(Boolean).join('');
  if (!cols) return '';
  return card('Matching critères programme', `<div class="mc">${cols}</div>`);
}

function blockContact(c: any): string {
  const inner =
    kvLine('Nom', c.contact_name) +
    kvLine('Email', c.contact_email) +
    kvLine('Tél', c.contact_phone);
  return card('Contact', inner || '<p class="muted">Non renseigné</p>');
}

// ── Fiche complète (une page) ─────────────────────────────────────
function ficheHtml(c: any, index: number): string {
  const s = c.screening_data || {};
  const hasError = s && typeof s === 'object' && s._error;
  const dims = s.diagnostic_dimensions || s.dimensions || s.scores_dimensions;
  const score = c.screening_score;
  const color = scoreColor(score);

  const scoreBadge = score != null
    ? `<div class="score-badge" style="background:${color}">${esc(String(score))}</div>`
    : `<div class="score-badge na">—</div>`;
  const tag = s.classification ? `<span class="class-tag">${esc(s.classification)}</span>` : '';

  // Blocs primaires (pleine largeur) : l'arbitrage de tête.
  const primary = [
    s.resume_comite ? card('Synthèse', `<p>${esc(s.resume_comite)}</p>`) : '',
    blockFicheEntreprise(s.fiche_entreprise),
    blockDimensions(dims),
    blockMatching(s.matching_criteres),
  ].filter(Boolean).join('');

  // Blocs secondaires ("voir plus") + contact : rendus en 2 COLONNES pour tenir
  // la fiche sur ~2 pages A4 sans rien couper (colonnes multiples CSS +
  // break-inside:avoid par carte → compression, jamais troncature).
  const contactBlock = blockContact(c);
  const secondaryDiag = [
    blockIndicateurs(s.indicateurs_financiers),
    blockMarche(s.marche_positionnement),
    blockEquipe(s.equipe_gouvernance),
    blockImpact(s.impact_mesurable),
    blockBesoin(s.besoin_financement),
    blockRisques(s.risques_programme),
    blockTraction(s.traction),
    blockBenchmark(s.benchmark_declaratif),
  ].filter(Boolean).join('');

  // Garde-fou : screening incomplet/absent → mention, jamais de page vide.
  const hasDiag = !!(primary || secondaryDiag);
  const noDiag = !hasDiag
    ? `<div class="card"><p class="muted">Diagnostic IA ${hasError ? 'en erreur' : 'non disponible'} — données non disponibles pour cette candidature.</p></div>`
    : '';

  return `
  <section class="fiche">
    <div class="fiche-head">
      <div class="fiche-title">
        <span class="fiche-idx">Fiche ${index}</span>
        <h2>${esc(c.company_name || 'Candidature')}</h2>
      </div>
      <div class="fiche-score">
        ${scoreBadge}
        <div class="score-meta">
          <span class="score-lbl">Score IA</span>
          ${tag}
          <span class="status-lbl">${esc(statusLabel(c.status))}</span>
        </div>
      </div>
    </div>
    ${primary}
    ${noDiag}
    <div class="grid2">${contactBlock}${secondaryDiag}</div>
  </section>`;
}

// ── Page 1 : tableau de bord ──────────────────────────────────────
function dashboardHtml(candidatures: any[]): string {
  const total = candidatures.length;

  const byStatus: Record<string, number> = {};
  const bySector: Record<string, number> = {};
  for (const c of candidatures) {
    const st = c.status || 'received';
    byStatus[st] = (byStatus[st] || 0) + 1;
    const sec = (c.form_data && c.form_data.secteur)
      || (c.screening_data && c.screening_data.fiche_entreprise && c.screening_data.fiche_entreprise.secteur_activite)
      || 'Non renseigné';
    bySector[sec] = (bySector[sec] || 0) + 1;
  }

  const statusChips = Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([st, n]) => `<span class="chip"><b>${n}</b> ${esc(statusLabel(st))}</span>`).join('');

  const sectorChips = Object.entries(bySector)
    .sort((a, b) => b[1] - a[1])
    .map(([sec, n]) => `<span class="chip"><b>${n}</b> ${esc(sec)}</span>`).join('');

  // Tri par Score IA décroissant ; non screenées (null) en bas.
  const sorted = [...candidatures].sort((a, b) => {
    const sa = a.screening_score == null ? -Infinity : Number(a.screening_score);
    const sb = b.screening_score == null ? -Infinity : Number(b.screening_score);
    return sb - sa;
  });

  const rows = sorted.map((c) => {
    const s = c.screening_data || {};
    const score = c.screening_score;
    const scoreCell = score != null
      ? `<span class="score-pin" style="background:${scoreColor(score)}">${esc(String(score))}</span>${s.classification ? ` <span class="tag-sm">${esc(s.classification)}</span>` : ''}`
      : '<span class="muted">—</span>';
    const sec = (c.form_data && c.form_data.secteur)
      || (s.fiche_entreprise && s.fiche_entreprise.secteur_activite) || '—';
    const ville = (c.form_data && (c.form_data.ville || c.form_data.localisation))
      || (s.fiche_entreprise && (s.fiche_entreprise.ville || s.fiche_entreprise.pays))
      || (c.form_data && c.form_data.pays) || '—';
    return `<tr>
      <td class="strong">${esc(c.company_name || '—')}</td>
      <td>${esc(sec)}</td>
      <td class="center">${scoreCell}</td>
      <td>${esc(statusLabel(c.status))}</td>
      <td>${esc(ville)}</td>
    </tr>`;
  }).join('');

  return `
  <section class="dashboard">
    <div class="agg">
      <div class="agg-total"><p class="agg-n">${total}</p><p class="agg-l">candidatures</p></div>
      <div class="agg-block">
        <p class="agg-h">Répartition par statut</p>
        <div class="chips">${statusChips || '<span class="muted">—</span>'}</div>
      </div>
      <div class="agg-block">
        <p class="agg-h">Répartition par secteur</p>
        <div class="chips">${sectorChips || '<span class="muted">—</span>'}</div>
      </div>
    </div>

    <h3 class="tbl-title">Récapitulatif — trié par Score IA</h3>
    <table class="recap">
      <thead><tr>
        <th>Entreprise</th><th>Secteur</th><th class="center">Score IA</th><th>Statut</th><th>Localisation</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="center muted">Aucune candidature</td></tr>'}</tbody>
    </table>
  </section>`;
}

// ── Assemblage + styles ───────────────────────────────────────────
export function buildHtml(candidatures: any[], programmeName: string): string {
  const date = new Date().toLocaleDateString('fr-FR');
  const fiches = candidatures.length
    ? [...candidatures]
        .sort((a, b) => {
          const sa = a.screening_score == null ? -Infinity : Number(a.screening_score);
          const sb = b.screening_score == null ? -Infinity : Number(b.screening_score);
          return sb - sa;
        })
        .map((c, i) => ficheHtml(c, i + 1))
        .join('')
    : '';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Reporting de candidatures — ${esc(programmeName)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; color: #333; line-height: 1.35; margin: 0; }
  .header { background: ${NAVY}; color: #fff; padding: 22px 24px; margin: -18mm -18mm 16px -18mm; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; color: #8BB8E8; font-size: 12px; }
  h2 { font-size: 16px; color: ${NAVY}; margin: 0; }
  h3 { font-size: 13px; color: ${NAVY}; margin: 18px 0 8px; }
  h4 { font-size: 11px; color: ${NAVY}; margin: 0 0 3px; }
  ul { padding-left: 18px; margin: 4px 0; }
  li { margin: 2px 0; }
  .muted { color: #6b7280; }
  .tiny { color: #9ca3af; font-size: 9px; margin: 4px 0 0; }
  .center { text-align: center; }
  .strong { font-weight: 600; }

  /* Page 1 */
  .agg { display: flex; gap: 12px; margin-bottom: 8px; }
  .agg-total { background: ${NAVY}; color: #fff; border-radius: 8px; padding: 12px 18px; text-align: center; min-width: 90px; }
  .agg-n { font-size: 30px; font-weight: 700; margin: 0; }
  .agg-l { margin: 0; font-size: 10px; color: #8BB8E8; }
  .agg-block { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
  .agg-h { font-weight: 600; font-size: 10px; text-transform: uppercase; color: #6b7280; margin: 0 0 6px; letter-spacing: .3px; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { background: #f3f4f6; border-radius: 12px; padding: 2px 9px; font-size: 10px; }
  .chip b { color: ${NAVY}; }
  .tbl-title { border-bottom: 2px solid ${NAVY}; padding-bottom: 4px; }
  table.recap { width: 100%; border-collapse: collapse; }
  table.recap th { background: ${NAVY}; color: #fff; text-align: left; padding: 7px 8px; font-size: 10px; }
  table.recap td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; font-size: 10px; }
  table.recap tr:nth-child(even) td { background: #f9fafb; }
  .score-pin { display: inline-block; color: #fff; font-weight: 700; border-radius: 10px; padding: 1px 8px; font-size: 10px; }
  .tag-sm { font-size: 8px; color: #6b7280; }

  /* Fiches */
  .fiche { page-break-before: always; }
  .fiche-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${NAVY}; padding-bottom: 8px; margin-bottom: 12px; }
  .fiche-idx { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #9ca3af; display: block; }
  .fiche-score { display: flex; align-items: center; gap: 10px; }
  .score-badge { width: 46px; height: 46px; border-radius: 50%; color: #fff; font-weight: 700; font-size: 17px; display: flex; align-items: center; justify-content: center; }
  .score-badge.na { background: #9ca3af; }
  .score-meta { display: flex; flex-direction: column; gap: 2px; }
  .score-lbl { font-size: 10px; font-weight: 600; }
  .class-tag { border: 1px solid ${NAVY}; color: ${NAVY}; border-radius: 4px; padding: 1px 6px; font-size: 9px; font-weight: 600; width: fit-content; }
  .status-lbl { font-size: 9px; color: #6b7280; }

  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 9px; margin-bottom: 6px; page-break-inside: avoid; }
  /* "Voir plus" en 2 colonnes : multicol = pagination propre entre pages + chaque carte insécable */
  .grid2 { column-count: 2; column-gap: 10px; }
  .grid2 > .card { break-inside: avoid; margin-top: 0; }
  .kv { margin: 2px 0; }
  .kv strong { color: ${NAVY}; }
  .tiles { display: flex; flex-wrap: wrap; gap: 5px; margin: 5px 0; }
  .tile { background: #f3f4f6; border-radius: 6px; padding: 4px 8px; text-align: center; min-width: 66px; }
  .tile-v { font-weight: 700; font-size: 12px; margin: 0; color: ${NAVY}; }
  .tile-l { font-size: 9px; color: #6b7280; margin: 0; }
  .pill { display: inline-block; border: 1px solid #d1d5db; border-radius: 10px; padding: 1px 8px; font-size: 9px; margin: 0 4px 4px 0; }
  .pill.danger { border-color: #fecaca; color: #b91c1c; }
  .pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .dims { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .dim-head { display: flex; justify-content: space-between; font-size: 10px; }
  .dim-score { font-weight: 600; }
  .bar { background: #e5e7eb; border-radius: 4px; height: 6px; overflow: hidden; margin: 2px 0 4px; }
  .bar-fill { background: ${NAVY}; height: 6px; }
  .risk { background: #f9fafb; border-radius: 6px; padding: 4px 6px; margin-bottom: 4px; }
  .risk p { margin: 2px 0; }
  .mitig { color: #6d28d9; }
  /* Matching critères programme (3 colonnes) */
  .mc { display: flex; gap: 12px; }
  .mc-col { flex: 1; }
  .mc-h { font-weight: 600; font-size: 10px; margin: 0 0 4px; }
  .mc-h.ok { color: #059669; }
  .mc-h.partial { color: #d97706; }
  .mc-h.ko { color: #dc2626; }
  .mc-item { display: flex; gap: 4px; font-size: 9.5px; margin-bottom: 3px; }
  .mc-mark { flex-shrink: 0; font-weight: 700; }
  .mc-item.ok .mc-mark { color: #10b981; }
  .mc-item.partial .mc-mark { color: #f59e0b; }
  .mc-item.ko .mc-mark { color: #ef4444; }
</style>
</head><body>
  <div class="header">
    <h1>Reporting de candidatures</h1>
    <p>${esc(programmeName)} — ${candidatures.length} candidature(s) — ${esc(date)}</p>
  </div>
  ${dashboardHtml(candidatures)}
  ${fiches}
  <p class="tiny center" style="margin-top:24px;">Généré par ESONO BIS Studio — Document confidentiel — ${esc(date)}</p>
</body></html>`;
}

function reportFilename(programmeName: string, ext: string): string {
  const safeName = (programmeName || 'programme').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `Reporting_Candidatures_${safeName}_${date}.${ext}`;
}

/**
 * Génère et télécharge le PDF de reporting d'un programme (via WeasyPrint côté serveur).
 * @param candidatures  L'array déjà en mémoire (lignes complètes, screening_data + form_data).
 * @param programmeName Nom du programme (pour l'en-tête + le nom de fichier).
 */
export async function exportCandidatureReportPdf(candidatures: any[], programmeName: string): Promise<void> {
  const html = buildHtml(candidatures || [], programmeName || 'Programme');
  await exportToPdf(html, reportFilename(programmeName, 'pdf'));
}

/**
 * Génère et télécharge le reporting en Word (.doc), 100% côté client.
 * Réutilise EXACTEMENT le même HTML que le PDF (buildHtml) et applique le trick
 * HTML→.doc (namespaces Office) déjà utilisé par FinalReportModal.downloadAsWord :
 * Microsoft Word ouvre nativement un HTML enveloppé des namespaces o/w.
 * Aucun serveur, aucune EF.
 */
export function exportCandidatureReportWord(candidatures: any[], programmeName: string): void {
  const html = buildHtml(candidatures || [], programmeName || 'Programme');
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const headInner = headMatch ? headMatch[1] : `<title>Reporting de candidatures</title>`;
  const bodyInner = bodyMatch ? bodyMatch[1] : html;
  const wordHtml =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8">${headInner}</head><body>${bodyInner}</body></html>`;

  const blob = new Blob([wordHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = reportFilename(programmeName, 'doc');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
