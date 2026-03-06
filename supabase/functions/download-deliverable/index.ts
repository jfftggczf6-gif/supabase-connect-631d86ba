import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateXlsxFile, buildInputsXlsx, buildFrameworkXlsx, buildPlanOvoXlsx } from "../_shared/xlsx-generator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== RICH HTML TEMPLATES =====

function htmlShell(title: string, score: number | null, body: string, enterprise: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - ${enterprise} | ESONO</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#f1f5f9;color:#1e293b;line-height:1.6}
.page{max-width:900px;margin:0 auto;padding:32px 24px}
.hero{background:linear-gradient(135deg,#1a2744 0%,#2d4a7c 50%,#1a2744 100%);color:#fff;padding:48px 40px;border-radius:16px;margin-bottom:32px;position:relative;overflow:hidden}
.hero::after{content:'';position:absolute;top:-50%;right:-20%;width:60%;height:200%;background:radial-gradient(circle,rgba(255,255,255,0.04) 0%,transparent 70%);pointer-events:none}
.hero h1{font-size:28px;font-weight:800;letter-spacing:-0.5px}
.hero .sub{opacity:.7;font-size:14px;margin-top:6px}
.hero .enterprise{font-size:16px;font-weight:600;margin-top:4px;opacity:.9}
.score-circle{width:90px;height:90px;border-radius:50%;border:4px solid rgba(255,255,255,.3);display:flex;flex-direction:column;align-items:center;justify-content:center;position:absolute;right:40px;top:50%;transform:translateY(-50%)}
.score-circle .num{font-size:36px;font-weight:900;line-height:1}.score-circle .lbl{font-size:10px;opacity:.6}
.card{background:#fff;border-radius:12px;padding:28px;margin-bottom:20px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.card h2{font-size:18px;font-weight:700;color:#1a2744;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
.card h3{font-size:15px;font-weight:600;color:#334155;margin:20px 0 10px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}
table th{text-align:left;padding:10px 12px;background:#f8fafc;border-bottom:2px solid #e2e8f0;font-weight:600;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
table td{padding:9px 12px;border-bottom:1px solid #f1f5f9}
table tr:hover td{background:#f8fafc}
.amount{text-align:right;font-variant-numeric:tabular-nums;font-weight:500}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
.badge-green{background:#dcfce7;color:#166534}.badge-red{background:#fef2f2;color:#991b1b}.badge-yellow{background:#fef9c3;color:#854d0e}.badge-blue{background:#dbeafe;color:#1e40af}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px}
.metric{padding:16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0}
.metric .val{font-size:22px;font-weight:800;color:#1a2744}.metric .lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
.tag{display:inline-block;margin:2px 4px 2px 0;padding:4px 10px;background:#f1f5f9;border-radius:6px;font-size:12px;color:#475569}
.progress-bar{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin:4px 0}
.progress-fill{height:100%;border-radius:4px;transition:width .3s}
.green{background:#22c55e}.yellow{background:#eab308}.red{background:#ef4444}.blue{background:#3b82f6}
.swot-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.swot-box{padding:16px;border-radius:10px;border:1px solid}
.swot-s{background:#f0fdf4;border-color:#bbf7d0}.swot-w{background:#fef2f2;border-color:#fecaca}
.swot-o{background:#eff6ff;border-color:#bfdbfe}.swot-t{background:#fefce8;border-color:#fef08a}
.swot-box h4{font-size:13px;font-weight:700;margin-bottom:8px}
.swot-box li{font-size:12px;margin-bottom:4px;padding-left:4px}
ul{padding-left:18px}li{font-size:13px;margin-bottom:5px;color:#475569}
.footer{text-align:center;margin-top:40px;padding:20px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0}
.toc{background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0}
.toc h3{font-size:14px;font-weight:700;margin-bottom:8px}.toc li{font-size:13px;margin-bottom:3px}
@media print{body{background:#fff}.page{padding:16px}.hero{page-break-after:avoid}}
</style>
</head>
<body>
<div class="page">
<div class="hero">
<h1>${title}</h1>
<p class="enterprise">${enterprise}</p>
<p class="sub">Généré par ESONO — Investment Readiness Platform • ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
${score != null ? `<div class="score-circle"><span class="num">${score}</span><span class="lbl">/100</span></div>` : ''}
</div>
${body}
<div class="footer">ESONO Investment Readiness Platform © ${new Date().getFullYear()} — Confidentiel</div>
</div>
</body>
</html>`;
}

function verdictBadge(v: string) {
  if (!v) return '';
  const c = v === 'Bon' || v === 'Fort' ? 'green' : v === 'Faible' ? 'red' : 'yellow';
  return `<span class="badge badge-${c}">${v}</span>`;
}

function fmt(n: any): string {
  if (n == null || n === '' || isNaN(Number(n))) return typeof n === 'string' ? n : '—';
  return new Intl.NumberFormat('fr-FR').format(Number(n));
}

// ===== BMC HTML =====
function bmcHTML(data: any, ent: string): string {
  const c = data.canvas || {};
  const canvasGrid = `<div class="card"><h2>📊 Business Model Canvas</h2>
<table><tr>
<th>Partenaires clés</th><th>Activités clés</th><th>Proposition de valeur</th><th>Relation client</th><th>Segments clients</th>
</tr><tr>
<td>${(c.partenaires_cles||[]).map((s:string)=>`• ${s}`).join('<br>')}</td>
<td>${(c.activites_cles||[]).map((s:string)=>`• ${s}`).join('<br>')}</td>
<td>${(c.proposition_valeur||[]).map((s:string)=>`• ${s}`).join('<br>')}</td>
<td>${(c.relation_client||[]).map((s:string)=>`• ${s}`).join('<br>')}</td>
<td>${(c.segments_clients||[]).map((s:string)=>`• ${s}`).join('<br>')}</td>
</tr><tr>
<th colspan="2">Structure de coûts</th><th>Ressources clés</th><th colspan="2">Flux de revenus</th>
</tr><tr>
<td colspan="2">${(c.structure_couts||[]).map((s:string)=>`• ${s}`).join('<br>')}</td>
<td>${(c.ressources_cles||[]).map((s:string)=>`• ${s}`).join('<br>')}</td>
<td colspan="2">${(c.flux_revenus||[]).map((s:string)=>`• ${s}`).join('<br>')}</td>
</tr></table></div>`;

  let swotHtml = '';
  if (data.swot) {
    swotHtml = `<div class="card"><h2>🧭 Analyse SWOT</h2><div class="swot-grid">
<div class="swot-box swot-s"><h4>✅ Forces</h4><ul>${(data.swot.forces||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
<div class="swot-box swot-w"><h4>⚠️ Faiblesses</h4><ul>${(data.swot.faiblesses||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
<div class="swot-box swot-o"><h4>🚀 Opportunités</h4><ul>${(data.swot.opportunites||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
<div class="swot-box swot-t"><h4>🔴 Menaces</h4><ul>${(data.swot.menaces||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
</div></div>`;
  }

  const recs = (data.recommandations||[]).length > 0 ? `<div class="card"><h2>🎯 Recommandations</h2><ul>${data.recommandations.map((r:string)=>`<li>${r}</li>`).join('')}</ul></div>` : '';

  return htmlShell('Business Model Canvas', data.score, canvasGrid + swotHtml + recs, ent);
}

// ===== SIC HTML =====
function sicHTML(data: any, ent: string): string {
  let body = '';
  if (data.mission_sociale) body += `<div class="card"><h2>🎯 Mission Sociale</h2><p style="font-size:15px;font-weight:500">${data.mission_sociale}</p>${data.probleme_social ? `<h3>Problème adressé</h3><p>${data.probleme_social}</p>` : ''}</div>`;

  if (data.theorie_changement) {
    const tc = data.theorie_changement;
    body += `<div class="card"><h2>🔄 Théorie du Changement</h2>
<div class="grid-4" style="grid-template-columns:repeat(5,1fr)">
${['inputs','activites','outputs','outcomes','impact'].map(k => `<div class="metric"><div class="lbl">${k.toUpperCase()}</div><ul style="margin-top:8px">${(tc[k]||[]).map((s:string)=>`<li style="font-size:11px">${s}</li>`).join('')}</ul></div>`).join('')}
</div></div>`;
  }

  if (data.odd_alignment?.length) {
    body += `<div class="card"><h2>🌍 Alignement ODD</h2><table><tr><th>ODD</th><th>Nom</th><th>Contribution</th><th>Niveau</th></tr>
${data.odd_alignment.map((o:any)=>`<tr><td><strong>ODD ${o.odd_number}</strong></td><td>${o.odd_name}</td><td>${o.contribution}</td><td>${verdictBadge(o.level)}</td></tr>`).join('')}</table></div>`;
  }

  if (data.indicateurs_impact?.length) {
    body += `<div class="card"><h2>📊 Indicateurs d'Impact</h2><table><tr><th>Indicateur</th><th>Valeur actuelle</th><th>Cible</th><th>Unité</th></tr>
${data.indicateurs_impact.map((i:any)=>`<tr><td>${i.indicateur}</td><td class="amount">${i.valeur_actuelle}</td><td class="amount">${i.cible}</td><td>${i.unite}</td></tr>`).join('')}</table></div>`;
  }

  return htmlShell('Social Impact Canvas', data.score, body, ent);
}

// ===== INPUTS HTML =====
function inputsHTML(data: any, ent: string): string {
  let body = '';
  const cr = data.compte_resultat || {};
  if (Object.keys(cr).length) {
    body += `<div class="card"><h2>📊 Compte de Résultat</h2><table><tr><th>Poste</th><th style="text-align:right">Montant (${data.devise||'FCFA'})</th></tr>
${Object.entries(cr).map(([k,v])=>`<tr${k.includes('resultat')?` style="font-weight:700;background:#f8fafc"`:''}>
<td>${k.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</td><td class="amount">${fmt(v)}</td></tr>`).join('')}</table></div>`;
  }

  const bilan = data.bilan || {};
  if (bilan.actif || bilan.passif) {
    body += `<div class="card"><h2>📋 Bilan</h2><div class="grid-2">
<div><h3>Actif</h3><table>${Object.entries(bilan.actif||{}).map(([k,v])=>`<tr${k.includes('total')?` style="font-weight:700"`:''}>
<td>${k.replace(/_/g,' ')}</td><td class="amount">${fmt(v)}</td></tr>`).join('')}</table></div>
<div><h3>Passif</h3><table>${Object.entries(bilan.passif||{}).map(([k,v])=>`<tr${k.includes('total')?` style="font-weight:700"`:''}>
<td>${k.replace(/_/g,' ')}</td><td class="amount">${fmt(v)}</td></tr>`).join('')}</table></div>
</div></div>`;
  }

  if (data.fiabilite) body += `<div class="card"><h2>📐 Fiabilité des données</h2><p><span class="badge badge-${data.fiabilite==='Élevée'?'green':data.fiabilite==='Moyenne'?'yellow':'red'}">${data.fiabilite}</span></p>
${data.hypotheses?.length ? `<h3>Hypothèses</h3><ul>${data.hypotheses.map((h:string)=>`<li>${h}</li>`).join('')}</ul>` : ''}</div>`;

  return htmlShell('Données Financières', data.score, body, ent);
}

// ===== FRAMEWORK HTML =====
function frameworkHTML(data: any, ent: string): string {
  let body = '';
  const ratios = data.ratios || {};

  for (const [cat, group] of Object.entries(ratios) as [string, any][]) {
    body += `<div class="card"><h2>${cat === 'rentabilite' ? '💰' : cat === 'liquidite' ? '💧' : cat === 'solvabilite' ? '🏦' : '📊'} ${cat.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</h2>
<table><tr><th>Ratio</th><th>Valeur</th><th>Benchmark/Seuil</th><th>Verdict</th></tr>
${Object.entries(group).map(([k,v]:any)=>`<tr><td>${k.replace(/_/g,' ')}</td><td class="amount">${v?.valeur||v}</td><td>${v?.benchmark||v?.seuil||'—'}</td><td>${verdictBadge(v?.verdict||'')}</td></tr>`).join('')}</table></div>`;
  }

  if (data.points_forts?.length || data.points_faibles?.length) {
    body += `<div class="grid-2">
<div class="card" style="border-left:4px solid #22c55e"><h2>✅ Points forts</h2><ul>${(data.points_forts||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
<div class="card" style="border-left:4px solid #ef4444"><h2>⚠️ Points faibles</h2><ul>${(data.points_faibles||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div></div>`;
  }

  if (data.recommandations?.length) body += `<div class="card"><h2>🎯 Recommandations</h2><ul>${data.recommandations.map((r:string)=>`<li>${r}</li>`).join('')}</ul></div>`;

  return htmlShell('Framework Analyse Financière', data.score, body, ent);
}

// ===== DIAGNOSTIC HTML =====
function diagnosticHTML(data: any, ent: string): string {
  let body = '';
  if (data.synthese_executive) body += `<div class="card"><h2>📋 Synthèse</h2><p style="font-size:15px">${data.synthese_executive}</p>${data.niveau_maturite ? `<p style="margin-top:8px"><span class="badge badge-blue">${data.niveau_maturite}</span></p>` : ''}</div>`;

  const dims = data.diagnostic_par_dimension || {};
  if (Object.keys(dims).length) {
    body += `<div class="card"><h2>📊 Scores par dimension</h2>`;
    for (const [k, d] of Object.entries(dims) as [string, any][]) {
      const color = d.score >= 70 ? 'green' : d.score >= 50 ? 'yellow' : 'red';
      body += `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-weight:600;font-size:13px">${k.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</span><span class="badge badge-${color}">${d.score}%</span></div>
<div class="progress-bar"><div class="progress-fill ${color}" style="width:${d.score}%"></div></div>
<p style="font-size:12px;color:#64748b;margin-top:4px">${d.analyse||''}</p></div>`;
    }
    body += '</div>';
  }

  if (data.swot) {
    body += `<div class="card"><h2>🧭 SWOT</h2><div class="swot-grid">
<div class="swot-box swot-s"><h4>Forces</h4><ul>${(data.swot.forces||[]).map((s:any)=>`<li>${typeof s==='string'?s:s.item||s.description}</li>`).join('')}</ul></div>
<div class="swot-box swot-w"><h4>Faiblesses</h4><ul>${(data.swot.faiblesses||[]).map((s:any)=>`<li>${typeof s==='string'?s:s.item||s.description}</li>`).join('')}</ul></div>
<div class="swot-box swot-o"><h4>Opportunités</h4><ul>${(data.swot.opportunites||[]).map((s:any)=>`<li>${typeof s==='string'?s:s.item||s.description}</li>`).join('')}</ul></div>
<div class="swot-box swot-t"><h4>Menaces</h4><ul>${(data.swot.menaces||[]).map((s:any)=>`<li>${typeof s==='string'?s:s.item||s.description}</li>`).join('')}</ul></div>
</div></div>`;
  }

  if (data.verdict) body += `<div class="card" style="background:linear-gradient(135deg,#f0fdf4,#ecfeff);border-color:#86efac"><h2>🏆 Verdict</h2><p style="font-size:16px;font-weight:600;color:#166534">${data.verdict}</p></div>`;

  return htmlShell('Diagnostic Expert', data.score, body, ent);
}

// ===== PLAN OVO HTML =====
function planOvoHTML(data: any, ent: string): string {
  let body = '';

  if (data.hypotheses_base) {
    body += `<div class="card"><h2>📐 Hypothèses de base</h2><div class="grid-4">${Object.entries(data.hypotheses_base).map(([k,v])=>`<div class="metric"><div class="lbl">${k.replace(/_/g,' ')}</div><div class="val" style="font-size:16px">${v}</div></div>`).join('')}</div></div>`;
  }

  const scenarioConfig: Record<string, { emoji: string; color: string }> = {
    optimiste: { emoji: '🚀', color: '#22c55e' },
    realiste: { emoji: '📊', color: '#3b82f6' },
    pessimiste: { emoji: '⚠️', color: '#eab308' },
  };

  for (const [name, cfg] of Object.entries(scenarioConfig)) {
    const s = (data.scenarios || {})[name];
    if (!s) continue;
    body += `<div class="card" style="border-left:4px solid ${cfg.color}"><h2>${cfg.emoji} Scénario ${name.charAt(0).toUpperCase()+name.slice(1)}</h2>
<p style="font-size:13px;color:#64748b;margin-bottom:8px">${s.hypotheses||''}</p>
<p>Croissance CA: <strong>${s.taux_croissance_ca||'—'}</strong></p>`;
    if (s.projections?.length) {
      body += `<table><tr><th>Année</th><th style="text-align:right">CA</th><th style="text-align:right">Résultat Net</th><th style="text-align:right">Trésorerie</th></tr>
${s.projections.map((p:any)=>`<tr><td>${p.annee}</td><td class="amount">${fmt(p.ca)}</td><td class="amount">${fmt(p.resultat_net)}</td><td class="amount">${fmt(p.tresorerie)}</td></tr>`).join('')}</table>`;
    }
    body += '</div>';
  }

  if (data.indicateurs_cles) {
    body += `<div class="card"><h2>📈 Indicateurs Clés</h2><div class="grid-4">${Object.entries(data.indicateurs_cles).map(([k,v])=>`<div class="metric"><div class="lbl">${k.replace(/_/g,' ')}</div><div class="val" style="font-size:16px">${v}</div></div>`).join('')}</div></div>`;
  }

  return htmlShell('Plan Financier OVO', data.score, body, ent);
}

// ===== BUSINESS PLAN HTML =====
function businessPlanHTML(data: any, ent: string): string {
  let body = '';
  const re = data.resume_executif || {};

  // Table of contents
  body += `<div class="toc"><h3>📑 Table des matières</h3><ol>
<li>Résumé Exécutif</li><li>Analyse de Marché</li><li>Stratégie Commerciale</li><li>Plan Opérationnel</li><li>Plan Financier</li><li>Risques & Mitigations</li>
</ol></div>`;

  if (Object.keys(re).length) {
    body += `<div class="card"><h2>1. Résumé Exécutif</h2>`;
    for (const [k, v] of Object.entries(re)) {
      if (v) body += `<h3>${k.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</h3><p>${v}</p>`;
    }
    body += '</div>';
  }

  if (data.analyse_marche) {
    const am = data.analyse_marche;
    body += `<div class="card"><h2>2. Analyse de Marché</h2>
${am.taille_marche ? `<div class="metric" style="margin-bottom:16px"><div class="lbl">Taille du marché</div><div class="val">${am.taille_marche}</div></div>` : ''}
${am.positionnement ? `<h3>Positionnement</h3><p>${am.positionnement}</p>` : ''}
${am.tendances?.length ? `<h3>Tendances</h3><ul>${am.tendances.map((t:string)=>`<li>${t}</li>`).join('')}</ul>` : ''}
${am.concurrents?.length ? `<h3>Concurrents</h3><table><tr><th>Concurrent</th><th>Forces</th><th>Faiblesses</th></tr>${am.concurrents.map((c:any)=>`<tr><td>${c.nom||c}</td><td>${c.forces||'—'}</td><td>${c.faiblesses||'—'}</td></tr>`).join('')}</table>` : ''}
</div>`;
  }

  if (data.strategie_commerciale) {
    const sc = data.strategie_commerciale;
    body += `<div class="card"><h2>3. Stratégie Commerciale</h2>`;
    for (const [k, v] of Object.entries(sc)) {
      if (Array.isArray(v)) body += `<h3>${k.replace(/_/g,' ')}</h3><ul>${v.map((i:any)=>`<li>${typeof i==='string'?i:JSON.stringify(i)}</li>`).join('')}</ul>`;
      else if (v) body += `<h3>${k.replace(/_/g,' ')}</h3><p>${v}</p>`;
    }
    body += '</div>';
  }

  if (data.plan_financier_resume) {
    const pf = data.plan_financier_resume;
    body += `<div class="card"><h2>5. Plan Financier</h2>`;
    if (pf.montant_recherche) body += `<div class="metric" style="margin-bottom:16px"><div class="lbl">Montant recherché</div><div class="val">${pf.montant_recherche}</div></div>`;
    if (pf.utilisation_fonds?.length) {
      body += `<h3>Utilisation des fonds</h3><table><tr><th>Poste</th><th style="text-align:right">Montant</th><th style="text-align:right">%</th></tr>
${pf.utilisation_fonds.map((f:any)=>`<tr><td>${f.poste}</td><td class="amount">${f.montant}</td><td class="amount">${f.pourcentage}%</td></tr>`).join('')}</table>`;
    }
    body += '</div>';
  }

  if (data.risques_et_mitigations?.length) {
    body += `<div class="card"><h2>6. Risques & Mitigations</h2><table><tr><th>Risque</th><th>Probabilité</th><th>Impact</th><th>Mitigation</th></tr>
${data.risques_et_mitigations.map((r:any)=>`<tr><td>${r.risque}</td><td>${verdictBadge(r.probabilite||'')}</td><td>${verdictBadge(r.impact||'')}</td><td>${r.mitigation}</td></tr>`).join('')}</table></div>`;
  }

  if (data.conclusion) body += `<div class="card" style="background:linear-gradient(135deg,#eff6ff,#f0fdf4)"><h2>Conclusion</h2><p style="font-size:15px;font-style:italic">${data.conclusion}</p></div>`;

  return htmlShell('Business Plan', data.score, body, ent);
}

// ===== ODD HTML =====
function oddHTML(data: any, ent: string): string {
  let body = '';
  if (data.synthese) body += `<div class="card"><h2>📋 Synthèse</h2><p style="font-size:15px">${data.synthese}</p>${data.readiness_level ? `<p style="margin-top:8px"><span class="badge badge-blue">${data.readiness_level}</span></p>` : ''}</div>`;

  if (data.scores_par_categorie) {
    body += `<div class="card"><h2>📊 Scores par catégorie</h2>`;
    for (const [k, cat] of Object.entries(data.scores_par_categorie) as [string, any][]) {
      const color = cat.score >= 70 ? 'green' : cat.score >= 50 ? 'yellow' : 'red';
      body += `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between"><span style="font-weight:600;font-size:13px">${k}</span><span class="badge badge-${color}">${cat.score}% (${cat.items_pass}/${cat.items_total})</span></div>
<div class="progress-bar"><div class="progress-fill ${color}" style="width:${cat.score}%"></div></div></div>`;
    }
    body += '</div>';
  }

  if (data.checklist?.length) {
    body += `<div class="card"><h2>✅ Checklist Due Diligence</h2><table><tr><th>Critère</th><th>Catégorie</th><th>Status</th><th>Commentaire</th></tr>
${data.checklist.map((c:any)=>`<tr><td>${c.critere}</td><td><span class="tag">${c.categorie}</span></td><td>${c.status==='pass'?'<span class="badge badge-green">✓ Pass</span>':c.status==='fail'?'<span class="badge badge-red">✗ Fail</span>':'<span class="badge badge-yellow">⚠ Partiel</span>'}</td><td>${c.commentaire||''}${c.action_requise?`<br><strong style="color:#3b82f6">→ ${c.action_requise}</strong>`:''}</td></tr>`).join('')}</table></div>`;
  }

  if (data.red_flags?.length) {
    body += `<div class="card" style="border-left:4px solid #ef4444"><h2>🚩 Red Flags</h2><ul>${data.red_flags.map((r:string)=>`<li style="color:#991b1b">${r}</li>`).join('')}</ul></div>`;
  }

  if (data.actions_prioritaires?.length) {
    body += `<div class="card"><h2>🎯 Actions Prioritaires</h2><table><tr><th>Action</th><th>Priorité</th><th>Délai</th></tr>
${data.actions_prioritaires.map((a:any)=>`<tr><td>${a.action}</td><td>${verdictBadge(a.priorite||'')}</td><td><span class="tag">${a.delai}</span></td></tr>`).join('')}</table></div>`;
  }

  return htmlShell('Due Diligence ODD', data.score, body, ent);
}

// ===== CSV GENERATOR =====
function generateCSV(data: any): string {
  const rows: string[][] = [];
  const flatten = (obj: any, prefix = "") => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => {
        if (typeof item === "object") flatten(item, `${prefix}[${i}]`);
        else rows.push([`${prefix}[${i}]`, String(item)]);
      });
    } else {
      Object.entries(obj).forEach(([key, val]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof val === "object" && val !== null) flatten(val, fullKey);
        else rows.push([fullKey, String(val)]);
      });
    }
  };
  flatten(data);
  return "Champ,Valeur\n" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

// (XLSX generation moved to _shared/xlsx-generator.ts)

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const deliverableType = url.searchParams.get("type");
    const enterpriseId = url.searchParams.get("enterprise_id");
    const format = url.searchParams.get("format") || "html";

    if (!deliverableType || !enterpriseId) {
      return new Response(JSON.stringify({ error: "type and enterprise_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: ent } = await supabase.from("enterprises").select("name, user_id, coach_id").eq("id", enterpriseId).single();
    if (!ent || (ent.user_id !== user.id && ent.coach_id !== user.id)) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: deliv } = await supabase.from("deliverables").select("*").eq("enterprise_id", enterpriseId).eq("type", deliverableType).single();
    if (!deliv || !deliv.data) {
      return new Response(JSON.stringify({ error: "Deliverable not ready" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const safeName = ent.name.replace(/[^a-zA-Z0-9]/g, "_");
    const titleMap: Record<string, string> = {
      bmc_analysis: "Business Model Canvas", sic_analysis: "Social Impact Canvas",
      inputs_data: "Données Financières", framework_data: "Framework Analyse Financière",
      diagnostic_data: "Diagnostic Expert", plan_ovo: "Plan Financier OVO",
      business_plan: "Business Plan", odd_analysis: "Due Diligence ODD",
    };
    const title = titleMap[deliverableType] || deliverableType;

    // CSV format
    if (format === "csv") {
      return new Response(generateCSV(deliv.data), {
        headers: { ...corsHeaders, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safeName}_${deliverableType}.csv"` },
      });
    }

    // JSON format
    if (format === "json") {
      return new Response(JSON.stringify(deliv.data, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${safeName}_${deliverableType}.json"` },
      });
    }

    // XLSX format - real Office Open XML
    if (format === "xlsx") {
      const xlsxBuilders: Record<string, (d: any) => any> = {
        inputs_data: buildInputsXlsx,
        framework_data: buildFrameworkXlsx,
        plan_ovo: buildPlanOvoXlsx,
      };
      const builder = xlsxBuilders[deliverableType];
      const sheets = builder ? builder(deliv.data) : [{ name: title.substring(0, 31), headers: ['Champ', 'Valeur'], rows: Object.entries(deliv.data as Record<string, any>).filter(([_, v]) => typeof v !== 'object').map(([k, v]) => [k, String(v)]) }];
      const xlsxData = await generateXlsxFile(sheets);
      return new Response(xlsxData, {
        headers: { ...corsHeaders, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${safeName}_${deliverableType}.xlsx"` },
      });
    }

    // HTML format - use rich templates per module
    const richGenerators: Record<string, (d: any, e: string) => string> = {
      bmc_analysis: bmcHTML, sic_analysis: sicHTML, inputs_data: inputsHTML,
      framework_data: frameworkHTML, diagnostic_data: diagnosticHTML,
      plan_ovo: planOvoHTML, business_plan: businessPlanHTML, odd_analysis: oddHTML,
    };

    const generator = richGenerators[deliverableType];
    const html = generator ? generator(deliv.data, ent.name) : htmlShell(title, deliv.data?.score, `<div class="card"><pre style="white-space:pre-wrap;font-size:12px">${JSON.stringify(deliv.data, null, 2)}</pre></div>`, ent.name);

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="${safeName}_${deliverableType}.html"` },
    });

  } catch (e) {
    console.error("download-deliverable error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
