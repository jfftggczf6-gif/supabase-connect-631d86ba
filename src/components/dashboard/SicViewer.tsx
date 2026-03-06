import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SicViewerProps {
  data: any;
}

const ODD_COLORS: Record<number, string> = {
  1:'#E5243B',2:'#DDA63A',3:'#4C9F38',4:'#C5192D',5:'#FF3A21',6:'#26BDE2',7:'#FCC30B',8:'#A21942',
  9:'#FD6925',10:'#DD1367',11:'#FD9D24',12:'#BF8B2E',13:'#3F7E44',14:'#0A97D9',15:'#56C02B',16:'#00689D',17:'#19486A',
};

const ODD_NAMES: Record<number, string> = {
  1:'Pas de pauvreté',2:'Faim zéro',3:'Bonne santé et bien-être',4:'Éducation de qualité',5:'Égalité entre les sexes',
  6:'Eau propre et assainissement',7:'Énergie propre et abordable',8:'Travail décent et croissance',9:'Industrie, innovation et infrastructure',
  10:'Inégalités réduites',11:'Villes et communautés durables',12:'Consommation et production responsables',13:'Mesures relatives au climat',
  14:'Vie aquatique',15:'Vie terrestre',16:'Paix, justice et institutions efficaces',17:'Partenariats pour les objectifs',
};

function fmtNum(n: any): string {
  if (n == null) return '—';
  const num = typeof n === 'string' ? parseInt(n.replace(/\D/g, '')) : Number(n);
  if (isNaN(num)) return String(n);
  return new Intl.NumberFormat('fr-FR').format(num);
}

function scoreColor(s: number): string {
  if (s >= 86) return '#16a34a';
  if (s >= 71) return '#22c55e';
  if (s >= 51) return '#eab308';
  if (s >= 31) return '#f97316';
  return '#ef4444';
}

const TC_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
const TC_LABELS = ['PROBLÈME', 'ACTIVITÉS', 'OUTPUTS', 'OUTCOMES', 'IMPACT'];
const TC_KEYS = ['probleme', 'activites', 'outputs', 'outcomes', 'impact'];

const MATURITY_LEVELS = ['idee', 'test_pilote', 'deploye', 'mesure', 'scale'];
const MATURITY_LABELS = ['Idée', 'Test/Pilote', 'Déployé', 'Mesuré', 'Scalé'];

/** Normalize flat DB structure (canvas.*, beneficiaires.*, odd_alignment[], etc.)
 *  into the nested format expected by the viewer */
function normalizeData(raw: any) {
  // If data already has the expected structure, return as-is
  if (raw.dimensions && raw.canvas_blocs) {
    return {
      score_global: raw.score_global ?? raw.score ?? 0,
      label: raw.label || raw.palier || '',
      synthese_impact: raw.synthese_impact || '',
      dimensions: raw.dimensions || {},
      chiffres_cles: raw.chiffres_cles || {},
      canvas_blocs: raw.canvas_blocs || {},
      risques_attenuation: raw.risques_attenuation || { risques: [] },
      theorie_du_changement: raw.theorie_du_changement || raw.theorie_changement || {},
      changements: raw.changements || {},
      recommandations: raw.recommandations || [],
      swot: raw.swot || {},
      parties_prenantes: raw.parties_prenantes || [],
      odd_detail: raw.odd_detail || [],
      alignement_modele: raw.alignement_modele || {},
      evolution_score: raw.evolution_score || [],
      niveau_maturite: raw.niveau_maturite || '',
    };
  }

  // === Flat DB structure: map fields ===
  const score = raw.score_global ?? raw.score ?? 0;
  const oddAlign = raw.odd_alignment || [];
  const beneficiaires = raw.beneficiaires || {};
  const canvas = raw.canvas || {};
  const tc = raw.theorie_changement || raw.theorie_du_changement || {};
  const indicators = raw.indicateurs_impact || [];
  const risques = raw.risques_sociaux || [];
  const recos = raw.recommandations || [];

  // Build ODD detail with colors
  const oddDetail = oddAlign.map((o: any) => ({
    numero: o.odd_number || o.numero,
    nom: o.odd_name || o.nom || ODD_NAMES[o.odd_number || o.numero] || '',
    couleur: o.couleur || ODD_COLORS[o.odd_number || o.numero] || '#666',
    alignement: (o.level || o.alignement || 'moyen').toLowerCase(),
    contribution: o.contribution || o.justification || '',
  }));

  // Build canvas blocs from flat data
  const canvasBlocs: any = {
    probleme_social: { titre: 'PROBLÈME SOCIAL', points: raw.probleme_social ? [raw.probleme_social] : [] },
    transformation_visee: { titre: 'TRANSFORMATION VISÉE', points: canvas.resultats_attendus || [] },
    beneficiaires: {
      titre: 'BÉNÉFICIAIRES',
      points: [
        ...(beneficiaires.directs || []),
        ...(beneficiaires.indirects || []),
      ],
    },
    solution_activites: {
      titre: 'SOLUTION & ACTIVITÉS À IMPACT',
      points: canvas.activites_impact || [],
    },
    indicateurs_mesure: {
      titre: 'INDICATEURS & MESURE',
      indicateurs: indicators.map((ind: any) => ({
        nom: `${ind.indicateur}: ${fmtNum(ind.valeur_actuelle)} → ${fmtNum(ind.cible)} ${ind.unite || ''}`,
        type: 'outcome',
      })),
      methode: canvas.mesure_impact || '',
      frequence: '',
    },
    odd_cibles: {
      titre: 'ODD CIBLÉS',
      odds: oddDetail,
    },
  };

  // Build chiffres clés
  const directCount = beneficiaires.directs?.length || 0;
  const indirectCount = beneficiaires.indirects?.length || 0;
  // Try to extract numbers from text
  const extractNum = (arr: string[]) => {
    if (!arr || arr.length === 0) return 0;
    for (const s of arr) {
      const m = s.match(/([\d\s]+[\d])/);
      if (m) return parseInt(m[1].replace(/\s/g, ''));
    }
    return arr.length;
  };

  const chiffres = {
    beneficiaires_directs: { nombre: extractNum(beneficiaires.directs || []) || directCount, horizon: '3 ans' },
    beneficiaires_indirects: { nombre: extractNum(beneficiaires.indirects || []) || indirectCount },
    impact_total_projete: { nombre: (extractNum(beneficiaires.directs || []) || 0) + (extractNum(beneficiaires.indirects || []) || 0) },
    odd_adresses: { nombre: oddAlign.length },
  };

  // Build théorie du changement from nested arrays or strings
  const flattenTc = (val: any) => {
    if (!val) return '—';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(' • ');
    return String(val);
  };

  const theorieDuChangement = {
    probleme: flattenTc(tc.probleme) !== '—' ? flattenTc(tc.probleme) : raw.probleme_social || '—',
    activites: flattenTc(tc.activites),
    outputs: flattenTc(tc.outputs),
    outcomes: flattenTc(tc.outcomes),
    impact: flattenTc(tc.impact),
  };

  // Build risques
  const risquesAttenuation = {
    risques: risques.map((r: string, i: number) => ({
      risque: r,
      mitigation: (canvas.ressources_impact || [])[i] || '—',
    })),
  };

  // Build recommandations
  const formattedRecos = recos.map((r: any, i: number) => {
    if (typeof r === 'string') return { priorite: i + 1, titre: r, detail: '', impact_score: '' };
    return r;
  });

  // Build parties prenantes from canvas
  const partiesPrenantes = (canvas.parties_prenantes || []).map((pp: string) => ({
    nom: pp,
    role: '—',
    implication: '—',
  }));

  return {
    score_global: score,
    label: raw.label || raw.palier || '',
    synthese_impact: raw.mission_sociale || raw.synthese_impact || '',
    dimensions: raw.dimensions || {},
    chiffres_cles: chiffres,
    canvas_blocs: canvasBlocs,
    risques_attenuation: risquesAttenuation,
    theorie_du_changement: theorieDuChangement,
    changements: raw.changements || {},
    recommandations: formattedRecos,
    swot: raw.swot || {},
    parties_prenantes: partiesPrenantes,
    odd_detail: oddDetail,
    alignement_modele: raw.alignement_modele || {},
    evolution_score: raw.evolution_score || [],
    niveau_maturite: raw.niveau_maturite || '',
  };
}


export default function SicViewer({ data }: SicViewerProps) {
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  if (!data) return null;

  // === NORMALIZE: map flat DB structure to expected viewer structure ===
  const d = normalizeData(data);

  const score = d.score_global;
  const color = scoreColor(score);
  const dims = d.dimensions;
  const chiffres = d.chiffres_cles;
  const canvas = d.canvas_blocs;
  const risques = d.risques_attenuation?.risques || [];
  const tc = d.theorie_du_changement;
  const changements = d.changements;
  const recos = d.recommandations;
  const oddBloc = canvas.odd_cibles || {};
  const swot = d.swot;
  const partiesPrenantes = d.parties_prenantes;
  const oddDetail = d.odd_detail.length > 0 ? d.odd_detail : (oddBloc.odds || []);
  const alignement = d.alignement_modele;
  const evolution = d.evolution_score;
  const maturite = d.niveau_maturite;

  const dimOrder = ['probleme_vision', 'beneficiaires', 'mesure_impact', 'alignement_odd', 'gestion_risques'];
  const maturityIdx = MATURITY_LEVELS.indexOf(maturite);

  return (
    <div className="max-w-[900px] mx-auto space-y-6" style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>

      {/* ===== BLOC 1 — SCORE GLOBAL (hero) ===== */}
      <div className="rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, #1a2744 0%, #2d4a7c 50%, #1a2744 100%)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Social Impact Canvas</p>
        <div className="flex items-center gap-4 mb-3">
          <span className="text-5xl font-black text-white leading-none" style={{ fontSize: 48 }}>{score}</span>
          <span className="text-2xl text-white/40 font-light">/100</span>
        </div>
        <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
        </div>
        <p className="text-lg font-semibold" style={{ color }}>{data.label || data.palier || ''}</p>
        {data.synthese_impact && (
          <p className="text-sm text-white/60 italic mt-3 max-w-[700px] leading-relaxed">{data.synthese_impact}</p>
        )}
      </div>

      {/* ===== BLOC 2 — 5 JAUGES DE DIMENSIONS ===== */}
      <div className="bg-card border border-border rounded-xl p-6">
        <SectionTitle>SCORES PAR DIMENSION</SectionTitle>
        <div className="space-y-3">
          {dimOrder.map(key => {
            const dim = dims[key];
            if (!dim) return null;
            const s = dim.score || 0;
            const c = scoreColor(s);
            const isOpen = expandedDim === key;
            return (
              <div key={key}>
                <button onClick={() => setExpandedDim(isOpen ? null : key)} className="w-full flex items-center gap-4 group">
                  <span className="w-[200px] text-left text-[13px] font-semibold text-foreground truncate">{dim.label || key}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s}%`, backgroundColor: c }} />
                  </div>
                  <span className="text-sm font-bold w-12 text-right" style={{ color: c }}>{s}%</span>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isOpen && dim.commentaire && (
                  <p className="ml-[216px] mt-2 text-xs text-muted-foreground leading-relaxed bg-muted/50 rounded-lg p-3">{dim.commentaire}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== BLOC 3 — SYNTHÈSE D'IMPACT ===== */}
      {data.synthese_impact && (
        <div className="bg-card border border-border rounded-xl p-6">
          <SectionTitle>SYNTHÈSE D'IMPACT</SectionTitle>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.synthese_impact}</p>
        </div>
      )}

      {/* ===== BLOC 4 — 4 CHIFFRES CLÉS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { val: chiffres.beneficiaires_directs?.nombre, label: `Bénéficiaires directs${chiffres.beneficiaires_directs?.horizon ? ` (${chiffres.beneficiaires_directs.horizon})` : ''}` },
          { val: chiffres.beneficiaires_indirects?.nombre, label: 'Bénéficiaires indirects' },
          { val: chiffres.impact_total_projete?.nombre, label: 'Impact total projeté' },
          { val: chiffres.odd_adresses?.nombre, label: 'ODD adressés' },
        ].map((item, i) => (
          <div key={i} className="rounded-xl p-5 text-center" style={{ background: 'linear-gradient(135deg, #1a2744, #2d4a7c)' }}>
            <p className="text-3xl font-black text-white leading-none mb-1">{fmtNum(item.val)}</p>
            <p className="text-[11px] text-white/50 uppercase tracking-wider">{item.label}</p>
          </div>
        ))}
      </div>

      {/* ===== BLOC 5 — CANVAS VISUEL (6 blocs) ===== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground p-6 pb-4 border-b border-border">
          SOCIAL IMPACT CANVAS — VUE SYNTHÉTIQUE
        </h2>
        {/* Row 1: 4 cols */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          <CanvasBlock icon="🔴" title={canvas.probleme_social?.titre || 'PROBLÈME SOCIAL'} points={canvas.probleme_social?.points} />
          <CanvasBlock icon="🟢" title={canvas.transformation_visee?.titre || 'TRANSFORMATION VISÉE'} points={canvas.transformation_visee?.points} />
          <CanvasBlock icon="👥" title={canvas.beneficiaires?.titre || 'BÉNÉFICIAIRES'} points={canvas.beneficiaires?.points} />
          {/* ODD block */}
          <div className="bg-card p-4 min-h-[180px]">
            <h4 className="text-[9px] font-black uppercase tracking-[0.12em] text-primary mb-3 pb-1.5 border-b border-border">
              🎯 ODD CIBLÉS
            </h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {(oddBloc.odds || []).map((odd: any, i: number) => (
                <div key={i} className="w-10 h-10 rounded flex items-center justify-center text-white text-sm font-bold"
                  style={{
                    backgroundColor: odd.couleur || ODD_COLORS[odd.numero] || '#666',
                    border: odd.alignement === 'fort' ? '3px solid white' : odd.alignement === 'faible' ? '1px dashed rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.7)',
                  }}
                  title={`ODD ${odd.numero}: ${odd.nom} (${odd.alignement})`}
                >
                  {odd.numero}
                </div>
              ))}
            </div>
            <ul className="space-y-0.5">
              {(oddBloc.odds || []).map((odd: any, i: number) => (
                <li key={i} className="text-[10px] text-muted-foreground">{odd.nom || ODD_NAMES[odd.numero]}</li>
              ))}
            </ul>
          </div>
        </div>
        {/* Row 2: 2 cols */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border-t border-border">
          <div className="bg-card p-4 min-h-[180px]">
            <h4 className="text-[9px] font-black uppercase tracking-[0.12em] text-primary mb-3 pb-1.5 border-b border-border">📏 INDICATEURS & MESURE</h4>
            <ul className="space-y-1.5 mb-3">
              {(canvas.indicateurs_mesure?.indicateurs || []).map((ind: any, i: number) => (
                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    ind.type === 'impact' ? 'bg-green-100 text-green-700' : ind.type === 'outcome' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>{ind.type}</span>
                  <span>{ind.nom}</span>
                </li>
              ))}
            </ul>
            {canvas.indicateurs_mesure?.cible_1_an && <p className="text-[10px] text-muted-foreground">🎯 Cible 1 an: {canvas.indicateurs_mesure.cible_1_an}</p>}
            {canvas.indicateurs_mesure?.methode && <p className="text-[10px] text-muted-foreground">📐 {canvas.indicateurs_mesure.methode}</p>}
            {canvas.indicateurs_mesure?.frequence && <p className="text-[10px] text-muted-foreground">🔄 {canvas.indicateurs_mesure.frequence}</p>}
          </div>
          <CanvasBlock icon="💡" title={canvas.solution_activites?.titre || 'SOLUTION & ACTIVITÉS'} points={canvas.solution_activites?.points} />
        </div>
      </div>

      {/* ===== BLOC 6 — RISQUES & ATTÉNUATION ===== */}
      {risques.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground p-6 pb-4 border-b border-border">RISQUES & ATTÉNUATION</h2>
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/50"><th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">⚠️ Risque</th><th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">✅ Atténuation</th></tr></thead>
            <tbody>{risques.map((r: any, i: number) => (
              <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/30'}><td className="p-3 text-foreground">{r.risque}</td><td className="p-3 text-muted-foreground">{r.mitigation}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* ===== BLOC 7 — THÉORIE DU CHANGEMENT ===== */}
      <div className="bg-card border border-border rounded-xl p-6">
        <SectionTitle>THÉORIE DU CHANGEMENT</SectionTitle>
        <div className="hidden md:flex items-stretch gap-1">
          {TC_KEYS.map((key, i) => (
            <div key={key} className="flex items-stretch" style={{ width: '19%' }}>
              <div className="rounded-lg p-3 flex-1 min-h-[100px]" style={{ backgroundColor: TC_COLORS[i] + '20', borderLeft: `4px solid ${TC_COLORS[i]}` }}>
                <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: TC_COLORS[i] }}>{TC_LABELS[i]}</p>
                <p className="text-[11px] text-foreground leading-snug">{tc[key] || '—'}</p>
              </div>
              {i < 4 && <div className="flex items-center px-1 text-muted-foreground text-lg">→</div>}
            </div>
          ))}
        </div>
        <div className="md:hidden space-y-2">
          {TC_KEYS.map((key, i) => (
            <div key={key}>
              <div className="rounded-lg p-3" style={{ backgroundColor: TC_COLORS[i] + '20', borderLeft: `4px solid ${TC_COLORS[i]}` }}>
                <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: TC_COLORS[i] }}>{TC_LABELS[i]}</p>
                <p className="text-[11px] text-foreground leading-snug">{tc[key] || '—'}</p>
              </div>
              {i < 4 && <div className="text-center text-muted-foreground text-lg">↓</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ===== BLOC 8 — CHANGEMENTS ATTENDUS ===== */}
      {(changements.court_terme || changements.moyen_terme || changements.long_terme) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Court terme (0-12 mois)', val: changements.court_terme, color: '#22c55e' },
            { label: 'Moyen terme (1-3 ans)', val: changements.moyen_terme, color: '#3b82f6' },
            { label: 'Long terme (3-5 ans)', val: changements.long_terme, color: '#8b5cf6' },
          ].map((item, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5" style={{ borderLeftWidth: 4, borderLeftColor: item.color }}>
              <h4 className="text-xs font-bold text-foreground mb-2">{item.label}</h4>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{item.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* ===== BLOC 9 — CONTRIBUTION ODD DÉTAIL ===== */}
      {oddDetail.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground p-6 pb-4 border-b border-border">
            CONTRIBUTION AUX ODD — DÉTAIL
          </h2>
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase w-16">ODD</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Intitulé</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Contribution concrète</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase w-20">Alignement</th>
            </tr></thead>
            <tbody>{oddDetail.map((odd: any, i: number) => (
              <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                <td className="p-3">
                  <div className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: odd.couleur || ODD_COLORS[odd.numero] || '#666' }}>
                    {odd.numero}
                  </div>
                </td>
                <td className="p-3 font-medium text-foreground">{odd.nom || ODD_NAMES[odd.numero]}</td>
                <td className="p-3 text-muted-foreground">{odd.justification || odd.contribution || ''}</td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    odd.alignement === 'fort' ? 'bg-green-100 text-green-700' : odd.alignement === 'faible' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{odd.alignement || 'moyen'}</span>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* ===== BLOC 10 — PARTIES PRENANTES CLÉS ===== */}
      {partiesPrenantes.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground p-6 pb-4 border-b border-border">PARTIES PRENANTES CLÉS</h2>
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Partie prenante</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Rôle</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase w-28">Implication</th>
            </tr></thead>
            <tbody>{partiesPrenantes.map((pp: any, i: number) => (
              <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                <td className="p-3 font-medium text-foreground">{pp.nom || pp.type}</td>
                <td className="p-3 text-muted-foreground">{pp.role}</td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    pp.implication === 'Élevé' || pp.implication === 'élevé' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{pp.implication || '—'}</span>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* ===== BLOC 11 — ALIGNEMENT MODÈLE ÉCONOMIQUE / IMPACT ===== */}
      {alignement.commentaire && (
        <div className="bg-card border border-border rounded-xl p-6">
          <SectionTitle>ALIGNEMENT MODÈLE ÉCONOMIQUE / IMPACT</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Position de l'impact</p>
              <p className="text-sm font-bold text-foreground">{
                alignement.impact_position === 'coeur_du_modele' ? '🎯 Cœur du modèle' :
                alignement.impact_position === 'effet_secondaire' ? '↗️ Effet secondaire' : '📎 Activité annexe'
              }</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Corrélation croissance</p>
              <p className="text-sm font-bold text-foreground">{
                alignement.correlation_croissance === 'augmente' ? '📈 Augmente' :
                alignement.correlation_croissance === 'stagne' ? '➡️ Stagne' : '📉 Diminue'
              }</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Conflit rentabilité</p>
              <p className={`text-sm font-bold ${
                alignement.conflit_rentabilite === 'faible' ? 'text-green-600' : alignement.conflit_rentabilite === 'fort' ? 'text-red-600' : 'text-yellow-600'
              }`}>{alignement.conflit_rentabilite || '—'}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{alignement.commentaire}</p>
        </div>
      )}

      {/* ===== BLOC 12 — SWOT IMPACT SOCIAL ===== */}
      {(swot.forces || swot.faiblesses || swot.opportunites || swot.menaces) && (
        <div className="bg-card border border-border rounded-xl p-6">
          <SectionTitle>DIAGNOSTIC SWOT — IMPACT SOCIAL</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <SwotBox title="FORCES" items={swot.forces} bg="#f0fdf4" border="#bbf7d0" />
            <SwotBox title="FAIBLESSES" items={swot.faiblesses} bg="#fef2f2" border="#fecaca" />
            <SwotBox title="OPPORTUNITÉS" items={swot.opportunites} bg="#eff6ff" border="#bfdbfe" />
            <SwotBox title="MENACES" items={swot.menaces} bg="#fefce8" border="#fef08a" />
          </div>
        </div>
      )}

      {/* ===== BLOC 13 — TOP 3 RECOMMANDATIONS ===== */}
      {recos.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <SectionTitle>RECOMMANDATIONS POUR RENFORCER L'IMPACT</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recos.slice(0, 3).map((r: any, i: number) => (
              <div key={i} className="bg-muted/30 border border-border rounded-xl p-5 relative">
                <div className="absolute -top-2 -left-2 h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: scoreColor(70) }}>
                  {r.priorite || i + 1}
                </div>
                <h4 className="text-sm font-bold text-foreground mb-2 mt-2">{r.titre}</h4>
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{r.detail}</p>
                {r.impact_score && (
                  <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">{r.impact_score}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== BLOC 14 — ÉVOLUTION POTENTIELLE DU SCORE ===== */}
      {evolution.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground p-6 pb-4 border-b border-border">ÉVOLUTION POTENTIELLE DU SCORE</h2>
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Critère</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Score actuel</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Score après</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Action clé</th>
            </tr></thead>
            <tbody>{evolution.map((e: any, i: number) => (
              <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                <td className="p-3 font-medium text-foreground">{e.critere}</td>
                <td className="p-3"><span className="font-bold" style={{ color: scoreColor(e.score_actuel || 0) }}>{e.score_actuel}/100</span></td>
                <td className="p-3"><span className="font-bold" style={{ color: scoreColor(e.score_apres || 0) }}>{e.score_apres}/100</span></td>
                <td className="p-3 text-muted-foreground">{e.action}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* ===== BLOC 15 — NIVEAU DE MATURITÉ ===== */}
      {maturite && (
        <div className="bg-card border border-border rounded-xl p-6">
          <SectionTitle>NIVEAU DE MATURITÉ DE L'IMPACT</SectionTitle>
          <div className="flex items-center gap-2 mb-4">
            {MATURITY_LEVELS.map((level, i) => {
              const isActive = i <= maturityIdx;
              const isCurrent = i === maturityIdx;
              return (
                <div key={level} className="flex-1 relative">
                  <div className={`h-3 rounded-full ${isActive ? '' : 'bg-muted'}`}
                    style={isActive ? { backgroundColor: TC_COLORS[i] } : {}} />
                  <p className={`text-[10px] text-center mt-1.5 ${isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                    {MATURITY_LABELS[i]}
                  </p>
                  {isCurrent && (
                    <p className="text-[9px] text-center text-primary font-semibold">← VOUS ÊTES ICI</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-6 border-t border-border">
        <p className="text-[11px] text-muted-foreground">
          Document généré par ESONO — Investment Readiness Platform • {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

/* ===== Sub-components ===== */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground mb-4 pb-2 border-b-2 border-border">
      {children}
    </h2>
  );
}

function CanvasBlock({ icon, title, points }: { icon: string; title: string; points?: string[] }) {
  return (
    <div className="bg-card p-4 min-h-[180px]">
      <h4 className="text-[9px] font-black uppercase tracking-[0.12em] text-primary mb-3 pb-1.5 border-b border-border">{icon} {title}</h4>
      <ul className="space-y-1">{(points || []).map((p, i) => <li key={i} className="text-[11px] text-muted-foreground">• {p}</li>)}</ul>
    </div>
  );
}

function SwotBox({ title, items, bg, border }: { title: string; items?: string[]; bg: string; border: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <h4 className="text-xs font-bold mb-2">{title}</h4>
      <ul className="space-y-1">{(items || []).map((item, i) => <li key={i} className="text-[11px] text-foreground">• {item}</li>)}</ul>
    </div>
  );
}
