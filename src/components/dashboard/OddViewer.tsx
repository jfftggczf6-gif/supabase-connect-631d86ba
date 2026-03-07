import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ODD_COLORS: Record<string, string> = {
  "1": "#E5243B", "2": "#DDA63A", "3": "#4C9F38", "4": "#C5192D", "5": "#FF3A21",
  "6": "#26BDE2", "7": "#FCC30B", "8": "#A21942", "9": "#FD6925", "10": "#DD1367",
  "11": "#FD9D24", "12": "#BF8B2E", "13": "#3F7E44", "14": "#0A97D9", "15": "#56C02B",
  "16": "#00689D", "17": "#19486A",
};

const ODD_NAMES: Record<string, string> = {
  "1": "Éliminer la pauvreté", "2": "Éliminer la faim", "3": "Bonne santé",
  "4": "Éducation de qualité", "5": "Égalité des genres", "6": "Eau propre",
  "7": "Énergie propre", "8": "Travail décent", "9": "Innovation",
  "10": "Réduction inégalités", "11": "Villes durables", "12": "Consommation responsable",
  "13": "Lutte climatique", "14": "Vie aquatique", "15": "Vie terrestre",
  "16": "Paix et justice", "17": "Partenariats",
};

interface Cible {
  target_id: string;
  target_description: string;
  evaluation: "positif" | "neutre" | "negatif";
  justification: string;
  info_additionnelle?: string;
  odd_parent: string;
}

interface OddData {
  metadata?: { nom_entreprise?: string; total_cibles_evaluees?: number };
  evaluation_cibles_odd?: {
    cibles?: Cible[];
    resume_par_odd?: Record<string, {
      nom: string;
      score: number;
      cibles_positives: number;
      cibles_neutres: number;
      cibles_negatives: number;
    }>;
  };
  indicateurs_impact?: { indicateurs?: Array<{
    target_id: string;
    indicateur_officiel_onu: string;
    indicateur_ovo?: string;
    valeur?: string;
  }> };
  circularite?: { evaluation: string; pratiques: string[]; cibles_odd_liees: string[] };
  synthese?: { odd_prioritaires: string[]; contribution_globale: string; recommandations: string[] };
}

interface OddViewerProps {
  data: OddData;
}

function EvalBadge({ evaluation }: { evaluation: string }) {
  if (evaluation === "positif") {
    return <Badge className="bg-green-100 text-green-800 border-green-200">🟢 Positif</Badge>;
  }
  if (evaluation === "neutre") {
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">🟡 Neutre</Badge>;
  }
  if (evaluation === "negatif") {
    return <Badge className="bg-red-100 text-red-800 border-red-200">🔴 Négatif</Badge>;
  }
  return <Badge variant="outline">—</Badge>;
}

export function OddViewer({ data }: OddViewerProps) {
  const cibles = data.evaluation_cibles_odd?.cibles ?? [];
  const resumeOdd = data.evaluation_cibles_odd?.resume_par_odd ?? {};
  const indicateurs = data.indicateurs_impact?.indicateurs ?? [];
  const synthese = {
    odd_prioritaires: Array.isArray(data.synthese?.odd_prioritaires) ? data.synthese.odd_prioritaires : [],
    contribution_globale: data.synthese?.contribution_globale ?? "",
    recommandations: Array.isArray(data.synthese?.recommandations) ? data.synthese.recommandations : [],
  };
  const circularite = {
    evaluation: data.circularite?.evaluation ?? "",
    pratiques: Array.isArray(data.circularite?.pratiques) ? data.circularite.pratiques : [],
    cibles_odd_liees: Array.isArray(data.circularite?.cibles_odd_liees) ? data.circularite.cibles_odd_liees : [],
  };

  const totalPositifs = cibles.filter(c => c.evaluation === "positif").length;
  const totalNeutres = cibles.filter(c => c.evaluation === "neutre").length;
  const totalNegatifs = cibles.filter(c => c.evaluation === "negatif").length;
  const scoreGlobal = cibles.length > 0 ? Math.round((totalPositifs / cibles.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Score global */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            🌍 ODD — Objectifs de Développement Durable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-3xl font-bold text-blue-700">{scoreGlobal}%</div>
              <div className="text-xs text-muted-foreground mt-1">Score global</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">{totalPositifs}</div>
              <div className="text-xs text-muted-foreground mt-1">Positif</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-700">{totalNeutres}</div>
              <div className="text-xs text-muted-foreground mt-1">Neutre</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-700">{totalNegatifs}</div>
              <div className="text-xs text-muted-foreground mt-1">Négatif</div>
            </div>
          </div>
          {synthese.contribution_globale && (
            <p className="mt-4 text-sm text-muted-foreground bg-muted/50 rounded p-3">
              {synthese.contribution_globale}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="cibles">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="cibles">Cibles ({cibles.length})</TabsTrigger>
          <TabsTrigger value="resume">Résumé par ODD</TabsTrigger>
          <TabsTrigger value="indicateurs">Indicateurs</TabsTrigger>
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
        </TabsList>

        {/* Tab 1: All targets */}
        <TabsContent value="cibles">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {cibles.map((cible) => (
                  <div key={cible.target_id} className="p-4 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: ODD_COLORS[cible.odd_parent] ?? "#666" }}
                          >
                            {cible.target_id}
                          </span>
                          <EvalBadge evaluation={cible.evaluation} />
                        </div>
                        <p className="text-sm font-medium">{cible.target_description}</p>
                        {cible.justification && (
                          <p className="text-xs text-muted-foreground mt-1">{cible.justification}</p>
                        )}
                        {cible.info_additionnelle && (
                          <p className="text-xs text-primary mt-1 italic">{cible.info_additionnelle}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Summary by SDG */}
        <TabsContent value="resume">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(resumeOdd).map(([key, odd]) => {
              const oddNum = key.replace("odd_", "");
              const color = ODD_COLORS[oddNum] ?? "#666";
              const total = Math.max(odd.cibles_positives + odd.cibles_neutres + odd.cibles_negatives, 1);
              return (
                <Card key={key} className="overflow-hidden">
                  <div className="h-1.5" style={{ backgroundColor: color }} />
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-7 h-7 rounded text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {oddNum}
                      </span>
                      <span className="text-sm font-semibold">
                        {ODD_NAMES[oddNum] ?? odd.nom}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <div
                        className="h-2 rounded-full bg-green-400"
                        style={{ width: `${(odd.cibles_positives / total) * 100}%` }}
                      />
                      <div
                        className="h-2 rounded-full bg-yellow-400"
                        style={{ width: `${(odd.cibles_neutres / total) * 100}%` }}
                      />
                      <div
                        className="h-2 rounded-full bg-red-400"
                        style={{ width: `${(odd.cibles_negatives / total) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>+{odd.cibles_positives}</span>
                      <span className="font-bold" style={{ color }}>{odd.score}%</span>
                      <span>-{odd.cibles_negatives}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 3: Indicators */}
        <TabsContent value="indicateurs">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground w-16">Cible</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Indicateur ONU</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Indicateur OVO</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground w-24">Valeur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {indicateurs.map((ind, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs text-muted-foreground">{ind.target_id}</td>
                        <td className="p-3 text-xs">{ind.indicateur_officiel_onu}</td>
                        <td className="p-3 text-xs text-primary">{ind.indicateur_ovo ?? "—"}</td>
                        <td className="p-3 text-xs font-medium">{ind.valeur ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Synthesis */}
        <TabsContent value="synthese">
          <div className="space-y-4">
            {synthese.odd_prioritaires.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">ODD Prioritaires</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {synthese.odd_prioritaires.map((oddNum) => (
                      <span
                        key={oddNum}
                        className="px-3 py-1.5 rounded-full text-white text-sm font-medium"
                        style={{ backgroundColor: ODD_COLORS[oddNum] ?? "#666" }}
                      >
                        ODD {oddNum} — {ODD_NAMES[oddNum] ?? ""}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {synthese.recommandations.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recommandations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {synthese.recommandations.map((rec, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-primary font-bold mt-0.5">→</span>
                        <span className="text-muted-foreground">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {circularite.evaluation && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Économie Circulaire</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{circularite.evaluation}</p>
                  {circularite.pratiques.length > 0 && (
                    <ul className="space-y-1">
                      {circularite.pratiques.map((p, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1">
                          <span className="text-green-500">♻</span> {p}
                        </li>
                      ))}
                    </ul>
                  )}
                  {circularite.cibles_odd_liees.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {circularite.cibles_odd_liees.map((id) => (
                        <span key={id} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
                          {id}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
