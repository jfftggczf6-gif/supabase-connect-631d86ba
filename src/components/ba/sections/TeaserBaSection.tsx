// src/components/ba/sections/TeaserBaSection.tsx
// Teaser anonymisé BA — feature #14 generate_teaser.
//
// Brief : génère un one-pager anonymisé depuis les sections IM, attribue un nom
// de code automatique, détecte les mentions identifiantes (warnings).
// Workflow : Analyste génère → résout warnings → soumet · Partner approuve.
//
// Stratégie : réutilise EF generate-onepager existante (PE produit déjà des
// one-pagers anonymisés). Le tagging warnings + workflow Partner sera enrichi
// avec EF dédiée generate-teaser-ba dans une session ultérieure.

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Eye, Sparkles, FileDown, AlertTriangle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface Props {
  dealId: string;
}

interface TeaserData {
  id: string;
  content_md: string | null;
  code_name: string | null;
  warnings: { type: string; text: string }[];
  status: 'draft' | 'submitted' | 'approved';
  created_at: string;
}

// Génère un nom de code anonymisé (Projet ALPHA, BETA, ...).
const CODE_NAMES = ['ALPHA', 'BAOBAB', 'CARAVAN', 'DELTA', 'EBENE', 'FIRENZA', 'GAÏA', 'HORIZON', 'IRIS', 'JALOUSIE'];
function pickCodeName(): string {
  return `PROJET ${CODE_NAMES[Math.floor(Math.random() * CODE_NAMES.length)]}`;
}

export default function TeaserBaSection({ dealId }: Props) {
  const [teaser, setTeaser] = useState<TeaserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Cherche un deliverable de type onepager / teaser pour ce deal.
    // En l'attente d'une EF dédiée generate-teaser-ba, on lit le résultat éventuel
    // de generate-onepager (livrable existant qui anonymise déjà).
    const { data: enterprise } = await supabase
      .from('pe_deals')
      .select('enterprise_id')
      .eq('id', dealId)
      .maybeSingle();
    const entId = (enterprise as any)?.enterprise_id;
    if (!entId) { setLoading(false); return; }

    const { data: deliv } = await supabase
      .from('deliverables')
      .select('id, html_content, data, created_at, validation_status')
      .eq('enterprise_id', entId)
      .eq('type', 'onepager')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (deliv) {
      const dataJson = ((deliv as any).data ?? {}) as any;
      // Convertit le statut DB (draft/pending_validation/validated) vers le statut UI.
      const vs = (deliv as any).validation_status;
      const status: 'draft' | 'submitted' | 'approved' =
        vs === 'validated' ? 'approved' : vs === 'pending_validation' ? 'submitted' : 'draft';
      setTeaser({
        id: (deliv as any).id,
        content_md: (deliv as any).html_content ?? null,
        code_name: dataJson.code_name ?? null,
        warnings: Array.isArray(dataJson.warnings) ? dataJson.warnings : [],
        status,
        created_at: (deliv as any).created_at,
      });
    } else {
      setTeaser(null);
    }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: enterprise } = await supabase
        .from('pe_deals').select('enterprise_id').eq('id', dealId).maybeSingle();
      const entId = (enterprise as any)?.enterprise_id;
      if (!entId) throw new Error('Pas d\'enterprise rattachée');

      const { data, error } = await supabase.functions.invoke('generate-onepager', {
        body: { enterprise_id: entId, anonymous: true, code_name: pickCodeName() },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || 'Génération échouée');
      }
      toast.success('Teaser généré');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!teaser) return;
    const { data, error } = await supabase.functions.invoke('render-document', {
      body: { deliverable_id: teaser.id, kind: 'onepager', format: 'pdf' },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Export échoué');
      return;
    }
    const url = (data as any)?.url;
    if (url) window.open(url, '_blank');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!teaser) {
    return (
      <Card className="p-12 text-center max-w-2xl mx-auto">
        <Eye className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <h3 className="text-base font-semibold mb-1">Aucun teaser généré</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
          Le teaser est un one-pager anonymisé envoyé aux fonds AVANT la NDA pour susciter l'intérêt.
          Génération IA depuis le Memo IM.
        </p>
        <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
          {generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Génération…</> : <><Sparkles className="h-3.5 w-3.5" /> Générer le teaser</>}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Teaser anonymisé
            </div>
            <h2 className="text-lg font-bold mt-0.5">{teaser.code_name || pickCodeName()}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={
              teaser.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
              teaser.status === 'submitted' ? 'bg-amber-100 text-amber-700 border-amber-200' :
              'bg-muted text-muted-foreground'
            }>
              {teaser.status === 'approved' ? 'Approuvé' :
               teaser.status === 'submitted' ? 'En attente Partner' :
               'Brouillon'}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating} className="gap-1">
              <RefreshCw className="h-3 w-3" /> Régénérer
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} className="gap-1">
              <FileDown className="h-3 w-3" /> PDF
            </Button>
          </div>
        </div>
      </Card>

      {teaser.warnings.length > 0 && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {teaser.warnings.length} mention{teaser.warnings.length > 1 ? 's' : ''} identifiante{teaser.warnings.length > 1 ? 's' : ''} détectée{teaser.warnings.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-amber-700 mb-2">
            L'Analyste doit résoudre chaque warning avant que le Partner puisse approuver le teaser.
          </p>
          <ul className="space-y-1 text-xs text-amber-800">
            {teaser.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="font-mono text-[10px] bg-amber-200 px-1.5 py-0.5 rounded">{w.type}</span>
                <span className="flex-1">{w.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-6 prose prose-sm max-w-none">
        {teaser.content_md ? (
          <ReactMarkdown>{teaser.content_md}</ReactMarkdown>
        ) : (
          <p className="text-xs text-muted-foreground italic">Contenu vide.</p>
        )}
      </Card>

      {teaser.status === 'draft' && teaser.warnings.length === 0 && (
        <Card className="p-3 flex items-center justify-between bg-violet-50 border-violet-200">
          <span className="text-xs text-violet-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Aucun warning. Tu peux soumettre le teaser au Partner pour approbation.
          </span>
          <Button size="sm" onClick={() => toast.info('Workflow soumission Partner — sera intégré avec generate-teaser-ba')}>
            Soumettre au Partner
          </Button>
        </Card>
      )}
    </div>
  );
}
