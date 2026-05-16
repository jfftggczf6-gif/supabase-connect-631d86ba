// src/components/ba/MandatKpiHeader.tsx
// KPIs distincts par rôle BA (analyste / senior / partner).
import { useMemo } from 'react';
import type { Mandat, MandatKpis } from '@/types/ba';
import { Card } from '@/components/ui/card';

interface Props {
  role: string | null | undefined;
  mandats: Mandat[];
  myUserId?: string | null;
}

function computeKpis(role: string, mandats: Mandat[], myUserId?: string | null): MandatKpis {
  const isAnalyst = role === 'analyst' || role === 'analyste';
  const isSenior = role === 'investment_manager';

  if (isAnalyst) {
    const mine = mandats.filter(m => m.lead_analyst_id === myUserId);
    const toFix = mine.filter(m => (m.sections_in_review ?? 0) > 0).length;
    const sectionsOk = mine.reduce((acc, m) => acc + Math.max(0, 12 - (m.sections_in_review ?? 0)), 0);
    const docsMissing = mine.filter(m => (m.progress_pct ?? 0) < 40).length;
    return {
      label_1: 'Mes mandats',          value_1: mine.length,
      label_2: 'À corriger',           value_2: toFix,
      label_3: 'Sections OK',          value_3: sectionsOk,
      label_4: 'Docs manquants',       value_4: docsMissing,
    };
  }

  if (isSenior) {
    const active = mandats.filter(m => m.stage !== 'close');
    const toReview = mandats.filter(m => (m.sections_in_review ?? 0) > 0).length;
    const analystes = new Set(mandats.map(m => m.lead_analyst_id).filter(Boolean)).size;
    const sectionsReview = mandats.reduce((acc, m) => acc + (m.sections_in_review ?? 0), 0);
    return {
      label_1: 'Mandats actifs',       value_1: active.length,
      label_2: 'À reviewer',           value_2: toReview,
      label_3: 'Analystes',            value_3: analystes,
      label_4: 'Sections en review',   value_4: sectionsReview,
    };
  }

  // Partner / MD / owner / admin / super_admin
  const total = mandats.length;
  const newOnes = mandats.filter(m => m.stage === 'recus').length;
  const inReview = mandats.filter(m => (m.sections_in_review ?? 0) > 0).length;
  const closedMonth = mandats.filter(m => m.stage === 'close').length;
  return {
    label_1: 'Total mandats',        value_1: total,
    label_2: 'Nouveaux',             value_2: newOnes,
    label_3: 'En revue',             value_3: inReview,
    label_4: 'Closés',               value_4: closedMonth,
  };
}

export default function MandatKpiHeader({ role, mandats, myUserId }: Props) {
  const kpis = useMemo(() => computeKpis(role || '', mandats, myUserId), [role, mandats, myUserId]);

  const items = [
    { label: kpis.label_1, value: kpis.value_1 },
    { label: kpis.label_2, value: kpis.value_2 },
    { label: kpis.label_3, value: kpis.value_3 },
    { label: kpis.label_4, value: kpis.value_4 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {items.map((it) => (
        <Card key={it.label} className="p-3">
          <div className="text-xs text-muted-foreground">{it.label}</div>
          <div className="text-2xl font-semibold mt-1">{it.value}</div>
        </Card>
      ))}
    </div>
  );
}
