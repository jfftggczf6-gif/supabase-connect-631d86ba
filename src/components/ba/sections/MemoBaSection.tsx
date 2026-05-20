// src/components/ba/sections/MemoBaSection.tsx
// Memo investissement BA — vue d'ensemble OU section individuelle.
//
// Briefs couverts (un seul composant pour 4 features alignées PE) :
//   #12   generate_im_vendeur     — 12 sections IM
//   #12.5 living_document         — workflow draft/submitted/correction/validated
//   #12.6 auto_update_suggestions — banner suggestions après nouvelle note/doc
//   #12.7 progress_tracker        — barre progression validées/total
//
// Stratégie (CLAUDE.md "Design PE comme référence") :
// Réutilisation maximum :
//   - MemoSectionsViewer (PE) : rend les 12 sections en colonne avec workflow
//   - PeSingleSectionView (PE) : rend une section individuelle avec regenerate + validation
//
// Le ton vendeur (BA vs PE) est à ajuster dans une session prompt-engineering.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, History } from 'lucide-react';
import MemoSectionsViewer from '@/components/pe/MemoSectionsViewer';
import PeSingleSectionView from '@/components/pe/PeSingleSectionView';
import MemoVersionsView from '@/components/pe/MemoVersionsView';
import MemoBaProgressBar from './MemoBaProgressBar';
import EmptyStateGenerate from '@/components/shared/EmptyStateGenerate';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  dealId: string;
  /** Si fourni, rend uniquement cette section. Sinon vue d'ensemble 12 sections. */
  sectionCode?: string;
  dealStage?: string;
}

/** Map section number (1-12) → code section PE/BA aligné. */
export const MEMO_SECTION_CODES: Record<number, string> = {
  1:  'executive_summary',
  2:  'shareholding_governance',
  3:  'top_management',
  4:  'services',
  5:  'competition_market',
  6:  'unit_economics',
  7:  'financials_pnl',
  8:  'financials_balance',
  9:  'investment_thesis',
  10: 'support_requested',
  11: 'esg_risks',
  12: 'annexes',
};

export default function MemoBaSection({ dealId, sectionCode, dealStage }: Props) {
  const [loading, setLoading] = useState(true);
  const [hasContent, setHasContent] = useState(false);

  const checkMemo = async () => {
    setLoading(true);
    const { data: memo } = await supabase
      .from('investment_memos')
      .select('id')
      .eq('deal_id', dealId)
      .maybeSingle();
    if (!memo) {
      setHasContent(false);
      setLoading(false);
      return;
    }
    const { data: versions } = await supabase
      .from('memo_versions')
      .select('id')
      .eq('memo_id', (memo as any).id)
      .neq('stage', 'pre_screening');
    const versionIds = (versions || []).map((v: any) => v.id);
    if (versionIds.length === 0) {
      setHasContent(false);
      setLoading(false);
      return;
    }
    const { count } = await supabase
      .from('memo_sections')
      .select('id', { count: 'exact', head: true })
      .in('version_id', versionIds);
    setHasContent((count || 0) > 0);
    setLoading(false);
  };

  useEffect(() => {
    if (!sectionCode) checkMemo();
  }, [dealId, sectionCode]);

  // Section individuelle (memo:N de la sidebar)
  if (sectionCode) {
    return (
      <div className="max-w-4xl mx-auto">
        <PeSingleSectionView dealId={dealId} sectionCode={sectionCode} />
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!hasContent) {
    return (
      <EmptyStateGenerate
        dealId={dealId}
        edgeFunction="generate-ic1-memo"
        label="Générer l'IM vendeur"
        description="L'IA produit un IM vendeur en 12 sections : equity story, gouvernance, services, marché, financials, thèse d'investissement. Living document — chaque section éditable et validable par l'analyste, l'IM et le MD."
        toastLabel="IM vendeur"
        onLaunched={checkMemo}
      />
    );
  }

  // Vue d'ensemble : progress_tracker + auto_update_suggestions + les 12 sections
  // + onglet Historique (brief P7 #28) — versions memo en lecture seule
  return (
    <div className="max-w-5xl mx-auto">
      <MemoBaProgressBar dealId={dealId} />
      <Tabs defaultValue="memo">
        <TabsList className="mb-4">
          <TabsTrigger value="memo" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Memo IM
          </TabsTrigger>
          <TabsTrigger value="historique" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Historique
          </TabsTrigger>
        </TabsList>
        <TabsContent value="memo">
          <MemoSectionsViewer dealId={dealId} dealStage={dealStage} withToc />
        </TabsContent>
        <TabsContent value="historique">
          <MemoVersionsView dealId={dealId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
