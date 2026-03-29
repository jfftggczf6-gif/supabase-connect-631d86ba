import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, XCircle } from 'lucide-react';

interface Alert {
  type: 'bloquant' | 'opportunite' | 'action' | 'info';
  title: string;
  detail: string;
  enterprise: string;
  enterpriseId: string;
}

export default function AlertsTab() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAlerts(); }, []);

  const loadAlerts = async () => {
    const { data: ents } = await supabase.from('enterprises').select('id, name, country, score_ir');
    const { data: delivs } = await supabase.from('deliverables').select('enterprise_id, type, score, data, updated_at');
    if (!ents || !delivs) { setLoading(false); return; }

    const alertList: Alert[] = [];

    for (const ent of ents) {
      const entDelivs = delivs.filter(d => d.enterprise_id === ent.id);

      // Pas de livrables
      if (entDelivs.length === 0) {
        alertList.push({ type: 'action', title: 'Pipeline non lancé', detail: 'Aucun livrable généré', enterprise: ent.name, enterpriseId: ent.id });
        continue;
      }

      // Livrables en erreur
      const errors = entDelivs.filter(d => (d.data as any)?.status === 'error' || (d.data as any)?.status === 'processing');
      errors.forEach(d => {
        alertList.push({ type: 'bloquant', title: `${d.type} en erreur/bloqué`, detail: (d.data as any)?.error || 'Status: processing', enterprise: ent.name, enterpriseId: ent.id });
      });

      // Score IR élevé → opportunité matching
      const diagScore = entDelivs.find(d => d.type === 'diagnostic_data')?.score;
      if (diagScore && Number(diagScore) >= 70) {
        alertList.push({ type: 'opportunite', title: 'Prête pour matching bailleurs', detail: `Score IR ${diagScore}/100 — lancer le matching`, enterprise: ent.name, enterpriseId: ent.id });
      }

      // Score très bas → attention
      const avgScore = entDelivs.filter(d => d.score).map(d => Number(d.score));
      const avg = avgScore.length > 0 ? avgScore.reduce((s, v) => s + v, 0) / avgScore.length : 0;
      if (avg > 0 && avg < 40) {
        alertList.push({ type: 'bloquant', title: 'Score très bas', detail: `Moyenne ${Math.round(avg)}/100 — dossier faible`, enterprise: ent.name, enterpriseId: ent.id });
      }

      // Pipeline incomplet
      const expectedTypes = ['pre_screening', 'inputs_data', 'bmc_analysis', 'sic_analysis', 'business_plan', 'diagnostic_data', 'valuation', 'investment_memo'];
      const missing = expectedTypes.filter(t => !entDelivs.find(d => d.type === t));
      if (missing.length > 0 && entDelivs.length >= 3) {
        alertList.push({ type: 'action', title: `${missing.length} livrable(s) manquant(s)`, detail: missing.join(', '), enterprise: ent.name, enterpriseId: ent.id });
      }

      // Livrables anciens (> 30 jours)
      const oldDelivs = entDelivs.filter(d => {
        const age = Date.now() - new Date(d.updated_at).getTime();
        return age > 30 * 24 * 60 * 60 * 1000;
      });
      if (oldDelivs.length > 0 && entDelivs.length >= 5) {
        alertList.push({ type: 'info', title: 'Livrables anciens', detail: `${oldDelivs.length} livrable(s) de +30 jours — regénérer ?`, enterprise: ent.name, enterpriseId: ent.id });
      }
    }

    // Sort: bloquants first, then opportunités, actions, info
    const order = { bloquant: 0, opportunite: 1, action: 2, info: 3 };
    alertList.sort((a, b) => order[a.type] - order[b.type]);

    setAlerts(alertList);
    setLoading(false);
  };

  const icon = (type: string) => {
    switch (type) {
      case 'bloquant': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'opportunite': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'action': return <Clock className="h-4 w-4 text-amber-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-blue-500" />;
    }
  };

  const badgeColor = (type: string) => {
    switch (type) {
      case 'bloquant': return 'bg-red-100 text-red-700';
      case 'opportunite': return 'bg-emerald-100 text-emerald-700';
      case 'action': return 'bg-amber-100 text-amber-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Analyse en cours...</p>;

  const bloquants = alerts.filter(a => a.type === 'bloquant').length;
  const opportunites = alerts.filter(a => a.type === 'opportunite').length;

  return (
    <div className="space-y-3">
      <div className="flex gap-3 mb-2">
        <Badge className="bg-red-100 text-red-700">{bloquants} bloquant(s)</Badge>
        <Badge className="bg-emerald-100 text-emerald-700">{opportunites} opportunité(s)</Badge>
        <Badge className="bg-amber-100 text-amber-700">{alerts.filter(a => a.type === 'action').length} action(s)</Badge>
        <Badge className="bg-blue-100 text-blue-700">{alerts.filter(a => a.type === 'info').length} info(s)</Badge>
      </div>

      {alerts.map((alert, i) => (
        <Card key={i} className={`border-l-4 ${alert.type === 'bloquant' ? 'border-l-red-500' : alert.type === 'opportunite' ? 'border-l-emerald-500' : alert.type === 'action' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
          <CardContent className="py-2.5 flex items-start gap-3">
            {icon(alert.type)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{alert.enterprise}</span>
                <Badge className={`text-[9px] ${badgeColor(alert.type)}`}>{alert.type}</Badge>
              </div>
              <p className="text-xs font-medium mt-0.5">{alert.title}</p>
              <p className="text-[11px] text-muted-foreground">{alert.detail}</p>
            </div>
          </CardContent>
        </Card>
      ))}

      {alerts.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucune alerte</p>}
    </div>
  );
}
