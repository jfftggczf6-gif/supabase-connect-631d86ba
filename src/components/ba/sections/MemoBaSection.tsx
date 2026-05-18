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

import MemoSectionsViewer from '@/components/pe/MemoSectionsViewer';
import PeSingleSectionView from '@/components/pe/PeSingleSectionView';
import MemoBaProgressBar from './MemoBaProgressBar';

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
  // Section individuelle (memo:N de la sidebar)
  if (sectionCode) {
    return (
      <div className="max-w-4xl mx-auto">
        <PeSingleSectionView dealId={dealId} sectionCode={sectionCode} />
      </div>
    );
  }

  // Vue d'ensemble : progress_tracker + auto_update_suggestions + les 12 sections
  return (
    <div className="max-w-5xl mx-auto">
      <MemoBaProgressBar dealId={dealId} />
      <MemoSectionsViewer dealId={dealId} dealStage={dealStage} withToc />
    </div>
  );
}
