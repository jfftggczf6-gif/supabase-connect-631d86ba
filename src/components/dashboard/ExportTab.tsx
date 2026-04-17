import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function ExportTab() {
  const { t } = useTranslation();
  const { currentOrg } = useOrganization();
  const [exporting, setExporting] = useState<string | null>(null);

  const exportPortfolio = async () => {
    setExporting('portfolio');
    try {
      let entQuery = supabase.from('enterprises').select('*');
      if (currentOrg?.id) entQuery = entQuery.eq('organization_id', currentOrg.id);
      const { data: ents } = await entQuery;
      const entIds = (ents || []).map(e => e.id);
      const { data: delivs } = entIds.length > 0
        ? await supabase.from('deliverables').select('enterprise_id, type, score').in('enterprise_id', entIds)
        : { data: [] as any[] };
      if (!ents) throw new Error('Pas de données');

      const rows = ents.map(e => {
        const eDelivs = (delivs || []).filter(d => d.enterprise_id === e.id);
        const scores = eDelivs.filter(d => d.score).map(d => Number(d.score));
        const avg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : '';
        return [
          e.name, e.country, e.sector, e.employees_count || '', e.score_ir || '',
          avg, eDelivs.length,
          ...['pre_screening', 'bmc_analysis', 'inputs_data', 'plan_financier', 'business_plan', 'valuation', 'investment_memo'].map(t => {
            const d = eDelivs.find(d => d.type === t);
            return d?.score || '';
          }),
        ].join('\t');
      });

      const header = ['Entreprise', 'Pays', 'Secteur', 'Effectif', 'Score IR', 'Score moyen', 'Nb livrables',
        'Pre-screening', 'BMC', 'Inputs', 'Plan Fin.', 'Business Plan', 'Valuation', 'Memo'].join('\t');
      const tsv = header + '\n' + rows.join('\n');

      const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ESONO_Portfolio_${new Date().toISOString().slice(0, 10)}.tsv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Export téléchargé');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(null);
    }
  };

  const exportMatching = async () => {
    setExporting('matching');
    try {
      const { data: matches } = await supabase
        .from('funding_matches')
        .select('*, enterprises(name, country), funding_programs(name, organisme)')
        .order('match_score', { ascending: false });

      if (!matches || matches.length === 0) throw new Error('Aucun matching — lancez le matching d\'abord');

      const rows = matches.map((m: any) => [
        (m.enterprises as any)?.name || '',
        (m.enterprises as any)?.country || '',
        (m.funding_programs as any)?.name || '',
        (m.funding_programs as any)?.organisme || '',
        m.match_score,
        (m.criteria_met || []).length,
        (m.criteria_missing || []).length,
        (m.criteria_met || []).join(' | '),
        (m.criteria_missing || []).join(' | '),
      ].join('\t'));

      const header = ['Entreprise', 'Pays', 'Programme', 'Bailleur', 'Score Match', 'Critères OK', 'Critères manquants', 'Détail OK', 'Détail manquants'].join('\t');
      const tsv = header + '\n' + rows.join('\n');

      const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ESONO_Matching_${new Date().toISOString().slice(0, 10)}.tsv`;
      a.click();
      toast.success('Export matching téléchargé');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Exportez les données du portefeuille pour vos rapports bailleurs.</p>

      <div className="grid grid-cols-2 gap-4">
        <Card className="hover:border-primary transition-colors cursor-pointer" onClick={exportPortfolio}>
          <CardContent className="py-6 text-center">
            <FileText className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="font-semibold text-sm">Export Portfolio</p>
            <p className="text-xs text-muted-foreground mt-1">Toutes les entreprises avec scores par livrable</p>
            <Button className="mt-3 gap-1.5" size="sm" disabled={exporting === 'portfolio'}>
              {exporting === 'portfolio' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Télécharger TSV
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary transition-colors cursor-pointer" onClick={exportMatching}>
          <CardContent className="py-6 text-center">
            <FileText className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
            <p className="font-semibold text-sm">Export Matching Bailleurs</p>
            <p className="text-xs text-muted-foreground mt-1">Résultats matching avec gap analysis</p>
            <Button className="mt-3 gap-1.5" size="sm" variant="outline" disabled={exporting === 'matching'}>
              {exporting === 'matching' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Télécharger TSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
