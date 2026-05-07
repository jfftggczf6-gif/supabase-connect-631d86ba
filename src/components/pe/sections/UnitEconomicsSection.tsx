import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

function GenericTable({ headers, rows, gridCols }: { headers: string[]; rows: any[][]; gridCols: string }) {
  return (
    <>
      <div className="grid border-b text-[10px] text-muted-foreground py-1" style={{ gridTemplateColumns: gridCols }}>
        {headers.map((h, i) => <span key={i} className={i === 0 ? '' : 'text-right'}>{h}</span>)}
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid py-1 border-b border-border/30 text-xs" style={{ gridTemplateColumns: gridCols }}>
          {row.map((cell, j) => (
            <span key={j} className={j === 0 ? 'text-muted-foreground' : 'text-right'}>
              {typeof cell === 'object' && cell != null
                ? <span style={{ fontWeight: cell.bold ? 500 : undefined }}>{cell.v}</span>
                : cell}
            </span>
          ))}
        </div>
      ))}
    </>
  );
}

export default function UnitEconomicsSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const renderingByCanal = cj.rentabilite_canal;
  const renderingByFamille = cj.rentabilite_famille;
  const decompositionCout = cj.decomposition_cout;
  const sensibiliteApi = cj.sensibilite_api;
  const breakEven = cj.break_even;
  const levierOpe = cj.levier_operationnel;
  const unitEcoSn = cj.unit_eco_sn;
  const benchmarks = cj.benchmarks;
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Unit economics</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderingByCanal?.rows?.length > 0 && (
          <NarrativeBlock title="Rentabilité par canal de distribution">
            <GenericTable headers={renderingByCanal.headers} rows={renderingByCanal.rows} gridCols="2fr 1fr 1fr 1fr 1fr" />
          </NarrativeBlock>
        )}

        {renderingByFamille?.rows?.length > 0 && (
          <NarrativeBlock title="Rentabilité par famille thérapeutique">
            <GenericTable headers={renderingByFamille.headers} rows={renderingByFamille.rows} gridCols="2fr 1fr 1fr 1fr 1fr" />
          </NarrativeBlock>
        )}

        {decompositionCout?.length > 0 && (() => {
          // Extrait le pourcentage depuis le hint ("55% du coût" → 55) ou retombe sur part égale
          const pcts = decompositionCout.map((k: any) => {
            const m = String(k.hint ?? '').match(/(\d+(?:\.\d+)?)/);
            return m ? parseFloat(m[1]) : 0;
          });
          const total = pcts.reduce((a: number, b: number) => a + b, 0);
          const normalized = total > 0
            ? pcts.map((p: number) => (p / total) * 100)
            : decompositionCout.map(() => 100 / decompositionCout.length);
          // 5 nuances de violet pour les segments
          const COLORS = ['#5B21B6', '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD'];
          const chartData = decompositionCout.map((k: any, i: number) => ({
            name: k.label,
            value: normalized[i],
            rawValue: k.value,
            hint: k.hint,
          }));
          // Total coût à afficher au centre du donut (somme des values FCFA si parsable)
          const totalCout = decompositionCout.reduce((sum: number, k: any) => {
            const m = String(k.value ?? '').match(/(\d+(?:[.,]\d+)?)/);
            return sum + (m ? parseFloat(m[1].replace(',', '.')) : 0);
          }, 0);
          return (
            <NarrativeBlock title="Décomposition du coût de revient (par unité)">
              <div className="grid md:grid-cols-[260px_1fr] gap-6 items-center">
                {/* Donut */}
                <div className="relative h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={1}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, _name: any, props: any) => [
                          `${props.payload.rawValue}${props.payload.hint ? ` (${props.payload.hint})` : ''}`,
                          props.payload.name,
                        ]}
                        contentStyle={{ fontSize: '12px', borderRadius: '6px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Total au centre */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
                    <div className="text-lg font-bold">{totalCout > 0 ? `${totalCout} FCFA` : '—'}</div>
                  </div>
                </div>

                {/* Légende détaillée */}
                <div className="space-y-2">
                  {decompositionCout.map((k: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        className="inline-block h-3 w-3 rounded-sm shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3 flex-wrap">
                        <span className="font-medium">{k.label}</span>
                        <span className="text-sm tabular-nums">
                          <strong>{k.value}</strong>
                          {k.hint && <span className="text-muted-foreground"> · {k.hint}</span>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </NarrativeBlock>
          );
        })()}

        {sensibiliteApi?.rows?.length > 0 && (
          <NarrativeBlock title="Sensibilité au prix des API">
            <GenericTable headers={sensibiliteApi.headers} rows={sensibiliteApi.rows} gridCols="2fr 1fr 1fr 1fr 1fr" />
          </NarrativeBlock>
        )}

        {breakEven && (
          <NarrativeBlock title="Break-even et levier opérationnel">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded p-3 bg-background border">
                <div className="text-[10px] text-muted-foreground">Break-even</div>
                <div className="text-base font-medium">{breakEven.value}</div>
                {breakEven.hint && <div className="text-[9px] mt-0.5 text-muted-foreground">{breakEven.hint}</div>}
              </div>
              {levierOpe && (
                <div className="rounded p-3 bg-background border">
                  <div className="text-[10px] text-muted-foreground">Levier opérationnel</div>
                  <p className="text-xs mt-0.5">{levierOpe}</p>
                </div>
              )}
            </div>
          </NarrativeBlock>
        )}

        {unitEcoSn && (
          <NarrativeBlock title="Unit economics expansion Sénégal">
            <p>{unitEcoSn}</p>
          </NarrativeBlock>
        )}

        {benchmarks?.rows?.length > 0 && (
          <NarrativeBlock title="Benchmarks sectoriels">
            <GenericTable headers={benchmarks.headers} rows={benchmarks.rows} gridCols="2fr 1fr 1fr 1fr 1fr" />
          </NarrativeBlock>
        )}

        {section.content_md && !renderingByCanal && (
          <NarrativeBlock title="Notes complémentaires">
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown>{section.content_md}</ReactMarkdown>
            </div>
          </NarrativeBlock>
        )}

        <SectionMetadataFooter meta={meta} footer={footer} />
      </CardContent>
    </Card>
  );
}
