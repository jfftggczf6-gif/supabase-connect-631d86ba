interface ChecklistItem { label: string; status: 'ok' | 'partial' | 'missing'; }
interface Props {
  name: string;
  level: 'N0' | 'N1' | 'N2';
  checklist: ChecklistItem[];
}

const LEVEL_STYLE: Record<string, { bg: string; color: string }> = {
  N0: { bg: 'var(--pe-bg-danger)',  color: 'var(--pe-danger)' },
  N1: { bg: 'var(--pe-bg-warning)', color: 'var(--pe-warning)' },
  N2: { bg: 'var(--pe-bg-ok)',      color: 'var(--pe-ok)' },
};
const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  ok:      { icon: '✓',       color: 'var(--pe-ok)' },
  partial: { icon: 'partiel', color: 'var(--pe-warning)' },
  missing: { icon: '✗',       color: 'var(--pe-danger)' },
};

export default function DocCategoryCard({ name, level, checklist }: Props) {
  const ls = LEVEL_STYLE[level] ?? LEVEL_STYLE.N0;
  return (
    <div className="text-[10px]">
      <div className="font-medium mb-1 flex items-center gap-2">
        <span>{name}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: ls.bg, color: ls.color }}>
          {level}
        </span>
      </div>
      {checklist.map((item, i) => {
        const si = STATUS_ICON[item.status] ?? STATUS_ICON.missing;
        return (
          <div key={i} className="flex justify-between py-0.5">
            <span className="text-muted-foreground">{item.label}</span>
            <span style={{ color: si.color }}>{si.icon}</span>
          </div>
        );
      })}
    </div>
  );
}
