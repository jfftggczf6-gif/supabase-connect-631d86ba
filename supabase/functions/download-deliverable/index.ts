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

  // New format detection
  const isNew = data.scores_dimensions || data.resume_executif || data.avis_par_livrable;

  if (isNew) {
    // Header with palier
    if (data.label || data.palier) {
      const palierColor = data.score_global >= 70 ? 'green' : data.score_global >= 50 ? 'yellow' : 'red';
      body += `<div class="card" style="text-align:center;padding:32px">
        <div style="font-size:48px;margin-bottom:8px">${data.couleur || '📊'}</div>
        <div style="font-size:22px;font-weight:800;color:#1a2744">${data.label || data.palier || ''}</div>
        <p style="margin-top:4px;color:#64748b;font-size:13px">Score global : <span class="badge badge-${palierColor}">${data.score_global ?? '—'}/100</span></p>
      </div>`;
    }

    // Resume executif
    if (data.resume_executif) {
      body += `<div class="card"><h2>📋 Résumé Exécutif</h2><p style="font-size:14px;white-space:pre-line">${data.resume_executif}</p></div>`;
    }

    // 5 Dimensions
    const dims = data.scores_dimensions;
    if (dims && typeof dims === 'object') {
      body += `<div class="card"><h2>📊 Scores par Dimension</h2>`;
      for (const [key, dim] of Object.entries(dims) as [string, any][]) {
        if (!dim || typeof dim !== 'object') continue;
        const s = dim.score ?? 0;
        const color = s >= 70 ? 'green' : s >= 50 ? 'yellow' : 'red';
        const label = dim.label || key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        body += `<div style="margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-weight:600;font-size:14px">${label}</span>
            <span class="badge badge-${color}">${s}/100 (${dim.poids || 0}%)</span>
          </div>
          <div class="progress-bar"><div class="progress-fill ${color}" style="width:${s}%"></div></div>
          ${dim.commentaire ? `<p style="font-size:12px;color:#64748b;margin-top:4px">${dim.commentaire}</p>` : ''}
          ${dim.analyse_detaillee ? `<p style="font-size:12px;color:#475569;margin-top:2px;font-style:italic">${dim.analyse_detaillee}</p>` : ''}
        </div>`;
      }
      body += '</div>';
    }

    // Forces
    if (data.forces?.length) {
      body += `<div class="card" style="border-left:4px solid #22c55e"><h2>💪 Forces</h2>`;
      for (const f of data.forces) {
        body += `<div style="margin-bottom:12px"><strong>${f.titre || ''}</strong>${f.livrable_source ? ` <span class="tag">${f.livrable_source}</span>` : ''}<p style="font-size:13px;color:#475569">${f.justification || ''}</p>${f.impact ? `<p style="font-size:12px;color:#166534;margin-top:2px">Impact : ${f.impact}</p>` : ''}</div>`;
      }
      body += '</div>';
    }

    // Opportunites d'amelioration
    if (data.opportunites_amelioration?.length) {
      body += `<div class="card" style="border-left:4px solid #eab308"><h2>🔧 Opportunités d'Amélioration</h2>`;
      for (const o of data.opportunites_amelioration) {
        const pColor = o.priorite === 'elevee' ? 'red' : o.priorite === 'moyenne' ? 'yellow' : 'blue';
        body += `<div style="margin-bottom:12px"><strong>${o.titre || ''}</strong> <span class="badge badge-${pColor}">${o.priorite || ''}</span>${o.livrable_concerne ? ` <span class="tag">${o.livrable_concerne}</span>` : ''}<p style="font-size:13px;color:#475569">${o.justification || ''}</p></div>`;
      }
      body += '</div>';
    }

    // Benchmarks
    const bm = data.benchmarks;
    if (bm && typeof bm === 'object' && Object.keys(bm).length) {
      body += `<div class="card"><h2>📈 Benchmarks Sectoriels</h2><table><thead><tr><th>Indicateur</th><th>Entreprise</th><th>Secteur (min-max)</th><th>Verdict</th></tr></thead><tbody>`;
      const bmLabels: Record<string, string> = { marge_brute: 'Marge Brute', marge_nette: 'Marge Nette', charges_fixes_ca: 'Charges Fixes/CA', masse_salariale_ca: 'Masse Salariale/CA', dscr: 'DSCR' };
      for (const [key, val] of Object.entries(bm) as [string, any][]) {
        if (!val || typeof val !== 'object') continue;
        const vColor = val.verdict === 'ok' ? 'green' : val.verdict === 'bas' ? 'red' : 'yellow';
        body += `<tr><td style="font-weight:600">${bmLabels[key] || key}</td><td class="amount">${val.entreprise != null ? (key === 'dscr' ? val.entreprise.toFixed(2) : val.entreprise + '%') : '—'}</td><td class="amount">${val.secteur_min ?? '—'} – ${val.secteur_max ?? '—'}</td><td><span class="badge badge-${vColor}">${val.verdict || '—'}</span></td></tr>`;
      }
      body += '</tbody></table></div>';
    }

    // Avis par livrable
    const avis = data.avis_par_livrable;
    if (avis && typeof avis === 'object' && Object.keys(avis).length) {
      body += `<div class="card"><h2>📝 Avis par Livrable</h2>`;
      const livrableLabels: Record<string, string> = { bmc: 'BMC', sic: 'SIC', inputs: 'Inputs', framework: 'Framework', plan_ovo: 'Plan OVO', business_plan: 'Business Plan', odd: 'ODD' };
      for (const [key, av] of Object.entries(avis) as [string, any][]) {
        if (!av || typeof av !== 'object') continue;
        const qColor = av.qualite === 'excellent' ? 'green' : av.qualite === 'bon' ? 'blue' : av.qualite === 'moyen' ? 'yellow' : 'red';
        body += `<div style="margin-bottom:20px;padding:16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="font-size:15px">${livrableLabels[key] || key}</strong>
            <span class="badge badge-${qColor}">${av.qualite || '—'}</span>
          </div>
          ${av.avis_global ? `<p style="font-size:13px;color:#475569;margin-bottom:8px">${av.avis_global}</p>` : ''}
          ${av.points_forts?.length ? `<div style="margin-bottom:4px"><span style="font-size:12px;font-weight:600;color:#166534">✅ Points forts :</span> <span style="font-size:12px">${av.points_forts.join(' · ')}</span></div>` : ''}
          ${av.points_amelioration?.length ? `<div><span style="font-size:12px;font-weight:600;color:#b45309">🔧 À améliorer :</span> <span style="font-size:12px">${av.points_amelioration.join(' · ')}</span></div>` : ''}
        </div>`;
      }
      body += '</div>';
    }

    // Recommandations
    if (data.recommandations?.length) {
      body += `<div class="card"><h2>🎯 Recommandations Prioritaires</h2>`;
      for (const r of data.recommandations) {
        const uColor = r.urgence === 'elevee' ? 'red' : r.urgence === 'moyenne' ? 'yellow' : 'blue';
        body += `<div style="margin-bottom:16px;padding:14px;background:#f8fafc;border-radius:8px;border-left:3px solid ${r.urgence === 'elevee' ? '#ef4444' : r.urgence === 'moyenne' ? '#eab308' : '#3b82f6'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <strong style="font-size:14px">${r.priorite ? `#${r.priorite} ` : ''}${r.titre || ''}</strong>
            <span class="badge badge-${uColor}">${r.urgence || ''}</span>
          </div>
          ${r.detail ? `<p style="font-size:13px;color:#475569">${r.detail}</p>` : ''}
          ${r.action_concrete ? `<p style="font-size:12px;color:#1a2744;margin-top:4px;font-weight:500">→ ${r.action_concrete}</p>` : ''}
          ${r.message_encourageant ? `<p style="font-size:12px;color:#166534;margin-top:2px;font-style:italic">${r.message_encourageant}</p>` : ''}
        </div>`;
      }
      body += '</div>';
    }

    // Synthese globale
    const sg = data.synthese_globale;
    if (sg) {
      body += `<div class="card" style="background:linear-gradient(135deg,#f0fdf4,#ecfeff);border-color:#86efac"><h2>🏆 Synthèse Globale</h2>`;
      if (sg.avis_ensemble) body += `<p style="font-size:14px;white-space:pre-line;margin-bottom:16px">${sg.avis_ensemble}</p>`;
      if (sg.points_cles_a_retenir?.length) {
        body += `<h3>Points Clés</h3><ul>${sg.points_cles_a_retenir.map((p: string) => `<li>${p}</li>`).join('')}</ul>`;
      }
      if (sg.prochaines_etapes?.length) {
        body += `<h3>Prochaines Étapes</h3><ol>${sg.prochaines_etapes.map((p: string) => `<li>${p}</li>`).join('')}</ol>`;
      }
      body += '</div>';
    }

    // Points attention prioritaires
    if (data.points_attention_prioritaires?.length) {
      body += `<div class="card" style="border-left:4px solid #f59e0b"><h2>⚠️ Points d'Attention Prioritaires</h2><ul>${data.points_attention_prioritaires.map((p: string) => `<li>${p}</li>`).join('')}</ul></div>`;
    }

  } else {
    // Legacy format fallback
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
  }

  return htmlShell('Diagnostic Expert', data.score_global || data.score, body, ent);
}

// ===== PLAN OVO HTML (aligned with PlanOvoViewer data format) =====
function planOvoHTML(data: any, ent: string): string {
  let body = '';
  const YEAR_KEYS = ['year_minus_2', 'year_minus_1', 'current_year', 'year2', 'year3', 'year4', 'year5', 'year6'];
  const years = data.years || {};
  const yearLabel = (key: string) => {
    if (years[key]) return String(years[key]);
    const map: Record<string, string> = { year_minus_2: 'N-2', year_minus_1: 'N-1', current_year: 'N', year2: 'N+1', year3: 'N+2', year4: 'N+3', year5: 'N+4', year6: 'N+5' };
    return map[key] || key;
  };
  const labels = YEAR_KEYS.map(yearLabel);
  const getSeries = (obj: any) => YEAR_KEYS.map(k => Number(obj?.[k]) || 0);

  const revSeries = getSeries(data.revenue);
  const cogsSeries = getSeries(data.cogs);
  const gpSeries = getSeries(data.gross_profit);
  const gpPctSeries = getSeries(data.gross_margin_pct);
  const ebitdaSeries = getSeries(data.ebitda);
  const ebitdaPctSeries = getSeries(data.ebitda_margin_pct);
  const npSeries = getSeries(data.net_profit);
  const cfSeries = getSeries(data.cashflow);

  // Investment Metrics
  const im = data.investment_metrics || {};
  const metricsHtml = [
    { label: 'VAN (NPV)', value: im.van != null ? fmt(im.van) + ' FCFA' : '—', color: im.van > 0 ? 'green' : 'red' },
    { label: 'TRI (IRR)', value: im.tri != null ? Number(im.tri).toFixed(1) + '%' : '—', color: im.tri > 15 ? 'green' : im.tri > 8 ? 'yellow' : 'red' },
    { label: 'CAGR Revenue', value: im.cagr_revenue != null ? Number(im.cagr_revenue).toFixed(1) + '%' : '—', color: im.cagr_revenue > 20 ? 'green' : 'yellow' },
    { label: 'CAGR EBITDA', value: im.cagr_ebitda != null ? Number(im.cagr_ebitda).toFixed(1) + '%' : '—', color: im.cagr_ebitda > 20 ? 'green' : 'yellow' },
    { label: 'ROI', value: im.roi != null ? Number(im.roi).toFixed(1) + '%' : '—', color: im.roi > 50 ? 'green' : im.roi > 20 ? 'yellow' : 'red' },
    { label: 'Payback', value: im.payback_years != null ? im.payback_years + ' ans' : '—', color: im.payback_years <= 3 ? 'green' : im.payback_years <= 5 ? 'yellow' : 'red' },
    { label: 'DSCR', value: im.dscr != null ? Number(im.dscr).toFixed(2) + 'x' : '—', color: im.dscr > 1.5 ? 'green' : im.dscr > 1 ? 'yellow' : 'red' },
    { label: 'Multiple EBITDA', value: im.multiple_ebitda != null ? Number(im.multiple_ebitda).toFixed(1) + 'x' : '—', color: 'blue' },
  ];

  body += `<div class="card"><h2>📐 Indicateurs de décision d'investissement</h2><div class="grid-4">${metricsHtml.map(m =>
    `<div class="metric"><div class="lbl">${m.label}</div><div class="val" style="font-size:18px;color:${m.color === 'green' ? '#16a34a' : m.color === 'red' ? '#dc2626' : m.color === 'yellow' ? '#ca8a04' : '#2563eb'}">${m.value}</div></div>`
  ).join('')}</div></div>`;

  // P&L Table
  const rows = [
    { label: "Chiffre d'affaires", values: revSeries, bold: true },
    { label: "Coûts directs (COGS)", values: cogsSeries },
    { label: "Marge brute", values: gpSeries, bold: true },
    { label: "Marge brute %", values: gpPctSeries, isPct: true },
    { label: "EBITDA", values: ebitdaSeries, bold: true },
    { label: "Marge EBITDA %", values: ebitdaPctSeries, isPct: true },
    { label: "Résultat net", values: npSeries, bold: true },
    { label: "Cash-Flow", values: cfSeries },
  ];

  body += `<div class="card"><h2>📋 Compte de résultat prévisionnel (8 ans)</h2><table><tr><th>Poste</th>${labels.map(l => `<th style="text-align:right">${l}</th>`).join('')}</tr>`;
  for (const row of rows) {
    const style = row.bold ? 'font-weight:700;background:#f8fafc' : 'padding-left:24px;color:#64748b';
    body += `<tr style="${style}"><td>${row.label}</td>${row.values.map(v => `<td class="amount">${row.isPct ? (v ? v.toFixed(1) + '%' : '—') : fmt(v)}</td>`).join('')}</tr>`;
  }
  body += '</table></div>';

  // OPEX breakdown
  const opex = data.opex || {};
  const opexLabels: Record<string, string> = { staff_salaries: 'Salaires', marketing: 'Marketing', office_costs: 'Bureaux', travel: 'Déplacements', insurance: 'Assurances', maintenance: 'Maintenance', third_parties: 'Prestataires', other: 'Autres' };
  const opexEntries = Object.entries(opexLabels).filter(([k]) => opex[k]);
  if (opexEntries.length > 0) {
    body += `<div class="card"><h2>💼 Détail OPEX</h2><table><tr><th>Poste</th>${labels.map(l => `<th style="text-align:right">${l}</th>`).join('')}</tr>`;
    for (const [key, label] of opexEntries) {
      const vals = getSeries(opex[key]);
      body += `<tr><td>${label}</td>${vals.map(v => `<td class="amount">${fmt(v)}</td>`).join('')}</tr>`;
    }
    body += '</table></div>';
  }

  // CAPEX
  if (data.capex?.length) {
    body += `<div class="card"><h2>🏗️ CAPEX</h2><table><tr><th>Actif</th><th style="text-align:right">Valeur</th><th style="text-align:right">Durée</th><th>Type</th></tr>`;
    for (const c of data.capex) {
      body += `<tr><td>${c.name || '—'}</td><td class="amount">${fmt(c.acquisition_value)}</td><td class="amount">${c.useful_life || '—'} ans</td><td><span class="tag">${c.type || '—'}</span></td></tr>`;
    }
    body += '</table></div>';
  }

  // Loans
  const loans = data.loans || {};
  const loanEntries = Object.entries(loans).filter(([_, v]: any) => v?.amount > 0);
  if (loanEntries.length > 0) {
    body += `<div class="card"><h2>🏦 Prêts</h2><table><tr><th>Prêt</th><th style="text-align:right">Montant</th><th style="text-align:right">Durée</th><th style="text-align:right">Taux</th></tr>`;
    for (const [name, l] of loanEntries as [string, any][]) {
      body += `<tr><td>${name}</td><td class="amount">${fmt(l.amount)}</td><td class="amount">${l.term_years || '—'} ans</td><td class="amount">${l.rate ? (l.rate * 100).toFixed(1) + '%' : '—'}</td></tr>`;
    }
    body += '</table></div>';
  }

  // Staff
  if (data.staff?.length) {
    body += `<div class="card"><h2>👥 Effectifs</h2><table><tr><th>Poste</th><th style="text-align:right">Nombre</th><th style="text-align:right">Salaire mensuel</th></tr>`;
    for (const s of data.staff) {
      body += `<tr><td>${s.title || s.role || '—'}</td><td class="amount">${s.count || s.headcount || '—'}</td><td class="amount">${fmt(s.monthly_salary || s.salary)}</td></tr>`;
    }
    body += '</table></div>';
  }

  // Funding & Break-even
  if (data.funding_need || data.break_even_year) {
    body += `<div class="card"><h2>💰 Financement & Rentabilité</h2><div class="grid-4">`;
    if (data.funding_need) body += `<div class="metric"><div class="lbl">Besoin de financement</div><div class="val" style="font-size:18px;color:#2563eb">${fmt(data.funding_need)} FCFA</div></div>`;
    if (data.break_even_year) body += `<div class="metric"><div class="lbl">Seuil de rentabilité</div><div class="val" style="font-size:18px;color:#16a34a">${data.break_even_year}</div></div>`;
    body += `</div></div>`;
  }

  // Products & Services
  const products = data.products || [];
  const services = data.services || [];
  if (products.length > 0 || services.length > 0) {
    body += `<div class="card"><h2>📦 Produits & Services</h2><table><tr><th>Nom</th><th>Type</th><th>Gamme</th><th>Canal</th></tr>`;
    for (const p of products) {
      body += `<tr><td>${p.name || '—'}</td><td><span class="tag">Produit</span></td><td>${p.range || '—'}</td><td>${p.channel || '—'}</td></tr>`;
    }
    for (const s of services) {
      body += `<tr><td>${s.name || '—'}</td><td><span class="tag">Service</span></td><td>${s.range || '—'}</td><td>${s.channel || '—'}</td></tr>`;
    }
    body += '</table></div>';
  }

  // Scenarios
  const scenarios = data.scenarios || {};
  const scenarioEntries = Object.entries(scenarios).filter(([_, v]) => v);
  if (scenarioEntries.length > 0) {
    body += `<div class="card"><h2>🎯 Scénarios</h2><table><tr><th>Scénario</th><th>Hypothèses</th><th style="text-align:right">CA Year 5</th><th style="text-align:right">EBITDA Year 5</th><th style="text-align:right">Résultat Net Year 5</th><th style="text-align:right">VAN</th><th style="text-align:right">TRI</th></tr>`;
    const scenarioLabels: Record<string, string> = { optimiste: '🟢 Optimiste', realiste: '🟡 Réaliste', pessimiste: '🔴 Pessimiste' };
    for (const [key, sc] of scenarioEntries as [string, any][]) {
      const triVal = sc.tri != null ? (typeof sc.tri === 'number' ? (sc.tri * 100).toFixed(1) + '%' : sc.tri) : '—';
      body += `<tr><td style="font-weight:600">${scenarioLabels[key] || key}</td><td style="max-width:200px;font-size:12px">${sc.hypotheses || '—'}</td><td class="amount">${fmt(sc.revenue_year5)}</td><td class="amount">${fmt(sc.ebitda_year5)}</td><td class="amount">${fmt(sc.net_profit_year5)}</td><td class="amount">${fmt(sc.van)}</td><td class="amount">${triVal}</td></tr>`;
    }
    body += '</table></div>';
  }

  // Key Assumptions
  if (data.key_assumptions?.length) {
    body += `<div class="card"><h2>📌 Hypothèses clés</h2><ul style="margin:0;padding-left:20px">`;
    for (const a of data.key_assumptions) {
      body += `<li style="margin-bottom:6px;line-height:1.5">${a}</li>`;
    }
    body += '</ul></div>';
  }

  // Recommendations
  if (data.recommandations?.length) {
    body += `<div class="card"><h2>✅ Recommandations</h2><ul style="margin:0;padding-left:20px">`;
    for (const r of data.recommandations) {
      body += `<li style="margin-bottom:6px;line-height:1.5">→ ${r}</li>`;
    }
    body += '</ul></div>';
  }

  return htmlShell('Plan Financier OVO', data.score, body, ent);
}

// ===== BUSINESS PLAN HTML =====
function businessPlanHTML(data: any, ent: string): string {
  // ... keep existing code
}

// ===== ODD HTML (aligned with OddViewer data format) =====
function oddHTML(data: any, ent: string): string {
  const ODD_COLORS: Record<string, string> = {
    "1":"#E5243B","2":"#DDA63A","3":"#4C9F38","4":"#C5192D","5":"#FF3A21",
    "6":"#26BDE2","7":"#FCC30B","8":"#A21942","9":"#FD6925","10":"#DD1367",
    "11":"#FD9D24","12":"#BF8B2E","13":"#3F7E44","14":"#0A97D9","15":"#56C02B",
    "16":"#00689D","17":"#19486A",
  };
  const ODD_NAMES: Record<string, string> = {
    "1":"Éliminer la pauvreté","2":"Éliminer la faim","3":"Bonne santé",
    "4":"Éducation de qualité","5":"Égalité des genres","6":"Eau propre",
    "7":"Énergie propre","8":"Travail décent","9":"Innovation",
    "10":"Réduction inégalités","11":"Villes durables","12":"Consommation responsable",
    "13":"Lutte climatique","14":"Vie aquatique","15":"Vie terrestre",
    "16":"Paix et justice","17":"Partenariats",
  };

  let body = '';
  const cibles = data.evaluation_cibles_odd?.cibles ?? [];
  const resumeOdd = data.evaluation_cibles_odd?.resume_par_odd ?? {};
  const indicateurs = data.indicateurs_impact?.indicateurs ?? [];
  const synthese = data.synthese || {};
  const circularite = data.circularite || {};

  const totalPositifs = cibles.filter((c: any) => c.evaluation === "positif").length;
  const totalNeutres = cibles.filter((c: any) => c.evaluation === "neutre").length;
  const totalNegatifs = cibles.filter((c: any) => c.evaluation === "negatif").length;
  const scoreGlobal = cibles.length > 0 ? Math.round((totalPositifs / cibles.length) * 100) : 0;

  // Score summary
  body += `<div class="card"><h2>🌍 Score ODD global</h2><div class="grid-4">
<div class="metric" style="background:#dbeafe"><div class="val" style="color:#1e40af">${scoreGlobal}%</div><div class="lbl">Score global</div></div>
<div class="metric" style="background:#dcfce7"><div class="val" style="color:#166534">${totalPositifs}</div><div class="lbl">Positif</div></div>
<div class="metric" style="background:#fef9c3"><div class="val" style="color:#854d0e">${totalNeutres}</div><div class="lbl">Neutre</div></div>
<div class="metric" style="background:#fef2f2"><div class="val" style="color:#991b1b">${totalNegatifs}</div><div class="lbl">Négatif</div></div>
</div>${synthese.contribution_globale ? `<p style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#475569">${synthese.contribution_globale}</p>` : ''}</div>`;

  // Summary by SDG
  if (Object.keys(resumeOdd).length > 0) {
    body += `<div class="card"><h2>📊 Résumé par ODD</h2><div class="grid-2">`;
    for (const [key, odd] of Object.entries(resumeOdd) as [string, any][]) {
      const oddNum = key.replace("odd_", "");
      const color = ODD_COLORS[oddNum] || "#666";
      const total = Math.max(odd.cibles_positives + odd.cibles_neutres + odd.cibles_negatives, 1);
      body += `<div style="padding:12px;border-radius:10px;border:1px solid #e2e8f0;border-top:3px solid ${color}">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
<span style="background:${color};color:#fff;width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${oddNum}</span>
<span style="font-size:13px;font-weight:600">${ODD_NAMES[oddNum] || odd.nom}</span>
<span class="badge badge-blue" style="margin-left:auto">${odd.score}%</span>
</div>
<div style="display:flex;gap:2px;height:6px;border-radius:3px;overflow:hidden">
<div style="width:${(odd.cibles_positives/total)*100}%;background:#4ade80;border-radius:3px"></div>
<div style="width:${(odd.cibles_neutres/total)*100}%;background:#facc15;border-radius:3px"></div>
<div style="width:${(odd.cibles_negatives/total)*100}%;background:#f87171;border-radius:3px"></div>
</div>
<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-top:4px"><span>+${odd.cibles_positives}</span><span>-${odd.cibles_negatives}</span></div>
</div>`;
    }
    body += '</div></div>';
  }

  // All targets
  if (cibles.length > 0) {
    body += `<div class="card"><h2>🎯 Évaluation des ${cibles.length} cibles ODD</h2><table><tr><th>Cible</th><th>Description</th><th>Évaluation</th><th>Justification</th></tr>`;
    for (const c of cibles) {
      const evalColor = c.evaluation === 'positif' ? 'green' : c.evaluation === 'neutre' ? 'yellow' : 'red';
      const evalEmoji = c.evaluation === 'positif' ? '🟢' : c.evaluation === 'neutre' ? '🟡' : '🔴';
      body += `<tr><td><span style="background:${ODD_COLORS[c.odd_parent] || '#666'};color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700">${c.target_id}</span></td>
<td style="font-size:12px">${c.target_description || ''}</td>
<td><span class="badge badge-${evalColor}">${evalEmoji} ${c.evaluation}</span></td>
<td style="font-size:11px;color:#64748b">${c.justification || ''}</td></tr>`;
    }
    body += '</table></div>';
  }

  // Indicators
  if (indicateurs.length > 0) {
    body += `<div class="card"><h2>📈 Indicateurs d'impact</h2><table><tr><th>Cible</th><th>Indicateur ONU</th><th>Indicateur OVO</th><th>Valeur</th></tr>`;
    for (const ind of indicateurs) {
      body += `<tr><td style="font-family:monospace;font-size:11px">${ind.target_id}</td><td style="font-size:12px">${ind.indicateur_officiel_onu || ''}</td><td style="font-size:12px;color:#3b82f6">${ind.indicateur_ovo || '—'}</td><td style="font-weight:600">${ind.valeur || '—'}</td></tr>`;
    }
    body += '</table></div>';
  }

  // Synthesis
  const oddPrioritaires = Array.isArray(synthese.odd_prioritaires) ? synthese.odd_prioritaires : [];
  const recommandations = Array.isArray(synthese.recommandations) ? synthese.recommandations : [];

  if (oddPrioritaires.length > 0) {
    body += `<div class="card"><h2>⭐ ODD Prioritaires</h2><div style="display:flex;flex-wrap:wrap;gap:8px">`;
    for (const num of oddPrioritaires) {
      body += `<span style="background:${ODD_COLORS[num] || '#666'};color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600">ODD ${num} — ${ODD_NAMES[num] || ''}</span>`;
    }
    body += '</div></div>';
  }

  if (recommandations.length > 0) {
    body += `<div class="card"><h2>💡 Recommandations</h2><ul>${recommandations.map((r: string) => `<li style="margin-bottom:8px"><span style="color:#3b82f6;font-weight:700">→</span> ${r}</li>`).join('')}</ul></div>`;
  }

  // Circular economy
  if (circularite.evaluation) {
    body += `<div class="card"><h2>♻️ Économie Circulaire</h2><p style="font-size:14px;margin-bottom:12px">${circularite.evaluation}</p>`;
    if (circularite.pratiques?.length) {
      body += `<ul>${circularite.pratiques.map((p: string) => `<li>♻ ${p}</li>`).join('')}</ul>`;
    }
    if (circularite.cibles_odd_liees?.length) {
      body += `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">${circularite.cibles_odd_liees.map((id: string) => `<span class="tag" style="background:#dcfce7;color:#166534">${id}</span>`).join('')}</div>`;
    }
    body += '</div>';
  }

  return htmlShell('Évaluation ODD — 17 Objectifs de Développement Durable', data.score ?? scoreGlobal, body, ent);
}
// ===== PRE-SCREENING HTML =====
function preScreeningHTML(data: any, ent: string): string {
  const score = data.score_ir ?? data.score ?? 0;
  const guide = data.guide_coach || {};
  const constats = data.constats_par_scope || {};
  const contexte = data.contexte_entreprise || {};
  const classification = data.classification || data.verdict || '—';

  let body = '';

  // Contexte entreprise
  body += `<div class="card"><h2>📋 Contexte entreprise</h2><div class="grid-2">`;
  if (contexte.ca_dernier_exercice) body += `<div class="metric"><div class="lbl">CA dernier exercice</div><div class="val">${fmt(contexte.ca_dernier_exercice)}</div></div>`;
  if (contexte.effectif) body += `<div class="metric"><div class="lbl">Effectif</div><div class="val">${contexte.effectif}</div></div>`;
  if (contexte.secteur) body += `<div class="metric"><div class="lbl">Secteur</div><div class="val">${contexte.secteur}</div></div>`;
  if (contexte.pays) body += `<div class="metric"><div class="lbl">Pays</div><div class="val">${contexte.pays}</div></div>`;
  if (contexte.date_creation) body += `<div class="metric"><div class="lbl">Date de création</div><div class="val">${contexte.date_creation}</div></div>`;
  if (contexte.forme_juridique) body += `<div class="metric"><div class="lbl">Forme juridique</div><div class="val">${contexte.forme_juridique}</div></div>`;
  body += `</div>`;
  if (contexte.activite) body += `<p style="margin-top:12px;font-size:13px;color:#475569">${contexte.activite}</p>`;
  body += `</div>`;

  // Classification
  const classColor = classification === 'PRIORITAIRE' ? 'green' : classification === 'POTENTIEL' ? 'yellow' : 'red';
  body += `<div class="card"><h2>🎯 Classification</h2><span class="badge badge-${classColor}" style="font-size:16px;padding:8px 20px">${classification}</span></div>`;

  // Points bloquants
  const bloquants = guide.points_bloquants_pipeline || [];
  if (bloquants.length) {
    body += `<div class="card"><h2>🚫 Points bloquants</h2>`;
    bloquants.forEach((b: any) => {
      body += `<div style="border-left:3px solid #ef4444;padding:12px 16px;margin-bottom:12px;background:#fef2f2;border-radius:0 8px 8px 0">`;
      body += `<p style="font-weight:600;color:#991b1b">${b.blocage || b.titre || ''}</p>`;
      if (b.consequence) body += `<p style="font-size:12px;color:#64748b">Conséquence : ${b.consequence}</p>`;
      if (b.resolution) body += `<p style="font-size:12px;color:#1e40af">Résolution : ${b.resolution}</p>`;
      if (b.source) body += `<p style="font-size:10px;color:#94a3b8;font-style:italic">Source : ${b.source}</p>`;
      body += `</div>`;
    });
    body += `</div>`;
  }

  // Constats par scope
  for (const [scope, items] of Object.entries(constats)) {
    if (!Array.isArray(items) || !items.length) continue;
    body += `<div class="card"><h2>📊 Constats — ${scope}</h2>`;
    (items as any[]).forEach((c: any) => {
      const color = c.severite === 'urgent' ? '#ef4444' : c.severite === 'positif' ? '#22c55e' : '#eab308';
      const badgeColor = c.severite === 'urgent' ? 'red' : c.severite === 'positif' ? 'green' : 'yellow';
      body += `<div style="border-left:3px solid ${color};padding:10px 14px;margin-bottom:8px;border-radius:0 6px 6px 0">`;
      body += `<span class="badge badge-${badgeColor}">${c.severite || ''}</span> `;
      body += `<strong>${c.titre || ''}</strong>`;
      if (c.constat) body += `<p style="font-size:12px;color:#475569;margin-top:4px">${c.constat}</p>`;
      if (c.source) body += `<p style="font-size:10px;color:#94a3b8;font-style:italic">Source : ${c.source}</p>`;
      body += `</div>`;
    });
    body += `</div>`;
  }

  // Actions recommandées
  const actions = guide.actions_recommandees || guide.actions_coach_semaine || [];
  if (actions.length) {
    body += `<div class="card"><h2>✅ Actions recommandées</h2><ol>`;
    actions.forEach((a: any) => {
      body += `<li><strong>${typeof a === 'string' ? a : a.action || a.titre || ''}</strong>`;
      if (a.detail) body += ` — <span style="color:#64748b">${a.detail}</span>`;
      body += `</li>`;
    });
    body += `</ol></div>`;
  }

  // Documents, Questions, Axes
  (['documents_a_demander', 'questions_a_poser', 'axes_accompagnement'] as string[]).forEach(key => {
    const items = guide[key] || [];
    if (items.length) {
      const title = key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      body += `<div class="card"><h2>${key === 'documents_a_demander' ? '📄' : key === 'questions_a_poser' ? '❓' : '🧭'} ${title}</h2><ul>`;
      items.forEach((item: any) => body += `<li>${typeof item === 'string' ? item : item.item || item.document || item.question || JSON.stringify(item)}</li>`);
      body += `</ul></div>`;
    }
  });

  // Alertes
  const alertes = guide.alertes || [];
  if (alertes.length) {
    body += `<div class="card"><h2>⚠️ Alertes</h2>`;
    alertes.forEach((a: any) => {
      body += `<div style="border-left:3px solid #eab308;padding:10px 14px;margin-bottom:8px;background:#fefce8;border-radius:0 6px 6px 0">`;
      body += `<p style="font-weight:600;color:#854d0e">${typeof a === 'string' ? a : a.titre || a.alerte || JSON.stringify(a)}</p>`;
      body += `</div>`;
    });
    body += `</div>`;
  }

  return htmlShell('Diagnostic initial', score, body, ent);
}

// ===== VALUATION HTML =====
function valuationHTML(data: any, ent: string): string {
  const score = data.score ?? data.confidence_score ?? 0;
  const synthese = data.synthese || data.valuation_range || {};
  const dcf = data.dcf || {};
  const multEbitda = data.multiples_ebitda || data.mult_ebitda || {};
  const multCA = data.multiples_ca || data.mult_ca || {};
  const decotes = data.decotes || data.discounts || {};
  const qualitative = data.analyse_qualitative || data.qualitative || {};
  const devise = data.devise || 'FCFA';

  const fmtV = (n: any) => {
    if (n == null || n === '' || isNaN(Number(n))) return '—';
    const v = Number(n);
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + ' Mrd ' + devise;
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + ' M ' + devise;
    return fmt(v) + ' ' + devise;
  };

  let body = '';

  // Synthèse / Range
  body += `<div class="card"><h2>💰 Synthèse de valorisation</h2><div class="grid-4">`;
  body += `<div class="metric" style="background:#fef2f2"><div class="lbl">Valeur basse</div><div class="val" style="color:#dc2626;font-size:18px">${fmtV(synthese.low || synthese.valeur_basse)}</div></div>`;
  body += `<div class="metric" style="background:#dcfce7"><div class="lbl">Valeur médiane</div><div class="val" style="color:#16a34a;font-size:22px">${fmtV(synthese.median || synthese.valeur_mediane)}</div></div>`;
  body += `<div class="metric" style="background:#dbeafe"><div class="lbl">Valeur haute</div><div class="val" style="color:#2563eb;font-size:18px">${fmtV(synthese.high || synthese.valeur_haute)}</div></div>`;
  if (synthese.equity_value) body += `<div class="metric"><div class="lbl">Equity Value</div><div class="val" style="font-size:18px">${fmtV(synthese.equity_value)}</div></div>`;
  body += `</div></div>`;

  // DCF
  if (dcf.equity_value || dcf.enterprise_value) {
    body += `<div class="card"><h2>📐 Méthode DCF</h2><div class="grid-2">`;
    if (dcf.wacc) body += `<div class="metric"><div class="lbl">WACC</div><div class="val">${(Number(dcf.wacc) * 100).toFixed(1)}%</div></div>`;
    if (dcf.terminal_value) body += `<div class="metric"><div class="lbl">Valeur terminale</div><div class="val" style="font-size:16px">${fmtV(dcf.terminal_value)}</div></div>`;
    if (dcf.enterprise_value) body += `<div class="metric"><div class="lbl">Enterprise Value</div><div class="val" style="font-size:16px">${fmtV(dcf.enterprise_value)}</div></div>`;
    if (dcf.equity_value) body += `<div class="metric"><div class="lbl">Equity Value</div><div class="val" style="font-size:16px">${fmtV(dcf.equity_value)}</div></div>`;
    body += `</div>`;
    if (dcf.source) body += `<p style="font-size:11px;color:#94a3b8;margin-top:8px">Source : ${dcf.source}</p>`;
    body += `</div>`;
  }

  // Multiples EBITDA
  if (multEbitda.valeur || multEbitda.equity_value) {
    body += `<div class="card"><h2>📊 Multiples EBITDA</h2><div class="grid-2">`;
    if (multEbitda.multiple) body += `<div class="metric"><div class="lbl">Multiple</div><div class="val">${multEbitda.multiple}x</div></div>`;
    if (multEbitda.fourchette) body += `<div class="metric"><div class="lbl">Fourchette</div><div class="val" style="font-size:14px">${multEbitda.fourchette}</div></div>`;
    body += `<div class="metric"><div class="lbl">Valeur</div><div class="val" style="font-size:16px">${fmtV(multEbitda.valeur || multEbitda.equity_value)}</div></div>`;
    body += `</div>`;
    if (multEbitda.source) body += `<p style="font-size:11px;color:#94a3b8;margin-top:8px">Source : ${multEbitda.source}</p>`;
    body += `</div>`;
  }

  // Multiples CA
  if (multCA.valeur || multCA.equity_value) {
    body += `<div class="card"><h2>📈 Multiples CA</h2><div class="grid-2">`;
    if (multCA.multiple) body += `<div class="metric"><div class="lbl">Multiple</div><div class="val">${multCA.multiple}x</div></div>`;
    if (multCA.fourchette) body += `<div class="metric"><div class="lbl">Fourchette</div><div class="val" style="font-size:14px">${multCA.fourchette}</div></div>`;
    body += `<div class="metric"><div class="lbl">Valeur</div><div class="val" style="font-size:16px">${fmtV(multCA.valeur || multCA.equity_value)}</div></div>`;
    body += `</div>`;
    if (multCA.source) body += `<p style="font-size:11px;color:#94a3b8;margin-top:8px">Source : ${multCA.source}</p>`;
    body += `</div>`;
  }

  // Décotes
  const decoteEntries = Object.entries(decotes).filter(([_, v]) => v != null);
  if (decoteEntries.length) {
    body += `<div class="card"><h2>📉 Décotes appliquées</h2><table><tr><th>Type</th><th style="text-align:right">Valeur</th></tr>`;
    for (const [k, v] of decoteEntries) {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      body += `<tr><td>${label}</td><td class="amount">${typeof v === 'number' ? (v * 100).toFixed(0) + '%' : v}</td></tr>`;
    }
    body += `</table></div>`;
  }

  // Analyse qualitative
  if (qualitative.forces || qualitative.faiblesses || qualitative.commentaire) {
    body += `<div class="card"><h2>🔍 Analyse qualitative</h2>`;
    if (qualitative.commentaire) body += `<p style="font-size:13px;color:#475569;margin-bottom:12px">${qualitative.commentaire}</p>`;
    if (qualitative.forces?.length) {
      body += `<h3 style="color:#166534">Forces</h3><ul>${qualitative.forces.map((f: string) => `<li style="color:#166534">✓ ${f}</li>`).join('')}</ul>`;
    }
    if (qualitative.faiblesses?.length) {
      body += `<h3 style="color:#991b1b">Faiblesses</h3><ul>${qualitative.faiblesses.map((f: string) => `<li style="color:#991b1b">✗ ${f}</li>`).join('')}</ul>`;
    }
    body += `</div>`;
  }

  return htmlShell('Valorisation', score, body, ent);
}

// ===== SCREENING REPORT HTML =====
function screeningReportHTML(data: any, ent: string): string {
  const score = data.score ?? 0;
  const verdict = data.decision?.verdict || data.verdict || '—';
  const verdictColor = verdict === 'ÉLIGIBLE' || verdict === 'ELIGIBLE' ? 'green' : verdict.includes('CONDITIONNEL') ? 'yellow' : 'red';

  let body = '';

  // Decision / Verdict
  body += `<div class="card" style="background:linear-gradient(135deg,${verdictColor === 'green' ? '#f0fdf4,#ecfeff' : verdictColor === 'yellow' ? '#fefce8,#fffbeb' : '#fef2f2,#fff1f2'})">`;
  body += `<h2>🏛️ Décision</h2><span class="badge badge-${verdictColor}" style="font-size:18px;padding:10px 24px">${verdict}</span>`;
  if (data.decision?.synthese) body += `<p style="margin-top:12px;font-size:14px;color:#475569">${data.decision.synthese}</p>`;
  body += `</div>`;

  // Matching critères programme
  const matching = data.matching_criteres || data.matching || {};
  const critMet = matching.criteres_remplis || matching.met || [];
  const critNotMet = matching.criteres_non_remplis || matching.not_met || [];
  const critPartial = matching.criteres_partiels || matching.partial || [];
  if (critMet.length || critNotMet.length || critPartial.length) {
    body += `<div class="card"><h2>✅ Matching critères programme</h2>`;
    if (critMet.length) {
      body += `<h3 style="color:#166534">Critères remplis</h3><ul>`;
      critMet.forEach((c: any) => body += `<li style="color:#166534">✓ ${typeof c === 'string' ? c : c.critere || c.label || JSON.stringify(c)}</li>`);
      body += `</ul>`;
    }
    if (critPartial.length) {
      body += `<h3 style="color:#854d0e">Critères partiels</h3><ul>`;
      critPartial.forEach((c: any) => body += `<li style="color:#854d0e">⚠ ${typeof c === 'string' ? c : c.critere || c.label || JSON.stringify(c)}</li>`);
      body += `</ul>`;
    }
    if (critNotMet.length) {
      body += `<h3 style="color:#991b1b">Critères non remplis</h3><ul>`;
      critNotMet.forEach((c: any) => body += `<li style="color:#991b1b">✗ ${typeof c === 'string' ? c : c.critere || c.label || JSON.stringify(c)}</li>`);
      body += `</ul>`;
    }
    body += `</div>`;
  }

  // Impact attendu
  const impact = data.impact_attendu || data.impact || {};
  if (typeof impact === 'string') {
    body += `<div class="card"><h2>🌍 Impact attendu</h2><p style="font-size:13px">${impact}</p></div>`;
  } else if (impact.description || impact.odd_cibles) {
    body += `<div class="card"><h2>🌍 Impact attendu</h2>`;
    if (impact.description) body += `<p style="font-size:13px;margin-bottom:12px">${impact.description}</p>`;
    if (impact.odd_cibles?.length) body += `<div style="display:flex;gap:4px;flex-wrap:wrap">${impact.odd_cibles.map((o: any) => `<span class="tag" style="background:#dcfce7;color:#166534">${typeof o === 'string' ? o : o.odd || o.label || ''}</span>`).join('')}</div>`;
    body += `</div>`;
  }

  // Dimensionnement appui
  const dim = data.dimensionnement_appui || data.dimensionnement || {};
  if (dim.montant || dim.instrument || dim.duree) {
    body += `<div class="card"><h2>💰 Dimensionnement de l'appui</h2><div class="grid-2">`;
    if (dim.montant) body += `<div class="metric"><div class="lbl">Montant</div><div class="val">${fmt(dim.montant)}</div></div>`;
    if (dim.instrument) body += `<div class="metric"><div class="lbl">Instrument</div><div class="val" style="font-size:14px">${dim.instrument}</div></div>`;
    if (dim.duree) body += `<div class="metric"><div class="lbl">Durée</div><div class="val" style="font-size:14px">${dim.duree}</div></div>`;
    if (dim.justification) body += `<div class="metric" style="grid-column:span 2"><div class="lbl">Justification</div><div class="val" style="font-size:13px;font-weight:400">${dim.justification}</div></div>`;
    body += `</div></div>`;
  }

  // Conditions préalables
  const conditions = data.conditions_prealables || data.conditions || [];
  if (conditions.length) {
    body += `<div class="card"><h2>📋 Conditions préalables</h2><ol>`;
    conditions.forEach((c: any) => body += `<li>${typeof c === 'string' ? c : c.condition || c.titre || JSON.stringify(c)}</li>`);
    body += `</ol></div>`;
  }

  // Risques
  const risques = data.risques_programme || data.risques || [];
  if (risques.length) {
    body += `<div class="card"><h2>⚠️ Risques programme</h2>`;
    risques.forEach((r: any) => {
      const sev = r.severite || r.niveau || '';
      const sevColor = sev === 'élevé' || sev === 'high' ? 'red' : sev === 'moyen' || sev === 'medium' ? 'yellow' : 'green';
      body += `<div style="border-left:3px solid ${sevColor === 'red' ? '#ef4444' : sevColor === 'yellow' ? '#eab308' : '#22c55e'};padding:10px 14px;margin-bottom:8px;border-radius:0 6px 6px 0">`;
      if (sev) body += `<span class="badge badge-${sevColor}">${sev}</span> `;
      body += `<strong>${typeof r === 'string' ? r : r.risque || r.titre || ''}</strong>`;
      if (r.mitigation) body += `<p style="font-size:12px;color:#1e40af;margin-top:4px">Mitigation : ${r.mitigation}</p>`;
      body += `</div>`;
    });
    body += `</div>`;
  }

  // Recommandation finale
  if (data.recommandation) {
    body += `<div class="card" style="background:#f8fafc"><h2>📝 Recommandation</h2><p style="font-size:14px">${data.recommandation}</p></div>`;
  }

  return htmlShell('Décision programme (Screening)', score, body, ent);
}

// ===== COACHING REPORT HTML =====
function coachingReportHTML(allDeliverables: any[], modules: any[], ent: string): string {
  let body = '';
  const MODULE_LABELS: Record<string, string> = {
    bmc_analysis: 'Business Model Canvas', sic_analysis: 'Social Impact Canvas',
    framework_data: 'Plan Financier Intermédiaire', diagnostic_data: 'Diagnostic Expert',
    plan_ovo: 'Plan Financier Final', business_plan: 'Business Plan', odd_analysis: 'ODD',
  };

  const completedMods = modules.filter((m: any) => m.status === 'completed').length;
  const totalMods = modules.length || 7;
  const pct = Math.round((completedMods / totalMods) * 100);
  const scores = allDeliverables.filter((d: any) => d.score).map((d: any) => d.score);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;

  // Overview
  body += `<div class="card"><h2>📊 Vue d'ensemble</h2><div class="grid-4">
<div class="metric"><div class="val">${pct}%</div><div class="lbl">Progression</div></div>
<div class="metric"><div class="val">${completedMods}/${totalMods}</div><div class="lbl">Modules terminés</div></div>
<div class="metric"><div class="val">${allDeliverables.length}</div><div class="lbl">Livrables générés</div></div>
<div class="metric"><div class="val">${avgScore}/100</div><div class="lbl">Score moyen</div></div>
</div></div>`;

  // Scores per deliverable
  body += `<div class="card"><h2>📈 Scores par module</h2><table><tr><th>Module</th><th>Score</th><th>Status</th><th>Dernière mise à jour</th></tr>`;
  for (const d of allDeliverables) {
    const label = MODULE_LABELS[d.type] || d.type;
    const scoreVal = d.score || 0;
    const color = scoreVal >= 70 ? 'green' : scoreVal >= 50 ? 'yellow' : 'red';
    body += `<tr><td>${label}</td><td><span class="badge badge-${color}">${scoreVal}/100</span></td>
<td><span class="badge badge-green">Généré</span></td>
<td style="font-size:11px;color:#64748b">${new Date(d.updated_at).toLocaleDateString('fr-FR')}</td></tr>`;
  }
  body += '</table></div>';

  // Extract key insights from deliverables
  const bmcDeliv = allDeliverables.find((d: any) => d.type === 'bmc_analysis');
  const diagDeliv = allDeliverables.find((d: any) => d.type === 'diagnostic_data');

  if (diagDeliv?.data) {
    const diagData = diagDeliv.data as any;
    if (diagData.verdict) {
      body += `<div class="card" style="background:linear-gradient(135deg,#f0fdf4,#ecfeff);border-color:#86efac"><h2>🏆 Verdict Diagnostic</h2><p style="font-size:15px;font-weight:600">${diagData.verdict}</p></div>`;
    }
    if (diagData.swot) {
      const sw = diagData.swot;
      body += `<div class="card"><h2>🧭 Analyse SWOT</h2><div class="swot-grid">
<div class="swot-box swot-s"><h4>Forces</h4><ul>${(sw.forces||[]).slice(0,3).map((s:any)=>`<li>${typeof s==='string'?s:s.item||''}</li>`).join('')}</ul></div>
<div class="swot-box swot-w"><h4>Faiblesses</h4><ul>${(sw.faiblesses||[]).slice(0,3).map((s:any)=>`<li>${typeof s==='string'?s:s.item||''}</li>`).join('')}</ul></div>
<div class="swot-box swot-o"><h4>Opportunités</h4><ul>${(sw.opportunites||[]).slice(0,3).map((s:any)=>`<li>${typeof s==='string'?s:s.item||''}</li>`).join('')}</ul></div>
<div class="swot-box swot-t"><h4>Menaces</h4><ul>${(sw.menaces||[]).slice(0,3).map((s:any)=>`<li>${typeof s==='string'?s:s.item||''}</li>`).join('')}</ul></div>
</div></div>`;
    }
  }

  // Financial highlights from plan_ovo
  const ovoDeliv = allDeliverables.find((d: any) => d.type === 'plan_ovo');
  if (ovoDeliv?.data) {
    const ovo = ovoDeliv.data as any;
    const im = ovo.investment_metrics || {};
    if (im.van != null || im.tri != null) {
      body += `<div class="card"><h2>💰 Indicateurs financiers clés</h2><div class="grid-4">
${im.van != null ? `<div class="metric"><div class="lbl">VAN (NPV)</div><div class="val" style="font-size:16px">${fmt(im.van)} FCFA</div></div>` : ''}
${im.tri != null ? `<div class="metric"><div class="lbl">TRI (IRR)</div><div class="val" style="font-size:16px">${Number(im.tri).toFixed(1)}%</div></div>` : ''}
${im.roi != null ? `<div class="metric"><div class="lbl">ROI</div><div class="val" style="font-size:16px">${Number(im.roi).toFixed(1)}%</div></div>` : ''}
${im.payback_years != null ? `<div class="metric"><div class="lbl">Payback</div><div class="val" style="font-size:16px">${im.payback_years} ans</div></div>` : ''}
</div></div>`;
    }
  }

  body += `<div class="card" style="background:linear-gradient(135deg,#eff6ff,#f0fdf4)"><h2>📝 Note du coach</h2><p style="font-size:14px;color:#64748b;font-style:italic">Ce rapport a été généré automatiquement à partir des livrables de l'entrepreneur. Il peut être utilisé comme base pour un rapport de suivi destiné à votre hiérarchie.</p></div>`;

  return htmlShell(`Rapport Coaching — ${ent}`, avgScore, body, ent);
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
    const url = new URL(req.url);
    const authHeader = req.headers.get("Authorization");
    const tokenParam = url.searchParams.get("token");
    const jwt = authHeader?.replace("Bearer ", "") || tokenParam;
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    // Special case: coaching_report (aggregates all deliverables)
    if (deliverableType === "coaching_report") {
      const { data: allDelivs } = await supabase.from("deliverables").select("*").eq("enterprise_id", enterpriseId);
      const { data: allMods } = await supabase.from("enterprise_modules").select("*").eq("enterprise_id", enterpriseId);
      const html = coachingReportHTML(allDelivs || [], allMods || [], ent.name);
      const safeName = ent.name.replace(/[^a-zA-Z0-9]/g, "_");
      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="${safeName}_Rapport_Coaching.html"` },
      });
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
      pre_screening: "Diagnostic initial", valuation: "Valorisation", screening_report: "Décision programme",
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
      // PRIORITY 0: Servir le template rempli depuis DB (instantané) pour framework_data
      if (deliverableType === "framework_data") {
        const { data: prebuilt } = await supabase
          .from("deliverables")
          .select("html_content")
          .eq("enterprise_id", enterpriseId)
          .eq("type", "framework_excel")
          .maybeSingle();

        if (prebuilt?.html_content && prebuilt.html_content.length > 1000) {
          const binary = atob(prebuilt.html_content);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return new Response(bytes, {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": `attachment; filename="${safeName}_Framework_Analyse_PME.xlsx"`,
            },
          });
        }

        // PRIORITY 1: Générer à la volée depuis Storage
        try {
          const { fillFrameworkExcelTemplate } = await import("../_shared/framework-excel-template.ts");
          const xlsxBytes = await fillFrameworkExcelTemplate(deliv.data, ent.name, supabase);
          return new Response(xlsxBytes, {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": `attachment; filename="${safeName}_Framework_Analyse_PME.xlsx"`,
            },
          });
        } catch (templateErr) {
          console.warn("[download] Template filling failed, falling back:", templateErr);
        }
      }

      // ODD: ALWAYS regenerate from odd_analysis data to ensure latest template engine is used
      if (deliverableType === "odd_analysis") {
        const oddMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const oddFileName = `${safeName}_ODD.xlsx`;
        const oddHeaders = {
          ...corsHeaders,
          "Content-Type": oddMime,
          "Content-Disposition": `attachment; filename="${oddFileName}"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        };

        console.log(`[download-odd] Generating ODD Excel on-the-fly from odd_analysis data...`);
        try {
          const { fillOddExcelTemplate } = await import("../_shared/odd-excel-template.ts");
          const xlsxBytes = await fillOddExcelTemplate(deliv.data, ent.name, supabase);
          console.log(`[download-odd] ✅ Generated on-the-fly (${xlsxBytes.byteLength} bytes) as ${oddFileName}`);
          return new Response(xlsxBytes, { headers: oddHeaders });
        } catch (oddErr) {
          console.warn("[download-odd] Template filling failed:", oddErr);
        }
      }

      // FALLBACK: XLSX basique existant
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
      pre_screening: preScreeningHTML, valuation: valuationHTML, screening_report: screeningReportHTML,
    };

    const generator = richGenerators[deliverableType];
    const html = generator ? generator(deliv.data, ent.name) : htmlShell(title, deliv.data?.score, `<div class="card"><pre style="white-space:pre-wrap;font-size:12px">${JSON.stringify(deliv.data, null, 2)}</pre></div>`, ent.name);

    // PDF format — generate HTML then send to parser for PDF conversion
    if (format === "pdf") {
      const parserUrl = Deno.env.get("PARSER_URL");
      const parserApiKey = Deno.env.get("PARSER_API_KEY");
      if (!parserUrl) {
        return new Response(JSON.stringify({ error: "PARSER_URL not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const pdfFilename = `${safeName}_${deliverableType}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const pdfRes = await fetch(`${parserUrl}/generate-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(parserApiKey ? { "Authorization": `Bearer ${parserApiKey}` } : {}),
        },
        body: JSON.stringify({ html, filename: pdfFilename }),
      });
      if (!pdfRes.ok) {
        const errText = await pdfRes.text();
        console.error("[download-deliverable] PDF generation failed:", pdfRes.status, errText);
        return new Response(JSON.stringify({ error: `PDF generation failed: ${pdfRes.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
      return new Response(pdfBytes, {
        headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdfFilename}"` },
      });
    }

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
