import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Download, CheckCircle2, Clock, Loader2,
  LayoutGrid, Globe, FileSpreadsheet, BarChart3,
  Stethoscope, ListChecks, FileText, Target
} from 'lucide-react';

const DELIVERABLES = [
  { type: 'bmc_analysis', label: 'BMC Analysé', module: 'Business Model Canvas', icon: LayoutGrid, format: '.html' },
  { type: 'sic_analysis', label: 'SIC Analysé', module: 'Social Impact Canvas', icon: Globe, format: '.html' },
  { type: 'inputs_data', label: 'Données Financières', module: 'Inputs Financiers', icon: FileSpreadsheet, format: '.html' },
  { type: 'framework_data', label: 'Framework Financier', module: 'Framework Analyse', icon: BarChart3, format: '.html' },
  { type: 'diagnostic_data', label: 'Diagnostic Expert', module: 'Diagnostic', icon: Stethoscope, format: '.html' },
  { type: 'plan_ovo', label: 'Plan Financier OVO', module: 'Plan OVO', icon: ListChecks, format: '.html' },
  { type: 'business_plan', label: 'Business Plan', module: 'Business Plan', icon: FileText, format: '.html' },
  { type: 'odd_analysis', label: 'Due Diligence ODD', module: 'ODD', icon: Target, format: '.html' },
];

export default function Livrables() {
  const { user } = useAuth();
  const [enterprise, setEnterprise] = useState<any>(null);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: ent } = await supabase.from('enterprises').select('*').eq('user_id', user.id).maybeSingle();
    if (ent) {
      setEnterprise(ent);
      const { data: delivs } = await supabase.from('deliverables').select('*').eq('enterprise_id', ent.id);
      setDeliverables(delivs || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownload = async (type: string, format: string) => {
    if (!enterprise) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-deliverable?type=${type}&enterprise_id=${enterprise.id}&format=${format}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) throw new Error('Erreur de téléchargement');
      const blob = await response.blob();
      const ext = format === 'csv' ? '.csv' : format === 'json' ? '.json' : format === 'xlsx' ? '.xlsx' : '.html';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${enterprise.name.replace(/[^a-zA-Z0-9]/g, '_')}_${type}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Fichier téléchargé !');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const readyCount = DELIVERABLES.filter(d => deliverables.find(del => del.type === d.type)).length;
  const avgScore = deliverables.length > 0
    ? Math.round(deliverables.reduce((s, d) => s + (d.score || 0), 0) / deliverables.length)
    : 0;

  return (
    <DashboardLayout title="Livrables" subtitle={enterprise ? `${enterprise.name} — ${readyCount}/${DELIVERABLES.length} prêts` : ''}>
      {/* Summary card */}
      <Card className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(222,47%,25%)] text-primary-foreground border-0 mb-8">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-60">Investment Readiness Score</p>
              <p className="text-4xl font-display font-bold mt-1">{avgScore > 0 ? `${avgScore}/100` : '—'}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-display font-bold">{readyCount}</p>
                <p className="text-xs opacity-50">Prêts</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-display font-bold">{DELIVERABLES.length - readyCount}</p>
                <p className="text-xs opacity-50">En attente</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deliverables grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DELIVERABLES.map(config => {
          const deliv = deliverables.find(d => d.type === config.type);
          const isReady = !!deliv;
          const Icon = config.icon;

          return (
            <Card key={config.type} className={`transition-all ${isReady ? 'hover:shadow-md' : 'opacity-60'}`}>
              <CardContent className="py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                    isReady ? 'bg-success/10' : 'bg-muted'
                  }`}>
                    {isReady ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-semibold">{config.label}</h3>
                    <p className="text-xs text-muted-foreground">{config.module} • {config.format}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isReady && deliv.score && (
                    <Badge variant="outline" className="text-xs font-bold">{deliv.score}/100</Badge>
                  )}
                  {isReady ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={() => handleDownload(config.type, 'html')}>
                        <Download className="h-3 w-3" /> HTML
                      </Button>
                      {['inputs_data', 'framework_data', 'plan_ovo'].includes(config.type) && (
                        <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleDownload(config.type, 'xlsx')}>
                          XLSX
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => handleDownload(config.type, 'json')}>
                        JSON
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" /> En attente
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
