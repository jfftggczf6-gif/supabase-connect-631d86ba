import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileText, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface Props {
  programmeId: string;
}

interface EnterpriseCompliance {
  id: string;
  name: string;
  sector: string | null;
  country: string | null;
  score_ir: number | null;
  compliance_status: string | null;
  score_ir_breakdown: Record<string, any> | null;
  has_compliance_report: boolean;
  has_ic_report: boolean;
  compliance_score: number | null;
  ic_verdict: string | null;
}

const statusColors: Record<string, string> = {
  prêt: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  presque_prêt: 'bg-amber-100 text-amber-700 border-amber-200',
  non_prêt: 'bg-red-100 text-red-700 border-red-200',
};

const verdictColors: Record<string, string> = {
  APPROUVER: 'bg-emerald-100 text-emerald-700',
  APPROUVER_SOUS_CONDITIONS: 'bg-amber-100 text-amber-700',
  REPORTER: 'bg-orange-100 text-orange-700',
  REJETER: 'bg-red-100 text-red-700',
};

export default function ProgrammeComplianceTab({ programmeId }: Props) {
  const [enterprises, setEnterprises] = useState<EnterpriseCompliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [selectedEnterprise, setSelectedEnterprise] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);

    // Get enterprises in this programme
    const { data: cands } = await supabase
      .from('candidatures')
      .select('enterprise_id')
      .eq('programme_id', programmeId)
      .eq('status', 'selected');

    if (!cands?.length) { setEnterprises([]); setLoading(false); return; }

    const entIds = cands.map(c => c.enterprise_id).filter(Boolean);
    const [{ data: ents }, { data: delivs }] = await Promise.all([
      supabase.from('enterprises').select('id, name, sector, country, score_ir, compliance_status, score_ir_breakdown').in('id', entIds),
      supabase.from('deliverables').select('enterprise_id, type, data, score').in('enterprise_id', entIds).in('type', ['compliance_report', 'ic_decision_report'] as any),
    ]);

    const delivMap: Record<string, Record<string, any>> = {};
    (delivs || []).forEach((d: any) => {
      if (!delivMap[d.enterprise_id]) delivMap[d.enterprise_id] = {};
      delivMap[d.enterprise_id][d.type] = d.data;
    });

    setEnterprises((ents || []).map(e => ({
      ...e,
      has_compliance_report: !!delivMap[e.id]?.compliance_report,
      has_ic_report: !!delivMap[e.id]?.ic_decision_report,
      compliance_score: (delivMap[e.id]?.compliance_report as any)?.score_compliance || null,
      ic_verdict: (delivMap[e.id]?.ic_decision_report as any)?.recommandation_ic || null,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [programmeId]);

  const handleGenerate = async (enterpriseId: string, type: 'compliance' | 'ic_decision') => {
    setGenerating(`${type}-${enterpriseId}`);
    try {
      const token = await getValidAccessToken(null);
      const fnName = type === 'compliance' ? 'generate-compliance-report' : 'generate-ic-decision-report';
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ enterprise_id: enterpriseId }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast.success(type === 'compliance' ? 'Compliance Report généré' : 'IC Decision Report généré');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
    setGenerating(null);
  };

  const handleViewReport = async (enterpriseId: string, type: string) => {
    const { data } = await supabase
      .from('deliverables')
      .select('data')
      .eq('enterprise_id', enterpriseId)
      .eq('type', type as any)
      .maybeSingle();
    if (data?.data) {
      setSelectedReport(data.data);
      setSelectedEnterprise(enterpriseId);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{enterprises.length}</p>
          <p className="text-xs text-muted-foreground">Entreprises</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{enterprises.filter(e => e.has_compliance_report).length}</p>
          <p className="text-xs text-muted-foreground">Compliance faite</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{enterprises.filter(e => e.has_ic_report).length}</p>
          <p className="text-xs text-muted-foreground">IC Report prêt</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{enterprises.filter(e => e.ic_verdict === 'APPROUVER' || e.ic_verdict === 'APPROUVER_SOUS_CONDITIONS').length}</p>
          <p className="text-xs text-muted-foreground">Recommandé IC</p>
        </CardContent></Card>
      </div>

      {/* Enterprise list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Compliance & IC Decision
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Secteur</TableHead>
                <TableHead>Score IR</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>IC Verdict</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enterprises.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.sector || '—'}</TableCell>
                  <TableCell>
                    {e.score_ir ? (
                      <Badge variant="outline" className={e.score_ir >= 70 ? 'border-emerald-300 text-emerald-700' : e.score_ir >= 40 ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'}>
                        {e.score_ir}/100
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {e.has_compliance_report ? (
                      <button onClick={() => handleViewReport(e.id, 'compliance_report')} className="inline-flex items-center gap-1">
                        <Badge className={statusColors[e.compliance_score && e.compliance_score >= 70 ? 'prêt' : e.compliance_score && e.compliance_score >= 40 ? 'presque_prêt' : 'non_prêt'] || 'bg-muted'}>
                          {e.compliance_score || 0}/100
                        </Badge>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Non généré</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {e.ic_verdict ? (
                      <Badge className={verdictColors[e.ic_verdict] || 'bg-muted'}>{e.ic_verdict.replace(/_/g, ' ')}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline" size="sm"
                      className="gap-1 border-primary/30 text-primary hover:bg-primary/5 text-xs"
                      onClick={() => handleGenerate(e.id, 'compliance')}
                      disabled={!!generating}
                    >
                      {generating === `compliance-${e.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                      {e.has_compliance_report ? 'Regénérer' : 'Compliance'}
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="gap-1 border-primary/30 text-primary hover:bg-primary/5 text-xs"
                      onClick={() => handleGenerate(e.id, 'ic_decision')}
                      disabled={!!generating || !e.has_compliance_report}
                      title={!e.has_compliance_report ? 'Générer le Compliance Report d\'abord' : ''}
                    >
                      {generating === `ic_decision-${e.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                      IC Report
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!enterprises.length && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune entreprise dans ce programme</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* IR Score Breakdown per enterprise (C) */}
      {enterprises.some(e => e.score_ir_breakdown) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Score IR décomposé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enterprises.filter(e => e.score_ir_breakdown).map(e => (
                <div key={e.id} className="border rounded-lg p-4 space-y-2">
                  <p className="font-semibold text-sm">{e.name}</p>
                  {Object.entries(e.score_ir_breakdown || {}).map(([key, val]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${val.score >= 70 ? 'bg-emerald-500' : val.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${val.score}%` }} />
                        </div>
                        <span className="font-medium w-8 text-right">{val.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report viewer dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => { setSelectedReport(null); setSelectedEnterprise(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReport?.enterprise_name || 'Rapport'} — {selectedReport?.recommandation_ic ? 'IC Decision Report' : 'Compliance Feedback Report'}
            </DialogTitle>
          </DialogHeader>
          {selectedReport?.sections && (
            <div className="space-y-4">
              {Object.entries(selectedReport.sections).map(([key, section]: [string, any]) => (
                <div key={key} className="border rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold text-sm text-primary capitalize">{key.replace(/_/g, ' ')}</h3>
                  {section.observations_cles?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Observations clés</p>
                      <ul className="space-y-1">{section.observations_cles.map((o: string, i: number) => (
                        <li key={i} className="text-xs flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />{o}</li>
                      ))}</ul>
                    </div>
                  )}
                  {section.a_clarifier?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">À clarifier</p>
                      <ul className="space-y-1">{section.a_clarifier.map((o: string, i: number) => (
                        <li key={i} className="text-xs flex items-start gap-1.5"><AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />{o}</li>
                      ))}</ul>
                    </div>
                  )}
                  {section.recommandations?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Recommandations</p>
                      <ul className="space-y-1">{section.recommandations.map((o: string, i: number) => (
                        <li key={i} className="text-xs flex items-start gap-1.5"><XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />{o}</li>
                      ))}</ul>
                    </div>
                  )}
                </div>
              ))}
              {selectedReport.red_flags?.length > 0 && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <h3 className="font-semibold text-sm text-red-700 mb-2">Red Flags détectés</h3>
                  {selectedReport.red_flags.map((rf: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs mb-1">
                      <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                      <span><strong>{rf.id?.replace(/_/g, ' ')}</strong> ({rf.severity}) — {rf.details}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedReport.conclusion && (
                <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                  <h3 className="font-semibold text-sm text-primary mb-2">Conclusion</h3>
                  <Badge className={statusColors[selectedReport.conclusion.verdict] || 'bg-muted'}>
                    {selectedReport.conclusion.verdict?.replace(/_/g, ' ')}
                  </Badge>
                  <p className="text-xs mt-2">{selectedReport.conclusion.summary}</p>
                  {selectedReport.conclusion.actions_prioritaires?.length > 0 && (
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      {selectedReport.conclusion.actions_prioritaires.map((a: string, i: number) => (
                        <li key={i} className="text-xs">{a}</li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          )}
          {selectedReport?.recommandation_ic && (
            <div className="space-y-4">
              <div className="text-center">
                <Badge className={`text-lg px-4 py-2 ${verdictColors[selectedReport.recommandation_ic] || 'bg-muted'}`}>
                  {selectedReport.recommandation_ic.replace(/_/g, ' ')}
                </Badge>
              </div>
              {selectedReport.resume_executif && <p className="text-sm">{selectedReport.resume_executif}</p>}
              {selectedReport.analyse_risques?.length > 0 && (
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">Risques</h3>
                  {selectedReport.analyse_risques.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b pb-1">
                      <span>{r.risque}</span>
                      <Badge variant="outline" className="text-[10px]">{r.severite}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {selectedReport.conditions?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-1">Conditions</h3>
                  <ol className="list-decimal list-inside space-y-1">
                    {selectedReport.conditions.map((c: string, i: number) => <li key={i} className="text-xs">{c}</li>)}
                  </ol>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
