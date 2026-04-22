import { Badge } from "@/components/ui/badge";
import { useTranslation } from 'react-i18next';

interface MarketAnalysisProps {
  marche: Record<string, any>;
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const isWeb = source.toLowerCase().includes("web");
  const isIA = source.toLowerCase().includes("ia") || source.toLowerCase().includes("estimation");
  const icon = isWeb ? "🌐" : isIA ? "🤖" : "📋";
  const label = isWeb ? "web" : isIA ? "estimation IA" : source;
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/60 italic ml-1">
      {icon} {label}
    </span>
  );
}

function PositionBadge({ position }: { position: string }) {
  const cls =
    position.toLowerCase().includes("leader")
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : position.toLowerCase().includes("niche")
        ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"
        : "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{position}</span>;
}

export default function MarketAnalysisSection({ marche }: MarketAnalysisProps) {
  const tm = marche.taille_marche || {};
  const dyn = marche.dynamique || {};
  const concurrents: any[] = marche.concurrents || [];
  const pos = marche.positionnement_entreprise || marche.positionnement || {};

  // Support both flat (old) and nested (new) field names
  const tam = tm.tam || marche.tam;
  const sam = tm.sam || marche.sam;
  const som = tm.som || marche.som;
  const tmSource = tm.source || marche.source_taille;

  const croissance = dyn.croissance_annuelle || marche.croissance;
  const facteurs = dyn.facteurs_porteurs || marche.facteurs_porteurs || [];
  const barrieres = dyn.barrieres_entree || marche.barrieres_entree || [];
  const reglementation = dyn.reglementation || marche.reglementation;

  return (
    <div className="space-y-5">
      {/* TAM / SAM / SOM */}
      {(tam || sam || som) && (
        <div>
          <p className="font-medium text-muted-foreground mb-2">📊 Taille du marché</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "TAM", sub: "Marché total", value: tam },
              { label: "SAM", sub: "Segment accessible", value: sam },
              { label: "SOM", sub: "Part réaliste", value: som },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                <p className="text-[10px] font-semibold text-muted-foreground tracking-wide">{m.label}</p>
                <p className="text-sm font-bold mt-1">{m.value || "—"}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{m.sub}</p>
              </div>
            ))}
          </div>
          {tmSource && (
            <p className="text-[10px] text-muted-foreground/60 italic mt-1.5">Source : {tmSource}</p>
          )}
        </div>
      )}

      {/* Dynamique */}
      {(croissance || facteurs.length > 0 || barrieres.length > 0) && (
        <div>
          <p className="font-medium text-muted-foreground mb-2">📈 Dynamique du marché</p>
          {croissance && (
            <p className="text-sm mb-2">
              Croissance : <span className="font-semibold text-emerald-600 dark:text-emerald-400">{croissance}</span>
            </p>
          )}
          {facteurs.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-muted-foreground mb-1">Facteurs porteurs :</p>
              <ul className="space-y-0.5">
                {facteurs.map((f: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5">✅</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {barrieres.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-muted-foreground mb-1">Barrières à l'entrée :</p>
              <ul className="space-y-0.5">
                {barrieres.map((b: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">⚠️</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reglementation && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">📋 Réglementation</p>
              <p className="text-sm">{reglementation}</p>
            </div>
          )}
        </div>
      )}

      {/* Concurrents */}
      {concurrents.length > 0 && (
        <div>
          <p className="font-medium text-muted-foreground mb-2">🏢 Concurrents</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left px-3 py-2 font-semibold border-b border-border">Concurrent</th>
                  <th className="text-left px-3 py-2 font-semibold border-b border-border">Positionnement</th>
                  <th className="text-left px-3 py-2 font-semibold border-b border-border">Forces</th>
                  <th className="text-left px-3 py-2 font-semibold border-b border-border">Faiblesses</th>
                  <th className="text-left px-3 py-2 font-semibold border-b border-border">Taille</th>
                </tr>
              </thead>
              <tbody>
                {concurrents.map((c: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                    <td className="px-3 py-2 border-b border-border font-medium align-top">
                      {c.nom}
                      <SourceBadge source={c.source} />
                    </td>
                    <td className="px-3 py-2 border-b border-border align-top">{c.positionnement || "—"}</td>
                    <td className="px-3 py-2 border-b border-border align-top">
                      <ul className="space-y-0.5">
                        {(Array.isArray(c.forces) ? c.forces : []).map((f: string, j: number) => (
                          <li key={j} className="flex items-start gap-1">
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] px-1.5 py-0 shrink-0">+</Badge>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2 border-b border-border align-top">
                      <ul className="space-y-0.5">
                        {(Array.isArray(c.faiblesses) ? c.faiblesses : []).map((f: string, j: number) => (
                          <li key={j} className="flex items-start gap-1">
                            <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 text-[10px] px-1.5 py-0 shrink-0">−</Badge>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2 border-b border-border align-top whitespace-nowrap">{c.taille_estimee || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Positionnement */}
      {pos && (pos.position || pos.avantages_concurrentiels?.length > 0 || pos.differenciation) && (
        <div>
          <p className="font-medium text-muted-foreground mb-2">🎯 Positionnement de l'entreprise</p>
          {pos.position && (
            <p className="text-sm mb-2">Position : <PositionBadge position={pos.position} /></p>
          )}
          {pos.avantages_concurrentiels?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-muted-foreground mb-1">Avantages concurrentiels :</p>
              <ul className="space-y-0.5">
                {pos.avantages_concurrentiels.map((a: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-1.5">
                    <span className="mt-0.5">💪</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pos.differenciation && (
            <p className="text-sm italic text-muted-foreground mb-1">
              <span className="font-medium not-italic text-foreground">Différenciation : </span>{pos.differenciation}
            </p>
          )}
          {pos.parts_marche_estimee && (
            <p className="text-sm">Part de marché estimée : <span className="font-semibold">{pos.parts_marche_estimee}</span></p>
          )}
          {pos.points_a_renforcer?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Points à renforcer :</p>
              <ul className="space-y-0.5">
                {pos.points_a_renforcer.map((p: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">⚠️</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
