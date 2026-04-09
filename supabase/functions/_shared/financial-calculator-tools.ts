/**
 * financial-calculator-tools.ts
 * 
 * Outils de calcul que l'IA peut appeler via tool_use pendant son analyse.
 * L'IA raisonne et croise les sources, mais ne fait JAMAIS de calcul de tête.
 * Chaque opération arithmétique passe par ces outils → 0 erreur de calcul.
 */

// ─── TOOL DEFINITIONS (pour l'API Claude) ──────────────────────

export const CALCULATOR_TOOLS = [
  {
    name: "calc",
    description: `Calculatrice financière. Utilise cet outil pour TOUTE opération arithmétique.
Ne fais JAMAIS de calcul de tête — appelle toujours cet outil.
Exemples d'expressions valides :
- "388000000 / 38880" (division simple)
- "10000 * 0.65" (pourcentage)  
- "3 * 350000 + 45 * 75000 + 35 * 110000 + 6 * 170000" (somme pondérée)
- "(692000000 - 498000000) / 692000000 * 100" (ratio en %)
- "round(9979.42, -2)" (arrondir aux centaines → 10000)
- "round(45600000, -3)" (arrondir aux milliers → 45600000)`,
    input_schema: {
      type: "object" as const,
      properties: {
        expression: {
          type: "string",
          description: "Expression mathématique à évaluer. Opérations supportées : +, -, *, /, **, %, round(), abs(), min(), max(), floor(), ceil(), sqrt()"
        },
        label: {
          type: "string",
          description: "Description courte de ce que le calcul représente (pour traçabilité)"
        }
      },
      required: ["expression"]
    }
  },
  {
    name: "verify_total",
    description: `Vérifie qu'une liste de composants totalise un montant cible.
Utilise pour la contrainte de cohérence : la somme des détails DOIT = le total réel.
Ex: vérifier que les salaires par catégorie = charges personnel totales.`,
    input_schema: {
      type: "object" as const,
      properties: {
        composants: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              montant: { type: "number" }
            },
            required: ["label", "montant"]
          },
          description: "Liste des composants avec leur montant"
        },
        total_cible: {
          type: "number",
          description: "Le total réel qui doit être atteint"
        },
        tolerance_pct: {
          type: "number",
          description: "Tolérance en % (défaut 5%)"
        }
      },
      required: ["composants", "total_cible"]
    }
  },
  {
    name: "estimate_breakdown",
    description: `Décompose un total en N catégories selon des poids relatifs, en s'assurant que la somme = total exact.
Utilise quand tu dois répartir un montant global entre sous-postes.
Ex: répartir 95M de charges personnel entre Direction (poids 3), Production (poids 45), Distribution (poids 35), Admin (poids 6).`,
    input_schema: {
      type: "object" as const,
      properties: {
        total: {
          type: "number",
          description: "Le montant total à répartir"
        },
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              poids: { type: "number", description: "Poids relatif (ex: effectif, ou ratio estimé)" },
              multiplicateur: { type: "number", description: "Optionnel — multiplicateur unitaire (ex: salaire mensuel × 12)" }
            },
            required: ["label", "poids"]
          }
        },
        arrondi: {
          type: "number",
          description: "Arrondi (1000 = arrondir aux milliers). Défaut: 1000"
        }
      },
      required: ["total", "categories"]
    }
  },
  {
    name: "project_series",
    description: `Projette une série de valeurs sur N années à partir d'une valeur initiale et d'un taux de croissance.
Retourne la série complète. Utilise pour les projections de CA, OPEX, volumes, etc.`,
    input_schema: {
      type: "object" as const,
      properties: {
        valeur_initiale: { type: "number" },
        taux_croissance: { type: "number", description: "Ex: 0.20 pour +20%/an" },
        nb_annees: { type: "number", description: "Nombre d'années à projeter (défaut 5)" },
        arrondi: { type: "number", description: "Arrondi (défaut 1000)" },
        historique_arriere: {
          type: "boolean",
          description: "Si true, projette aussi 2 ans en arrière (Y-2, Y-1)"
        }
      },
      required: ["valeur_initiale", "taux_croissance"]
    }
  },
  {
    name: "ratio_check",
    description: `Calcule un ratio et le compare à un benchmark sectoriel.
Retourne la valeur, le statut (bon/attention/critique) et un commentaire.`,
    input_schema: {
      type: "object" as const,
      properties: {
        numerateur: { type: "number" },
        denominateur: { type: "number" },
        nom_ratio: { type: "string", description: "Ex: 'Marge brute'" },
        benchmark_min: { type: "number", description: "Borne basse du benchmark" },
        benchmark_max: { type: "number", description: "Borne haute du benchmark" },
        format: { type: "string", description: "'pct' pour pourcentage, 'ratio' pour ratio, 'jours' pour jours" }
      },
      required: ["numerateur", "denominateur", "nom_ratio"]
    }
  }
];

// ─── TOOL EXECUTION ────────────────────────────────────────────

export function executeCalculatorTool(
  toolName: string,
  input: Record<string, any>,
): Record<string, any> {
  switch (toolName) {
    case "calc":
      return executeCalc(input);
    case "verify_total":
      return executeVerifyTotal(input);
    case "estimate_breakdown":
      return executeEstimateBreakdown(input);
    case "project_series":
      return executeProjectSeries(input);
    case "ratio_check":
      return executeRatioCheck(input);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── CALC ──────────────────────────────────────────────────────

function executeCalc(input: { expression: string; label?: string }): Record<string, any> {
  try {
    // Safe math eval — only arithmetic, no code execution
    const expr = input.expression
      .replace(/round\(/g, "Math.round(")
      .replace(/abs\(/g, "Math.abs(")
      .replace(/min\(/g, "Math.min(")
      .replace(/max\(/g, "Math.max(")
      .replace(/floor\(/g, "Math.floor(")
      .replace(/ceil\(/g, "Math.ceil(")
      .replace(/sqrt\(/g, "Math.sqrt(")
      .replace(/pow\(/g, "Math.pow(");

    // Block dangerous JS keywords before any evaluation
    if (/\b(constructor|prototype|__proto__|this|window|global|globalThis|import|require|eval|Function|fetch|Deno|process|Buffer)\b/i.test(expr)) {
      return { error: "Expression contient un mot-clé interdit", expression: input.expression };
    }

    // Validate: only numbers, operators, Math functions, parentheses, commas, dots, spaces, minus
    if (!/^[\d\s+\-*/().,%eE^Math.roundabsminmaxflceilsqrtpow]+$/.test(expr.replace(/Math\.\w+/g, ""))) {
      return { error: "Expression invalide — uniquement arithmétique autorisée", expression: input.expression };
    }

    // Custom round(value, digits) — supports negative digits for rounding to 1000s
    const safeExpr = expr.replace(
      /Math\.round\(([^,]+),\s*(-?\d+)\)/g,
      (_, val, digits) => {
        const d = parseInt(digits);
        if (d < 0) {
          const factor = Math.pow(10, -d);
          return `(Math.round((${val})/${factor})*${factor})`;
        }
        const factor = Math.pow(10, d);
        return `(Math.round((${val})*${factor})/${factor})`;
      }
    );

    const result = new Function(`"use strict"; return (${safeExpr})`)();

    if (typeof result === "number" && !isFinite(result)) {
      return { error: "Division par zéro ou résultat infini", expression: input.expression, label: input.label || "" };
    }

    return {
      resultat: result,
      resultat_arrondi: typeof result === "number" ? Math.round(result * 100) / 100 : result,
      expression: input.expression,
      label: input.label || "",
    };
  } catch (err) {
    return { error: `Erreur de calcul: ${err}`, expression: input.expression };
  }
}

// ─── VERIFY TOTAL ──────────────────────────────────────────────

function executeVerifyTotal(input: {
  composants: Array<{ label: string; montant: number }>;
  total_cible: number;
  tolerance_pct?: number;
}): Record<string, any> {
  const tolerance = input.tolerance_pct || 5;
  const somme = input.composants.reduce((s, c) => s + c.montant, 0);
  const ecart = somme - input.total_cible;
  const ecart_pct = input.total_cible !== 0 ? (ecart / input.total_cible) * 100 : 0;
  const ok = Math.abs(ecart_pct) <= tolerance;

  return {
    somme,
    total_cible: input.total_cible,
    ecart,
    ecart_pct: Math.round(ecart_pct * 10) / 10,
    statut: ok ? "OK" : "ÉCART TROP GRAND",
    message: ok
      ? `Somme ${somme.toLocaleString("fr-FR")} ≈ cible ${input.total_cible.toLocaleString("fr-FR")} (écart ${ecart_pct.toFixed(1)}%)`
      : `ATTENTION: Somme ${somme.toLocaleString("fr-FR")} vs cible ${input.total_cible.toLocaleString("fr-FR")} — écart ${ecart_pct.toFixed(1)}% (tolérance ${tolerance}%)`,
    detail: input.composants.map(c => ({
      label: c.label,
      montant: c.montant,
      pct_du_total: Math.round((c.montant / (input.total_cible || 1)) * 1000) / 10,
    })),
  };
}

// ─── ESTIMATE BREAKDOWN ────────────────────────────────────────

function executeEstimateBreakdown(input: {
  total: number;
  categories: Array<{ label: string; poids: number; multiplicateur?: number }>;
  arrondi?: number;
}): Record<string, any> {
  const arrondi = input.arrondi || 1000;

  // If multiplicateur provided, use weighted allocation
  // poids × multiplicateur = coût brut par catégorie
  // Then scale to match total

  const hasMultiplicateur = input.categories.some(c => c.multiplicateur !== undefined);

  let results: Array<{ label: string; montant: number; pct: number }>;

  if (hasMultiplicateur) {
    // Weighted: poids (effectif) × multiplicateur (salaire × 12) = coût brut
    const bruts = input.categories.map(c => ({
      label: c.label,
      brut: c.poids * (c.multiplicateur || 1),
    }));
    const totalBrut = bruts.reduce((s, b) => s + b.brut, 0);
    const scaleFactor = totalBrut > 0 ? input.total / totalBrut : 1;

    results = bruts.map(b => ({
      label: b.label,
      montant: Math.round((b.brut * scaleFactor) / arrondi) * arrondi,
      pct: Math.round((b.brut / (totalBrut || 1)) * 1000) / 10,
    }));
  } else {
    // Simple proportional: poids relatifs
    const totalPoids = input.categories.reduce((s, c) => s + c.poids, 0);
    results = input.categories.map(c => ({
      label: c.label,
      montant: Math.round(((c.poids / (totalPoids || 1)) * input.total) / arrondi) * arrondi,
      pct: Math.round((c.poids / (totalPoids || 1)) * 1000) / 10,
    }));
  }

  // Adjust last item to ensure exact total
  const somme = results.reduce((s, r) => s + r.montant, 0);
  const diff = input.total - somme;
  if (results.length > 0 && Math.abs(diff) > 0) {
    results[results.length - 1].montant += diff;
  }

  const finalSomme = results.reduce((s, r) => s + r.montant, 0);

  return {
    total_cible: input.total,
    total_reparti: finalSomme,
    ecart: finalSomme - input.total,
    repartition: results,
    message: `${results.length} postes répartis, total = ${finalSomme.toLocaleString("fr-FR")} (cible ${input.total.toLocaleString("fr-FR")})`,
  };
}

// ─── PROJECT SERIES ────────────────────────────────────────────

function executeProjectSeries(input: {
  valeur_initiale: number;
  taux_croissance: number;
  nb_annees?: number;
  arrondi?: number;
  historique_arriere?: boolean;
}): Record<string, any> {
  const n = input.nb_annees || 5;
  const arrondi = input.arrondi || 1000;
  const g = input.taux_croissance;
  const v0 = input.valeur_initiale;

  const series: Array<{ annee: string; valeur: number }> = [];

  // Historique arrière (Y-2, Y-1)
  if (input.historique_arriere) {
    series.push({ annee: "YEAR-2", valeur: Math.round((v0 / Math.pow(1 + g, 2)) / arrondi) * arrondi });
    series.push({ annee: "YEAR-1", valeur: Math.round((v0 / (1 + g)) / arrondi) * arrondi });
  }

  // Année courante
  series.push({ annee: "CURRENT YEAR", valeur: Math.round(v0 / arrondi) * arrondi });

  // Projections
  for (let i = 1; i <= n; i++) {
    series.push({
      annee: `YEAR${i + 1}`,
      valeur: Math.round((v0 * Math.pow(1 + g, i)) / arrondi) * arrondi,
    });
  }

  return {
    valeur_initiale: v0,
    taux_croissance: `${(g * 100).toFixed(1)}%`,
    serie: series,
    valeur_finale: series[series.length - 1].valeur,
    multiplicateur: Math.round(Math.pow(1 + g, n) * 100) / 100,
  };
}

// ─── RATIO CHECK ───────────────────────────────────────────────

function executeRatioCheck(input: {
  numerateur: number;
  denominateur: number;
  nom_ratio: string;
  benchmark_min?: number;
  benchmark_max?: number;
  format?: string;
}): Record<string, any> {
  if (input.denominateur === 0) {
    return { error: "Dénominateur est zéro — ratio impossible à calculer", nom: input.nom_ratio, valeur: null, valeur_affichee: "N/A", statut: "erreur" };
  }
  const val = input.numerateur / input.denominateur;
  const fmt = input.format || "pct";

  let valeur_affichee: string;
  let valeur_brute: number;

  if (fmt === "pct") {
    valeur_brute = Math.round(val * 1000) / 10;
    valeur_affichee = `${valeur_brute}%`;
  } else if (fmt === "jours") {
    valeur_brute = Math.round(val * 365 * 10) / 10;
    valeur_affichee = `${valeur_brute} jours`;
  } else {
    valeur_brute = Math.round(val * 100) / 100;
    valeur_affichee = `${valeur_brute}x`;
  }

  let statut = "neutre";
  if (input.benchmark_min !== undefined && input.benchmark_max !== undefined) {
    if (valeur_brute >= input.benchmark_min && valeur_brute <= input.benchmark_max) {
      statut = "conforme";
    } else if (valeur_brute < input.benchmark_min) {
      statut = valeur_brute < input.benchmark_min * 0.5 ? "critique" : "faible";
    } else {
      statut = "au-dessus";
    }
  }

  return {
    nom: input.nom_ratio,
    valeur: valeur_brute,
    valeur_affichee: valeur_affichee,
    benchmark: input.benchmark_min !== undefined ? `${input.benchmark_min}-${input.benchmark_max}` : "N/A",
    statut,
    calcul: `${input.numerateur.toLocaleString("fr-FR")} / ${input.denominateur.toLocaleString("fr-FR")}`,
  };
}
