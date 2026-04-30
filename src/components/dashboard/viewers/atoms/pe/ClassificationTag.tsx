interface Props { classification: string | null; }

const LABELS: Record<string, { label: string; color: string; bg: string }> = {
  go_direct:        { label: 'Go direct',        color: 'var(--pe-ok)',      bg: 'var(--pe-bg-ok)' },
  go_conditionnel:  { label: 'Go conditionnel',  color: 'var(--pe-ok)',      bg: 'var(--pe-bg-ok)' },
  hold:             { label: 'Hold',             color: 'var(--pe-warning)', bg: 'var(--pe-bg-warning)' },
  reject:           { label: 'Reject',           color: 'var(--pe-danger)',  bg: 'var(--pe-bg-danger)' },
};

export default function ClassificationTag({ classification }: Props) {
  if (!classification) return null;
  const def = LABELS[classification] ?? { label: classification, color: 'var(--pe-text-secondary)', bg: '#f0f0f0' };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ background: def.bg, color: def.color }}
    >
      {def.label}
    </span>
  );
}
