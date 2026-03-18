import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ConfidenceEntry {
  level: number;
  source?: string;
}

interface Props {
  field: string;
  confidence?: Record<string, ConfidenceEntry>;
}

export default function ConfidenceIndicator({ field, confidence }: Props) {
  if (!confidence || !confidence[field]) return null;

  const entry = confidence[field];
  const level = entry.level;

  let dotClass = 'bg-red-500';
  let label = 'Faible confiance';
  if (level >= 80) { dotClass = 'bg-green-500'; label = 'Haute confiance'; }
  else if (level >= 40) { dotClass = 'bg-amber-500'; label = 'Confiance moyenne'; }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-block w-2 h-2 rounded-full ${dotClass} ml-1.5 cursor-help`} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-64">
        <p className="font-medium">{label} ({level}%)</p>
        {entry.source && <p className="text-muted-foreground mt-0.5">Source : {entry.source}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
