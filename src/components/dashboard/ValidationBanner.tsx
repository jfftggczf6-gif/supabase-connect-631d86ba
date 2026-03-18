import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  auto_corrected: boolean;
  original_value?: any;
  corrected_value?: any;
}

interface ValidationData {
  valid: boolean;
  issues_count: number;
  errors: number;
  warnings: number;
  corrections_applied: number;
  issues: ValidationIssue[];
  validated_at: string;
  original_score?: number;
}

interface Props {
  validation?: ValidationData;
}

export default function ValidationBanner({ validation }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!validation) return null;

  const { warnings, corrections_applied, issues } = validation;
  const uncorrectedErrors = issues.filter(i => i.severity === 'error' && !i.auto_corrected).length;
  let Icon = CheckCircle2;
  let label = '✅ Données validées — aucune incohérence détectée';
  let bgClass = 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300';

  if (uncorrectedErrors > 0) {
    Icon = XCircle;
    label = `❌ ${uncorrectedErrors} incohérence${uncorrectedErrors > 1 ? 's' : ''} détectée${uncorrectedErrors > 1 ? 's' : ''} — fiabilité réduite`;
    bgClass = 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300';
  } else if (warnings > 0) {
    Icon = AlertTriangle;
    label = `⚠️ ${warnings} avertissement${warnings > 1 ? 's' : ''} détecté${warnings > 1 ? 's' : ''}`;
    bgClass = 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300';
  }

  return (
    <div className={`rounded-lg border p-3 mb-4 ${bgClass}`}>
      <div className="flex items-center justify-between cursor-pointer" onClick={() => issues.length > 0 && setExpanded(!expanded)}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4" />
          <span>{label}</span>
          {corrections_applied > 0 && (
            <Badge variant="outline" className="text-xs gap-1 ml-2">
              <Wrench className="h-3 w-3" /> {corrections_applied} auto-corrigé{corrections_applied > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {issues.length > 0 && (
          expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        )}
      </div>

      {expanded && issues.length > 0 && (
        <div className="mt-3 space-y-2 text-xs">
          {issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded bg-background/50">
              {issue.severity === 'error' ? <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" /> :
               issue.severity === 'warning' ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" /> :
               <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />}
              <div>
                <span className="font-mono text-muted-foreground">{issue.field}</span>
                <span className="mx-1">—</span>
                <span>{issue.message}</span>
                {issue.auto_corrected && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">Auto-corrigé</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
