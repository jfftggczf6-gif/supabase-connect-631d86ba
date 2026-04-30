interface Props {
  title: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
}

const SEV_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  high:   { bg: 'var(--pe-bg-danger)',  border: 'var(--pe-danger)',  color: 'var(--pe-danger)',  label: 'Impact fort' },
  medium: { bg: 'var(--pe-bg-warning)', border: 'var(--pe-warning)', color: 'var(--pe-warning)', label: 'Impact modéré' },
  low:    { bg: 'var(--pe-bg-info)',    border: 'var(--pe-info)',    color: 'var(--pe-info)',    label: 'Informatif' },
};

export default function RedFlagItem({ title, severity, detail }: Props) {
  const s = SEV_STYLE[severity] ?? SEV_STYLE.medium;
  return (
    <div
      className="rounded px-2 py-1.5 my-1 text-sm"
      style={{ background: s.bg, borderLeft: `3px solid ${s.border}` }}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="font-medium text-[11px]" style={{ color: s.color }}>{title}</span>
        <span
          className="px-1.5 py-0.5 rounded text-[9px]"
          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
        >
          {s.label}
        </span>
      </div>
      <p className="text-[10px] leading-relaxed" style={{ color: s.color, opacity: 0.85 }}>{detail}</p>
    </div>
  );
}
