// Builder du Rapport de suivi de coaching (format ESONO, monochrome)
// Reproduit la mise en page du template Ideal Vivrier sans couleurs.

export interface RoadmapItem {
  prio: string;       // URGENT / HAUTE / MOYENNE / BASSE
  action: string;
  resp: string;
  echeance: string;
}

export interface SujetTravaille {
  sujet: string;
  avancement: string;
  statut: string;     // En cours / Clos / Bloqué
}

export interface PointCle {
  tag: string;        // URGENT / ATTENTION / POSITIF
  titre: string;
  description: string;
}

export interface SuiviReportInput {
  enterprise: any;
  // Métadonnées session
  sessionNumber: string;
  sessionDate: string;      // ISO YYYY-MM-DD
  coachNames: string;
  // Contenu généré / saisi
  synthese: string;
  pointsCles: PointCle[];
  sujetsTravailles: SujetTravaille[];
  roadmap: RoadmapItem[];
  documentsAObtenir: string[];
  nextSessionDate: string;  // ISO
  nextSessionObjectives: string[];
  noteCoach: string;
  // Scores auto-calculés
  scoreIrDebut: number;
  scoreIrActuel: number;
}

const esc = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const frDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const frDateLong = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const classification = (score: number) => {
  if (score >= 70) return 'AVANCER';
  if (score >= 40) return 'ACCOMPAGNER';
  if (score >= 20) return "COMPLETER D'ABORD";
  return 'REJETER';
};

export function buildSuiviReportHtml(input: SuiviReportInput): string {
  const {
    enterprise: ent,
    sessionNumber,
    sessionDate,
    coachNames,
    synthese,
    pointsCles,
    sujetsTravailles,
    roadmap,
    documentsAObtenir,
    nextSessionDate,
    nextSessionObjectives,
    noteCoach,
    scoreIrDebut,
    scoreIrActuel,
  } = input;

  const delta = scoreIrActuel - scoreIrDebut;
  const deltaArrow = delta >= 0 ? '↑' : '↓';
  const deltaSign = delta > 0 ? '+' : '';

  const pointsClesRows = (pointsCles || [])
    .filter((p) => p.tag || p.titre || p.description)
    .map(
      (p) => `<li><strong>${esc(p.tag)}</strong>  <em>${esc(p.titre)}</em> — ${esc(p.description)}</li>`
    )
    .join('');

  const sujetsRows = (sujetsTravailles || [])
    .filter((s) => s.sujet)
    .map(
      (s) => `<tr><td>${esc(s.sujet)}</td><td>${esc(s.avancement)}</td><td>${esc(s.statut)}</td></tr>`
    )
    .join('');

  const roadmapRows = (roadmap || [])
    .filter((r) => r.action)
    .map(
      (r) =>
        `<tr><td>${esc(r.prio)}</td><td>${esc(r.action)}</td><td>${esc(r.resp)}</td><td>${esc(r.echeance)}</td></tr>`
    )
    .join('');

  const docsItems = (documentsAObtenir || [])
    .filter((d) => d && d.trim())
    .map((d) => `<li>${esc(d)}</li>`)
    .join('');

  const objectifsItems = (nextSessionObjectives || [])
    .filter((o) => o && o.trim())
    .map((o, i) => `<li>(${i + 1}) ${esc(o)}</li>`)
    .join('');

  // CSS strictement monochrome : noir sur blanc, hiérarchie par graisse/taille/italique.
  const css = `
@page { size: A4; margin: 18mm; }
body { font-family: "Inter", "Segoe UI", system-ui, sans-serif; font-size: 10.5pt; color: #111; line-height: 1.5; max-width: 180mm; margin: 0 auto; padding: 0; }
h1 { font-size: 20pt; margin: 0 0 2px; font-weight: 700; color: #111; }
h2 { font-size: 12pt; margin: 22px 0 10px; font-weight: 700; color: #111; border-bottom: 1px solid #111; padding-bottom: 3px; }
h3 { font-size: 11pt; margin: 14px 0 6px; font-weight: 600; color: #111; }
.subtitle { font-size: 12pt; color: #111; margin: 2px 0; }
.meta { font-size: 10pt; color: #111; margin: 2px 0 14px; }
.score-box { border: 1px solid #111; padding: 10px 14px; margin: 12px 0 22px; font-size: 11pt; }
.score-box .score { font-size: 16pt; font-weight: 700; color: #111; }
.score-box .delta { font-size: 10pt; color: #111; margin-top: 2px; }
p { margin: 6px 0; color: #111; }
ul { margin: 6px 0 6px 22px; padding: 0; color: #111; }
ul li { margin: 3px 0; color: #111; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 10pt; }
th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; vertical-align: top; color: #111; }
th { font-weight: 700; background: transparent; }
.note-coach { border: 1px solid #333; padding: 10px 14px; margin: 8px 0; font-style: italic; color: #111; }
.footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #333; font-size: 9pt; color: #111; text-align: center; }
strong { color: #111; }
em { color: #111; }
/* Impression monochrome stricte — on force la couleur noire partout même si un style externe tente d'injecter une couleur */
* { color: #111 !important; }
`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Rapport de coaching — ${esc(ent?.name || '')}</title>
<style>${css}</style>
</head><body>

<h1>Rapport de coaching</h1>
<div class="subtitle">${esc(ent?.name || '')}</div>
<div class="meta">Session${sessionNumber ? ' n°' + esc(sessionNumber) : ''}${sessionDate ? ' — ' + esc(frDate(sessionDate)) : ''}${coachNames ? ' — Coachs : ' + esc(coachNames) : ''}</div>

<div class="score-box">
  <div><strong>Score IR</strong></div>
  <div class="score">${scoreIrDebut} → ${scoreIrActuel}</div>
  <div class="delta">${deltaArrow} ${deltaSign}${delta} pts · ${classification(scoreIrActuel)}</div>
</div>

<h2>📌 Synthèse de la session</h2>
<p>${esc(synthese) || '—'}</p>

<h2>🎯 Points clés à retenir</h2>
${pointsClesRows ? `<ul>${pointsClesRows}</ul>` : '<p>—</p>'}

<h2>✅ Sujets travaillés</h2>
${
  sujetsRows
    ? `<table>
  <thead><tr><th style="width:38%">Sujet</th><th style="width:42%">Avancement</th><th style="width:20%">Statut</th></tr></thead>
  <tbody>${sujetsRows}</tbody>
</table>`
    : '<p>—</p>'
}

<h2>📋 Feuille de route 30 jours</h2>
${
  roadmapRows
    ? `<table>
  <thead><tr><th style="width:14%">Prio.</th><th style="width:54%">Action</th><th style="width:18%">Resp.</th><th style="width:14%">Échéance</th></tr></thead>
  <tbody>${roadmapRows}</tbody>
</table>`
    : '<p>—</p>'
}

<h2>📎 En attente &amp; prochaine session</h2>
<h3>📂 Documents à obtenir</h3>
${docsItems ? `<ul>${docsItems}</ul>` : '<p>—</p>'}

<h3>📅 Prochaine session</h3>
<p><strong>Date :</strong> ${esc(frDateLong(nextSessionDate))}</p>
${objectifsItems ? `<p><strong>Objectifs :</strong></p><ul>${objectifsItems}</ul>` : ''}

<h2>💬 Note coach (visibilité chef de programme)</h2>
<div class="note-coach">${esc(noteCoach) || '—'}</div>

<div class="footer">ESONO Investment Readiness Platform © ${new Date().getFullYear()} — Confidentiel</div>

</body></html>`;
}
