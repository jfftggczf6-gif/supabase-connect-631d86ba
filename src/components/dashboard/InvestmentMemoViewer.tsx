import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, Download, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

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

  const handleDownloadHtml = () => {
    const sections = SECTIONS.map(s => {
      const d = data[s.key];
      if (!d) return '';
      return `<h2>${s.label}</h2>${renderSectionHtml(s.key, d)}`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.page_de_garde?.titre || 'Investment Memo'}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a2e;font-size:14px;line-height:1.8}
h1{font-size:24px;border-bottom:3px solid #4338ca;padding-bottom:8px}h2{font-size:18px;color:#4338ca;margin-top:32px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px;border:1px solid #e2e8f0;text-align:left;font-size:13px}
th{background:#f8fafc}.verdict{display:inline-block;padding:8px 24px;border-radius:8px;font-size:18px;font-weight:700;color:white}
.green{background:#059669}.amber{background:#d97706}.red{background:#dc2626}
@media print{body{padding:20px}h2{page-break-before:always}}
</style></head><body>
<h1>${data.page_de_garde?.titre || 'Investment Memorandum'}</h1>
<p style="color:#888">${data.page_de_garde?.sous_titre || ''} — ${data.page_de_garde?.date || ''}</p>
${sections}
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `InvestmentMemo.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const renderSectionHtml = (_key: string, d: any): string => {
    if (typeof d === 'string') return `<p>${d}</p>`;
    if (Array.isArray(d)) return `<ul>${d.map(i => `<li>${typeof i === 'string' ? i : JSON.stringify(i)}</li>`).join('')}</ul>`;
    return Object.entries(d).map(([k, v]) => {
      if (Array.isArray(v)) return `<p><strong>${k}:</strong></p><ul>${(v as any[]).map(i => `<li>${typeof i === 'string' ? i : JSON.stringify(i)}</li>`).join('')}</ul>`;
      if (typeof v === 'object' && v) return `<p><strong>${k}:</strong> ${JSON.stringify(v)}</p>`;
      return `<p><strong>${k}:</strong> ${v}</p>`;
    }).join('');
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
                    <Badge className={r.probabilite === 'elevee' ? 'bg-red-100 text-red-700' : r.probabilite === 'moyenne' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                      P: {r.probabilite}
                    </Badge>
                    <Badge className={r.impact === 'fort' ? 'bg-red-100 text-red-700' : r.impact === 'moyen' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                      I: {r.impact}
                    </Badge>
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
              <div>
                <p className="text-xs font-semibold mb-1">Conditions</p>
                <ul className="space-y-1">{d.conditions.map((c: string, i: number) => (
                  <li key={i} className="text-sm text-muted-foreground">• {c}</li>
                ))}</ul>
              </div>
            )}
            {d.prochaines_etapes?.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Prochaines Étapes</p>
                <ul className="space-y-1">{d.prochaines_etapes.map((s: string, i: number) => (
                  <li key={i} className="text-sm text-muted-foreground">→ {s}</li>
                ))}</ul>
              </div>
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
                      <div className="flex justify-between text-sm">
                        <span>{u.poste}</span>
                        <span className="font-semibold">{u.montant} ({u.pourcentage})</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: u.pourcentage || '0%' }} />
                      </div>
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
              {d.methodes_utilisees?.map((m: string, i: number) => (
                <Badge key={i} variant="secondary" className="justify-center">{m}</Badge>
              ))}
            </div>
            <div className="p-3 rounded-lg bg-violet-50 text-center">
              <p className="text-xs text-violet-600 mb-1">Fourchette de Valorisation</p>
              <p className="text-xl font-bold text-violet-700">{d.fourchette_valorisation || '—'}</p>
              <p className="text-sm text-violet-600">Médiane : {d.valeur_mediane || '—'}</p>
            </div>
            {d.note_valorisation && <p className="text-sm text-muted-foreground">{d.note_valorisation}</p>}
          </div>
        );

      default: {
        // Generic renderer for narrative sections
        return (
          <div className="space-y-3">
            {Object.entries(d).map(([k, v]) => {
              if (Array.isArray(v)) {
                return (
                  <div key={k}>
                    <p className="text-xs font-semibold mb-1 capitalize">{k.replace(/_/g, ' ')}</p>
                    <ul className="space-y-1">{(v as any[]).map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        {typeof item === 'string' ? `• ${item}` : typeof item === 'object' ? `• ${Object.values(item).join(' — ')}` : `• ${item}`}
                      </li>
                    ))}</ul>
                  </div>
                );
              }
              if (typeof v === 'string') {
                return (
                  <div key={k}>
                    <p className="text-xs font-semibold capitalize text-muted-foreground">{k.replace(/_/g, ' ')}</p>
                    <p className="text-sm leading-relaxed">{v}</p>
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      }
    }
  };

  return (
    <div className="flex gap-6 min-h-0">
      {/* Sidebar TOC */}
      <div className="w-56 flex-none sticky top-0 self-start space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Table des matières</p>
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => scrollToSection(s.key)}
            className={`w-full text-left text-xs px-3 py-1.5 rounded-md transition-colors ${
              activeSection === s.key ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'
            } ${!data[s.key] ? 'opacity-40' : ''}`}
          >
            {s.label}
          </button>
        ))}
        <div className="pt-4 space-y-2">
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleCopySummary}>
            <Copy className="h-3 w-3 mr-1" /> Copier résumé
          </Button>
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleDownloadHtml}>
            <Download className="h-3 w-3 mr-1" /> HTML (A4)
          </Button>
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleDownloadJson}>
            <Download className="h-3 w-3 mr-1" /> JSON
          </Button>
          {onRegenerate && (
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onRegenerate}>
              Regénérer
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6 overflow-y-auto">
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
            <Badge className={`text-sm px-3 py-1.5 ${verdictColors[verdict] || 'bg-gray-200'}`}>
              {verdict}
            </Badge>
          </div>
        </div>

        {/* Sections */}
        {SECTIONS.map(s => (
          <div key={s.key} ref={el => { sectionRefs.current[s.key] = el; }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>{renderSection(s.key)}</CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
