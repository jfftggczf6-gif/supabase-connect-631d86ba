interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function ScoreCircle({ score, size = 'lg' }: Props) {
  const color = score >= 70 ? 'var(--pe-ok)' : score >= 40 ? 'var(--pe-warning)' : 'var(--pe-danger)';
  const bg = score >= 70 ? 'var(--pe-bg-ok)' : score >= 40 ? 'var(--pe-bg-warning)' : 'var(--pe-bg-danger)';
  const sizes = {
    sm: { box: 'p-2', val: 'text-base', label: 'text-[9px]' },
    md: { box: 'p-3', val: 'text-xl', label: 'text-[10px]' },
    lg: { box: 'p-4', val: 'text-3xl', label: 'text-xs' },
  };
  const cls = sizes[size];
  return (
    <div className={`text-center rounded-xl ${cls.box}`} style={{ background: bg }}>
      <div className={`font-medium ${cls.val}`} style={{ color }}>{score}</div>
      <div className={cls.label} style={{ color }}>Score global</div>
    </div>
  );
}
