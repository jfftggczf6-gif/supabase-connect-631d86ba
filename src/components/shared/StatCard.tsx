// StatCard — composant KPI partagé entre volets programme / PE / banque
// Pattern aligné sur ProgrammeDashboardTab : Card blanche sobre + icône colorée + chiffre big + label small.
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface Props {
  icon: LucideIcon;
  value: string | number | ReactNode;
  label: string;
  iconColor?: string;          // 'text-primary' | 'text-emerald-500' | 'text-amber-500' | 'text-red-500' …
  subText?: string;            // ligne de sous-info (ex: delta vs N-1)
  onClick?: () => void;
  highlight?: 'amber' | 'red'; // ring border en cas d'alerte
  className?: string;
}

export default function StatCard({
  icon: Icon,
  value,
  label,
  iconColor = 'text-primary',
  subText,
  onClick,
  highlight,
  className,
}: Props) {
  const ringClass = highlight === 'amber' ? 'cursor-pointer hover:ring-2 ring-amber-300 transition-all'
                  : highlight === 'red' ? 'cursor-pointer hover:ring-2 ring-red-300 transition-all'
                  : onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : '';
  return (
    <Card className={cn(ringClass, className)} onClick={onClick}>
      <CardContent className="p-4 text-center">
        <Icon className={cn('h-5 w-5 mx-auto mb-1', iconColor)} />
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {subText && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subText}</p>}
      </CardContent>
    </Card>
  );
}
