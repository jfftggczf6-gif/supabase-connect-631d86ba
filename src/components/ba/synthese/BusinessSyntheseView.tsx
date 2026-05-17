// src/components/ba/synthese/BusinessSyntheseView.tsx
// Brief synthese_partner critère #4 : pipeline value, success fees, deals closés, win rate.

import { Card } from '@/components/ba/synthese/_card';
import { TrendingUp, Coins, Trophy, Target } from 'lucide-react';
import type { BusinessSynthese } from '@/types/synthese-ba';

interface Props {
  business: BusinessSynthese;
}

function formatLargeUSD(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} Mrd USD`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} M USD`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)} K USD`;
  return `${amount.toFixed(0)} USD`;
}

export default function BusinessSyntheseView({ business }: Props) {
  const winRateLabel = business.win_rate_ytd === null
    ? '—'
    : `${Math.round(business.win_rate_ytd * 100)}%`;

  return (
    <div className="mb-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Synthèse business
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader Icon={TrendingUp} label="Pipeline value" tint="emerald" />
          <CardValue value={formatLargeUSD(business.pipeline_value_usd)} hint="Σ tickets actifs" />
        </Card>
        <Card>
          <CardHeader Icon={Coins} label="Success fees" tint="amber" />
          <CardValue
            value={formatLargeUSD(business.success_fees_potential_usd)}
            hint={`Pipeline × ${(business.success_fee_pct * 100).toFixed(1)}%`}
          />
        </Card>
        <Card>
          <CardHeader Icon={Trophy} label="Deals closés YTD" tint="violet" />
          <CardValue value={business.deals_closed_ytd.toString()} hint="Année courante" />
        </Card>
        <Card>
          <CardHeader Icon={Target} label="Win rate YTD" tint="blue" />
          <CardValue value={winRateLabel} hint="Closés / (closés + perdus)" />
        </Card>
      </div>
    </div>
  );
}

function CardHeader({ Icon, label, tint }: { Icon: any; label: string; tint: 'emerald' | 'amber' | 'violet' | 'blue' }) {
  const tints = {
    emerald: 'text-emerald-600 bg-emerald-100',
    amber:   'text-amber-600 bg-amber-100',
    violet:  'text-violet-600 bg-violet-100',
    blue:    'text-blue-600 bg-blue-100',
  };
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className={`h-6 w-6 rounded-full flex items-center justify-center ${tints[tint]}`}>
        <Icon className="h-3 w-3" />
      </div>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</span>
    </div>
  );
}

function CardValue({ value, hint }: { value: string; hint: string }) {
  return (
    <div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}
