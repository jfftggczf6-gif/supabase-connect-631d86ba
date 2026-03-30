import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2, Sparkles } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ModuleCode = Database['public']['Enums']['module_code'];

const MODULE_INFO: Record<string, { title: string; description: string; fields: { id: string; label: string; placeholder: string }[] }> = {
  sic: {
    title: 'Social Impact Canvas',
    description: 'Évaluez votre impact social et alignement ODD',
    fields: [
      { id: 'mission', label: 'Mission sociale', placeholder: 'Décrivez la mission sociale de votre entreprise...' },
      { id: 'beneficiaries', label: 'Bénéficiaires cibles', placeholder: 'Qui sont les bénéficiaires directs et indirects ?' },
      { id: 'odd_alignment', label: 'Alignement ODD', placeholder: 'Quels Objectifs de Développement Durable visez-vous ?' },
      { id: 'impact_indicators', label: 'Indicateurs d\'impact', placeholder: 'Comment mesurez-vous votre impact ?' },
      { id: 'theory_of_change', label: 'Théorie du changement', placeholder: 'Décrivez votre théorie du changement...' },
      { id: 'social_value', label: 'Valeur sociale créée', placeholder: 'Quelle valeur sociale créez-vous ?' },
    ],
  },
  framework: {
    title: 'Framework Analyse',
    description: 'Analyse financière automatique générée par IA',
    fields: [
      { id: 'ratios', label: 'Ratios financiers clés', placeholder: 'Sera généré automatiquement par l\'IA...' },
      { id: 'performance', label: 'Analyse de performance', placeholder: 'Sera généré automatiquement...' },
      { id: 'risks', label: 'Analyse des risques', placeholder: 'Sera généré automatiquement...' },
    ],
  },
  diagnostic: {
    title: 'Diagnostic Expert',
    description: 'Diagnostic global automatique de l\'entreprise',
    fields: [
      { id: 'strengths', label: 'Forces identifiées', placeholder: 'Sera généré automatiquement...' },
      { id: 'weaknesses', label: 'Faiblesses identifiées', placeholder: 'Sera généré automatiquement...' },
      { id: 'opportunities', label: 'Opportunités', placeholder: 'Sera généré automatiquement...' },
      { id: 'threats', label: 'Menaces', placeholder: 'Sera généré automatiquement...' },
    ],
  },
  plan_ovo: {
    title: 'Plan Financier OVO',
    description: 'Projections financières et scénarios',
    fields: [
      { id: 'scenario_optimistic', label: 'Scénario optimiste', placeholder: 'Sera généré automatiquement...' },
      { id: 'scenario_realistic', label: 'Scénario réaliste', placeholder: 'Sera généré automatiquement...' },
      { id: 'scenario_pessimistic', label: 'Scénario pessimiste', placeholder: 'Sera généré automatiquement...' },
    ],
  },
  business_plan: {
    title: 'Business Plan',
    description: 'Business Plan complet généré par IA',
    fields: [
      { id: 'executive_summary', label: 'Résumé exécutif', placeholder: 'Sera généré automatiquement par l\'IA...' },
      { id: 'market_analysis', label: 'Analyse de marché', placeholder: 'Sera généré automatiquement...' },
      { id: 'strategy', label: 'Stratégie', placeholder: 'Sera généré automatiquement...' },
    ],
  },
  odd: {
    title: 'ODD — Objectifs de Développement Durable',
    description: 'Évaluation de l\'alignement avec les 17 ODD de l\'ONU (basée sur BMC + SIC)',
    fields: [
      { id: 'bmcRequired', label: 'Prérequis', placeholder: 'Le BMC ou SIC doit être généré avant cette analyse.' },
    ],
  },
};

export default function GenericModule() {
  const { t } = useTranslation();
  const { moduleCode } = useParams<{ moduleCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [moduleRecord, setModuleRecord] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const info = MODULE_INFO[moduleCode || ''];

  useEffect(() => {
    if (!user || !moduleCode) return;
    const load = async () => {
      const { data: ent } = await supabase
        .from('enterprises').select('id').eq('user_id', user.id).maybeSingle();
      if (!ent) { navigate('/dashboard'); return; }

      const { data: mod } = await supabase
        .from('enterprise_modules').select('*')
        .eq('enterprise_id', ent.id)
        .eq('module', moduleCode as ModuleCode)
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
  }, [user, moduleCode, navigate]);

  if (!info) {
    navigate('/dashboard');
    return null;
  }

  const answeredCount = info.fields.filter(f => answers[f.id]?.trim()).length;
  const progressPct = Math.round((answeredCount / info.fields.length) * 100);
  const isAutoModule = ['framework', 'diagnostic', 'plan_ovo', 'business_plan', 'odd'].includes(moduleCode || '');

  const saveProgress = async () => {
    if (!moduleRecord) return;
    setSaving(true);
    try {
      const status = progressPct === 100 ? 'completed' : progressPct > 0 ? 'in_progress' : 'not_started';
      await supabase.from('enterprise_modules').update({
        data: answers, progress: progressPct, status,
      }).eq('id', moduleRecord.id);
      toast.success('Sauvegardé !');
    } catch {
      toast.error('Erreur');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
            <span className="text-sm font-medium">{info.title}</span>
            {isAutoModule && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-info/10 text-info font-medium flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> IA
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{progressPct}%</span>
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl py-8 space-y-6">
        {isAutoModule && (
          <Card className="border-info/20 bg-info/5">
            <CardContent className="py-4 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-info" />
              <p className="text-sm text-info">
                Ce module sera généré automatiquement par l'IA à partir de vos données BMC, SIC et financières.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display">{info.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{info.description}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {info.fields.map(field => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>{field.label}</Label>
                <Textarea
                  id={field.id}
                  value={answers[field.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={3}
                  className="resize-none"
                  readOnly={isAutoModule}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          {!isAutoModule && (
            <Button onClick={saveProgress} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Sauvegarder
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
