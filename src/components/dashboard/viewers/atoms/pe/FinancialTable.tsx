interface Row {
  label: string;
  values: (string | number | null)[];
  highlight?: 'ok' | 'warning' | 'danger';
}
interface Props {
  headers: string[];
  rows: Row[];
  footnote?: string;
}

export default function FinancialTable({ headers, rows, footnote }: Props) {
  const colorMap: Record<string, string> = {
    ok: 'var(--pe-ok)',
    warning: 'var(--pe-warning)',
    danger: 'var(--pe-danger)',
  };
  const cols = `1.8fr ${headers.map(() => '1fr').join(' ')}`;
  return (
    <div className="text-sm">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
        <span></span>
        {headers.map((h, i) => (
          <span key={i} className="text-right text-[10px] text-muted-foreground py-1">{h}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid py-1 border-b border-border/50" style={{ gridTemplateColumns: cols }}>
          <span className="text-muted-foreground">{row.label}</span>
          {row.values.map((v, j) => (
            <span
              key={j}
              className="text-right"
              style={{
                color: row.highlight ? colorMap[row.highlight] : undefined,
                fontWeight: j === row.values.length - 1 ? 500 : undefined,
              }}
            >
              {v ?? '—'}
            </span>
          ))}
        </div>
      ))}
      {footnote && <p className="text-[10px] text-muted-foreground mt-1.5">{footnote}</p>}
    </div>
  );
}
