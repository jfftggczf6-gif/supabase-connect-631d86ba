// MemoNarrativeView — Rendu ELEMBO-style du memo (vue rédactionnelle).
// Concatène les content_md de toutes les sections en un document A4 simulé,
// titres bleus/violets, paragraphes justifiés, pour un rendu proche du PDF/Word
// final (style banque d'affaires institutionnelle).

import ReactMarkdown from 'react-markdown';

const SECTION_LABELS: Record<string, string> = {
  executive_summary:        'Résumé exécutif',
  shareholding_governance:  "Actionnariat & gouvernance",
  top_management:           'Top management',
  services:                 "Services et chaîne de valeur",
  competition_market:       'Concurrence et marché',
  unit_economics:           'Units economics',
  financials_pnl:           'États financiers — PnL',
  financials_balance:       'États financiers — Bilan',
  investment_thesis:        "Thèse d'investissement",
  valuation:                'Valorisation',
  support_requested:        'Accompagnement et value creation',
  esg_risks:                'ESG, impact et risques',
  annexes:                  'Annexes',
};

const SECTION_ORDER = [
  'executive_summary', 'shareholding_governance', 'top_management', 'services',
  'competition_market', 'unit_economics', 'financials_pnl', 'financials_balance',
  'investment_thesis', 'valuation', 'support_requested', 'esg_risks', 'annexes',
];

interface Props {
  sections: Record<string, any>;
  valuation: any;
  deal: any;
  version: any;
}

export default function MemoNarrativeView({ sections, valuation, deal, version }: Props) {
  const enterpriseName = (deal?.enterprises as any)?.name ?? deal?.deal_ref ?? '—';
  const enterpriseSector = (deal?.enterprises as any)?.sector ?? '—';
  const enterpriseCountry = (deal?.enterprises as any)?.country ?? '—';
  const today = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const filledSections = SECTION_ORDER.filter((code) => {
    if (code === 'valuation') return !!valuation && valuation.status === 'ready';
    return !!sections[code]?.content_md && sections[code].content_md.trim().length > 0;
  });

  const emptyCount = SECTION_ORDER.length - filledSections.length;

  return (
    <div className="bg-slate-100 -mx-3 -my-3 p-6 rounded">
      {/* Document A4 simulé */}
      <article className="mx-auto max-w-[820px] bg-white shadow-sm rounded-sm">
        {/* Page de garde */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white px-12 py-16 rounded-t-sm">
          <div className="text-[10px] tracking-[0.2em] font-medium opacity-70 mb-8 border border-white/30 inline-block px-3 py-1 rounded">
            CONFIDENTIEL
          </div>
          <h1 className="text-4xl font-bold leading-tight">Investment Memorandum</h1>
          <p className="mt-3 text-slate-300 text-sm">
            Confidentiel — Préparé par ESONO | Dossier d'investissement {enterpriseCountry}
          </p>
          <div className="my-6 h-px w-16 bg-white/40" />
          <dl className="text-sm space-y-1">
            <div><dt className="inline font-semibold">Entreprise : </dt><dd className="inline">{enterpriseName}</dd></div>
            <div><dt className="inline font-semibold">Secteur : </dt><dd className="inline">{enterpriseSector}</dd></div>
            <div><dt className="inline font-semibold">Pays : </dt><dd className="inline">{enterpriseCountry}</dd></div>
            <div><dt className="inline font-semibold">Stage : </dt><dd className="inline capitalize">{(version?.stage ?? 'note_ic1').replace(/_/g, ' ')}</dd></div>
            <div><dt className="inline font-semibold">Date : </dt><dd className="inline">{today}</dd></div>
          </dl>
        </header>

        {/* Table des matières */}
        <section className="px-12 pt-10 pb-6">
          <h2 className="text-2xl font-bold text-slate-900 border-b-2 border-violet-200 pb-1.5 mb-5">
            Table des matières
          </h2>
          <ol className="space-y-1.5">
            {SECTION_ORDER.map((code, idx) => {
              const filled = filledSections.includes(code);
              return (
                <li key={code} className="flex items-baseline gap-3 text-sm">
                  <span className={`tabular-nums w-6 ${filled ? 'text-violet-600 font-semibold' : 'text-slate-300'}`}>
                    {String(idx + 1).padStart(2, ' ')}
                  </span>
                  <a
                    href={`#nv-${code}`}
                    className={`${filled ? 'text-slate-700 hover:text-violet-700 hover:underline' : 'text-slate-400'}`}
                  >
                    {SECTION_LABELS[code]}
                  </a>
                  {!filled && (
                    <span className="text-[10px] uppercase tracking-wider text-slate-300">— vide</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* Avertissement si beaucoup de sections vides */}
        {emptyCount > 4 && (
          <div className="mx-12 mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <strong>Vue rédactionnelle partielle.</strong> {emptyCount} section(s) sur {SECTION_ORDER.length} n'ont pas encore de contenu narratif (Markdown). Les données structurées sont disponibles en "Vue données". Régénère le memo après mise à jour du prompt long-form pour enrichir cette vue.
          </div>
        )}

        {/* Sections narratives */}
        <div className="px-12 pb-16">
          {SECTION_ORDER.map((code, idx) => {
            const isValuation = code === 'valuation';
            const sec = sections[code];
            const md = isValuation
              ? buildValuationMd(valuation, deal?.currency)
              : (sec?.content_md ?? '');
            const hasContent = md && md.trim().length > 0;

            // Encarts spéciaux pour le résumé exécutif (style ELEMBO)
            const cj = sec?.content_json ?? {};
            const isExec = code === 'executive_summary';
            const pointsCles: string[] | null = isExec && Array.isArray(cj.points_cles)
              ? cj.points_cles
              : isExec && Array.isArray(cj.bullets)
              ? cj.bullets
              : null;
            const reco = isExec ? (cj.recommendation ?? {}) : null;
            const score = isExec ? (reco?.score_esono ?? cj.score_memo ?? null) : null;
            const verdict = isExec ? (reco?.verdict ?? null) : null;
            const verdictLabel: Record<string, string> = {
              go_direct: 'GO',
              go_conditionnel: 'GO CONDITIONNEL',
              hold: 'APPROFONDIR',
              reject: 'NO-GO',
            };

            return (
              <section key={code} id={`nv-${code}`} className="mt-10 first:mt-6">
                <h2 className="text-2xl font-bold text-slate-900 border-b-2 border-violet-200 pb-1.5 mb-5">
                  {idx + 1}. {SECTION_LABELS[code]}
                </h2>
                {hasContent ? (
                  <div className="prose prose-sm max-w-none prose-slate
                                  prose-headings:text-violet-700 prose-headings:font-semibold
                                  prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
                                  prose-h4:text-sm prose-h4:mt-4 prose-h4:mb-1.5
                                  prose-p:text-slate-700 prose-p:leading-relaxed prose-p:text-justify prose-p:my-2
                                  prose-strong:text-slate-900 prose-strong:font-semibold
                                  prose-li:text-slate-700 prose-li:leading-relaxed
                                  prose-ul:my-2 prose-ol:my-2">
                    <ReactMarkdown>{md}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm italic text-slate-400">
                    Section non rédigée — le contenu narratif sera produit lors de la prochaine génération avec le prompt long-form.
                  </p>
                )}

                {/* Encart "Points clés" en bas du résumé exécutif (style ELEMBO) */}
                {isExec && pointsCles && pointsCles.length > 0 && (
                  <div className="mt-6 rounded-md border-l-4 border-blue-500 bg-blue-50/60 px-5 py-4">
                    <p className="text-sm font-semibold text-slate-900 mb-2">Points clés de l'investissement :</p>
                    <ul className="space-y-1.5 text-sm text-slate-700 list-disc list-inside marker:text-blue-500">
                      {pointsCles.map((p, i) => <li key={i} className="leading-relaxed">{p}</li>)}
                    </ul>
                  </div>
                )}

                {/* Score + Verdict en bas du résumé exécutif (style ELEMBO) */}
                {isExec && (score != null || verdict) && (
                  <div className="mt-4 flex gap-3 flex-wrap">
                    {score != null && (
                      <div className="flex items-center gap-3 rounded-md bg-slate-900 text-white px-4 py-3 min-w-[200px]">
                        <span className="text-3xl font-bold tabular-nums">{score}</span>
                        <div className="text-xs leading-tight">
                          <div className="font-medium">Score Investment Readiness</div>
                          <div className="text-slate-400">/100</div>
                        </div>
                      </div>
                    )}
                    {verdict && (
                      <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 flex-1 min-w-[240px]">
                        <span className="text-amber-500 text-lg">⚡</span>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-amber-700">Recommandation</div>
                          <div className="font-bold text-amber-900">{verdictLabel[verdict] ?? verdict}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </article>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildValuationMd(valuation: any, currency = 'FCFA'): string {
  if (!valuation || valuation.status !== 'ready') return '';
  const syn = valuation.synthesis ?? {};
  const cur = valuation.currency ?? currency;
  const fmt = (v: number | undefined | null): string => {
    if (v == null || isNaN(v as number)) return '—';
    const abs = Math.abs(v);
    if (abs >= 1000) return `${(v / 1000).toFixed(2)} Md ${cur}`;
    if (abs >= 1) return `${Math.round(v)} M ${cur}`;
    return `${Math.round(v * 1000)} K ${cur}`;
  };
  const pct = (v: number | undefined | null) => v == null ? '—' : `${(v * 100).toFixed(0)}%`;
  const x = (v: number | undefined | null) => v == null ? '—' : `${v.toFixed(1)}x`;

  const justification = syn.justification ?? valuation.ai_justification ?? '';

  return `### Synthèse de valorisation

La valorisation pondérée (DCF ${pct(syn.weights?.dcf)} · Multiples ${pct(syn.weights?.multiples)} · ANCC ${pct(syn.weights?.ancc)}) ressort à **${fmt(syn.weighted_ev)}** (Enterprise Value). Le pre-money recommandé s'établit à **${fmt(syn.pre_money_recommended)}** pour un ticket de **${fmt(syn.ticket_recommended)}**, soit une participation de **${pct(syn.equity_stake_pct)}** au capital. L'horizon de sortie est fixé à **${syn.exit_horizon_years ?? 5} ans**.

### Fourchette de valorisation — 3 scénarios

- **Bear** : EV ${fmt(syn.range?.bear)}, MOIC ${x(syn.moic_bear)}, TRI ${pct(syn.irr_bear)}
- **Base** : EV ${fmt(syn.range?.base)}, MOIC ${x(syn.moic_base)}, TRI ${pct(syn.irr_base)}
- **Bull** : EV ${fmt(syn.range?.bull)}, MOIC ${x(syn.moic_bull)}, TRI ${pct(syn.irr_bull)}

${justification ? `### Justification analyste\n\n${justification}` : ''}`;
}
