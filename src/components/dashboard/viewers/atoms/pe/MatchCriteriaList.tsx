interface Criterion { label: string; status: 'match' | 'partial' | 'no'; }
interface Props {
  criteria: Criterion[];
  match_count?: number;
  total?: number;
  score_percent?: number;
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  match:   { label: 'Match',    bg: 'var(--pe-bg-ok)',      color: 'var(--pe-ok)' },
  partial: { label: 'Partiel',  bg: 'var(--pe-bg-warning)', color: 'var(--pe-warning)' },
  no:      { label: 'No-match', bg: 'var(--pe-bg-danger)',  color: 'var(--pe-danger)' },
};

export default function MatchCriteriaList({ criteria, match_count, total, score_percent }: Props) {
  return (
    <div>
      <div className="flex flex-col gap-1 text-sm">
        {criteria.map((c, i) => {
          const s = STATUS_STYLE[c.status] ?? STATUS_STYLE.no;
          return (
            <div key={i} className="flex justify-between">
              <span className="text-muted-foreground">{c.label}</span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-medium"
                style={{ background: s.bg, color: s.color }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      {(match_count !== undefined || score_percent !== undefined) && (
        <div className="border-t border-border mt-1.5 pt-1.5 text-sm">
          <span className="text-muted-foreground">{match_count}/{total} critères remplis · Adéquation</span>
          {' '}<span style={{ fontWeight: 500, color: 'var(--pe-ok)' }}>{score_percent}%</span>
        </div>
      )}
    </div>
  );
}
