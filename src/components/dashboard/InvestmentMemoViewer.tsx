import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Download, Copy, CheckCircle2, FileText, Presentation, Loader2, TrendingUp, Users, Shield, Target } from 'lucide-react';
import { toast } from 'sonner';
import { generateMemoHtml } from '@/lib/memo-html-generator';
import { supabase } from '@/integrations/supabase/client';

const SLIDE_TITLES = [
  'Page de Garde',
  'Table des Matières',
  'Résumé Exécutif',
  'Présentation de l\'Entreprise',
  'Analyse de Marché',
  'Modèle Économique',
  'Analyse Financière',
  'Projections Financières',
  'Valorisation',
  'Besoins de Financement',
  'Équipe & Gouvernance',
  'ESG & Impact',
  'Analyse des Risques',
  'Thèse d\'Investissement',
  'Structure Proposée',
  'Recommandation Finale',
  'Annexes',
];

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

const arr = (v: any): any[] => (Array.isArray(v) ? v : []);

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
      // Auth is handled automatically by supabase.functions.invoke
      const resp = await supabase.functions.invoke('generate-memo-pptx', {
        body: { data },
      });
      if (resp.error) throw new Error(resp.error.message || 'PPTX generation failed');
      
      const blob = new Blob([resp.data], { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Investment_Memo_${data.page_de_garde?.titre?.replace(/[^a-zA-Z0-9]/g, '_') || 'ESONO'}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PPTX téléchargé !');
    } catch (err: any) {
      console.error('PPTX error:', err);
      toast.error(err.message || 'Erreur génération PPTX');
    } finally {
      setGeneratingPptx(false);
    }
  };

  const handleDownloadHtml = () => {
    const html = generateMemoHtml(data);
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `InvestmentMemo_${data.page_de_garde?.titre?.replace(/[^a-zA-Z0-9]/g, '_') || 'memo'}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Enhanced Section Renderers ──
  const renderSection = (key: string) => {
    const d = data[key];
    if (!d) return <p className="text-sm text-muted-foreground italic">Section non générée</p>;

    switch (key) {
      case 'page_de_garde':
        return (
          <div className="space-y-2">
            {d.titre && <p className="text-lg font-bold text-foreground">{d.titre}</p>}
            {d.sous_titre && <p className="text-sm text-muted-foreground">{d.sous_titre}</p>}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {d.entreprise && <InfoField label="Entreprise" value={d.entreprise} />}
              {d.secteur && <InfoField label="Secteur" value={d.secteur} />}
              {d.pays && <InfoField label="Pays" value={d.pays} />}
              {d.date && <InfoField label="Date" value={d.date} />}
            </div>
          </div>
        );

      case 'resume_executif':
        return (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">{d.synthese}</p>
            {d.points_cles && (
              <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
                <p className="text-xs font-semibold mb-2">Points Clés</p>
                <ul className="space-y-1.5">{d.points_cles.map((p: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-none" />{p}</li>
                ))}</ul>
              </div>
            )}
            {d.recommandation_preliminaire && (
              <div className="flex items-center gap-3 mt-2">
                <Badge className={scoreBg}>{score}/100</Badge>
                <span className="text-sm text-muted-foreground">Recommandation : {d.recommandation_preliminaire}</span>
              </div>
            )}
          </div>
        );

      case 'presentation_entreprise':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-4 border">
              {d.raison_sociale && <InfoField label="Raison sociale" value={d.raison_sociale || d.nom} />}
              {d.forme_juridique && <InfoField label="Forme juridique" value={d.forme_juridique} />}
              {d.date_creation && <InfoField label="Date de création" value={d.date_creation} />}
              {(d.siege_social || d.ville) && <InfoField label="Siège social" value={d.siege_social || d.ville} />}
              {d.secteur && <InfoField label="Secteur" value={d.secteur} />}
              {d.effectif && <InfoField label="Effectif" value={d.effectif} />}
            </div>
            {d.historique && <TextBlock title="Historique" text={d.historique} />}
            {(d.description || d.activite) && <TextBlock title="Activités" text={d.description || d.activite} />}
            {d.positionnement && <TextBlock title="Positionnement" text={d.positionnement} />}
            {arr(d.avantages_competitifs).length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Avantages compétitifs</p>
                <ul className="space-y-1">{arr(d.avantages_competitifs).map((a: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-none" />{a}</li>
                ))}</ul>
              </div>
            )}
          </div>
        );

      case 'analyse_marche':
        return (
          <div className="space-y-4">
            {d.contexte_macroeconomique && <TextBlock title="Contexte macro" text={d.contexte_macroeconomique} />}
            <div className="grid grid-cols-2 gap-3">
              {d.taille_marche && <KpiCard icon={<Target className="h-4 w-4" />} label="Taille du marché" value={d.taille_marche} />}
              {d.croissance && <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Croissance" value={d.croissance} />}
            </div>
            {d.tendances && <TextBlock title="Tendances" text={d.tendances} />}
            {d.positionnement_concurrentiel && <TextBlock title="Positionnement concurrentiel" text={d.positionnement_concurrentiel} />}
            {arr(d.concurrents).length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Concurrents</p>
                <ul className="space-y-1">{arr(d.concurrents).map((c: any, i: number) => (
                  <li key={i} className="text-sm text-muted-foreground">• {typeof c === 'string' ? c : c.nom || JSON.stringify(c)}</li>
                ))}</ul>
              </div>
            )}
            {d.opportunites && <Callout type="green" title="Opportunités" text={d.opportunites} />}
            {d.menaces && <Callout type="amber" title="Menaces" text={d.menaces} />}
            {renderGenericFields(d, ['contexte_macroeconomique', 'taille_marche', 'croissance', 'tendances', 'positionnement_concurrentiel', 'concurrents', 'opportunites', 'menaces'])}
          </div>
        );

      case 'modele_economique':
        return (
          <div className="space-y-4">
            {(d.description || d.modele) && <p className="text-sm leading-relaxed">{d.description || d.modele}</p>}
            {d.proposition_valeur && <Callout type="blue" title="Proposition de valeur" text={d.proposition_valeur} />}
            {arr(d.sources_revenus).length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2">Sources de revenus</p>
                <div className="space-y-2">{arr(d.sources_revenus).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-muted/50 border">
                    <span className="text-sm font-medium">{typeof s === 'string' ? s : s.nom || s.source || '—'}</span>
                    {typeof s === 'object' && (s.pourcentage || s.detail) && (
                      <span className="text-xs text-muted-foreground ml-auto">{s.pourcentage || s.detail}</span>
                    )}
                  </div>
                ))}</div>
              </div>
            )}
            {d.scalabilite && <TextBlock title="Scalabilité" text={d.scalabilite} />}
            {renderGenericFields(d, ['description', 'modele', 'proposition_valeur', 'sources_revenus', 'scalabilite'])}
          </div>
        );

      case 'analyse_financiere':
        return (
          <div className="space-y-4">
            {(d.commentaire || d.analyse) && <p className="text-sm leading-relaxed">{d.commentaire || d.analyse}</p>}
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Chiffre d'affaires" value={d.chiffre_affaires || d.ca || '—'} />
              <KpiCard label="Marge brute" value={d.marge_brute || '—'} />
              <KpiCard label="EBITDA" value={d.ebitda || '—'} />
              <KpiCard label="Résultat net" value={d.resultat_net || '—'} />
              <KpiCard label="Trésorerie" value={d.tresorerie || '—'} />
              <KpiCard label="Ratio dette" value={d.ratio_dette || d.endettement || '—'} />
            </div>
            {d.points_forts && <Callout type="green" title="Points forts" text={d.points_forts} />}
            {d.points_attention && <Callout type="amber" title="Points d'attention" text={d.points_attention} />}
            {(d.projections || d.previsions) && (() => {
              const proj = d.projections || d.previsions || {};
              return (
                <div>
                  <p className="text-xs font-semibold mb-2">Projections</p>
                  <div className="grid grid-cols-2 gap-3">
                    {proj.ca_n1 && <KpiCard label="CA projeté N+1" value={proj.ca_n1} />}
                    {proj.ca_n3 && <KpiCard label="CA projeté N+3" value={proj.ca_n3} />}
                    {proj.ebitda_projete && <KpiCard label="EBITDA projeté" value={proj.ebitda_projete} />}
                    {(proj.point_mort || proj.breakeven) && <KpiCard label="Point mort" value={proj.point_mort || proj.breakeven} />}
                  </div>
                </div>
              );
            })()}
            {renderGenericFields(d, ['commentaire', 'analyse', 'chiffre_affaires', 'ca', 'marge_brute', 'ebitda', 'resultat_net', 'tresorerie', 'ratio_dette', 'endettement', 'points_forts', 'points_attention', 'projections', 'previsions', 'evolution'])}
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
                    <ProbBadge label="P" value={r.probabilite} />
                    <ProbBadge label="I" value={r.impact} />
                  </div>
                </div>
                <p className="text-sm">{r.description || r.risque}</p>
                {r.mitigation && <p className="text-xs text-muted-foreground mt-1">🛡️ {r.mitigation}</p>}
              </div>
            ))}
            {(d.matrice_risque_synthese || d.commentaire || d.analyse_globale) && (
              <p className="text-sm text-muted-foreground italic">{d.matrice_risque_synthese || d.commentaire || d.analyse_globale}</p>
            )}
          </div>
        );

      case 'recommandation_finale':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold ${scoreBg}`}>
                {score}
              </div>
              <div className={`inline-block px-6 py-3 rounded-xl text-lg font-bold ${verdictColors[d.verdict] || 'bg-gray-200'}`}>
                {d.verdict === 'INVESTIR' ? '✅' : d.verdict === 'APPROFONDIR' ? '⚠️' : '❌'} {d.verdict}
              </div>
            </div>
            <p className="text-sm leading-relaxed">{d.justification}</p>
            {d.conditions?.length > 0 && (
              <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
                <p className="text-xs font-semibold mb-1">Conditions</p>
                <ul className="space-y-1">{d.conditions.map((c: string, i: number) => <li key={i} className="text-sm">• {c}</li>)}</ul>
              </div>
            )}
            {d.prochaines_etapes?.length > 0 && (
              <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
                <p className="text-xs font-semibold mb-1">Prochaines Étapes</p>
                <ul className="space-y-1">{d.prochaines_etapes.map((s: string, i: number) => <li key={i} className="text-sm">→ {s}</li>)}</ul>
              </div>
            )}
          </div>
        );

      case 'besoins_financement':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {d.montant_recherche && <KpiCard label="Montant recherché" value={d.montant_recherche} />}
              {d.retour_attendu && <KpiCard label="Retour attendu" value={d.retour_attendu} />}
            </div>
            {d.utilisation_fonds?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold">Utilisation des fonds</p>
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
          </div>
        );

      case 'valorisation':
        return (
          <div className="space-y-3">
            {d.description || d.commentaire ? <p className="text-sm leading-relaxed">{d.description || d.commentaire}</p> : null}
            <div className="grid grid-cols-3 gap-3">
              {d.methodes_utilisees?.map((m: string, i: number) => <Badge key={i} variant="secondary" className="justify-center">{m}</Badge>)}
            </div>
            <div className="p-4 rounded-lg bg-violet-50 text-center border border-violet-200">
              <p className="text-xs text-violet-600 mb-1">Fourchette de Valorisation</p>
              <p className="text-xl font-bold text-violet-700">{d.fourchette_valorisation || '—'}</p>
              <p className="text-sm text-violet-600">Médiane : {d.valeur_mediane || '—'}</p>
            </div>
            {d.note_valorisation && <p className="text-sm text-muted-foreground italic">{d.note_valorisation}</p>}
          </div>
        );

      case 'equipe_et_gouvernance':
        return (
          <div className="space-y-4">
            {(d.description || d.synthese) && <p className="text-sm leading-relaxed">{d.description || d.synthese}</p>}
            {arr(d.membres_cles).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold">Membres clés</p>
                {arr(d.membres_cles).map((m: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-none">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{m.nom || m.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{m.role || m.poste || '—'}</p>
                      {m.experience && <p className="text-xs text-muted-foreground mt-1">{m.experience}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {d.gouvernance && <TextBlock title="Gouvernance" text={d.gouvernance} />}
            {arr(d.gaps_identifies).length > 0 && (
              <Callout type="amber" title="Gaps identifiés" text={arr(d.gaps_identifies).join(' • ')} />
            )}
          </div>
        );

      case 'esg_impact':
        return (
          <div className="space-y-4">
            {(d.description || d.synthese) && <p className="text-sm leading-relaxed">{d.description || d.synthese}</p>}
            {arr(d.odd_cibles || d.odd_alignement).length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2">Alignement ODD</p>
                <div className="flex flex-wrap gap-2">{arr(d.odd_cibles || d.odd_alignement).map((o: any, i: number) => (
                  <Badge key={i} variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                    🌍 {typeof o === 'string' ? o : o.odd || o.nom || '—'}
                  </Badge>
                ))}</div>
              </div>
            )}
            {d.impact_social && <Callout type="green" title="Impact social" text={d.impact_social} />}
            {d.impact_environnemental && <Callout type="green" title="Impact environnemental" text={d.impact_environnemental} />}
            {d.conformite_ifc && <TextBlock title="Conformité IFC" text={d.conformite_ifc} />}
          </div>
        );

      case 'these_investissement':
        return (
          <div className="space-y-4">
            {(d.these || d.synthese) && <p className="text-sm leading-relaxed">{d.these || d.synthese}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border-l-4 border-emerald-400 bg-emerald-50/50 p-4">
                <p className="text-xs font-semibold text-emerald-700 mb-2">✅ Arguments Pour</p>
                <ul className="space-y-1">{arr(d.arguments_pour).map((a: string, i: number) => (
                  <li key={i} className="text-sm">{a}</li>
                ))}</ul>
              </div>
              <div className="rounded-lg border-l-4 border-red-400 bg-red-50/50 p-4">
                <p className="text-xs font-semibold text-red-700 mb-2">⚠️ Arguments Contre</p>
                <ul className="space-y-1">{arr(d.arguments_contre).map((a: string, i: number) => (
                  <li key={i} className="text-sm">{a}</li>
                ))}</ul>
              </div>
            </div>
            {arr(d.facteurs_cles).length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Facteurs clés de succès</p>
                <ul className="space-y-1">{arr(d.facteurs_cles).map((f: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2"><Target className="h-3.5 w-3.5 text-primary mt-0.5 flex-none" />{f}</li>
                ))}</ul>
              </div>
            )}
          </div>
        );

      case 'structure_proposee':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-4 border">
              {d.type_instrument && <InfoField label="Instrument" value={d.type_instrument || d.instrument} />}
              {d.montant && <InfoField label="Montant" value={d.montant} />}
              {d.valorisation_premoney && <InfoField label="Valo pré-money" value={d.valorisation_premoney} />}
              {d.dilution && <InfoField label="Dilution" value={d.dilution} />}
              {(d.horizon_sortie || d.calendrier) && <InfoField label="Horizon" value={d.horizon_sortie || d.calendrier} />}
              {d.irr_cible && <InfoField label="IRR cible" value={d.irr_cible} />}
            </div>
            {d.conditions && <TextBlock title="Conditions" text={typeof d.conditions === 'string' ? d.conditions : JSON.stringify(d.conditions)} />}
            {arr(d.droits_investisseur).length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Droits investisseur</p>
                <ul className="space-y-1">{arr(d.droits_investisseur).map((dr: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2"><Shield className="h-3.5 w-3.5 text-primary mt-0.5 flex-none" />{dr}</li>
                ))}</ul>
              </div>
            )}
            {arr(d.termes).length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Termes</p>
                <ul className="space-y-1">{arr(d.termes).map((t: any, i: number) => (
                  <li key={i} className="text-sm">• {typeof t === 'string' ? t : `${t.terme || t.label || '—'} : ${t.valeur || t.detail || '—'}`}</li>
                ))}</ul>
              </div>
            )}
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
              if (typeof v === 'object' && v) return (
                <div key={k}><p className="text-xs font-semibold capitalize text-muted-foreground">{k.replace(/_/g, ' ')}</p><p className="text-sm leading-relaxed">{JSON.stringify(v)}</p></div>
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
        <TabsList className="grid w-full grid-cols-2 max-w-md">
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
          <div className="space-y-6 pt-4">
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
                    i === 0 ? 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-primary-foreground' :
                    i === SLIDE_TITLES.length - 1 ? 'bg-muted/50 border-border text-muted-foreground' :
                    'bg-card border-border hover:border-primary/30'
                  }`}>
                    <span className={`text-[10px] font-mono mb-1 ${i === 0 ? 'text-amber-300' : 'text-muted-foreground'}`}>
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

// ── Small UI helpers ──

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg border bg-muted/30 text-center">
      {icon && <div className="flex justify-center mb-1 text-muted-foreground">{icon}</div>}
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1">{title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function Callout({ type, title, text }: { type: 'blue' | 'green' | 'amber'; title: string; text: string }) {
  const borderColor = type === 'green' ? 'border-emerald-400 bg-emerald-50' : type === 'amber' ? 'border-amber-400 bg-amber-50' : 'border-primary bg-primary/5';
  return (
    <div className={`rounded-r-lg border-l-4 p-3 ${borderColor}`}>
      <p className="text-xs font-semibold mb-1">{title}</p>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function ProbBadge({ label, value }: { label: string; value: string }) {
  const v = (value || '').toLowerCase();
  const cls = v.includes('elev') || v.includes('fort') || v.includes('haute')
    ? 'bg-red-100 text-red-700'
    : v.includes('moyen') ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  return <Badge className={cls}>{label}: {value}</Badge>;
}

function renderGenericFields(d: Record<string, any>, exclude: string[]) {
  const remaining = Object.entries(d).filter(([k]) => !exclude.includes(k) && !k.startsWith('_'));
  if (remaining.length === 0) return null;
  return (
    <>
      {remaining.map(([k, v]) => {
        if (typeof v === 'string') return <TextBlock key={k} title={k.replace(/_/g, ' ')} text={v} />;
        if (Array.isArray(v)) return (
          <div key={k}>
            <p className="text-xs font-semibold mb-1 capitalize">{k.replace(/_/g, ' ')}</p>
            <ul className="space-y-1">{v.map((item, i) => <li key={i} className="text-sm text-muted-foreground">• {typeof item === 'string' ? item : JSON.stringify(item)}</li>)}</ul>
          </div>
        );
        return null;
      })}
    </>
  );
}
