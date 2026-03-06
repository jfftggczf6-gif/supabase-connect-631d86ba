import { Progress } from '@/components/ui/progress';

interface BmcViewerProps {
  data: any;
}

const BLOC_LABELS: Record<string, string> = {
  proposition_valeur: 'Proposition de Valeur',
  activites_cles: 'Activités Clés',
  ressources_cles: 'Ressources Clés',
  segments_clients: 'Segments Clients',
  relations_clients: 'Relations Clients',
  flux_revenus: 'Flux de Revenus',
  partenaires_cles: 'Partenaires Clés',
  canaux: 'Canaux',
  structure_couts: 'Structure de Coûts',
};

function toArr(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : v?.item || v?.libelle || v?.description || v?.nom || JSON.stringify(v));
  if (typeof val === 'object') {
    if (val.items) return toArr(val.items);
    if (val.postes) return toArr(val.postes);
    if (val.enonce) return [val.enonce, ...(val.avantages || [])];
    if (val.principal) return [val.principal];
    return [];
  }
  if (typeof val === 'string') return [val];
  return [];
}

export default function BmcViewer({ data }: BmcViewerProps) {
  if (!data) return null;

  const canvas = data.canvas || {};
  const diag = data.diagnostic || {};
  const swot = data.swot || {};
  const reco = data.recommandations || {};
  const scores = diag.scores_par_bloc || {};

  const scoreColor = (s: number) =>
    s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444';

  return (
    <div className="max-w-[900px] mx-auto" style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      {/* ===== HERO HEADER ===== */}
      <div className="relative rounded-2xl overflow-hidden mb-8" style={{ background: 'linear-gradient(135deg, #1a2744 0%, #2d4a7c 50%, #1a2744 100%)' }}>
        <div className="px-10 py-10 text-white">
          <h1 className="text-3xl font-black tracking-tight">BUSINESS MODEL CANVAS</h1>
          <p className="text-lg font-semibold mt-1 opacity-90">{data.entreprise || data.enterprise_name || ''}</p>
          {data.resume && (
            <p className="text-sm opacity-70 italic mt-3 max-w-[600px]">"{data.resume}"</p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {(data.tags || []).map((tag: string, i: number) => (
              <span key={i} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.15)' }}>{tag}</span>
            ))}
          </div>
          {data.maturite && (
            <p className="text-xs opacity-60 mt-3">Maturité du business model</p>
          )}
        </div>
        {/* Score circle */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 text-center text-white">
          <div className="w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
            <span className="text-4xl font-black leading-none">{data.score_global ?? data.score ?? '—'}</span>
            <span className="text-[10px] opacity-50">%</span>
          </div>
          <p className="text-[10px] opacity-50 mt-2">Score BMC Global</p>
        </div>
      </div>

      {/* ===== CANVAS — VUE D'ENSEMBLE ===== */}
      <SectionTitle>CANVAS — VUE D'ENSEMBLE</SectionTitle>

      {/* 5-column grid row */}
      <div className="grid grid-cols-5 gap-px bg-border rounded-xl overflow-hidden mb-px">
        <CanvasCell title="PARTENAIRES CLÉS" items={toArr(canvas.partenaires_cles)} critical={canvas.partenaires_cles?.element_critique} />
        <CanvasCell title="ACTIVITÉS CLÉS" items={toArr(canvas.activites_cles)} critical={canvas.activites_cles?.element_critique} />
        <CanvasCell title="PROPOSITION DE VALEUR" items={canvas.proposition_valeur?.enonce ? [canvas.proposition_valeur.enonce, ...(canvas.proposition_valeur.avantages || [])] : toArr(canvas.proposition_valeur)} highlight />
        <CanvasCell title="RELATIONS CLIENTS" items={[canvas.relations_clients?.type, ...toArr(canvas.relations_clients?.items || canvas.relations_clients)].filter(Boolean)} />
        <CanvasCell title="SEGMENTS CLIENTS" items={[
          canvas.segments_clients?.principal,
          canvas.segments_clients?.zone ? `Zone: ${canvas.segments_clients.zone}` : null,
          canvas.segments_clients?.type_marche ? `Type: ${canvas.segments_clients.type_marche}` : null,
          canvas.segments_clients?.probleme_resolu ? `Problème résolu: ${canvas.segments_clients.probleme_resolu}` : null,
          canvas.segments_clients?.taille_marche ? `Taille marché: ${canvas.segments_clients.taille_marche}` : null,
          canvas.segments_clients?.intensite_besoin ? `Intensité besoin: ${canvas.segments_clients.intensite_besoin}` : null,
        ].filter(Boolean) as string[]} />
      </div>

      {/* RESSOURCES CLÉS (full width below canvas) */}
      <div className="bg-card border border-t-0 border-border rounded-b-xl p-5 mb-6">
        <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-primary mb-3">RESSOURCES CLÉS</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
          {canvas.ressources_cles?.categories ? (
            Object.entries(canvas.ressources_cles.categories).map(([key, val]: [string, any]) => (
              <div key={key}>
                <span className="font-semibold text-foreground capitalize">{key}: </span>
                <span>{val}</span>
              </div>
            ))
          ) : (
            toArr(canvas.ressources_cles).map((item, i) => (
              <div key={i}>• {item}</div>
            ))
          )}
        </div>
        {canvas.ressources_cles?.element_critique && (
          <p className="text-[11px] text-destructive font-semibold mt-2">⚠ CRITIQUE: {canvas.ressources_cles.element_critique}</p>
        )}
      </div>

      {/* STRUCTURE DE COÛTS + FLUX DE REVENUS (bottom row) */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Coûts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-primary mb-3">STRUCTURE DE COÛTS</h4>
          <div className="space-y-1.5">
            {(canvas.structure_couts?.postes || []).map((p: any, i: number) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-foreground">{p.libelle}</span>
                <span className="text-muted-foreground">{p.montant} ({p.type || ''} · {p.pourcentage}%)</span>
              </div>
            ))}
          </div>
          {canvas.structure_couts?.total_mensuel && (
            <p className="text-sm font-bold mt-3 pt-2 border-t border-border">TOTAL ≈ {canvas.structure_couts.total_mensuel}</p>
          )}
          {canvas.structure_couts?.cout_critique && (
            <p className="text-[11px] text-destructive font-medium mt-1">Coût critique: {canvas.structure_couts.cout_critique}</p>
          )}
        </div>

        {/* Revenus */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-primary mb-3">FLUX DE REVENUS</h4>
          <div className="space-y-1.5 text-xs">
            {canvas.flux_revenus?.produit_principal && <Row label="Produit principal" val={canvas.flux_revenus.produit_principal} />}
            {canvas.flux_revenus?.prix_moyen && <Row label="Prix moyen" val={canvas.flux_revenus.prix_moyen} />}
            {canvas.flux_revenus?.frequence_achat && <Row label="Fréquence d'achat" val={canvas.flux_revenus.frequence_achat} />}
            {canvas.flux_revenus?.volume_estime && <Row label="Volume estimé" val={canvas.flux_revenus.volume_estime} />}
            {canvas.flux_revenus?.mode_paiement && <Row label="Mode de paiement" val={canvas.flux_revenus.mode_paiement} />}
          </div>
          <div className="mt-3 pt-2 border-t border-border flex justify-between">
            {canvas.flux_revenus?.ca_mensuel && <div><p className="text-[10px] text-muted-foreground">CA mensuel</p><p className="text-sm font-bold">≈ {canvas.flux_revenus.ca_mensuel}</p></div>}
            {canvas.flux_revenus?.marge_brute && <div><p className="text-[10px] text-muted-foreground">Marge brute</p><p className="text-sm font-bold">≈ {canvas.flux_revenus.marge_brute}</p></div>}
          </div>
        </div>
      </div>

      {/* ===== DIAGNOSTIC EXPERT ===== */}
      <SectionTitle>DIAGNOSTIC EXPERT</SectionTitle>
      <p className="text-xs text-muted-foreground mb-4">
        Scores par bloc BMC — Score global : <strong className="text-foreground">{data.score_global ?? data.score ?? '—'}%</strong>
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {Object.entries(scores).map(([key, val]: [string, any]) => {
          const s = val?.score || 0;
          const color = scoreColor(s);
          return (
            <div key={key} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-foreground">{BLOC_LABELS[key] || key}</span>
                <span className="text-xs font-bold" style={{ color }}>{s}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${s}%`, backgroundColor: color }} />
              </div>
              {val?.commentaire && <p className="text-[10px] text-muted-foreground mt-1.5">{val.commentaire}</p>}
            </div>
          );
        })}
      </div>

      {/* Forces & Points de vigilance */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-card border rounded-xl p-5" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          <h4 className="text-sm font-bold mb-3" style={{ color: '#166534' }}>✅ Forces</h4>
          <ul className="space-y-1.5">
            {(diag.forces || []).map((f: string, i: number) => (
              <li key={i} className="text-xs text-foreground">• {f}</li>
            ))}
          </ul>
        </div>
        <div className="bg-card border rounded-xl p-5" style={{ borderColor: '#fef08a', background: '#fefce8' }}>
          <h4 className="text-sm font-bold mb-3" style={{ color: '#854d0e' }}>⚠️ Points de vigilance</h4>
          <ul className="space-y-1.5">
            {(diag.points_vigilance || []).map((p: string, i: number) => (
              <li key={i} className="text-xs text-foreground">• {p}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ===== MATRICE SWOT ===== */}
      <SectionTitle>MATRICE SWOT SYNTHÉTIQUE</SectionTitle>
      <div className="grid grid-cols-2 gap-3 mb-8">
        <SwotBox title="FORCES" items={swot.forces} bg="#f0fdf4" border="#bbf7d0" />
        <SwotBox title="FAIBLESSES" items={swot.faiblesses} bg="#fef2f2" border="#fecaca" />
        <SwotBox title="OPPORTUNITÉS" items={swot.opportunites} bg="#eff6ff" border="#bfdbfe" />
        <SwotBox title="MENACES" items={swot.menaces} bg="#fefce8" border="#fef08a" />
      </div>

      {/* ===== RECOMMANDATIONS STRATÉGIQUES ===== */}
      <SectionTitle>RECOMMANDATIONS STRATÉGIQUES</SectionTitle>
      <div className="space-y-4 mb-8">
        {reco.court_terme && (
          <RecoBlock emoji="📌" title="Court terme — Consolider les fondations" text={reco.court_terme} color="#22c55e" />
        )}
        {reco.moyen_terme && (
          <RecoBlock emoji="📈" title="Moyen terme — Croissance maîtrisée" text={reco.moyen_terme} color="#3b82f6" />
        )}
        {reco.long_terme && (
          <RecoBlock emoji="🚀" title="Long terme — Industrialisation et marque" text={reco.long_terme} color="#8b5cf6" />
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t border-border">
        <p className="text-[11px] text-muted-foreground">
          Document généré par ESONO — Investment Readiness Platform • {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1 italic">
          "Les chiffres ne servent pas à juger le passé, mais à décider le futur."
        </p>
      </div>
    </div>
  );
}

/* ===== Sub-components ===== */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground mb-4 pb-2 border-b-2 border-border">
      {children}
    </h2>
  );
}

function CanvasCell({ title, items, critical, highlight }: { title: string; items: string[]; critical?: string; highlight?: boolean }) {
  return (
    <div className={`bg-card p-4 min-h-[160px] ${highlight ? 'bg-primary/5' : ''}`}>
      <h4 className="text-[9px] font-black uppercase tracking-[0.12em] text-primary mb-2 pb-1.5 border-b border-border">
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-[11px] ${highlight && i === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            {highlight && i > 0 ? `✓ ${item}` : `• ${item}`}
          </li>
        ))}
      </ul>
      {critical && (
        <p className="text-[10px] text-destructive font-semibold mt-2">⚠ CRITIQUE: {critical}</p>
      )}
    </div>
  );
}

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{val}</span>
    </div>
  );
}

function SwotBox({ title, items, bg, border }: { title: string; items?: string[]; bg: string; border: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <h4 className="text-xs font-bold mb-2">{title}</h4>
      <ul className="space-y-1">
        {(items || []).map((item, i) => (
          <li key={i} className="text-[11px] text-foreground">• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function RecoBlock({ emoji, title, text, color }: { emoji: string; title: string; text: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5" style={{ borderLeftWidth: 4, borderLeftColor: color }}>
      <h4 className="text-sm font-bold mb-2">{emoji} {title}</h4>
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}
