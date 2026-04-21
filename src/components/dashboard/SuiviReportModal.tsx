import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, FileDown, FileText, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  buildSuiviReportHtml,
  type PointCle,
  type SujetTravaille,
  type RoadmapItem,
} from '@/lib/suivi-report-builder';

interface SuiviReportModalProps {
  enterpriseId: string;
  enterpriseName: string;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function SuiviReportModal({ enterpriseId, enterpriseName, onClose }: SuiviReportModalProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();

  // Métadonnées session
  const [sessionNumber, setSessionNumber] = useState('');
  const [sessionDate, setSessionDate] = useState(today());
  const [coachNames, setCoachNames] = useState(profile?.full_name || '');

  // Sections narratives
  const [synthese, setSynthese] = useState('');
  const [pointsCles, setPointsCles] = useState<PointCle[]>([{ tag: 'URGENT', titre: '', description: '' }]);
  const [sujets, setSujets] = useState<SujetTravaille[]>([{ sujet: '', avancement: '', statut: 'En cours' }]);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([{ prio: 'URGENT', action: '', resp: 'Entrep.', echeance: '' }]);
  const [docs, setDocs] = useState('');
  const [nextSessionDate, setNextSessionDate] = useState('');
  const [nextObjectives, setNextObjectives] = useState('');
  const [noteCoach, setNoteCoach] = useState('');

  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const addPoint = () => setPointsCles([...pointsCles, { tag: 'ATTENTION', titre: '', description: '' }]);
  const removePoint = (i: number) => setPointsCles(pointsCles.filter((_, idx) => idx !== i));
  const updatePoint = (i: number, field: keyof PointCle, val: string) => {
    setPointsCles(pointsCles.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));
  };

  const addSujet = () => setSujets([...sujets, { sujet: '', avancement: '', statut: 'En cours' }]);
  const removeSujet = (i: number) => setSujets(sujets.filter((_, idx) => idx !== i));
  const updateSujet = (i: number, field: keyof SujetTravaille, val: string) => {
    setSujets(sujets.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  };

  const addRoadmap = () => setRoadmap([...roadmap, { prio: 'HAUTE', action: '', resp: 'Entrep.', echeance: '' }]);
  const removeRoadmap = (i: number) => setRoadmap(roadmap.filter((_, idx) => idx !== i));
  const updateRoadmap = (i: number, field: keyof RoadmapItem, val: string) => {
    setRoadmap(roadmap.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const [entRes, scoreHistRes] = await Promise.all([
        supabase.from('enterprises').select('*').eq('id', enterpriseId).single(),
        supabase
          .from('score_history')
          .select('score, created_at')
          .eq('enterprise_id', enterpriseId)
          .order('created_at', { ascending: true }),
      ]);

      const scoreHistory = scoreHistRes.data || [];
      const scoreIrDebut = scoreHistory.length > 0 ? Number(scoreHistory[0].score) : 0;
      const scoreIrActuel = Number(entRes.data?.score_ir || 0);

      const html = buildSuiviReportHtml({
        enterprise: entRes.data,
        sessionNumber,
        sessionDate,
        coachNames,
        synthese,
        pointsCles,
        sujetsTravailles: sujets,
        roadmap,
        documentsAObtenir: docs.split('\n').map((l) => l.trim()).filter(Boolean),
        nextSessionDate,
        nextSessionObjectives: nextObjectives.split('\n').map((l) => l.trim()).filter(Boolean),
        noteCoach,
        scoreIrDebut,
        scoreIrActuel,
      });
      setReportHtml(html);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setGenerating(false);
    }
  };

  const baseFilename = `Rapport_Coaching_${enterpriseName.replace(/[^a-zA-Z0-9]/g, '_')}${sessionNumber ? '_S' + sessionNumber : ''}`;

  const downloadFile = (content: string, mime: string, ext: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseFilename}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const downloadAsHtml = () => {
    if (!reportHtml) return;
    downloadFile(reportHtml, 'text/html', 'html');
    toast.success('HTML téléchargé');
  };

  const downloadAsWord = () => {
    if (!reportHtml) return;
    // HTML + namespaces Office → Microsoft Word ouvre le .doc nativement.
    // L'utilisateur peut ensuite "Enregistrer sous" en .docx.
    const body = reportHtml
      .replace(/<!DOCTYPE[^>]*>/i, '')
      .replace(/<\/?html[^>]*>/gi, '');
    const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${baseFilename}</title></head>${body}</html>`;
    downloadFile(wordHtml, 'application/msword', 'doc');
    toast.success('Word téléchargé — ouvre avec Microsoft Word');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {!reportHtml ? (
          <>
            <DialogHeader>
              <DialogTitle>Rapport de suivi de coaching — {enterpriseName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              {/* Métadonnées */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium">Session n°</Label>
                  <Input type="number" min="1" value={sessionNumber} onChange={(e) => setSessionNumber(e.target.value)} placeholder="4" />
                </div>
                <div>
                  <Label className="text-xs font-medium">Date de la session</Label>
                  <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-medium">Coachs</Label>
                  <Input value={coachNames} onChange={(e) => setCoachNames(e.target.value)} placeholder="K. Diabaté / P. N'Guessan" />
                </div>
              </div>

              {/* 📌 Synthèse */}
              <div>
                <Label className="text-xs font-medium">📌 Synthèse de la session</Label>
                <Textarea
                  value={synthese}
                  onChange={(e) => setSynthese(e.target.value)}
                  rows={4}
                  placeholder="Session consacrée à la réconciliation bancaire et au cadrage de l'étude marché..."
                />
              </div>

              {/* 🎯 Points clés */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-medium">🎯 Points clés à retenir</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={addPoint}>
                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                  </Button>
                </div>
                {pointsCles.map((p, i) => (
                  <div key={i} className="grid grid-cols-[110px_1fr_2fr_auto] gap-2 mb-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={p.tag}
                      onChange={(e) => updatePoint(i, 'tag', e.target.value)}
                    >
                      <option>URGENT</option>
                      <option>ATTENTION</option>
                      <option>POSITIF</option>
                    </select>
                    <Input value={p.titre} onChange={(e) => updatePoint(i, 'titre', e.target.value)} placeholder="Trésorerie" />
                    <Input
                      value={p.description}
                      onChange={(e) => updatePoint(i, 'description', e.target.value)}
                      placeholder="écart 12M FCFA réconcilié à 9,6M..."
                    />
                    <Button type="button" size="sm" variant="ghost" onClick={() => removePoint(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* ✅ Sujets travaillés */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-medium">✅ Sujets travaillés</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={addSujet}>
                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                  </Button>
                </div>
                {sujets.map((s, i) => (
                  <div key={i} className="grid grid-cols-[2fr_3fr_120px_auto] gap-2 mb-2">
                    <Input value={s.sujet} onChange={(e) => updateSujet(i, 'sujet', e.target.value)} placeholder="Réconciliation trésorerie" />
                    <Input value={s.avancement} onChange={(e) => updateSujet(i, 'avancement', e.target.value)} placeholder="Relevés 6 mois obtenus, 9,6M/12M réconciliés" />
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={s.statut}
                      onChange={(e) => updateSujet(i, 'statut', e.target.value)}
                    >
                      <option>En cours</option>
                      <option>Clos</option>
                      <option>Bloqué</option>
                    </select>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeSujet(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* 📋 Feuille de route */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-medium">📋 Feuille de route 30 jours</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={addRoadmap}>
                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                  </Button>
                </div>
                {roadmap.map((r, i) => (
                  <div key={i} className="grid grid-cols-[110px_2fr_130px_100px_auto] gap-2 mb-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={r.prio}
                      onChange={(e) => updateRoadmap(i, 'prio', e.target.value)}
                    >
                      <option>URGENT</option>
                      <option>HAUTE</option>
                      <option>MOYENNE</option>
                      <option>BASSE</option>
                    </select>
                    <Input value={r.action} onChange={(e) => updateRoadmap(i, 'action', e.target.value)} placeholder="Obtenir attestation DGI" />
                    <Input value={r.resp} onChange={(e) => updateRoadmap(i, 'resp', e.target.value)} placeholder="Entrep." />
                    <Input value={r.echeance} onChange={(e) => updateRoadmap(i, 'echeance', e.target.value)} placeholder="30/04" />
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeRoadmap(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* 📎 Documents à obtenir */}
              <div>
                <Label className="text-xs font-medium">📂 Documents à obtenir (un par ligne)</Label>
                <Textarea
                  value={docs}
                  onChange={(e) => setDocs(e.target.value)}
                  rows={4}
                  placeholder={`Attestation régularité fiscale DGI\nÉtats financiers certifiés 2023 et 2024\nAttestation CNPS 2025`}
                />
              </div>

              {/* 📅 Prochaine session */}
              <div className="grid grid-cols-[200px_1fr] gap-3">
                <div>
                  <Label className="text-xs font-medium">📅 Date prochaine session</Label>
                  <Input type="datetime-local" value={nextSessionDate} onChange={(e) => setNextSessionDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-medium">Objectifs prochaine session (un par ligne)</Label>
                  <Textarea
                    value={nextObjectives}
                    onChange={(e) => setNextObjectives(e.target.value)}
                    rows={3}
                    placeholder={`Valider chiffrage passif fiscal\nPrésenter BP v2 et challenger hypothèses\nRoadmap financement (I&P, Comoé)`}
                  />
                </div>
              </div>

              {/* 💬 Note coach */}
              <div>
                <Label className="text-xs font-medium">💬 Note coach (visibilité chef de programme)</Label>
                <Textarea
                  value={noteCoach}
                  onChange={(e) => setNoteCoach(e.target.value)}
                  rows={4}
                  placeholder="Entrepreneure très forte sur l'opérationnel mais réticente au volet fiscal..."
                />
              </div>

              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Génération…
                  </>
                ) : (
                  'Générer le rapport'
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Rapport de suivi de coaching</DialogTitle>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={downloadAsWord}>
                  <FileDown className="h-4 w-4 mr-1" /> Télécharger Word
                </Button>
                <Button size="sm" variant="outline" onClick={downloadAsHtml}>
                  <FileText className="h-4 w-4 mr-1" /> HTML
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReportHtml(null)}>
                  Modifier
                </Button>
              </div>
            </DialogHeader>
            <iframe srcDoc={reportHtml} className="w-full h-[600px] border rounded-lg" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
