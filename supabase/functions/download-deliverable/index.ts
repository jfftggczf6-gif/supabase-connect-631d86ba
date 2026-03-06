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

// Safely extract an array of strings from any shape (array, object with items/postes, string, etc.)
function toArr(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v: any) => typeof v === 'string' ? v : v?.item || v?.libelle || v?.description || v?.nom || v?.name || v?.enonce || JSON.stringify(v));
  if (typeof val === 'object') {
    // Handle normalized shapes: { items: [...] }, { postes: [...] }, { enonce: "..." }, { principal: "..." }
    if (val.items) return toArr(val.items);
    if (val.postes) return toArr(val.postes);
    if (val.enonce) return [val.enonce, ...(val.avantages || [])];
    if (val.principal) return [val.principal];
    if (val.produit_principal) return [val.produit_principal];
    return [];
  }
  if (typeof val === 'string') return [val];
  return [];
}

// ===== BMC HTML =====
function bmcHTML(data: any, ent: string): string {
  const c = data.canvas || {};
  const diag = data.diagnostic || {};
  const swot = data.swot || {};
  const reco = data.recommandations || {};
  const scores = diag.scores_par_bloc || {};
  const scoreGlobal = data.score_global ?? data.score ?? null;

  const blocLabels: Record<string,string> = {
    proposition_valeur:'Proposition de Valeur',activites_cles:'Activités Clés',ressources_cles:'Ressources Clés',
    segments_clients:'Segments Clients',relations_clients:'Relations Clients',flux_revenus:'Flux de Revenus',
    partenaires_cles:'Partenaires Clés',canaux:'Canaux',structure_couts:'Structure de Coûts',
  };
  const barColor = (s:number) => s>=80?'green':s>=60?'yellow':'red';

  // Hero
  let body = `<div class="hero">
<h1>BUSINESS MODEL CANVAS</h1>
<p class="enterprise">${ent}</p>
${data.resume ? `<p class="sub" style="font-style:italic;max-width:600px">"${data.resume}"</p>` : ''}
<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
${(data.tags||[]).map((t:string)=>`<span style="padding:4px 12px;border-radius:20px;background:rgba(255,255,255,0.15);font-size:11px;font-weight:600">${t}</span>`).join('')}
</div>
${scoreGlobal!=null?`<div class="score-circle"><span class="num">${scoreGlobal}</span><span class="lbl">%</span></div>`:''}
</div>`;

  // Canvas 5-col grid
  const cellStyle = 'style="vertical-align:top;padding:16px;border:1px solid #e2e8f0;background:#fff;min-height:160px"';
  const cellTitle = (t:string) => `<div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1a2744;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px">${t}</div>`;

  const segItems = [
    c.segments_clients?.principal,
    c.segments_clients?.zone?`Zone: ${c.segments_clients.zone}`:null,
    c.segments_clients?.type_marche?`Type: ${c.segments_clients.type_marche}`:null,
    c.segments_clients?.probleme_resolu?`Problème résolu: ${c.segments_clients.probleme_resolu}`:null,
    c.segments_clients?.taille_marche?`Taille marché: ${c.segments_clients.taille_marche}`:null,
  ].filter(Boolean);

  const relItems = [c.relations_clients?.type, ...toArr(c.relations_clients?.items||c.relations_clients)].filter(Boolean);

  const pvItems = c.proposition_valeur?.enonce
    ? [`<strong>${c.proposition_valeur.enonce}</strong>`, ...(c.proposition_valeur.avantages||[]).map((a:string)=>`✓ ${a}`)]
    : toArr(c.proposition_valeur);

  body += `<div class="card" style="padding:0;overflow:hidden"><h2 style="padding:20px 20px 12px;margin:0;border:0">CANVAS — VUE D'ENSEMBLE</h2>
<table style="margin:0;border-collapse:collapse;table-layout:fixed"><tr>
<td ${cellStyle}>${cellTitle('PARTENAIRES CLÉS')}${toArr(c.partenaires_cles).map(s=>`<div style="font-size:11px;color:#475569;margin-bottom:3px">• ${s}</div>`).join('')}${c.partenaires_cles?.element_critique?`<div style="font-size:10px;color:#dc2626;font-weight:600;margin-top:6px">⚠ CRITIQUE: ${c.partenaires_cles.element_critique}</div>`:''}</td>
<td ${cellStyle}>${cellTitle('ACTIVITÉS CLÉS')}${toArr(c.activites_cles).map(s=>`<div style="font-size:11px;color:#475569;margin-bottom:3px">• ${s}</div>`).join('')}</td>
<td ${cellStyle} style="vertical-align:top;padding:16px;border:1px solid #e2e8f0;background:#f0f4ff;min-height:160px">${cellTitle('PROPOSITION DE VALEUR')}${pvItems.map(s=>`<div style="font-size:11px;color:#475569;margin-bottom:3px">${s}</div>`).join('')}</td>
<td ${cellStyle}>${cellTitle('RELATIONS CLIENTS')}${relItems.map(s=>`<div style="font-size:11px;color:#475569;margin-bottom:3px">• ${s}</div>`).join('')}</td>
<td ${cellStyle}>${cellTitle('SEGMENTS CLIENTS')}${segItems.map(s=>`<div style="font-size:11px;color:#475569;margin-bottom:3px">• ${s}</div>`).join('')}</td>
</tr></table>`;

  // Ressources clés row
  body += `<div style="padding:16px 20px;border-top:1px solid #e2e8f0">
<div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1a2744;margin-bottom:8px">RESSOURCES CLÉS</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px;color:#475569">`;
  if (c.ressources_cles?.categories) {
    for (const [k,v] of Object.entries(c.ressources_cles.categories)) {
      body += `<div><strong style="text-transform:capitalize">${k}:</strong> ${v}</div>`;
    }
  } else {
    toArr(c.ressources_cles).forEach(s => { body += `<div>• ${s}</div>`; });
  }
  body += `</div></div></div>`;

  // Structure de coûts + Flux de revenus
  body += `<div class="grid-2">`;
  // Coûts
  body += `<div class="card"><h2 style="font-size:15px">STRUCTURE DE COÛTS</h2>`;
  (c.structure_couts?.postes||[]).forEach((p:any) => {
    body += `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid #f1f5f9"><span>${p.libelle}</span><span style="color:#64748b">${p.montant} (${p.type||''} · ${p.pourcentage}%)</span></div>`;
  });
  if (c.structure_couts?.total_mensuel) body += `<p style="font-weight:700;margin-top:12px;padding-top:8px;border-top:2px solid #e2e8f0">TOTAL ≈ ${c.structure_couts.total_mensuel}</p>`;
  if (c.structure_couts?.cout_critique) body += `<p style="font-size:11px;color:#dc2626;font-weight:600;margin-top:4px">Coût critique: ${c.structure_couts.cout_critique}</p>`;
  body += `</div>`;
  // Revenus
  body += `<div class="card"><h2 style="font-size:15px">FLUX DE REVENUS</h2>`;
  const revFields = [
    ['Produit principal', c.flux_revenus?.produit_principal],
    ['Prix moyen', c.flux_revenus?.prix_moyen],
    ["Fréquence d'achat", c.flux_revenus?.frequence_achat],
    ['Volume estimé', c.flux_revenus?.volume_estime],
    ['Mode de paiement', c.flux_revenus?.mode_paiement],
  ];
  revFields.forEach(([l,v]) => {
    if (v) body += `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span style="color:#64748b">${l}</span><span style="font-weight:500">${v}</span></div>`;
  });
  if (c.flux_revenus?.ca_mensuel || c.flux_revenus?.marge_brute) {
    body += `<div style="margin-top:12px;padding-top:8px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between">`;
    if (c.flux_revenus?.ca_mensuel) body += `<div><div style="font-size:10px;color:#64748b">CA mensuel</div><div style="font-size:14px;font-weight:700">≈ ${c.flux_revenus.ca_mensuel}</div></div>`;
    if (c.flux_revenus?.marge_brute) body += `<div><div style="font-size:10px;color:#64748b">Marge brute</div><div style="font-size:14px;font-weight:700">≈ ${c.flux_revenus.marge_brute}</div></div>`;
    body += `</div>`;
  }
  body += `</div></div>`;

  // Diagnostic Expert
  body += `<div class="card"><h2>DIAGNOSTIC EXPERT</h2>
<p style="font-size:12px;color:#64748b;margin-bottom:16px">Scores par bloc BMC — Score global : <strong style="color:#1e293b">${scoreGlobal??'—'}%</strong></p>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">`;
  for (const [key,val] of Object.entries(scores) as [string,any][]) {
    const s = val?.score||0;
    const col = barColor(s);
    body += `<div style="padding:12px;border:1px solid #e2e8f0;border-radius:8px">
<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:11px;font-weight:600">${blocLabels[key]||key}</span><span style="font-size:12px;font-weight:700" class="badge badge-${col}">${s}%</span></div>
<div class="progress-bar"><div class="progress-fill ${col}" style="width:${s}%"></div></div>
${val?.commentaire?`<p style="font-size:10px;color:#64748b;margin-top:6px">${val.commentaire}</p>`:''}
</div>`;
  }
  body += `</div></div>`;

  // Forces & Points de vigilance
  body += `<div class="grid-2">
<div class="card" style="background:#f0fdf4;border-color:#bbf7d0"><h2 style="color:#166534">✅ Forces</h2><ul>${(diag.forces||[]).map((f:string)=>`<li>${f}</li>`).join('')}</ul></div>
<div class="card" style="background:#fefce8;border-color:#fef08a"><h2 style="color:#854d0e">⚠️ Points de vigilance</h2><ul>${(diag.points_vigilance||[]).map((p:string)=>`<li>${p}</li>`).join('')}</ul></div>
</div>`;

  // SWOT
  if (swot.forces || swot.faiblesses || swot.opportunites || swot.menaces) {
    body += `<div class="card"><h2>MATRICE SWOT SYNTHÉTIQUE</h2><div class="swot-grid">
<div class="swot-box swot-s"><h4>FORCES</h4><ul>${(swot.forces||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
<div class="swot-box swot-w"><h4>FAIBLESSES</h4><ul>${(swot.faiblesses||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
<div class="swot-box swot-o"><h4>OPPORTUNITÉS</h4><ul>${(swot.opportunites||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
<div class="swot-box swot-t"><h4>MENACES</h4><ul>${(swot.menaces||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
</div></div>`;
  }

  // Recommandations
  if (reco.court_terme || reco.moyen_terme || reco.long_terme) {
    body += `<div class="card"><h2>RECOMMANDATIONS STRATÉGIQUES</h2>`;
    if (reco.court_terme) body += `<div style="border-left:4px solid #22c55e;padding:12px 16px;margin-bottom:12px;border-radius:0 8px 8px 0;background:#f0fdf4"><h3 style="margin:0 0 4px">📌 Court terme — Consolider les fondations</h3><p style="font-size:12px;color:#475569">${reco.court_terme}</p></div>`;
    if (reco.moyen_terme) body += `<div style="border-left:4px solid #3b82f6;padding:12px 16px;margin-bottom:12px;border-radius:0 8px 8px 0;background:#eff6ff"><h3 style="margin:0 0 4px">📈 Moyen terme — Croissance maîtrisée</h3><p style="font-size:12px;color:#475569">${reco.moyen_terme}</p></div>`;
    if (reco.long_terme) body += `<div style="border-left:4px solid #8b5cf6;padding:12px 16px;margin-bottom:12px;border-radius:0 8px 8px 0;background:#f5f3ff"><h3 style="margin:0 0 4px">🚀 Long terme — Industrialisation et marque</h3><p style="font-size:12px;color:#475569">${reco.long_terme}</p></div>`;
    body += `</div>`;
  }

  // Footer quote
  body += `<div style="text-align:center;margin-top:24px;padding:16px;font-size:12px;color:#94a3b8;font-style:italic">"Les chiffres ne servent pas à juger le passé, mais à décider le futur."</div>`;

  return htmlShell('Business Model Canvas', scoreGlobal, body, ent);
}

// ===== SIC HTML =====
function sicHTML(data: any, ent: string): string {
  const score = data.score_global ?? data.score ?? 0;
  const dims = data.dimensions || {};
  const chiffres = data.chiffres_cles || {};
  const canvas = data.canvas_blocs || {};
  const risques = data.risques_attenuation?.risques || [];
  const tc = data.theorie_du_changement || data.theorie_changement || {};
  const changements = data.changements || {};
  const recos = data.recommandations || [];
  const oddBloc = canvas.odd_cibles || {};
  const swot = data.swot || {};
  const partiesPrenantes = data.parties_prenantes || [];
  const oddDetail = data.odd_detail || oddBloc.odds || [];
  const alignement = data.alignement_modele || {};
  const evolution = data.evolution_score || [];
  const maturite = data.niveau_maturite || '';
  const palierColor = score >= 86 ? '#16a34a' : score >= 71 ? '#22c55e' : score >= 51 ? '#eab308' : score >= 31 ? '#f97316' : '#ef4444';
  const scColor = (s:number) => s>=80?'#22c55e':s>=50?'#eab308':'#ef4444';

  let body = '';

  // Score Hero
  body += `<div style="background:linear-gradient(135deg,#1a2744,#2d4a7c,#1a2744);padding:40px;border-radius:16px;color:#fff;margin-bottom:24px">
<p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,.4);margin-bottom:8px">Social Impact Canvas</p>
<div style="font-size:48px;font-weight:900;line-height:1">${score}<span style="font-size:24px;opacity:.4">/100</span></div>
<div style="width:100%;height:12px;background:rgba(255,255,255,.1);border-radius:6px;margin:12px 0;overflow:hidden"><div style="width:${score}%;height:100%;border-radius:6px;background:${palierColor}"></div></div>
<div style="font-size:18px;font-weight:600;color:${palierColor}">${data.label || data.palier || ''}</div>
${data.synthese_impact ? `<p style="font-size:14px;color:rgba(255,255,255,.6);font-style:italic;margin-top:12px;max-width:700px;line-height:1.6">${data.synthese_impact}</p>` : ''}
</div>`;

  // Dimensions
  const dimOrder = ['probleme_vision','beneficiaires','mesure_impact','alignement_odd','gestion_risques'];
  body += `<div class="card"><h2>SCORES PAR DIMENSION</h2>`;
  for (const key of dimOrder) {
    const dim = dims[key]; if (!dim) continue;
    const s = dim.score || 0;
    const c = scColor(s);
    body += `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
<span style="font-weight:600;font-size:13px;min-width:200px">${dim.label || key}</span>
<span style="font-weight:700;font-size:14px;color:${c}">${s}%</span></div>
<div class="progress-bar" style="height:10px"><div class="progress-fill" style="width:${s}%;background:${c};height:100%;border-radius:4px"></div></div>
${dim.commentaire ? `<p style="font-size:12px;color:#64748b;margin-top:6px">${dim.commentaire}</p>` : ''}</div>`;
  }
  body += `</div>`;

  // Chiffres clés
  body += `<div class="grid-4" style="margin-bottom:24px">`;
  const kpis = [
    { val: chiffres.beneficiaires_directs?.nombre, label: `Bénéficiaires directs${chiffres.beneficiaires_directs?.horizon ? ` (${chiffres.beneficiaires_directs.horizon})` : ''}` },
    { val: chiffres.beneficiaires_indirects?.nombre, label: 'Bénéficiaires indirects' },
    { val: chiffres.impact_total_projete?.nombre, label: 'Impact total projeté' },
    { val: chiffres.odd_adresses?.nombre, label: 'ODD adressés' },
  ];
  for (const kpi of kpis) {
    body += `<div style="background:linear-gradient(135deg,#1a2744,#2d4a7c);padding:20px;border-radius:12px;text-align:center;color:#fff">
<div style="font-size:32px;font-weight:900">${fmt(kpi.val)}</div>
<div style="font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px">${kpi.label}</div></div>`;
  }
  body += `</div>`;

  // Canvas grid
  const canvasBlock = (icon: string, title: string, points: string[]) =>
    `<div style="background:#fff;padding:16px;min-height:180px;border:1px solid #e2e8f0">
<div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1a2744;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px">${icon} ${title}</div>
${(points||[]).map(p => `<div style="font-size:11px;color:#475569;margin-bottom:3px">• ${p}</div>`).join('')}</div>`;

  body += `<div class="card" style="padding:0;overflow:hidden"><h2 style="padding:20px;margin:0;border:0">SOCIAL IMPACT CANVAS — VUE SYNTHÉTIQUE</h2>`;
  body += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e2e8f0">
${canvasBlock('🔴', canvas.probleme_social?.titre || 'PROBLÈME SOCIAL', canvas.probleme_social?.points || [])}
${canvasBlock('🟢', canvas.transformation_visee?.titre || 'TRANSFORMATION VISÉE', canvas.transformation_visee?.points || [])}
${canvasBlock('👥', canvas.beneficiaires?.titre || 'BÉNÉFICIAIRES', canvas.beneficiaires?.points || [])}
<div style="background:#fff;padding:16px;min-height:180px;border:1px solid #e2e8f0">
<div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1a2744;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px">🎯 ODD CIBLÉS</div>
<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
${(oddBloc.odds||[]).map((o:any) => `<div style="width:40px;height:40px;border-radius:4px;background:${o.couleur||'#666'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;border:${o.alignement==='fort'?'3px solid #fff':o.alignement==='faible'?'1px dashed rgba(255,255,255,.5)':'1px solid rgba(255,255,255,.7)'}">${o.numero}</div>`).join('')}
</div>
${(oddBloc.odds||[]).map((o:any) => `<div style="font-size:10px;color:#64748b">${o.nom}</div>`).join('')}
</div></div>`;

  body += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e2e8f0;border-top:1px solid #e2e8f0">
<div style="background:#fff;padding:16px;min-height:180px">
<div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1a2744;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px">📏 INDICATEURS & MESURE</div>
${(canvas.indicateurs_mesure?.indicateurs||[]).map((ind:any) => `<div style="font-size:11px;color:#475569;margin-bottom:4px"><span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;text-transform:uppercase;${ind.type==='impact'?'background:#dcfce7;color:#166534':ind.type==='outcome'?'background:#dbeafe;color:#1e40af':'background:#f1f5f9;color:#475569'}">${ind.type}</span> ${ind.nom}</div>`).join('')}
${canvas.indicateurs_mesure?.cible_1_an ? `<p style="font-size:10px;color:#64748b;margin-top:8px">🎯 Cible 1 an: ${canvas.indicateurs_mesure.cible_1_an}</p>` : ''}
${canvas.indicateurs_mesure?.methode ? `<p style="font-size:10px;color:#64748b">📐 ${canvas.indicateurs_mesure.methode}</p>` : ''}
</div>
${canvasBlock('💡', canvas.solution_activites?.titre || 'SOLUTION & ACTIVITÉS', canvas.solution_activites?.points || [])}
</div></div>`;

  // Risques
  if (risques.length) {
    body += `<div class="card"><h2>⚠️ RISQUES & ATTÉNUATION</h2>
<table><tr><th>Risque</th><th>Atténuation</th></tr>
${risques.map((r:any,i:number) => `<tr${i%2?'':' style="background:#f8fafc"'}><td>${r.risque}</td><td>${r.mitigation}</td></tr>`).join('')}</table></div>`;
  }

  // Théorie du changement
  const tcColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e'];
  const tcLabels = ['PROBLÈME','ACTIVITÉS','OUTPUTS','OUTCOMES','IMPACT'];
  const tcKeys = ['probleme','activites','outputs','outcomes','impact'];
  body += `<div class="card"><h2>🔄 THÉORIE DU CHANGEMENT</h2>
<div style="display:flex;align-items:stretch;gap:4px">
${tcKeys.map((k,i) => `<div style="flex:1;padding:12px;border-radius:8px;background:${tcColors[i]}15;border-left:4px solid ${tcColors[i]};min-height:90px">
<div style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:${tcColors[i]};margin-bottom:6px">${tcLabels[i]}</div>
<div style="font-size:11px;color:#1e293b;line-height:1.4">${tc[k]||'—'}</div>
</div>${i<4?'<div style="display:flex;align-items:center;font-size:16px;color:#94a3b8">→</div>':''}`).join('')}
</div></div>`;

  // Changements
  if (changements.court_terme || changements.moyen_terme || changements.long_terme) {
    const chColors = ['#22c55e','#3b82f6','#8b5cf6'];
    const chLabels = ['Court terme (0-12 mois)','Moyen terme (1-3 ans)','Long terme (3-5 ans)'];
    const chKeys = ['court_terme','moyen_terme','long_terme'];
    body += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
${chKeys.map((k,i) => `<div style="border:1px solid #e2e8f0;border-left:4px solid ${chColors[i]};border-radius:12px;padding:20px;background:#fff">
<h3 style="font-size:13px;font-weight:700;margin-bottom:8px">${chLabels[i]}</h3>
<p style="font-size:13px;color:#64748b;line-height:1.5">${changements[k]||''}</p></div>`).join('')}</div>`;
  }

  // ODD Detail table
  if (oddDetail.length) {
    body += `<div class="card"><h2>🌍 CONTRIBUTION AUX ODD — DÉTAIL</h2>
<table><tr><th style="width:60px">ODD</th><th>Intitulé</th><th>Contribution concrète</th><th style="width:90px">Alignement</th></tr>
${oddDetail.map((o:any,i:number) => `<tr${i%2?'':' style="background:#f8fafc"'}>
<td><div style="width:32px;height:32px;border-radius:4px;background:${o.couleur||'#666'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px">${o.numero}</div></td>
<td style="font-weight:500">${o.nom||''}</td>
<td style="color:#64748b">${o.justification||o.contribution||''}</td>
<td><span class="badge badge-${o.alignement==='fort'?'green':o.alignement==='faible'?'red':'yellow'}" style="text-transform:capitalize">${o.alignement||'moyen'}</span></td>
</tr>`).join('')}</table></div>`;
  }

  // Parties prenantes
  if (partiesPrenantes.length) {
    body += `<div class="card"><h2>🤝 PARTIES PRENANTES CLÉS</h2>
<table><tr><th>Partie prenante</th><th>Rôle</th><th style="width:100px">Implication</th></tr>
${partiesPrenantes.map((pp:any,i:number) => `<tr${i%2?'':' style="background:#f8fafc"'}>
<td style="font-weight:500">${pp.nom||pp.type||''}</td><td style="color:#64748b">${pp.role||''}</td>
<td><span class="badge badge-${pp.implication==='Élevé'||pp.implication==='élevé'?'green':'yellow'}">${pp.implication||'—'}</span></td>
</tr>`).join('')}</table></div>`;
  }

  // Alignement modèle
  if (alignement.commentaire) {
    body += `<div class="card"><h2>🔗 ALIGNEMENT MODÈLE ÉCONOMIQUE / IMPACT</h2>
<div class="grid-4" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
<div class="metric"><div class="lbl">Position de l'impact</div><div class="val" style="font-size:14px">${
  alignement.impact_position==='coeur_du_modele'?'🎯 Cœur du modèle':alignement.impact_position==='effet_secondaire'?'↗️ Effet secondaire':'📎 Activité annexe'
}</div></div>
<div class="metric"><div class="lbl">Corrélation croissance</div><div class="val" style="font-size:14px">${
  alignement.correlation_croissance==='augmente'?'📈 Augmente':alignement.correlation_croissance==='stagne'?'➡️ Stagne':'📉 Diminue'
}</div></div>
<div class="metric"><div class="lbl">Conflit rentabilité</div><div class="val" style="font-size:14px;color:${
  alignement.conflit_rentabilite==='faible'?'#22c55e':alignement.conflit_rentabilite==='fort'?'#ef4444':'#eab308'
}">${alignement.conflit_rentabilite||'—'}</div></div>
</div>
<p style="font-size:13px;color:#64748b;line-height:1.5">${alignement.commentaire}</p></div>`;
  }

  // SWOT
  if (swot.forces || swot.faiblesses || swot.opportunites || swot.menaces) {
    body += `<div class="card"><h2>🧭 DIAGNOSTIC SWOT — IMPACT SOCIAL</h2><div class="swot-grid">
<div class="swot-box swot-s"><h4>FORCES</h4><ul>${(swot.forces||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
<div class="swot-box swot-w"><h4>FAIBLESSES</h4><ul>${(swot.faiblesses||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
<div class="swot-box swot-o"><h4>OPPORTUNITÉS</h4><ul>${(swot.opportunites||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
<div class="swot-box swot-t"><h4>MENACES</h4><ul>${(swot.menaces||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>
</div></div>`;
  }

  // Recommandations
  if (recos.length) {
    body += `<div class="card"><h2>🎯 RECOMMANDATIONS POUR RENFORCER L'IMPACT</h2>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
${recos.slice(0,3).map((r:any,i:number) => `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;background:#fff;position:relative">
<div style="position:absolute;top:-8px;left:-8px;width:28px;height:28px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${r.priorite||i+1}</div>
<h3 style="font-size:14px;font-weight:700;margin-top:8px;margin-bottom:8px">${r.titre}</h3>
<p style="font-size:13px;color:#64748b;line-height:1.5;margin-bottom:12px">${r.detail}</p>
${r.impact_score?`<span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#dcfce7;color:#166534">${r.impact_score}</span>`:''}</div>`).join('')}
</div></div>`;
  }

  // Evolution score
  if (evolution.length) {
    body += `<div class="card"><h2>📈 ÉVOLUTION POTENTIELLE DU SCORE</h2>
<table><tr><th>Critère</th><th>Score actuel</th><th>Score après</th><th>Action clé</th></tr>
${evolution.map((e:any,i:number) => `<tr${i%2?'':' style="background:#f8fafc"'}>
<td style="font-weight:500">${e.critere}</td>
<td><strong style="color:${scColor(e.score_actuel||0)}">${e.score_actuel}/100</strong></td>
<td><strong style="color:${scColor(e.score_apres||0)}">${e.score_apres}/100</strong></td>
<td style="color:#64748b">${e.action}</td></tr>`).join('')}</table></div>`;
  }

  // Maturité
  if (maturite) {
    const levels = ['idee','test_pilote','deploye','mesure','scale'];
    const labels = ['Idée','Test/Pilote','Déployé','Mesuré','Scalé'];
    const matColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e'];
    const idx = levels.indexOf(maturite);
    body += `<div class="card"><h2>🎯 NIVEAU DE MATURITÉ DE L'IMPACT</h2>
<div style="display:flex;gap:4px;margin-bottom:12px">
${levels.map((l,i) => `<div style="flex:1;text-align:center">
<div style="height:12px;border-radius:6px;background:${i<=idx?matColors[i]:'#e2e8f0'}"></div>
<p style="font-size:10px;margin-top:4px;${i===idx?'font-weight:700;color:#1e293b':'color:#94a3b8'}">${labels[i]}</p>
${i===idx?'<p style="font-size:9px;color:#3b82f6;font-weight:600">← VOUS ÊTES ICI</p>':''}
</div>`).join('')}
</div></div>`;
  }

  return htmlShell('Social Impact Canvas', score, body, ent);
}

// ===== INPUTS HTML (Framework d'Analyse Financière PME) =====
function inputsHTML(data: any, ent: string): string {
  let body = '';
  const cr = data.compte_resultat || {};
  const kpis = data.kpis || {};
  const alertes = data.alertes || [];
  const croisements = data.croisements_bmc_fin || [];
  const tresBfr = data.tresorerie_bfr || {};
  const sante = data.sante_financiere || {};
  const marge = data.analyse_marge || {};
  const proj = data.projection_5ans || {};
  const seuil = data.seuil_rentabilite || {};
  const scenarios = data.scenarios || {};
  const planAction = data.plan_action || [];
  const risques = data.risques_cles || [];
  const bailleurs = data.bailleurs_potentiels || [];
  const croisBmc = data.croisement_bmc_financiers || {};
  const manquantes = data.donnees_manquantes || [];

  // KPIs bar
  if (kpis.ca_annee_n) {
    body += `<div class="grid-4">
${[['Marge EBITDA', kpis.marge_ebitda], ['CA Année N (FCFA)', fmt(kpis.ca_annee_n)], ['EBITDA (FCFA)', fmt(kpis.ebitda)], ['CA An 5 projeté (FCFA)', fmt(kpis.ca_an5_projete)]].map(([l,v])=>`<div class="metric"><div class="lbl">${l}</div><div class="val" style="font-size:16px">${v}</div></div>`).join('')}</div>`;
  }

  // Alertes
  if (alertes.length) {
    body += `<div class="card" style="border-left:4px solid #eab308;background:#fefce8"><h2>⚠️ Alertes & Points de vigilance</h2><ul>
${alertes.map((a:any)=>`<li style="color:#854d0e">${typeof a==='string'?a:a.message}${a.detail?` — <span style="color:#64748b">${a.detail}</span>`:''}</li>`).join('')}</ul></div>`;
  }

  // Croisements BMC ↔ Fin
  if (croisements.length) {
    body += `<div class="card"><h2>🔗 Croisement BMC ↔ Financiers</h2>`;
    croisements.forEach((c:any) => {
      body += `<div style="border-left:3px solid #3b82f6;padding:12px 16px;margin-bottom:12px;border-radius:0 8px 8px 0;background:#eff6ff">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span class="badge badge-blue">[BMC↔Fin] ${c.bloc_bmc}</span><strong>${c.titre}</strong></div>
<p style="font-size:12px;color:#475569">${c.recommandation}</p></div>`;
    });
    body += '</div>';
  }

  // Compte de résultat
  if (Object.keys(cr).length) {
    body += `<div class="card"><h2>📊 Compte de Résultat</h2><table><tr><th>Poste</th><th style="text-align:right">Montant (${data.devise||'FCFA'})</th></tr>
${Object.entries(cr).map(([k,v])=>`<tr${k.includes('resultat')?` style="font-weight:700;background:#f8fafc"`:''}>
<td>${k.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</td><td class="amount">${fmt(v)}</td></tr>`).join('')}</table></div>`;
  }

  // Indicateurs Clés + Verdict
  if (data.indicateurs_cles) {
    body += `<div class="card"><h2>📈 Indicateurs Clés</h2><div class="grid-4">${Object.entries(data.indicateurs_cles).map(([k,v])=>`<div class="metric"><div class="lbl">${k.replace(/_/g,' ')}</div><div class="val" style="font-size:18px">${v}</div></div>`).join('')}</div>`;
    if (data.verdict_indicateurs) body += `<p style="font-size:13px;color:#64748b;font-style:italic;margin-top:16px;padding:12px;border-left:3px solid #e2e8f0">${data.verdict_indicateurs}</p>`;
    body += '</div>';
  }

  // Ratios historiques
  if (data.ratios_historiques?.length) {
    body += `<div class="card"><h2>📊 Évolution des Ratios</h2><table><tr><th>Ratio</th><th>Année N-2</th><th>Année N-1</th><th>Année N</th><th>Benchmark</th></tr>
${data.ratios_historiques.map((r:any,i:number)=>`<tr${i%2?'':' style="background:#f8fafc"'}><td>${r.ratio}</td><td>${r.n_moins_2}</td><td>${r.n_moins_1}</td><td><strong>${r.n}</strong></td><td style="color:#64748b">${r.benchmark}</td></tr>`).join('')}</table></div>`;
  }

  // Trésorerie & BFR
  if (tresBfr.tresorerie_nette || tresBfr.composantes?.length) {
    body += `<div class="card"><h2>💧 Trésorerie & BFR</h2>
<div class="grid-4">${[['Trésorerie nette',fmt(tresBfr.tresorerie_nette)],['Cash-flow opérationnel',fmt(tresBfr.cashflow_operationnel)],['CAF',fmt(tresBfr.caf)],['DSCR',tresBfr.dscr||'—']].map(([l,v])=>`<div class="metric"><div class="lbl">${l}</div><div class="val" style="font-size:16px">${v}</div></div>`).join('')}</div>`;
    if (tresBfr.composantes?.length) {
      body += `<table style="margin-top:16px"><tr><th>Composante</th><th>Valeur</th><th>Benchmark</th></tr>
${tresBfr.composantes.map((c:any)=>`<tr><td>${c.indicateur}</td><td><strong>${c.valeur}</strong></td><td style="color:#64748b">${c.benchmark}</td></tr>`).join('')}</table>`;
    }
    if (tresBfr.verdict) body += `<p style="font-size:13px;color:#64748b;font-style:italic;margin-top:12px;padding:12px;border-left:3px solid #e2e8f0">${tresBfr.verdict}</p>`;
    body += '</div>';
  }

  // Bilan
  const bilan = data.bilan || {};
  if (bilan.actif || bilan.passif) {
    body += `<div class="card"><h2>📋 Bilan</h2><div class="grid-2">
<div><h3>Actif</h3><table>${Object.entries(bilan.actif||{}).map(([k,v])=>`<tr${k.includes('total')?` style="font-weight:700"`:''}>
<td>${k.replace(/_/g,' ')}</td><td class="amount">${fmt(v)}</td></tr>`).join('')}</table></div>
<div><h3>Passif</h3><table>${Object.entries(bilan.passif||{}).map(([k,v])=>`<tr${k.includes('total')?` style="font-weight:700"`:''}>
<td>${k.replace(/_/g,' ')}</td><td class="amount">${fmt(v)}</td></tr>`).join('')}</table></div>
</div></div>`;
  }

  // Forces / Faiblesses
  if (sante.forces?.length || sante.faiblesses?.length) {
    body += `<div class="card"><h2>SLIDE 1 — ÉTAT DE SANTÉ FINANCIÈRE</h2>`;
    if (sante.resume_chiffres?.length) body += `<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px"><h3>Ce que montrent les chiffres</h3><ul>${sante.resume_chiffres.map((c:string)=>`<li><strong>${c}</strong></li>`).join('')}</ul></div>`;
    body += `<div class="grid-2">
<div class="card" style="background:#f0fdf4;border-color:#bbf7d0"><h2 style="color:#166534;font-size:15px">✅ Forces</h2><ul>${(sante.forces||[]).map((f:string)=>`<li>${f}</li>`).join('')}</ul></div>
<div class="card" style="background:#fefce8;border-color:#fef08a"><h2 style="color:#854d0e;font-size:15px">⚠️ Faiblesses</h2><ul>${(sante.faiblesses||[]).map((f:string)=>`<li>${f}</li>`).join('')}</ul></div>
</div></div>`;
  }

  // Analyse marge
  if (marge.activites?.length) {
    body += `<div class="card"><h2>SLIDE 2 — OÙ SE CRÉE LA MARGE</h2>`;
    if (marge.verdict) body += `<p style="font-size:13px;color:#64748b;font-style:italic;margin-bottom:16px;padding:12px;border-left:3px solid #e2e8f0">${marge.verdict}</p>`;
    body += `<table><tr><th>Activité</th><th style="text-align:right">CA (FCFA)</th><th style="text-align:right">Marge Brute</th><th style="text-align:right">Marge %</th><th>Classification</th></tr>
${marge.activites.map((a:any)=>`<tr><td>${a.nom}</td><td class="amount">${fmt(a.ca)}</td><td class="amount">${fmt(a.marge_brute)}</td><td class="amount"><strong>${a.marge_pct}</strong></td><td><span class="badge ${a.classification==='RENFORCER'?'badge-green':a.classification==='RESTRUCTURER'?'badge-red':'badge-yellow'}">${a.classification}</span></td></tr>`).join('')}</table>`;
    if (marge.message_cle) body += `<p style="font-size:13px;font-weight:600;margin-top:12px;color:#1a2744">💡 ${marge.message_cle}</p>`;
    body += '</div>';
  }

  // Projection 5 ans
  if (proj.lignes?.length) {
    body += `<div class="card"><h2>📈 Projection Financière 5 Ans</h2>`;
    if (proj.verdict) body += `<p style="font-size:13px;color:#64748b;font-style:italic;margin-bottom:16px;padding:12px;border-left:3px solid #e2e8f0">${proj.verdict}</p>`;
    body += `<table><tr><th>Poste</th><th style="text-align:right">Année 1</th><th style="text-align:right">Année 2</th><th style="text-align:right">Année 3</th><th style="text-align:right">Année 4</th><th style="text-align:right">Année 5</th><th style="text-align:right">CAGR</th></tr>
${proj.lignes.map((l:any)=>`<tr${l.poste.includes('CA')?` style="font-weight:700"`:''}>
<td>${l.poste}</td><td class="amount">${fmt(l.an1)}</td><td class="amount">${fmt(l.an2)}</td><td class="amount">${fmt(l.an3)}</td><td class="amount">${fmt(l.an4)}</td><td class="amount">${fmt(l.an5)}</td><td class="amount" style="color:#3b82f6;font-weight:700">${l.cagr||''}</td></tr>`).join('')}</table>`;
    if (proj.marges?.length) {
      body += `<table style="margin-top:8px"><tr><th>Marge</th><th>An 1</th><th>An 2</th><th>An 3</th><th>An 4</th><th>An 5</th></tr>
${proj.marges.map((m:any)=>`<tr><td>${m.poste}</td><td>${m.an1}</td><td>${m.an2}</td><td>${m.an3}</td><td>${m.an4}</td><td>${m.an5}</td></tr>`).join('')}</table>`;
    }
    body += '</div>';
  }

  // Seuil de rentabilité
  if (seuil.ca_point_mort) {
    body += `<div class="card"><h2>🎯 Seuil de Rentabilité (Année 1)</h2>
<p style="font-size:15px">CA au point mort = <strong>${fmt(seuil.ca_point_mort)} FCFA</strong> · Atteint en <strong>${seuil.atteint_en}</strong></p>
${seuil.verdict?`<p style="font-size:13px;color:#64748b;font-style:italic;margin-top:8px">${seuil.verdict}</p>`:''}</div>`;
  }

  // Scénarios
  if (scenarios.tableau?.length) {
    body += `<div class="card"><h2>🔄 Analyse par Scénarios (Année 5)</h2>`;
    if (scenarios.verdict) body += `<p style="font-size:13px;color:#64748b;font-style:italic;margin-bottom:16px;padding:12px;border-left:3px solid #e2e8f0">${scenarios.verdict}</p>`;
    body += `<table><tr><th>Indicateur</th><th style="text-align:right">Prudent</th><th style="text-align:right;color:#3b82f6">Central</th><th style="text-align:right;color:#22c55e">Ambitieux</th></tr>
${scenarios.tableau.map((r:any,i:number)=>`<tr${i%2?'':' style="background:#f8fafc"'}><td>${r.indicateur}</td><td class="amount">${r.prudent}</td><td class="amount" style="font-weight:700">${r.central}</td><td class="amount">${r.ambitieux}</td></tr>`).join('')}</table>`;
    if (scenarios.sensibilite?.length) body += `<div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px"><h3 style="font-size:13px">Analyse de Sensibilité (±10%)</h3><ul>${scenarios.sensibilite.map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>`;
    if (scenarios.recommandation_scenario) body += `<p style="font-size:13px;font-weight:600;margin-top:12px;color:#1a2744">📌 Recommandation : ${scenarios.recommandation_scenario}</p>`;
    body += '</div>';
  }

  // Plan d'action
  if (planAction.length) {
    body += `<div class="card"><h2>SLIDE 3 — PLAN D'ACTION & TRAJECTOIRE 5 ANS</h2><h3>Décisions recommandées</h3>`;
    const horizonColors: Record<string,string> = { COURT: '#22c55e', MOYEN: '#3b82f6', LONG: '#8b5cf6' };
    const horizonBg: Record<string,string> = { COURT: '#f0fdf4', MOYEN: '#eff6ff', LONG: '#f5f3ff' };
    planAction.forEach((a:any, i:number) => {
      body += `<div style="border-left:4px solid ${horizonColors[a.horizon]||'#e2e8f0'};padding:12px 16px;margin-bottom:8px;border-radius:0 8px 8px 0;background:${horizonBg[a.horizon]||'#f8fafc'}">
<strong>${i+1}. [${a.horizon}]</strong> ${a.action} ${a.cout?`<span style="color:#64748b">(${a.cout})</span>`:''}
${a.impact?`<br><span style="font-size:12px;color:#475569">→ ${a.impact}</span>`:''}</div>`;
    });
    body += '</div>';
  }

  // Impact + Besoins
  if (data.impact_attendu || data.besoins_financiers) {
    body += '<div class="grid-2">';
    if (data.impact_attendu) body += `<div class="card" style="background:#f0fdf4;border-color:#bbf7d0"><h2 style="color:#166534;font-size:15px">📈 Impact attendu</h2>${Object.entries(data.impact_attendu).map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span style="color:#64748b">${k.replace(/_/g,' ')}</span><strong>${v}</strong></div>`).join('')}</div>`;
    if (data.besoins_financiers) body += `<div class="card" style="background:#eff6ff;border-color:#bfdbfe"><h2 style="color:#1e40af;font-size:15px">💰 Besoins financiers</h2><p style="font-size:14px">CAPEX total (5 ans) : <strong>${data.besoins_financiers.capex_total}</strong></p><p style="font-size:12px;color:#64748b">Timing : ${data.besoins_financiers.timing}</p></div>`;
    body += '</div>';
  }

  // Synthèse expert
  if (data.synthese_expert) body += `<div class="card" style="background:linear-gradient(135deg,#f8fafc,#eff6ff)"><h2>🧠 Synthèse Expert</h2><p style="font-size:14px;line-height:1.7;color:#334155">${data.synthese_expert}</p></div>`;

  // Score d'investissabilité
  body += `<div class="card" style="text-align:center;padding:32px"><h2>Score d'Investissabilité (IA)</h2>
<div style="font-size:48px;font-weight:900;color:#1a2744">${data.score||0} <span style="font-size:24px;color:#94a3b8">/ 100</span></div>
${data.analyse_scenarios_ia?`<p style="font-size:13px;color:#64748b;margin-top:16px;max-width:600px;margin-left:auto;margin-right:auto">${data.analyse_scenarios_ia}</p>`:''}</div>`;

  // Risques clés
  if (risques.length) {
    body += `<div class="card" style="border-left:4px solid #ef4444"><h2>🚨 Risques Clés (IA)</h2><ul>
${risques.map((r:any)=>`<li>${r.risque} — <span class="badge ${r.severite==='HAUTE'||r.severite==='CRITIQUE'?'badge-red':'badge-yellow'}">${r.severite}</span></li>`).join('')}</ul></div>`;
  }

  // Bailleurs
  if (bailleurs.length) {
    body += `<div class="card"><h2>🏦 Bailleurs Potentiels (IA)</h2><ul>
${bailleurs.map((b:any)=>`<li><strong>${b.nom}</strong> — ${b.raison}</li>`).join('')}</ul></div>`;
  }

  // Incohérences
  if (croisBmc.incoherences?.length) {
    body += `<div class="card"><h2>⚠️ Incohérences détectées (${croisBmc.incoherences.length})</h2>
${croisBmc.synthese?`<p style="font-size:13px;color:#64748b;margin-bottom:12px">${croisBmc.synthese}</p>`:''}
<ul>${croisBmc.incoherences.map((inc:any)=>`<li><span class="badge ${inc.severite==='CRITIQUE'?'badge-red':inc.severite==='HAUTE'?'badge-red':'badge-yellow'}">${inc.severite}</span> ${inc.description}</li>`).join('')}</ul></div>`;
  }

  // Données manquantes
  if (manquantes.length) body += `<div class="card"><h2>📋 Données manquantes détectées</h2><ul>${manquantes.map((d:string)=>`<li>${d}</li>`).join('')}</ul></div>`;

  // Hypothèses
  if (data.hypotheses?.length) body += `<div class="card" style="border-left:4px solid #eab308;background:#fefce8"><h2>⚠️ Hypothèses</h2><ul>${data.hypotheses.map((h:string)=>`<li>${h}</li>`).join('')}</ul></div>`;

  return htmlShell("Framework d'Analyse Financière PME", data.score, body, ent);
}

// ===== FRAMEWORK HTML (Rich version matching PDF reference) =====
function frameworkHTML(data: any, ent: string): string {
  let body = '';
  const ratios = data.ratios || {};
  const kpis = data.kpis || {};
  const alertes = data.alertes || [];
  const croisements = data.croisements_bmc_fin || [];
  const tresBfr = data.tresorerie_bfr || {};
  const sante = data.sante_financiere || {};
  const marge = data.analyse_marge || {};
  const proj = data.projection_5ans || {};
  const seuil = data.seuil_rentabilite || {};
  const scenarios = data.scenarios || {};
  const planAction = data.plan_action || [];
  const risques = data.risques_cles || [];
  const bailleurs = data.bailleurs_potentiels || [];
  const croisBmc = data.croisement_bmc_financiers || {};
  const manquantes = data.donnees_manquantes || [];

  // KPIs bar
  if (kpis.ca_annee_n) {
    body += `<div class="grid-4">
${[['Marge EBITDA', kpis.marge_ebitda], ['CA Année N (FCFA)', fmt(kpis.ca_annee_n)], ['EBITDA (FCFA)', fmt(kpis.ebitda)], ['CA An 5 projeté (FCFA)', fmt(kpis.ca_an5_projete)]].map(([l,v])=>`<div class="metric"><div class="lbl">${l}</div><div class="val" style="font-size:16px">${v}</div></div>`).join('')}</div>`;
  }

  // Alertes
  if (alertes.length) {
    body += `<div class="card" style="border-left:4px solid #eab308;background:#fefce8"><h2>⚠️ Alertes & Points de vigilance</h2><ul>
${alertes.map((a:any)=>`<li style="color:#854d0e">${typeof a==='string'?a:a.message}${a.detail?` — <span style="color:#64748b">${a.detail}</span>`:''}</li>`).join('')}</ul></div>`;
  }

  // Croisements BMC ↔ Fin
  if (croisements.length) {
    body += `<div class="card"><h2>🔗 Croisement BMC ↔ Financiers</h2>`;
    croisements.forEach((c:any) => {
      body += `<div style="border-left:3px solid #3b82f6;padding:12px 16px;margin-bottom:12px;border-radius:0 8px 8px 0;background:#eff6ff">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span class="badge badge-blue">[BMC↔Fin] ${c.bloc_bmc}</span><strong>${c.titre}</strong></div>
<p style="font-size:12px;color:#475569">${c.recommandation}</p></div>`;
    });
    body += '</div>';
  }

  // Indicateurs Clés + Verdict
  if (data.indicateurs_cles) {
    body += `<div class="card"><h2>📈 Indicateurs Clés</h2><div class="grid-4">${Object.entries(data.indicateurs_cles).map(([k,v])=>`<div class="metric"><div class="lbl">${k.replace(/_/g,' ')}</div><div class="val" style="font-size:18px">${v}</div></div>`).join('')}</div>`;
    if (data.verdict_indicateurs) body += `<p style="font-size:13px;color:#64748b;font-style:italic;margin-top:16px;padding:12px;border-left:3px solid #e2e8f0">${data.verdict_indicateurs}</p>`;
    body += '</div>';
  }

  // Ratios historiques
  if (data.ratios_historiques?.length) {
    body += `<div class="card"><h2>📊 Évolution des Ratios</h2><table><tr><th>Ratio</th><th>Année N-2</th><th>Année N-1</th><th>Année N</th><th>Benchmark</th></tr>
${data.ratios_historiques.map((r:any,i:number)=>`<tr${i%2?'':' style="background:#f8fafc"'}><td>${r.ratio}</td><td>${r.n_moins_2}</td><td>${r.n_moins_1}</td><td><strong>${r.n}</strong></td><td style="color:#64748b">${r.benchmark}</td></tr>`).join('')}</table></div>`;
  }

  // Ratios par catégorie
  for (const [cat, group] of Object.entries(ratios) as [string, any][]) {
    body += `<div class="card"><h2>${cat === 'rentabilite' ? '💰' : cat === 'liquidite' ? '💧' : cat === 'solvabilite' ? '🏦' : '📊'} ${cat.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</h2>
<table><tr><th>Ratio</th><th>Valeur</th><th>Benchmark/Seuil</th><th>Verdict</th></tr>
${Object.entries(group).map(([k,v]:any)=>`<tr><td>${k.replace(/_/g,' ')}</td><td class="amount">${v?.valeur||v}</td><td>${v?.benchmark||v?.seuil||'—'}</td><td>${verdictBadge(v?.verdict||'')}</td></tr>`).join('')}</table></div>`;
  }

  // Trésorerie & BFR
  if (tresBfr.tresorerie_nette || tresBfr.composantes?.length) {
    body += `<div class="card"><h2>💧 Trésorerie & BFR</h2>
<div class="grid-4">${[['Trésorerie nette',fmt(tresBfr.tresorerie_nette)],['Cash-flow opérationnel',fmt(tresBfr.cashflow_operationnel)],['CAF',fmt(tresBfr.caf)],['DSCR',tresBfr.dscr||'—']].map(([l,v])=>`<div class="metric"><div class="lbl">${l}</div><div class="val" style="font-size:16px">${v}</div></div>`).join('')}</div>`;
    if (tresBfr.composantes?.length) {
      body += `<table style="margin-top:16px"><tr><th>Composante</th><th>Valeur</th><th>Benchmark</th></tr>
${tresBfr.composantes.map((c:any)=>`<tr><td>${c.indicateur}</td><td><strong>${c.valeur}</strong></td><td style="color:#64748b">${c.benchmark}</td></tr>`).join('')}</table>`;
    }
    if (tresBfr.verdict) body += `<p style="font-size:13px;color:#64748b;font-style:italic;margin-top:12px;padding:12px;border-left:3px solid #e2e8f0">${tresBfr.verdict}</p>`;
    body += '</div>';
  }

  // SLIDE 1 — État de santé financière
  if (sante.forces?.length || sante.faiblesses?.length) {
    body += `<div class="card"><h2>SLIDE 1 — ÉTAT DE SANTÉ FINANCIÈRE</h2>`;
    if (sante.resume_chiffres?.length) body += `<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px"><h3>Ce que montrent les chiffres</h3><ul>${sante.resume_chiffres.map((c:string)=>`<li><strong>${c}</strong></li>`).join('')}</ul></div>`;
    body += `<div class="grid-2">
<div class="card" style="background:#f0fdf4;border-color:#bbf7d0"><h2 style="color:#166534;font-size:15px">✅ Forces</h2><ul>${(sante.forces||[]).map((f:string)=>`<li>${f}</li>`).join('')}</ul></div>
<div class="card" style="background:#fefce8;border-color:#fef08a"><h2 style="color:#854d0e;font-size:15px">⚠️ Faiblesses</h2><ul>${(sante.faiblesses||[]).map((f:string)=>`<li>${f}</li>`).join('')}</ul></div>
</div></div>`;
  }

  // SLIDE 2 — Analyse marge
  if (marge.activites?.length) {
    body += `<div class="card"><h2>SLIDE 2 — OÙ SE CRÉE LA MARGE</h2>`;
    if (marge.verdict) body += `<p style="font-size:13px;color:#64748b;font-style:italic;margin-bottom:16px;padding:12px;border-left:3px solid #e2e8f0">${marge.verdict}</p>`;
    body += `<table><tr><th>Activité</th><th style="text-align:right">CA (FCFA)</th><th style="text-align:right">Marge Brute</th><th style="text-align:right">Marge %</th><th>Classification</th></tr>
${marge.activites.map((a:any)=>`<tr><td>${a.nom}</td><td class="amount">${fmt(a.ca)}</td><td class="amount">${fmt(a.marge_brute)}</td><td class="amount"><strong>${a.marge_pct}</strong></td><td><span class="badge ${a.classification==='RENFORCER'?'badge-green':a.classification==='RESTRUCTURER'?'badge-red':'badge-yellow'}">${a.classification}</span></td></tr>`).join('')}</table>`;
    if (marge.message_cle) body += `<p style="font-size:13px;font-weight:600;margin-top:12px;color:#1a2744">💡 ${marge.message_cle}</p>`;
    body += '</div>';
  }

  // Projection 5 ans
  if (proj.lignes?.length) {
    body += `<div class="card"><h2>📈 Projection Financière 5 Ans</h2>`;
    if (proj.verdict) body += `<p style="font-size:13px;color:#64748b;font-style:italic;margin-bottom:16px;padding:12px;border-left:3px solid #e2e8f0">${proj.verdict}</p>`;
    body += `<table><tr><th>Poste</th><th style="text-align:right">Année 1</th><th style="text-align:right">Année 2</th><th style="text-align:right">Année 3</th><th style="text-align:right">Année 4</th><th style="text-align:right">Année 5</th><th style="text-align:right">CAGR</th></tr>
${proj.lignes.map((l:any)=>`<tr${l.poste.includes('CA')||l.poste.includes('Trésorerie')?` style="font-weight:700"`:''}>
<td>${l.poste}</td><td class="amount">${fmt(l.an1)}</td><td class="amount">${fmt(l.an2)}</td><td class="amount">${fmt(l.an3)}</td><td class="amount">${fmt(l.an4)}</td><td class="amount">${fmt(l.an5)}</td><td class="amount" style="color:#3b82f6;font-weight:700">${l.cagr||''}</td></tr>`).join('')}</table></div>`;
  }

  // Seuil de rentabilité
  if (seuil.ca_point_mort) {
    body += `<div class="card"><h2>🎯 Seuil de Rentabilité (Année 1)</h2>
<p style="font-size:15px">CA au point mort = <strong>${fmt(seuil.ca_point_mort)} FCFA</strong> · Atteint en <strong>${seuil.atteint_en}</strong></p>
${seuil.verdict?`<p style="font-size:13px;color:#64748b;font-style:italic;margin-top:8px">${seuil.verdict}</p>`:''}</div>`;
  }

  // Scénarios
  if (scenarios.tableau?.length) {
    body += `<div class="card"><h2>🔄 Analyse par Scénarios (Année 5)</h2>`;
    if (scenarios.verdict) body += `<p style="font-size:13px;color:#64748b;font-style:italic;margin-bottom:16px;padding:12px;border-left:3px solid #e2e8f0">${scenarios.verdict}</p>`;
    body += `<table><tr><th>Indicateur</th><th style="text-align:right">Prudent</th><th style="text-align:right;color:#3b82f6">Central</th><th style="text-align:right;color:#22c55e">Ambitieux</th></tr>
${scenarios.tableau.map((r:any,i:number)=>`<tr${i%2?'':' style="background:#f8fafc"'}${r.indicateur==='ROI'?' style="font-weight:700"':''}><td>${r.indicateur}</td><td class="amount">${r.prudent}</td><td class="amount" style="font-weight:700">${r.central}</td><td class="amount">${r.ambitieux}</td></tr>`).join('')}</table>`;
    if (scenarios.sensibilite?.length) body += `<div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px"><h3 style="font-size:13px">Analyse de Sensibilité (±10%)</h3><ul>${scenarios.sensibilite.map((s:string)=>`<li>${s}</li>`).join('')}</ul></div>`;
    if (scenarios.recommandation_scenario) body += `<p style="font-size:13px;font-weight:600;margin-top:12px;color:#1a2744">📌 Recommandation : ${scenarios.recommandation_scenario}</p>`;
    body += '</div>';
  }

  // SLIDE 3 — Plan d'action
  if (planAction.length) {
    body += `<div class="card"><h2>SLIDE 3 — PLAN D'ACTION & TRAJECTOIRE 5 ANS</h2><h3>Décisions recommandées</h3>`;
    const horizonColors: Record<string,string> = { COURT: '#22c55e', MOYEN: '#3b82f6', LONG: '#8b5cf6' };
    const horizonBg: Record<string,string> = { COURT: '#f0fdf4', MOYEN: '#eff6ff', LONG: '#f5f3ff' };
    planAction.forEach((a:any, i:number) => {
      body += `<div style="border-left:4px solid ${horizonColors[a.horizon]||'#e2e8f0'};padding:12px 16px;margin-bottom:8px;border-radius:0 8px 8px 0;background:${horizonBg[a.horizon]||'#f8fafc'}">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
<strong style="color:${horizonColors[a.horizon]||'#64748b'}">${i+1}.</strong>
${a.horizon?`<span style="font-size:11px;font-weight:700;color:${horizonColors[a.horizon]||'#64748b'};background:white;padding:2px 8px;border-radius:12px;border:1px solid ${horizonColors[a.horizon]||'#e2e8f0'}">${a.horizon}</span>`:''}
</div>
<div style="font-size:13px;color:#334155;">${a.action} ${a.cout?`<span style="color:#64748b">(${a.cout})</span>`:''}</div>
${a.impact?`<div style="font-size:12px;color:#475569;margin-top:4px">→ ${a.impact}</div>`:''}</div>`;
    });
    body += '</div>';
  }

  // Impact + Besoins
  if (data.impact_attendu || data.besoins_financiers) {
    body += '<div class="grid-2">';
    if (data.impact_attendu) body += `<div class="card" style="background:#f0fdf4;border-color:#bbf7d0"><h2 style="color:#166534;font-size:15px">📈 Impact attendu</h2>${Object.entries(data.impact_attendu).map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span style="color:#64748b">${k.replace(/_/g,' ')}</span><strong>${v}</strong></div>`).join('')}</div>`;
    if (data.besoins_financiers) body += `<div class="card" style="background:#eff6ff;border-color:#bfdbfe"><h2 style="color:#1e40af;font-size:15px">💰 Besoins financiers</h2><p style="font-size:14px">CAPEX total (5 ans) : <strong>${data.besoins_financiers.capex_total}</strong></p><p style="font-size:12px;color:#64748b">Timing : ${data.besoins_financiers.timing}</p></div>`;
    body += '</div>';
  }

  // Synthèse expert
  if (data.synthese_expert) body += `<div class="card" style="background:linear-gradient(135deg,#f8fafc,#eff6ff)"><h2>🧠 Synthèse Expert</h2><p style="font-size:14px;line-height:1.7;color:#334155">${data.synthese_expert}</p></div>`;

  // Score d'investissabilité
  if (data.score_investissabilite != null) {
    body += `<div class="card" style="text-align:center;padding:32px"><h2>Score d'Investissabilité (IA)</h2>
<div style="font-size:48px;font-weight:900;color:#1a2744">${data.score_investissabilite} <span style="font-size:24px;color:#94a3b8">/ 100</span></div>
${data.analyse_scenarios_ia?`<p style="font-size:13px;color:#64748b;margin-top:16px;max-width:600px;margin-left:auto;margin-right:auto">${data.analyse_scenarios_ia}</p>`:''}</div>`;
  }

  // Risques clés
  if (risques.length) {
    body += `<div class="card" style="border-left:4px solid #ef4444"><h2>🚨 Risques Clés</h2><ul>
${risques.map((r:any)=>`<li>${r.risque} — <span class="badge ${r.severite==='HAUTE'||r.severite==='CRITIQUE'?'badge-red':'badge-yellow'}">${r.severite}</span></li>`).join('')}</ul></div>`;
  }

  // Bailleurs
  if (bailleurs.length) {
    body += `<div class="card"><h2>🏦 Bailleurs Potentiels</h2><ul>
${bailleurs.map((b:any)=>`<li><strong>${b.nom}</strong> — ${b.raison}</li>`).join('')}</ul></div>`;
  }

  // Incohérences BMC ↔ Financiers
  if (croisBmc.incoherences?.length) {
    body += `<div class="card"><h2>⚠️ Incohérences détectées (${croisBmc.incoherences.length})</h2>
${croisBmc.synthese?`<p style="font-size:13px;color:#64748b;margin-bottom:12px">${croisBmc.synthese}</p>`:''}
<ul>${croisBmc.incoherences.map((inc:any)=>`<li><span class="badge ${inc.severite==='CRITIQUE'?'badge-red':inc.severite==='HAUTE'?'badge-red':'badge-yellow'}">${inc.severite}</span> ${inc.description}</li>`).join('')}</ul></div>`;
  }

  // Données manquantes
  if (manquantes.length) body += `<div class="card"><h2>📋 Données manquantes détectées</h2><ul>${manquantes.map((d:string)=>`<li>${d}</li>`).join('')}</ul></div>`;

  // Hypothèses
  if (data.hypotheses?.length) body += `<div class="card" style="border-left:4px solid #eab308;background:#fefce8"><h2>⚠️ Hypothèses</h2><ul>${data.hypotheses.map((h:string)=>`<li>${h}</li>`).join('')}</ul></div>`;

  // Legacy: points forts/faibles + recommandations
  if (!sante.forces?.length && (data.points_forts?.length || data.points_faibles?.length)) {
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
