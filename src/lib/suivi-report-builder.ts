export function buildSuiviReportHtml(data: {
  enterprise: any;
  deliverables: any[];
  notes: any[];
  uploads: any[];
  coachComment: string;
  nextSteps: string;
  coachName: string;
}): string {
  const { enterprise: ent, deliverables, notes, uploads, coachComment, nextSteps, coachName } = data;

  const preScreening = deliverables.find(d => d.type === 'pre_screening')?.data as any;
  const diagnostic = deliverables.find(d => d.type === 'diagnostic_data')?.data as any;
  const framework = deliverables.find(d => d.type === 'framework_data')?.data as any;
  const inputs = deliverables.find(d => d.type === 'inputs_data')?.data as any;

  const scoreInitial = preScreening?.pre_screening_score || null;
  const scoreActuel = diagnostic?.score_global || ent.score_ir || 0;
  const ca = inputs?.compte_resultat?.chiffre_affaires || framework?.kpis?.ca_annee_n || 0;
  const margeBrute = framework?.kpis?.marge_brute || inputs?.kpis?.marge_brute_pct || 0;
  const ebitda = framework?.kpis?.ebitda || 0;
  const tresorerie = inputs?.bilan?.actif?.tresorerie || framework?.tresorerie_bfr?.tresorerie_nette || 0;
  const effectifs = ent.employees_count || 0;

  const rdvNotes = notes.filter((n: any) => n.date_rdv).sort((a: any, b: any) =>
    new Date(b.date_rdv).getTime() - new Date(a.date_rdv).getTime()
  );
  const livrableTypes = deliverables.map((d: any) => d.type);

  const bloquantsLeves = diagnostic?.progression?.bloquants_leves || [];
  const bloquantsRestants = diagnostic?.progression?.bloquants_restants || [];

  const fmt = (v: number) => v ? Math.round(v / 1e6) + 'M' : '—';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Rapport de suivi — ${ent.name}</title>
<style>
@page{size:A4;margin:16mm}
body{font-family:"Segoe UI",system-ui,sans-serif;font-size:10pt;color:#1E293B;line-height:1.6;max-width:190mm;margin:0 auto;padding:20px}
h1{font-size:16pt;color:#0F2B46;margin:0 0 4px}
h2{font-size:11pt;color:#1B5E8A;border-bottom:1.5px solid #1B5E8A;padding-bottom:3px;margin:18px 0 8px}
.meta{font-size:9pt;color:#64748B;line-height:1.8}
.coach-box{background:#EEEDFE;border-left:3px solid #AFA9EC;padding:10px 14px;margin:8px 0;font-size:10pt;color:#3C3489}
.reco-box{background:#E1F5EE;border-left:3px solid #5DCAA5;padding:8px 14px;margin:4px 0;font-size:10pt;color:#085041;font-weight:600}
.kpi-row{display:flex;gap:8px;margin:8px 0}
.kpi{flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:8px;text-align:center}
.kpi .v{font-size:14pt;font-weight:700;color:#0F2B46}
.kpi .l{font-size:8pt;color:#64748B}
.check{font-size:9pt;margin:2px 0}
.check .g{color:#16a34a}
.check .r{color:#dc2626}
.rdv{font-size:9pt;margin:2px 0;color:#475569}
.rdv b{color:#1E293B}
.liv{display:inline-block;padding:2px 8px;border-radius:4px;font-size:8pt;margin:2px}
.liv.ok{background:#EAF3DE;color:#27500A}
.liv.pending{background:#F1EFE8;color:#5F5E5A}
</style></head><body>
<h1>Rapport de suivi — ${ent.name}</h1>
<div class="meta">
${ent.sector || ''} — ${ent.country || "Côte d'Ivoire"}<br>
Coach : ${coachName} | Date : ${new Date().toLocaleDateString('fr-FR')}<br>
Accompagnement depuis : ${rdvNotes.length > 0 ? new Date(rdvNotes[rdvNotes.length - 1].date_rdv).toLocaleDateString('fr-FR') : '—'}
</div>

<h2>Commentaire du coach</h2>
<div class="coach-box">${coachComment || 'Aucun commentaire'}</div>
${nextSteps ? `<div class="reco-box">Prochaines étapes : ${nextSteps}</div>` : ''}

<h2>L'entreprise en bref</h2>
<div class="kpi-row">
<div class="kpi"><div class="v">${fmt(ca)}</div><div class="l">CA</div></div>
<div class="kpi"><div class="v">${margeBrute ? margeBrute + '%' : '—'}</div><div class="l">Marge brute</div></div>
<div class="kpi"><div class="v">${fmt(ebitda)}</div><div class="l">EBITDA</div></div>
<div class="kpi"><div class="v">${fmt(tresorerie)}</div><div class="l">Trésorerie</div></div>
<div class="kpi"><div class="v">${effectifs || '—'}</div><div class="l">Effectifs</div></div>
</div>

<h2>Progression</h2>
<p style="font-size:10pt"><strong>${scoreInitial || '?'}</strong> → <strong>${scoreActuel}</strong> ${scoreInitial ? `(${scoreActuel - scoreInitial > 0 ? '+' : ''}${scoreActuel - scoreInitial} pts)` : ''}</p>
${bloquantsLeves.map((b: string) => `<div class="check"><span class="g">✓</span> ${b}</div>`).join('')}
${bloquantsRestants.map((b: string) => `<div class="check"><span class="r">✗</span> ${b}</div>`).join('')}

<h2>Activité de coaching</h2>
${rdvNotes.map((n: any) => `<div class="rdv"><b>${new Date(n.date_rdv).toLocaleDateString('fr-FR')}</b> — ${n.titre || (n.resume_ia as string)?.substring(0, 100) || 'Note'}</div>`).join('')}
<p style="font-size:9pt;color:#64748B;margin-top:6px">Documents collectés : ${uploads.length} | Livrables : ${livrableTypes.length}</p>
<div>
${['pre_screening','bmc_analysis','sic_analysis','framework_data','plan_ovo','business_plan','odd_analysis','diagnostic_data','screening_report'].map(t =>
  `<span class="liv ${livrableTypes.includes(t) ? 'ok' : 'pending'}">${t.replace(/_/g,' ')}</span>`
).join('')}
</div>

</body></html>`;
}
