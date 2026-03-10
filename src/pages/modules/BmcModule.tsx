import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BMC_SECTIONS } from '@/data/bmc-questions';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Save, CheckCircle2, LayoutGrid, Loader2 } from 'lucide-react';

export default function BmcModule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enterprise, setEnterprise] = useState<any>(null);
  const [moduleRecord, setModuleRecord] = useState<any>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: ent } = await supabase
        .from('enterprises')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!ent) { navigate('/dashboard'); return; }
      setEnterprise(ent);

      const { data: mod } = await supabase
        .from('enterprise_modules')
        .select('*')
        .eq('enterprise_id', ent.id)
        .eq('module', 'bmc')
        .maybeSingle();
      if (mod) {
        setModuleRecord(mod);
        if (mod.data && typeof mod.data === 'object' && !Array.isArray(mod.data)) {
          setAnswers(mod.data as Record<string, string>);
        }
      }
      setLoading(false);
    };
    load();
  }, [user, navigate]);

  const totalQuestions = BMC_SECTIONS.reduce((sum, s) => sum + s.questions.length, 0);
  const answeredQuestions = Object.values(answers).filter(v => v.trim().length > 0).length;
  const progressPct = Math.round((answeredQuestions / totalQuestions) * 100);

  const section = BMC_SECTIONS[currentSection];

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const saveProgress = async () => {
    if (!enterprise || !moduleRecord) return;
    setSaving(true);
    try {
      const status = progressPct === 100 ? 'completed' : progressPct > 0 ? 'in_progress' : 'not_started';
      await supabase
        .from('enterprise_modules')
        .update({
          data: answers,
          progress: progressPct,
          status,
        })
        .eq('id', moduleRecord.id);
      toast.success('Progression sauvegardée');
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (currentSection < BMC_SECTIONS.length - 1) setCurrentSection(prev => prev + 1);
  };
  const goPrev = () => {
    if (currentSection > 0) setCurrentSection(prev => prev - 1);
  };

  if (loading) {
    return (
      <DashboardLayout title="Business Model Canvas">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Business Model Canvas"
      subtitle={enterprise?.name}
    >
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">
            Section {currentSection + 1} / {BMC_SECTIONS.length}
          </span>
          <span className="font-medium">{progressPct}% complété</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* Section navigation chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {BMC_SECTIONS.map((s, i) => {
          const sectionAnswered = s.questions.every(q => answers[q.id]?.trim());
          return (
            <button
              key={s.id}
              onClick={() => setCurrentSection(i)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                i === currentSection
                  ? 'bg-primary text-primary-foreground border-primary'
                  : sectionAnswered
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-card hover:bg-muted border-border'
              }`}
            >
              {sectionAnswered && <CheckCircle2 className="h-3 w-3" />}
              {s.title}
            </button>
          );
        })}
      </div>

      {/* Current section */}
      <Card className="animate-fade-in" key={section.id}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <LayoutGrid className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="font-display text-lg">{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {section.questions.map(q => (
            <div key={q.id} className="space-y-2">
              <Label htmlFor={q.id} className="text-sm font-medium">
                {q.label}
              </Label>
              {q.type === 'textarea' ? (
                <Textarea
                  id={q.id}
                  value={answers[q.id] || ''}
                  onChange={e => handleAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder}
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <Input
                  id={q.id}
                  value={answers[q.id] || ''}
                  onChange={e => handleAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex gap-2">
          <Button variant="outline" onClick={goPrev} disabled={currentSection === 0}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Précédent
          </Button>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Retour
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveProgress} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Sauvegarder
          </Button>
          {currentSection < BMC_SECTIONS.length - 1 ? (
            <Button onClick={goNext}>
              Suivant <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={saveProgress} disabled={saving}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Terminer
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
