import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Download, Copy, CheckCircle2, FileText, Presentation, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateMemoPptx, SLIDE_TITLES } from '@/lib/memo-pptx-generator';

interface Props {
  data: Record<string, any>;
  onRegenerate?: () => void;
}

const SECTIONS = [
  { key: 'page_de_garde', label: '1. Page de Garde' },
  { key: 'resume_executif', label: '2. Résumé Exécutif' },
  { key: 'presentation_entreprise', label: '3. Présentation' },
  { key: 'analyse_marche', label: '4. Marché' },
  { key: 'modele_economique', label: '5. Modèle Économique' },
  { key: 'analyse_financiere', label: '6. Analyse Financière' },
  { key: 'valorisation', label: '7. Valorisation' },
  { key: 'besoins_financement', label: '8. Besoins Financement' },
  { key: 'equipe_et_gouvernance', label: '9. Équipe' },
  { key: 'esg_impact', label: '10. ESG & Impact' },
  { key: 'analyse_risques', label: '11. Risques' },
  { key: 'these_investissement', label: '12. Thèse' },
  { key: 'structure_proposee', label: '13. Structure' },
  { key: 'recommandation_finale', label: '14. Recommandation' },
  { key: 'annexes', label: '15. Annexes' },
];

const verdictColors: Record<string, string> = {
  INVESTIR: 'bg-emerald-600 text-white',
  APPROFONDIR: 'bg-amber-500 text-white',
  DECLINER: 'bg-red-600 text-white',
};

export default function InvestmentMemoViewer({ data, onRegenerate }: Props) {
  const [activeSection, setActiveSection] = useState('resume_executif');
  const [generatingPptx, setGeneratingPptx] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToSection = (key: string) => {
    setActiveSection(key);
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const verdict = data.recommandation_finale?.verdict || data.resume_executif?.recommandation_preliminaire || '—';
  const score = data.score || data.resume_executif?.score_ir || 0;
  const scoreBg = score >= 70 ? 'bg-emerald-100 text-emerald-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  const handleCopySummary = () => {
    const summary = data.resume_executif?.synthese || '';
    navigator.clipboard.writeText(summary);
    toast.success('Résumé copié !');
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `InvestmentMemo_${data.page_de_garde?.titre || 'memo'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleDownloadPptx = async () => {
    setGeneratingPptx(true);
    try {
      await generateMemoPptx(data);
      toast.success('PPTX téléchargé !');
    } catch (err: any) {
      toast.error(err.message || 'Erreur génération PPTX');
    } finally {
      setGeneratingPptx(false);
    }
  };

  // ── Enhanced HTML Download ──
  const handleDownloadHtml = () => {
    const pg = data.page_de_garde || {};
    const reco = data.recommandation_finale || {};
    const valo = data.valorisation || {};
    const besoin = data.besoins_financement || {};
    const these = data.these_investissement || {};

    const verdictColor = reco.verdict === 'INVESTIR' ? '#0E7C6B' : reco.verdict === 'APPROFONDIR' ? '#C4841D' : '#9B2C2C';

    const renderObj = (obj: any, depth = 0): string => {
      if (!obj) return '';
      if (typeof obj === 'string') return `<p>${obj}</p>`;
      if (Array.isArray(obj)) return `<ul>${obj.map(i => `<li>${typeof i === 'string' ? i : typeof i === 'object' ? Object.values(i).join(' — ') : String(i)}</li>`).join('')}</ul>`;
      return Object.entries(obj).filter(([k]) => !k.startsWith('_')).map(([k, v]) => {
        if (Array.isArray(v)) return `<h3>${k.replace(/_/g, ' ')}</h3><ul>${(v as any[]).map(i => `<li>${typeof i === 'string' ? i : typeof i === 'object' ? Object.values(i as Record<string, unknown>).join(' — ') : String(i)}</li>`).join('')}</ul>`;
        if (typeof v === 'object' && v) return `<h3>${k.replace(/_/g, ' ')}</h3>${renderObj(v, depth + 1)}`;
        return `<p><strong>${k.replace(/_/g, ' ')} :</strong> ${v}</p>`;
      }).join('');
    };

    const sectionHtml = SECTIONS.filter(s => s.key !== 'page_de_garde').map(s => {
      const d = data[s.key];
      if (!d) return '';
      // Special rendering for certain sections
      if (s.key === 'resume_executif') {
        return `<h2>${s.label}</h2>
          <div class="callout">${d.synthese || ''}</div>
          ${d.points_cles ? `<ul>${d.points_cles.map((p: string) => `<li>✓ ${p}</li>`).join('')}</ul>` : ''}
          ${d.recommandation_preliminaire ? `<p><strong>Recommandation :</strong> ${d.recommandation_preliminaire}</p>` : ''}`;
      }
      if (s.key === 'analyse_risques' && d.risques_identifies) {
        return `<h2>${s.label}</h2>
          <table><thead><tr><th>Risque</th><th>Catégorie</th><th>Probabilité</th><th>Impact</th><th>Mitigation</th></tr></thead><tbody>
          ${d.risques_identifies.map((r: any) => `<tr><td>${r.description || '—'}</td><td>${r.categorie || '—'}</td>
            <td><span class="badge badge-${r.probabilite === 'elevee' ? 'red' : r.probabilite === 'moyenne' ? 'amber' : 'green'}">${r.probabilite || '—'}</span></td>
            <td><span class="badge badge-${r.impact === 'fort' ? 'red' : r.impact === 'moyen' ? 'amber' : 'green'}">${r.impact || '—'}</span></td>
            <td>${r.mitigation || '—'}</td></tr>`).join('')}</tbody></table>
          ${d.matrice_risque_synthese ? `<p class="note">${d.matrice_risque_synthese}</p>` : ''}`;
      }
      if (s.key === 'recommandation_finale') {
        return `<h2>${s.label}</h2>
          <div class="verdict-banner" style="background:${verdictColor}">${reco.verdict || '—'}</div>
          <p>${reco.justification || ''}</p>
          ${reco.conditions?.length ? `<div class="callout callout-amber"><strong>Conditions :</strong><ul>${reco.conditions.map((c: string) => `<li>${c}</li>`).join('')}</ul></div>` : ''}
          ${reco.prochaines_etapes?.length ? `<div class="callout callout-blue"><strong>Prochaines étapes :</strong><ul>${reco.prochaines_etapes.map((s: string) => `<li>→ ${s}</li>`).join('')}</ul></div>` : ''}`;
      }
      if (s.key === 'valorisation') {
        return `<h2>${s.label}</h2>
          <div class="grid-2">
            <div class="card"><h3>Méthodes</h3>${(valo.methodes_utilisees || []).map((m: string) => `<span class="tag">${m}</span>`).join(' ')}</div>
            <div class="card"><h3>Fourchette</h3><p class="big-number">${valo.fourchette_valorisation || '—'}</p><p>Médiane : ${valo.valeur_mediane || '—'}</p></div>
          </div>
          ${valo.note_valorisation ? `<p>${valo.note_valorisation}</p>` : ''}`;
      }
      if (s.key === 'these_investissement') {
        return `<h2>${s.label}</h2>
          <div class="grid-2">
            <div class="card card-green"><h3>✅ Arguments Pour</h3><ul>${(these.arguments_pour || []).map((a: string) => `<li>${a}</li>`).join('')}</ul></div>
            <div class="card card-red"><h3>⚠️ Arguments Contre</h3><ul>${(these.arguments_contre || []).map((a: string) => `<li>${a}</li>`).join('')}</ul></div>
          </div>
          ${these.these || these.synthese ? `<p>${these.these || these.synthese}</p>` : ''}`;
      }
      if (s.key === 'besoins_financement' && besoin.utilisation_fonds) {
        return `<h2>${s.label}</h2>
          <p class="big-number">${besoin.montant_recherche || '—'}</p>
          <table><thead><tr><th>Poste</th><th>Montant</th><th>%</th></tr></thead><tbody>
          ${besoin.utilisation_fonds.map((u: any) => `<tr><td>${u.poste || '—'}</td><td>${u.montant || '—'}</td><td>${u.pourcentage || '—'}</td></tr>`).join('')}</tbody></table>
          ${besoin.calendrier_deploiement ? `<p>📅 ${besoin.calendrier_deploiement}</p>` : ''}
          ${besoin.retour_attendu ? `<p>📈 ${besoin.retour_attendu}</p>` : ''}`;
      }
      return `<h2>${s.label}</h2>${renderObj(d)}`;
    }).join('\n');

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${pg.titre || 'Investment Memo'}</title>
<style>
:root{--navy:#0F2B46;--blue:#1B5E8A;--teal:#0E7C6B;--gold:#C4841D;--red:#9B2C2C;--gray:#64748B;--light:#F8FAFC;--border:#E2E8F0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:0;color:#1e293b;font-size:10pt;line-height:1.6}
.cover{background:linear-gradient(135deg,var(--navy) 0%,#1a3a5c 100%);color:white;padding:80px 60px;page-break-after:always;min-height:400px}
.cover h1{font-size:28pt;margin-bottom:8px;letter-spacing:1px}.cover .subtitle{font-size:14pt;color:#94a3b8;margin-bottom:24px}
.cover .meta{font-size:9pt;color:#64748b;margin-top:40px}.cover .conf{display:inline-block;background:var(--red);color:white;padding:4px 16px;border-radius:4px;font-size:8pt;font-weight:700;letter-spacing:2px;margin-top:16px}
.toc{padding:40px 60px;page-break-after:always}.toc h2{color:var(--navy);font-size:16pt;border-bottom:2px solid var(--blue);padding-bottom:6px;margin-bottom:20px}
.toc ol{counter-reset:toc;list-style:none;padding:0}.toc li{counter-increment:toc;padding:6px 0;border-bottom:1px dotted var(--border);font-size:10pt}
.toc li::before{content:counter(toc) ".";font-weight:700;color:var(--blue);margin-right:8px}
h2{font-size:14pt;color:var(--navy);border-bottom:2px solid var(--blue);padding-bottom:4px;margin:32px 60px 12px;page-break-after:avoid}
h3{font-size:11pt;color:var(--blue);margin:16px 60px 8px;text-transform:capitalize}
p,ul,ol{margin:8px 60px;text-align:justify}ul{padding-left:20px}li{margin-bottom:4px}
table{width:calc(100% - 120px);margin:12px 60px;border-collapse:collapse;font-size:9pt}
th{background:var(--navy);color:white;padding:8px 10px;text-align:left;font-weight:600}
td{padding:6px 10px;border:1px solid var(--border)}tr:nth-child(even) td{background:var(--light)}
.callout{margin:12px 60px;padding:12px 16px;border-left:4px solid var(--blue);background:#eff6ff;border-radius:0 6px 6px 0;font-size:10pt}
.callout-amber{border-left-color:var(--gold);background:#fffbeb}.callout-blue{border-left-color:var(--blue);background:#eff6ff}
.verdict-banner{display:block;text-align:center;padding:16px;margin:16px 60px;border-radius:8px;color:white;font-size:18pt;font-weight:700;letter-spacing:2px}
.score-badge{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:var(--navy);color:white;font-size:20pt;font-weight:700}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 60px}
.card{padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--light)}
.card-green{border-left:4px solid var(--teal)}.card-red{border-left:4px solid var(--red)}
.big-number{font-size:18pt;font-weight:700;color:var(--navy);text-align:center;margin:8px 60px}
.tag{display:inline-block;background:#e8e6ff;color:var(--blue);padding:2px 10px;border-radius:4px;font-size:9pt;margin:2px}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:8pt;font-weight:600;color:white}
.badge-green{background:var(--teal)}.badge-amber{background:var(--gold)}.badge-red{background:var(--red)}
.note{font-style:italic;color:var(--gray);font-size:9pt}
.footer{margin-top:40px;padding:16px 60px;border-top:1px solid var(--border);font-size:8pt;color:var(--gray);text-align:center}
@media print{body{padding:0;max-width:none}h2{page-break-before:always;margin-top:20px}.cover{page-break-before:avoid}}
</style></head><body>
<div class="cover">
  <h1>${pg.titre || 'Investment Memorandum'}</h1>
  <div class="subtitle">${pg.sous_titre || ''}</div>
  <div class="meta">${pg.date || new Date().toLocaleDateString('fr-FR')}</div>
  <div class="conf">CONFIDENTIEL</div>
</div>
<div class="toc"><h2>Table des Matières</h2><ol>
${SECTIONS.filter(s => s.key !== 'page_de_garde').map(s => `<li>${s.label.replace(/^\d+\.\s*/, '')}</li>`).join('\n')}
</ol></div>
<div class="score-section" style="text-align:center;padding:24px 60px">
  <span class="score-badge">${score}</span>
  <span class="verdict-banner" style="background:${verdictColor};display:inline-block;padding:8px 24px;margin-left:16px;font-size:14pt">${verdict}</span>
</div>
${sectionHtml}
<div class="footer">ESONO — Plateforme d'analyse d'investissement · Document confidentiel · ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `InvestmentMemo_${pg.titre?.replace(/[^a-zA-Z0-9]/g, '_') || 'memo'}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const renderSection = (key: string) => {
    const d = data[key];
    if (!d) return <p className="text-sm text-muted-foreground italic">Section non générée</p>;

    switch (key) {
      case 'resume_executif':
        return (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">{d.synthese}</p>
            {d.points_cles && (
              <div>
                <p className="text-xs font-semibold mb-2">Points Clés</p>
                <ul className="space-y-1">{d.points_cles.map((p: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-none" />{p}</li>
                ))}</ul>
              </div>
            )}
          </div>
        );
      case 'analyse_risques':
        return (
          <div className="space-y-3">
            {d.risques_identifies?.map((r: any, i: number) => (
              <div key={i} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs">{r.categorie}</Badge>
                  <div className="flex gap-2">
                    <Badge className={r.probabilite === 'elevee' ? 'bg-red-100 text-red-700' : r.probabilite === 'moyenne' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>P: {r.probabilite}</Badge>
                    <Badge className={r.impact === 'fort' ? 'bg-red-100 text-red-700' : r.impact === 'moyen' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>I: {r.impact}</Badge>
                  </div>
                </div>
                <p className="text-sm">{r.description}</p>
                <p className="text-xs text-muted-foreground mt-1">🛡️ {r.mitigation}</p>
              </div>
            ))}
            {d.matrice_risque_synthese && <p className="text-sm text-muted-foreground italic">{d.matrice_risque_synthese}</p>}
          </div>
        );
      case 'recommandation_finale':
        return (
          <div className="space-y-4">
            <div className={`inline-block px-6 py-3 rounded-xl text-lg font-bold ${verdictColors[d.verdict] || 'bg-gray-200'}`}>
              {d.verdict === 'INVESTIR' ? '✅' : d.verdict === 'APPROFONDIR' ? '⚠️' : '❌'} {d.verdict}
            </div>
            <p className="text-sm leading-relaxed">{d.justification}</p>
            {d.conditions?.length > 0 && (
              <div><p className="text-xs font-semibold mb-1">Conditions</p><ul className="space-y-1">{d.conditions.map((c: string, i: number) => <li key={i} className="text-sm text-muted-foreground">• {c}</li>)}</ul></div>
            )}
            {d.prochaines_etapes?.length > 0 && (
              <div><p className="text-xs font-semibold mb-1">Prochaines Étapes</p><ul className="space-y-1">{d.prochaines_etapes.map((s: string, i: number) => <li key={i} className="text-sm text-muted-foreground">→ {s}</li>)}</ul></div>
            )}
          </div>
        );
      case 'besoins_financement':
        return (
          <div className="space-y-3">
            <p className="text-sm"><strong>Montant :</strong> {d.montant_recherche}</p>
            {d.utilisation_fonds?.length > 0 && (
              <div className="space-y-2">
                {d.utilisation_fonds.map((u: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm"><span>{u.poste}</span><span className="font-semibold">{u.montant} ({u.pourcentage})</span></div>
                      <div className="h-2 bg-muted rounded-full mt-1 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: u.pourcentage || '0%' }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {d.calendrier_deploiement && <p className="text-sm text-muted-foreground">📅 {d.calendrier_deploiement}</p>}
            {d.retour_attendu && <p className="text-sm text-muted-foreground">📈 {d.retour_attendu}</p>}
          </div>
        );
      case 'valorisation':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {d.methodes_utilisees?.map((m: string, i: number) => <Badge key={i} variant="secondary" className="justify-center">{m}</Badge>)}
            </div>
            <div className="p-3 rounded-lg bg-violet-50 text-center">
              <p className="text-xs text-violet-600 mb-1">Fourchette de Valorisation</p>
              <p className="text-xl font-bold text-violet-700">{d.fourchette_valorisation || '—'}</p>
              <p className="text-sm text-violet-600">Médiane : {d.valeur_mediane || '—'}</p>
            </div>
            {d.note_valorisation && <p className="text-sm text-muted-foreground">{d.note_valorisation}</p>}
          </div>
        );
      default:
        return (
          <div className="space-y-3">
            {Object.entries(d).filter(([k]) => !k.startsWith('_')).map(([k, v]) => {
              if (Array.isArray(v)) return (
                <div key={k}><p className="text-xs font-semibold mb-1 capitalize">{k.replace(/_/g, ' ')}</p>
                  <ul className="space-y-1">{(v as any[]).map((item, i) => <li key={i} className="text-sm text-muted-foreground">{typeof item === 'string' ? `• ${item}` : typeof item === 'object' ? `• ${Object.values(item).join(' — ')}` : `• ${item}`}</li>)}</ul>
                </div>
              );
              if (typeof v === 'string') return (
                <div key={k}><p className="text-xs font-semibold capitalize text-muted-foreground">{k.replace(/_/g, ' ')}</p><p className="text-sm leading-relaxed">{v}</p></div>
              );
              return null;
            })}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-slate-700" /> Investment Memorandum
          </h2>
          <p className="text-sm text-muted-foreground">{data.page_de_garde?.titre}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`text-lg px-4 py-2 ${scoreBg}`}>{score}/100</Badge>
          <Badge className={`text-sm px-3 py-1.5 ${verdictColors[verdict] || 'bg-gray-200'}`}>{verdict}</Badge>
        </div>
      </div>

      {/* Tabs: HTML / PPTX */}
      <Tabs defaultValue="html" className="w-full">
        <TabsList>
          <TabsTrigger value="html" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Document HTML</TabsTrigger>
          <TabsTrigger value="pptx" className="gap-1.5"><Presentation className="h-3.5 w-3.5" /> Présentation PPTX</TabsTrigger>
        </TabsList>

        {/* ── HTML Tab ── */}
        <TabsContent value="html">
          <div className="flex gap-6 min-h-0">
            {/* Sidebar TOC */}
            <div className="w-56 flex-none sticky top-0 self-start space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Table des matières</p>
              {SECTIONS.map(s => (
                <button key={s.key} onClick={() => scrollToSection(s.key)}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-md transition-colors ${activeSection === s.key ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'} ${!data[s.key] ? 'opacity-40' : ''}`}>
                  {s.label}
                </button>
              ))}
              <div className="pt-4 space-y-2">
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleCopySummary}><Copy className="h-3 w-3 mr-1" /> Copier résumé</Button>
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleDownloadHtml}><Download className="h-3 w-3 mr-1" /> HTML (A4)</Button>
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleDownloadJson}><Download className="h-3 w-3 mr-1" /> JSON</Button>
                {onRegenerate && <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onRegenerate}>Regénérer</Button>}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-6 overflow-y-auto">
              {SECTIONS.map(s => (
                <div key={s.key} ref={el => { sectionRefs.current[s.key] = el; }}>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-display">{s.label}</CardTitle></CardHeader>
                    <CardContent>{renderSection(s.key)}</CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── PPTX Tab ── */}
        <TabsContent value="pptx">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Aperçu des slides de la présentation comité d'investissement (~20 slides)</p>
              <Button onClick={handleDownloadPptx} disabled={generatingPptx} className="gap-2">
                {generatingPptx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Télécharger le PPTX
              </Button>
            </div>

            {/* Slide preview grid */}
            <div className="grid grid-cols-3 gap-4">
              {SLIDE_TITLES.map((title, i) => (
                <div key={i} className="group relative">
                  <div className={`aspect-[16/9] rounded-lg border-2 flex flex-col items-center justify-center p-4 transition-colors ${
                    i === 0 ? 'bg-[#0F2B46] border-[#0F2B46] text-white' :
                    i === SLIDE_TITLES.length - 1 ? 'bg-muted/50 border-border text-muted-foreground' :
                    'bg-card border-border hover:border-primary/30'
                  }`}>
                    <span className={`text-[10px] font-mono mb-1 ${i === 0 ? 'text-[#C4841D]' : 'text-muted-foreground'}`}>
                      Slide {i + 1}
                    </span>
                    <span className={`text-xs font-semibold text-center leading-tight ${i === 0 ? '' : 'text-foreground'}`}>
                      {title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
