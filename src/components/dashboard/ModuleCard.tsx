import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  onClick?: () => void;
}

export default function ModuleCard({ title, description, icon: Icon, status, progress, onClick }: ModuleCardProps) {
  const { t } = useTranslation();
  const statusConfig = {
    not_started: { label: t('status.not_started'), variant: 'outline' as const },
    in_progress: { label: t('status.in_progress'), variant: 'default' as const },
    completed: { label: t('status.completed'), variant: 'secondary' as const },
  };
  const config = statusConfig[status];

  return (
    <Card
      className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <Badge variant={config.variant} className="text-xs">
            {config.label}
          </Badge>
        </div>
        <CardTitle className="text-base font-display mt-3">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('dashboard_programme.progression')}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}
