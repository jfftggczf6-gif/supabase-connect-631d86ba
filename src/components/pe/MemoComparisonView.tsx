// MemoComparisonView — Compare 2 versions du memo côte à côte (pré-DD vs post-DD typiquement).
// Affiche les 12 sections alignées, avec content_md de chaque côté.
// Highlight visuel : sections dont le contenu a changé entre les 2 versions.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

interface Props {
  versionAId: string;
  versionBId: string;
}

interface Section {
  section_code: string;
  content_md: string | null;
  content_json: any;
  status: string;
  position: number;
}

interface VersionData {
  id: string;
  label: string;
  stage: string;
  snapshot_label: string | null;
  is_snapshot: boolean;
  overall_score: number | null;
  classification: string | null;
  generated_at: string | null;
  snapshot_taken_at: string | null;
  sections: Section[];
}

const SECTION_LABELS: Record<string, string> = {
  executive_summary:        '§1 Résumé exécutif',
  shareholding_governance:  '§2 Actionnariat & gouvernance',
  top_management:           '§3 Top management',
  services:                 '§4 Services',
  competition_market:       '§5 Concurrence & marché',
  unit_economics:           '§6 Unit economics',
  financials_pnl:           '§7 États financiers PnL',
  financials_balance:       '§8 États financiers Bilan',
  investment_thesis:        "§9 Thèse d'investissement",
  support_requested:        '§10 Accompagnement',
  esg_risks:                '§11 ESG / Risques',
  annexes:                  '§12 Annexes',
};

const SECTION_ORDER = [
  'executive_summary', 'shareholding_governance', 'top_management', 'services',
  'competition_market', 'unit_economics', 'financials_pnl', 'financials_balance',
  'investment_thesis', 'support_requested', 'esg_risks', 'annexes',
];

const STAGE_LABEL: Record<string, string> = {
  pre_screening:   'Pré-screening',
  note_ic1:        'IC1',
  note_ic_finale:  'IC finale',
};

async function fetchVersion(id: string): Promise<VersionData | null> {
  const { data: v } = await supabase
    .from('memo_versions')
    .select('id, label, stage, snapshot_label, is_snapshot, overall_score, classification, generated_at, snapshot_taken_at')
    .eq('id', id)
    .maybeSingle();
  if (!v) return null;

  const { data: secs } = await supabase
    .from('memo_sections')
    .select('section_code, content_md, content_json, status, position')
    .eq('version_id', id)
    .order('position');

  return {
    ...(v as any),
    sections: (secs ?? []) as Section[],
  };
}

function VersionHeader({ data, side }: { data: VersionData; side: 'A' | 'B' }) {
  const dateLabel = data.is_snapshot && data.snapshot_taken_at
    ? new Date(data.snapshot_taken_at).toLocaleDateString('fr-FR')
    : data.generated_at
      ? new Date(data.generated_at).toLocaleDateString('fr-FR')
      : '—';
  return (
    <div className="border-b bg-muted/30 px-4 py-3 sticky top-0 z-10">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{side === 'A' ? 'Version A' : 'Version B'}</span>
        {data.is_snapshot ? (
          <Badge variant="outline" style={{ background: 'var(--pe-bg-purple)', color: 'var(--pe-purple)' }}>Snapshot</Badge>
        ) : (
          <Badge variant="outline" style={{ background: 'var(--pe-bg-ok)', color: 'var(--pe-ok)' }}>Live</Badge>
        )}
        <Badge variant="outline" className="text-[10px]">
          {STAGE_LABEL[data.stage] ?? data.stage}
        </Badge>
      </div>
      <div className="text-sm font-medium truncate">
        {data.snapshot_label ?? data.label}
      </div>
      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
        <span>{dateLabel}</span>
        {data.overall_score != null && <span>· Score {data.overall_score}</span>}
        {data.classification && <span>· {data.classification.replace('_', ' ')}</span>}
      </div>
    </div>
  );
}

function SectionCell({ section, isChanged }: { section: Section | null; isChanged: boolean }) {
  if (!section) {
    return (
      <div className="p-4 text-xs text-muted-foreground italic">
        (section absente de cette version)
      </div>
    );
  }
  return (
    <div className={`p-4 ${isChanged ? 'border-l-2' : ''}`} style={isChanged ? { borderLeftColor: 'var(--pe-warning)' } : {}}>
      {section.content_md ? (
        <div className="prose prose-sm max-w-none text-foreground">
          <ReactMarkdown>{section.content_md}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">(content_md vide — voir content_json structuré dans le memo)</p>
      )}
    </div>
  );
}

export default function MemoComparisonView({ versionAId, versionBId }: Props) {
  const [a, setA] = useState<VersionData | null>(null);
  const [b, setB] = useState<VersionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [vA, vB] = await Promise.all([
        fetchVersion(versionAId),
        fetchVersion(versionBId),
      ]);
      if (!cancelled) {
        setA(vA);
        setB(vB);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [versionAId, versionBId]);

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>;
  }
  if (!a || !b) {
    return <div className="p-6 text-sm text-muted-foreground">Une des versions est introuvable.</div>;
  }

  const sectionsAByCode = Object.fromEntries(a.sections.map(s => [s.section_code, s]));
  const sectionsBByCode = Object.fromEntries(b.sections.map(s => [s.section_code, s]));

  const isChanged = (code: string): boolean => {
    const sA = sectionsAByCode[code];
    const sB = sectionsBByCode[code];
    if (!sA || !sB) return true;
    return (sA.content_md ?? '') !== (sB.content_md ?? '');
  };

  const changedCount = SECTION_ORDER.filter(isChanged).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Bandeau résumé */}
      <div className="border-b bg-card px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className="font-medium">{changedCount} sections sur 12</span>
          <span className="text-muted-foreground">avec changement de contenu</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px]" style={{ borderColor: 'var(--pe-warning)', color: 'var(--pe-warning)' }}>
            Surlignées
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" />
          Comparaison sur le content_md narratif. Le content_json structuré peut aussi avoir évolué.
        </div>
      </div>

      {/* Layout 2 colonnes */}
      <div className="flex-1 grid grid-cols-2 overflow-hidden">
        <div className="border-r overflow-y-auto">
          <VersionHeader data={a} side="A" />
          {SECTION_ORDER.map(code => {
            const changed = isChanged(code);
            return (
              <div key={code} className="border-b">
                <div className="px-4 py-2 bg-muted/20 text-[11px] font-medium flex items-center gap-2">
                  {SECTION_LABELS[code] ?? code}
                  {changed && (
                    <Badge variant="outline" className="text-[9px]" style={{ background: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', borderColor: 'var(--pe-warning)' }}>
                      Modifiée
                    </Badge>
                  )}
                </div>
                <SectionCell section={sectionsAByCode[code] ?? null} isChanged={changed} />
              </div>
            );
          })}
        </div>
        <div className="overflow-y-auto">
          <VersionHeader data={b} side="B" />
          {SECTION_ORDER.map(code => {
            const changed = isChanged(code);
            return (
              <div key={code} className="border-b">
                <div className="px-4 py-2 bg-muted/20 text-[11px] font-medium flex items-center gap-2">
                  {SECTION_LABELS[code] ?? code}
                  {changed && (
                    <Badge variant="outline" className="text-[9px]" style={{ background: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', borderColor: 'var(--pe-warning)' }}>
                      Modifiée
                    </Badge>
                  )}
                </div>
                <SectionCell section={sectionsBByCode[code] ?? null} isChanged={changed} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
