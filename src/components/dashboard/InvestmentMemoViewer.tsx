import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Download, CheckCircle2, FileText, Presentation, Loader2, TrendingUp, Users, Shield, Target } from 'lucide-react';
import { toast } from 'sonner';
import { generateMemoHtml } from '@/lib/memo-html-generator';
import { exportToPdf } from '@/lib/export-pdf';
import { supabase } from '@/integrations/supabase/client';
import SectionEditButton from './SectionEditButton';
import EditableField from './EditableField';

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
  enterpriseId?: string;
  deliverableId?: string;
  onUpdated?: () => void;
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

export default function InvestmentMemoViewer({ data, onRegenerate, enterpriseId, deliverableId, onUpdated }: Props) {
  const { t } = useTranslation();
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

  // Removed handleCopySummary and handleDownloadJson — only HTML and PPTX remain

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
  const editBtn = (sectionPath: string, sectionTitle: string) =>
    enterpriseId && onUpdated ? (
      <SectionEditButton enterpriseId={enterpriseId} deliverableType="investment_memo" sectionPath={sectionPath} sectionTitle={sectionTitle} onUpdated={onUpdated} />
    ) : null;

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
            {arr(d.chiffres_cles).length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {arr(d.chiffres_cles).map((c: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-[10px] text-muted-foreground uppercase">{c.label}</p>
                    <p className="text-lg font-bold">{c.valeur}</p>
                    {c.evolution && <p className="text-xs text-emerald-600">{c.evolution}</p>}
                    {c.source && <p className="text-[9px] text-muted-foreground italic">{c.source}</p>}
                  </div>
                ))}
              </div>
            )}
            {d.points_cles && (
              <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
                <p className="text-xs font-semibold mb-2">Points Clés</p>
                <ul className="space-y-1.5">{arr(d.points_cles).map((p: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-none" />{p}</li>
                ))}</ul>
              </div>
            )}
            {d.recommandation_preliminaire && (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm text-muted-foreground">Recommandation : {d.recommandation_preliminaire}</span>
              </div>
            )}
          </div>
        );

      case 'presentation_entreprise':
        return (
          <div className="space-y-4">
            {d.resume && <p className="text-sm leading-relaxed">{d.resume}</p>}
            {/* Historique — structured or string */}
            {d.historique && (typeof d.historique === 'string' ? (
              <TextBlock title="Historique" text={d.historique} />
            ) : (
              <div>
                <p className="text-xs font-semibold mb-2">Historique</p>
                {d.historique.resume && <p className="text-sm leading-relaxed mb-3">{d.historique.resume}</p>}
                {arr(d.historique.jalons).length > 0 && (
                  <div className="relative pl-6 border-l-2 border-primary/20 space-y-3">
                    {arr(d.historique.jalons).map((j: any, i: number) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-primary border-2 border-white" />
                        <span className="text-xs font-bold text-primary">{j.annee}</span>
                        <p className="text-sm text-muted-foreground">{j.evenement}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {/* Activités — structured or string */}
            {(d.activites || d.description || d.activite) && (typeof (d.activites || d.description) === 'string' ? (
              <TextBlock title="Activités" text={d.activites || d.description || d.activite} />
            ) : d.activites && (
              <div>
                <p className="text-xs font-semibold mb-2">Activités</p>
                {d.activites.resume && <p className="text-sm leading-relaxed mb-2">{d.activites.resume}</p>}
                {arr(d.activites.produits_services).length > 0 && (
                  <table className="w-full text-xs border-collapse"><thead><tr className="bg-muted"><th className="text-left px-3 py-2 border-b font-semibold">Produit/Service</th><th className="text-left px-3 py-2 border-b font-semibold">Description</th><th className="text-right px-3 py-2 border-b font-semibold">Part CA</th></tr></thead>
                  <tbody>{arr(d.activites.produits_services).map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/30"><td className="px-3 py-2 border-b font-medium">{p.nom}</td><td className="px-3 py-2 border-b text-muted-foreground">{p.description}</td><td className="px-3 py-2 border-b text-right">{p.part_ca}</td></tr>
                  ))}</tbody></table>
                )}
              </div>
            ))}
            {d.positionnement && <TextBlock title="Positionnement" text={typeof d.positionnement === 'string' ? d.positionnement : d.positionnement.resume || JSON.stringify(d.positionnement)} />}
            {/* Gouvernance — structured or string */}
            {d.gouvernance && (typeof d.gouvernance === 'string' ? (
              <TextBlock title="Gouvernance" text={d.gouvernance} />
            ) : (
              <div>
                <p className="text-xs font-semibold mb-2">Gouvernance</p>
                {d.gouvernance.resume && <p className="text-sm leading-relaxed mb-2">{d.gouvernance.resume}</p>}
                {arr(d.gouvernance.actionnariat).length > 0 && (
                  <table className="w-full text-xs border-collapse"><thead><tr className="bg-muted"><th className="text-left px-3 py-2 border-b font-semibold">Actionnaire</th><th className="text-right px-3 py-2 border-b font-semibold">Part</th><th className="text-left px-3 py-2 border-b font-semibold">Rôle</th></tr></thead>
                  <tbody>{arr(d.gouvernance.actionnariat).map((a: any, i: number) => (
                    <tr key={i}><td className="px-3 py-2 border-b font-medium">{a.nom}</td><td className="px-3 py-2 border-b text-right">{a.part}</td><td className="px-3 py-2 border-b text-muted-foreground">{a.role}</td></tr>
                  ))}</tbody></table>
                )}
              </div>
            ))}
            {/* Effectifs — structured or string */}
            {d.effectifs && (typeof d.effectifs === 'string' ? (
              <TextBlock title="Effectifs" text={d.effectifs} />
            ) : (
              <div>
                <p className="text-xs font-semibold mb-1">Effectifs : {d.effectifs.total || '—'}</p>
                {arr(d.effectifs.repartition).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">{arr(d.effectifs.repartition).map((r: any, i: number) => (
                    <Badge key={i} variant="outline">{r.departement} : {r.nombre}</Badge>
                  ))}</div>
                )}
              </div>
            ))}
          </div>
        );

      case 'analyse_marche':
        return (
          <div className="space-y-4">
            {d.resume && <p className="text-sm leading-relaxed">{d.resume}</p>}
            {/* Contexte macro — structured or string */}
            {(d.contexte_macro || d.contexte_macroeconomique) && (typeof (d.contexte_macro || d.contexte_macroeconomique) === 'string' ? (
              <TextBlock title="Contexte macro" text={d.contexte_macro || d.contexte_macroeconomique} />
            ) : (
              <div>
                <p className="text-xs font-semibold mb-2">Contexte macroéconomique</p>
                {d.contexte_macro?.resume && <p className="text-sm leading-relaxed mb-2">{d.contexte_macro.resume}</p>}
                {arr(d.contexte_macro?.indicateurs).length > 0 && (
                  <div className="grid grid-cols-3 gap-2">{arr(d.contexte_macro.indicateurs).map((ind: any, i: number) => (
                    <div key={i} className="p-2 rounded bg-muted/50 border"><p className="text-[10px] text-muted-foreground uppercase">{ind.label}</p><p className="text-sm font-semibold">{ind.valeur}</p>{ind.source && <p className="text-[9px] text-muted-foreground italic">{ind.source}</p>}</div>
                  ))}</div>
                )}
              </div>
            ))}
            {/* Taille marché — structured or string */}
            {d.taille_marche && (typeof d.taille_marche === 'string' ? (
              <KpiCard icon={<Target className="h-4 w-4" />} label="Taille du marché" value={d.taille_marche} />
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {['tam', 'sam', 'som'].map(k => d.taille_marche[k] && (
                  <div key={k} className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-[10px] text-muted-foreground uppercase">{k}</p>
                    <p className="text-sm font-bold">{d.taille_marche[k].valeur || d.taille_marche[k]}</p>
                    {d.taille_marche[k].source && <p className="text-[9px] text-muted-foreground italic">{d.taille_marche[k].source}</p>}
                  </div>
                ))}
              </div>
            ))}
            {/* Dynamiques — structured or string */}
            {d.dynamiques && (typeof d.dynamiques === 'string' ? (
              <TextBlock title="Dynamiques" text={d.dynamiques} />
            ) : (
              <div>
                {d.dynamiques.croissance && <p className="text-sm mb-2"><span className="font-medium">Croissance :</span> {d.dynamiques.croissance}</p>}
                {arr(d.dynamiques.tendances).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">{arr(d.dynamiques.tendances).map((t: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{t}</span>
                  ))}</div>
                )}
                {d.dynamiques.reglementation && <p className="text-sm text-muted-foreground">{d.dynamiques.reglementation}</p>}
              </div>
            ))}
            {/* Concurrence — structured or string */}
            {(d.concurrence || arr(d.concurrents).length > 0) && (typeof d.concurrence === 'string' ? (
              <TextBlock title="Concurrence" text={d.concurrence} />
            ) : (
              <div>
                <p className="text-xs font-semibold mb-2">Concurrence</p>
                {d.concurrence?.resume && <p className="text-sm leading-relaxed mb-2">{d.concurrence.resume}</p>}
                {arr(d.concurrence?.principaux_concurrents || d.concurrents).length > 0 && (
                  <table className="w-full text-xs border-collapse"><thead><tr className="bg-muted"><th className="text-left px-3 py-2 border-b font-semibold">Concurrent</th><th className="text-left px-3 py-2 border-b font-semibold">Positionnement</th><th className="text-left px-3 py-2 border-b font-semibold">Taille</th></tr></thead>
                  <tbody>{arr(d.concurrence?.principaux_concurrents || d.concurrents).map((c: any, i: number) => (
                    <tr key={i}><td className="px-3 py-2 border-b font-medium">{typeof c === 'string' ? c : c.nom}</td><td className="px-3 py-2 border-b text-muted-foreground">{c.positionnement || '—'}</td><td className="px-3 py-2 border-b">{c.taille || '—'}</td></tr>
                  ))}</tbody></table>
                )}
              </div>
            ))}
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

      case 'analyse_financiere': {
        return (
          <div className="space-y-4">
            {d.resume && <p className="text-sm leading-relaxed">{d.resume}</p>}
            {(d.commentaire || d.analyse) && <p className="text-sm leading-relaxed">{d.commentaire || d.analyse}</p>}
            {/* Historique financier — structured table */}
            {d.historique && (typeof d.historique === 'string' ? (
              <TextBlock title="Historique financier" text={d.historique} />
            ) : (
              <div>
                <p className="text-xs font-semibold mb-2">Historique financier</p>
                {d.historique.commentaire && <p className="text-sm leading-relaxed mb-2">{d.historique.commentaire}</p>}
                {arr(d.historique.tableau).length > 0 && (
                  <table className="w-full text-xs border-collapse"><thead><tr className="bg-muted"><th className="text-left px-3 py-2 border-b font-semibold">Année</th><th className="text-right px-3 py-2 border-b font-semibold">CA</th><th className="text-right px-3 py-2 border-b font-semibold">Marge brute</th><th className="text-right px-3 py-2 border-b font-semibold">EBITDA</th><th className="text-right px-3 py-2 border-b font-semibold">Résultat net</th></tr></thead>
                  <tbody>{arr(d.historique.tableau).map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/30"><td className="px-3 py-2 border-b font-medium">{r.annee}</td><td className="px-3 py-2 border-b text-right">{r.ca}</td><td className="px-3 py-2 border-b text-right">{r.marge_brute}</td><td className="px-3 py-2 border-b text-right">{r.ebitda}</td><td className="px-3 py-2 border-b text-right">{r.resultat_net}</td></tr>
                  ))}</tbody></table>
                )}
              </div>
            ))}
            {/* Projections — structured table */}
            {d.projections && (typeof d.projections === 'string' ? (
              <TextBlock title="Projections" text={d.projections} />
            ) : (
              <div>
                <p className="text-xs font-semibold mb-2">Projections</p>
                {d.projections.commentaire && <p className="text-sm leading-relaxed mb-2">{d.projections.commentaire}</p>}
                {arr(d.projections.tableau).length > 0 && (
                  <table className="w-full text-xs border-collapse"><thead><tr className="bg-primary/5"><th className="text-left px-3 py-2 border-b font-semibold">Année</th><th className="text-right px-3 py-2 border-b font-semibold">CA</th><th className="text-right px-3 py-2 border-b font-semibold">Marge brute</th><th className="text-right px-3 py-2 border-b font-semibold">EBITDA</th><th className="text-right px-3 py-2 border-b font-semibold">Résultat net</th></tr></thead>
                  <tbody>{arr(d.projections.tableau).map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/30"><td className="px-3 py-2 border-b font-medium">{r.annee}</td><td className="px-3 py-2 border-b text-right">{r.ca}</td><td className="px-3 py-2 border-b text-right">{r.marge_brute}</td><td className="px-3 py-2 border-b text-right">{r.ebitda}</td><td className="px-3 py-2 border-b text-right">{r.resultat_net}</td></tr>
                  ))}</tbody></table>
                )}
              </div>
            ))}
            {/* Ratios clés — structured */}
            {arr(d.ratios_cles).length > 0 && (typeof d.ratios_cles === 'string' ? (
              <TextBlock title="Ratios clés" text={d.ratios_cles} />
            ) : (
              <div>
                <p className="text-xs font-semibold mb-2">Ratios clés</p>
                <div className="space-y-1">{arr(d.ratios_cles).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30 border">
                    <span className="text-sm font-medium">{r.ratio}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{r.valeur}</span>
                      {r.benchmark && <span className="text-xs text-muted-foreground">Benchmark : {r.benchmark}</span>}
                      {r.verdict && <Badge variant="outline" className={r.verdict === 'Bon' ? 'border-emerald-300 text-emerald-700' : r.verdict === 'Faible' ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'}>{r.verdict}</Badge>}
                    </div>
                  </div>
                ))}</div>
              </div>
            ))}
            {/* Besoins financement */}
            {d.besoins_financement && typeof d.besoins_financement === 'object' && (
              <div className="grid grid-cols-3 gap-3">
                {d.besoins_financement.bfr && <KpiCard label="BFR" value={d.besoins_financement.bfr} />}
                {d.besoins_financement.capex && <KpiCard label="CAPEX" value={d.besoins_financement.capex} />}
                {d.besoins_financement.dette && <KpiCard label="Dette" value={d.besoins_financement.dette} />}
              </div>
            )}
            {d.qualite_donnees && <p className="text-xs text-muted-foreground italic mt-2">{d.qualite_donnees}</p>}
          </div>
        );
      }

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
                {r.source && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{r.source}</p>
                )}
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
              <div className={`inline-block px-6 py-3 rounded-xl text-lg font-bold ${verdictColors[d.verdict] || 'bg-gray-200'}`}>
                {d.verdict === 'INVESTIR' ? '✅' : d.verdict === 'APPROFONDIR' ? '⚠️' : '❌'} {d.verdict}
              </div>
            </div>
            {d.resume && <p className="text-sm leading-relaxed font-medium">{d.resume}</p>}
            {/* Justification — structured or string */}
            {d.justification && (typeof d.justification === 'string' ? (
              <p className="text-sm leading-relaxed">{d.justification}</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {arr(d.justification.arguments_pour).length > 0 && (
                    <div className="rounded-lg border-l-4 border-emerald-400 bg-emerald-50/50 p-3">
                      <p className="text-xs font-semibold text-emerald-700 mb-1">Arguments en faveur</p>
                      <ul className="space-y-1">{arr(d.justification.arguments_pour).map((a: string, i: number) => <li key={i} className="text-xs text-emerald-700">✓ {a}</li>)}</ul>
                    </div>
                  )}
                  {arr(d.justification.arguments_contre).length > 0 && (
                    <div className="rounded-lg border-l-4 border-red-400 bg-red-50/50 p-3">
                      <p className="text-xs font-semibold text-red-700 mb-1">Réserves</p>
                      <ul className="space-y-1">{arr(d.justification.arguments_contre).map((a: string, i: number) => <li key={i} className="text-xs text-red-700">✗ {a}</li>)}</ul>
                    </div>
                  )}
                </div>
                {d.justification.facteur_decisif && (
                  <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3">
                    <p className="text-xs font-semibold mb-1">Facteur décisif</p>
                    <p className="text-sm leading-relaxed">{d.justification.facteur_decisif}</p>
                  </div>
                )}
              </div>
            ))}
            {arr(d.conditions).length > 0 && (
              <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
                <p className="text-xs font-semibold mb-1">Conditions</p>
                <ul className="space-y-1">{arr(d.conditions).map((c: any, i: number) => <li key={i} className="text-sm">• {typeof c === 'string' ? c : c.condition || JSON.stringify(c)}</li>)}</ul>
              </div>
            )}
            {arr(d.prochaines_etapes).length > 0 && (
              <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
                <p className="text-xs font-semibold mb-1">Prochaines Étapes</p>
                {typeof d.prochaines_etapes[0] === 'string' ? (
                  <ul className="space-y-1">{arr(d.prochaines_etapes).map((s: string, i: number) => <li key={i} className="text-sm">→ {s}</li>)}</ul>
                ) : (
                  <table className="w-full text-xs border-collapse mt-1"><thead><tr><th className="text-left px-2 py-1 font-semibold">Étape</th><th className="text-left px-2 py-1 font-semibold">Responsable</th><th className="text-left px-2 py-1 font-semibold">Délai</th></tr></thead>
                  <tbody>{arr(d.prochaines_etapes).map((s: any, i: number) => (
                    <tr key={i}><td className="px-2 py-1">{s.etape}</td><td className="px-2 py-1 text-muted-foreground">{s.responsable}</td><td className="px-2 py-1">{s.delai}</td></tr>
                  ))}</tbody></table>
                )}
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
              <p className="text-xs text-violet-800 mb-1">Fourchette de Valorisation</p>
              <p className="text-xl font-bold text-violet-700">{d.fourchette_valorisation || '—'}</p>
              <p className="text-sm text-violet-800">Médiane : {d.valeur_mediane || '—'}</p>
              {d.source && (
                <p className="text-[10px] text-muted-foreground/60 mt-1 italic">{d.source}</p>
              )}
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
            {d.resume && <p className="text-sm leading-relaxed">{d.resume}</p>}
            {(d.these || d.synthese) && !d.resume && <p className="text-sm leading-relaxed">{d.these || d.synthese}</p>}
            <div className="grid grid-cols-2 gap-4">
              {/* Thèse positive — structured or flat */}
              <div className="rounded-lg border-l-4 border-emerald-400 bg-emerald-50/50 p-4">
                <p className="text-xs font-semibold text-emerald-700 mb-2">✅ Thèse positive</p>
                {typeof d.these_positive === 'string' ? (
                  <p className="text-sm leading-relaxed">{d.these_positive}</p>
                ) : d.these_positive ? (
                  <>
                    {d.these_positive.synthese && <p className="text-sm leading-relaxed mb-3">{d.these_positive.synthese}</p>}
                    {arr(d.these_positive.arguments).map((a: any, i: number) => (
                      <div key={i} className="mb-2">
                        <p className="text-sm font-semibold text-emerald-800">{a.argument}</p>
                        <p className="text-xs text-emerald-700/80 leading-relaxed">{a.explication}</p>
                      </div>
                    ))}
                  </>
                ) : (
                  <ul className="space-y-1">{arr(d.arguments_pour || d.pour || []).map((a: any, i: number) => (
                    <li key={i} className="text-sm">{typeof a === 'string' ? a : a.argument || JSON.stringify(a)}</li>
                  ))}</ul>
                )}
              </div>
              {/* Thèse négative — structured or flat */}
              <div className="rounded-lg border-l-4 border-red-400 bg-red-50/50 p-4">
                <p className="text-xs font-semibold text-red-700 mb-2">⚠️ Réserves</p>
                {typeof d.these_negative === 'string' ? (
                  <p className="text-sm leading-relaxed">{d.these_negative}</p>
                ) : d.these_negative ? (
                  <>
                    {d.these_negative.synthese && <p className="text-sm leading-relaxed mb-3">{d.these_negative.synthese}</p>}
                    {arr(d.these_negative.arguments).map((a: any, i: number) => (
                      <div key={i} className="mb-2">
                        <p className="text-sm font-semibold text-red-800">{a.argument}</p>
                        <p className="text-xs text-red-700/80 leading-relaxed">{a.explication}</p>
                      </div>
                    ))}
                  </>
                ) : (
                  <ul className="space-y-1">{arr(d.arguments_contre || d.contre || []).map((a: any, i: number) => (
                    <li key={i} className="text-sm">{typeof a === 'string' ? a : a.argument || JSON.stringify(a)}</li>
                  ))}</ul>
                )}
              </div>
            </div>
            {arr(d.facteurs_cles_succes || d.facteurs_cles || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Facteurs clés de succès</p>
                <ul className="space-y-1">{arr(d.facteurs_cles_succes || d.facteurs_cles).map((f: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2"><Target className="h-3.5 w-3.5 text-primary mt-0.5 flex-none" />{f}</li>
                ))}</ul>
              </div>
            )}
            {arr(d.catalyseurs).length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Catalyseurs de croissance</p>
                <ul className="space-y-1">{arr(d.catalyseurs).map((c: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2"><TrendingUp className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-none" />{c}</li>
                ))}</ul>
              </div>
            )}
            {/* Scénarios de sortie — structured or string */}
            {d.scenarios_sortie && (typeof d.scenarios_sortie === 'string' ? (
              <TextBlock title="Scénarios de sortie" text={d.scenarios_sortie} />
            ) : (
              <div>
                <p className="text-xs font-semibold mb-2">Scénarios de sortie</p>
                {d.scenarios_sortie.resume && <p className="text-sm leading-relaxed mb-2">{d.scenarios_sortie.resume}</p>}
                {arr(d.scenarios_sortie.options).length > 0 && (
                  <table className="w-full text-xs border-collapse"><thead><tr className="bg-muted"><th className="text-left px-3 py-2 border-b font-semibold">Type</th><th className="text-left px-3 py-2 border-b font-semibold">Horizon</th><th className="text-left px-3 py-2 border-b font-semibold">Multiple</th><th className="text-left px-3 py-2 border-b font-semibold">Commentaire</th></tr></thead>
                  <tbody>{arr(d.scenarios_sortie.options).map((o: any, i: number) => (
                    <tr key={i}><td className="px-3 py-2 border-b font-medium">{o.type}</td><td className="px-3 py-2 border-b">{o.horizon}</td><td className="px-3 py-2 border-b">{o.multiple_sortie}</td><td className="px-3 py-2 border-b text-muted-foreground">{o.commentaire}</td></tr>
                  ))}</tbody></table>
                )}
              </div>
            ))}
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
              {/* CTAs déplacés dans la barre d'actions unifiée du dashboard */}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-6 overflow-y-auto">
              {SECTIONS.map(s => (
                <div key={s.key} ref={el => { sectionRefs.current[s.key] = el; }}>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-display flex items-center gap-2">{s.label} {editBtn(s.key, s.label)}</CardTitle></CardHeader>
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
