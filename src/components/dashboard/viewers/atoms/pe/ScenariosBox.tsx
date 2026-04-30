interface Scenario { moic: string; irr: string; description?: string; }
interface Props {
  bear?: Scenario;
  base?: Scenario;
  bull?: Scenario;
  pre_money_indicatif?: string;
}

export default function ScenariosBox({ bear, base, bull, pre_money_indicatif }: Props) {
  return (
    <div>
      <div className="flex flex-col gap-1 text-sm">
        {bear && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bear</span>
            <span style={{ color: 'var(--pe-warning)', fontWeight: 500 }}>{bear.moic} · IRR {bear.irr}</span>
          </div>
        )}
        {base && (
          <div className="flex justify-between">
            <span style={{ color: 'var(--pe-info)' }}>Base</span>
            <span style={{ color: 'var(--pe-info)', fontWeight: 500 }}>{base.moic} · IRR {base.irr}</span>
          </div>
        )}
        {bull && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bull</span>
            <span style={{ color: 'var(--pe-ok)', fontWeight: 500 }}>{bull.moic} · IRR {bull.irr}</span>
          </div>
        )}
      </div>
      {pre_money_indicatif && (
        <p className="text-[10px] text-muted-foreground mt-1.5">Pre-money indicatif : {pre_money_indicatif}</p>
      )}
    </div>
  );
}
