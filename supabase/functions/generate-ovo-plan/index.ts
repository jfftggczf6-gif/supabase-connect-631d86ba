/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ESONO — Supabase Edge Function : generate-ovo-plan                ║
 * ║  Génère le Plan Financier OVO (.xlsm) depuis les données client    ║
 * ║                                                                      ║
 * ║  Pipeline :                                                          ║
 * ║    1. Reçoit les données entrepreneur (POST JSON)                   ║
 * ║    2. Appelle Claude API → JSON financier structuré                 ║
 * ║    3. Télécharge le template .xlsm depuis Supabase Storage          ║
 * ║    4. Injecte les valeurs cellule par cellule via manipulation ZIP  ║
 * ║    5. Upload le fichier rempli dans Supabase Storage                ║
 * ║    6. Retourne l'URL de téléchargement                              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Deploy : supabase functions deploy generate-ovo-plan
 * Env vars requis :
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────

interface EntrepreneurData {
  user_id: string;
  company: string;
  country: string;
  sector: string;
  business_model: string;
  products: Array<{ name: string; description: string; price?: number }>;
  services: Array<{ name: string; description: string; price?: number }>;
  current_year: number;
  employees?: number;
  existing_revenue?: number;
  startup_costs?: number;
  loan_needed?: number;
  bmc_data?: Record<string, unknown>;
  sic_data?: Record<string, unknown>;
}

interface CellWrite {
  sheet: string;
  row: number;
  col: number;   // 1-indexé : A=1, B=2, ..., Z=26, AA=27 ...
  value: string | number | null;
  type: "string" | "number" | "date";
}

// ─────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────

const TEMPLATE_BUCKET = "ovo-templates";
const TEMPLATE_FILE   = "251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm";
const OUTPUT_BUCKET   = "ovo-outputs";

const COL: Record<string, number> = {
  A:1,  B:2,  C:3,  D:4,  E:5,  F:6,  G:7,  H:8,  I:9,  J:10,
  K:11, L:12, M:13, N:14, O:15, P:16, Q:17, R:18, S:19, T:20,
  U:21, V:22, W:23, X:24, Y:25, Z:26,
  AA:27, AB:28, AC:29, AD:30, AE:31, AF:32, AG:33, AH:34,
  AI:35, AJ:36, AK:37, AL:38, AM:39, AN:40, AO:41, AP:42,
  AQ:43, AR:44, AS:45,
};

/** Ligne header RevenueData par slot produit */
const PRODUCT_HEADER: Record<number, number> = {
   1:8,   2:50,  3:92,  4:134, 5:176,
   6:218, 7:260, 8:302, 9:344, 10:386,
  11:428,12:470,13:512,14:554,15:596,
  16:638,17:680,18:722,19:764,20:806,
};

/** Ligne header RevenueData par slot service */
const SERVICE_HEADER: Record<number, number> = {
   1:848,  2:890,  3:932,  4:974,  5:1016,
   6:1058, 7:1100, 8:1142, 9:1184, 10:1226,
};

/** yearLabel → index 0-7 pour les lignes VOLUME */
const YEAR_IDX: Record<string, number> = {
  "YEAR-2":0, "YEAR-1":1, "CURRENT YEAR":2,
  "YEAR2":3, "YEAR3":4, "YEAR4":5, "YEAR5":6, "YEAR6":7,
};

/** Mapping yearLabel → colonne FinanceData (O-X) */
const YEAR_FIN_COL: Record<string, string> = {
  "YEAR-2":"O", "YEAR-1":"P", "H1":"Q", "H2":"R",
  "CURRENT YEAR":"S", "YEAR2":"T", "YEAR3":"U",
  "YEAR4":"V", "YEAR5":"W", "YEAR6":"X",
};

// Mapping feuille nom → fichier XML dans le ZIP
const SHEET_FILES: Record<string, string> = {
  "ReadMe":     "xl/worksheets/sheet1.xml",
  "Instructions":"xl/worksheets/sheet2.xml",
  "InputsData": "xl/worksheets/sheet3.xml",
  "RevenueData":"xl/worksheets/sheet4.xml",
  "FinanceData":"xl/worksheets/sheet7.xml",
};

// ─────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // ── Auth: vérifier le JWT ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ success: false, error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const data: EntrepreneurData = await req.json();

    // ── Validation: sécuriser products/services ───────────────────────
    if (!Array.isArray(data.products)) data.products = [];
    if (!Array.isArray(data.services)) data.services = [];

    console.log(`[generate-ovo-plan] START — user: ${authUser.id}, company: ${data.company}`);

    // ── Étape 1 : Appel Claude API ─────────────────────────────────────
    console.log("[generate-ovo-plan] Calling Claude API...");
    const financialJson = await callClaudeAPI(data);

    // ── Étape 2 : Télécharger le template ─────────────────────────────
    console.log("[generate-ovo-plan] Downloading template...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: templateBlob, error: dlError } = await supabase.storage
      .from(TEMPLATE_BUCKET)
      .download(TEMPLATE_FILE);

    if (dlError || !templateBlob) {
      throw new Error(`Template download failed: ${dlError?.message}`);
    }

    const templateBuffer = await templateBlob.arrayBuffer();

    // ── Étape 3 : Construire la liste des cellules à écrire ────────────
    console.log("[generate-ovo-plan] Building cell writes...");
    const cellWrites = buildCellWrites(financialJson);
    console.log(`[generate-ovo-plan] ${cellWrites.length} cells to write`);

    // ── Étape 4 : Injecter les valeurs dans le ZIP ─────────────────────
    console.log("[generate-ovo-plan] Injecting values into Excel...");
    const filledBuffer = await injectIntoXlsm(templateBuffer, cellWrites);

    // ── Étape 5 : Upload vers Supabase Storage ─────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const outputFileName = `PlanFinancier_${sanitize(data.company)}_OVO_${timestamp}.xlsm`;

    console.log(`[generate-ovo-plan] Uploading ${outputFileName}...`);
    const { error: uploadError } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .upload(outputFileName, filledBuffer, {
        contentType: "application/vnd.ms-excel.sheet.macroEnabled.12",
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .createSignedUrl(outputFileName, 86400); // 24 heures

    console.log("[generate-ovo-plan] SUCCESS");

    return new Response(
      JSON.stringify({
        success: true,
        file_name: outputFileName,
        download_url: urlData?.signedUrl,
        cells_written: cellWrites.length,
        financial_summary: extractSummary(financialJson),
      }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[generate-ovo-plan] ERROR:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});

// ─────────────────────────────────────────────────────────────────────
// ÉTAPE 1 : APPEL CLAUDE API
// ─────────────────────────────────────────────────────────────────────

async function callClaudeAPI(data: EntrepreneurData): Promise<Record<string, unknown>> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt  = buildUserPrompt(data);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[Claude] Attempt ${attempt}/3`);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 32768,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      
      // Vérifier si la réponse a été tronquée
      const stopReason = result.stop_reason;
      if (stopReason === "max_tokens") {
        console.warn("[Claude] Response truncated (max_tokens reached), attempting JSON repair...");
      }

      const rawText = result.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");

      // Nettoyer les backticks markdown si présents
      let cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      // Tentative de réparation JSON si tronqué
      try {
        return JSON.parse(cleaned);
      } catch (parseErr) {
        if (stopReason === "max_tokens") {
          console.warn("[Claude] Repairing truncated JSON...");
          // Supprimer les entrées incomplètes (per_year arrays, objets partiels)
          cleaned = cleaned.replace(/,\s*\{[^}]*$/g, "");
          cleaned = cleaned.replace(/,\s*\[[^\]]*$/g, "");
          cleaned = cleaned.replace(/,\s*"[^"]*"?\s*:?\s*[^}\]]*$/g, "");
          cleaned = cleaned.replace(/,\s*"per_year"\s*:\s*\[[^\]]*$/g, "");
          // Nettoyer les virgules trailing
          cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
          // Fermer les structures ouvertes
          const openBraces = (cleaned.match(/{/g) || []).length;
          const closeBraces = (cleaned.match(/}/g) || []).length;
          const openBrackets = (cleaned.match(/\[/g) || []).length;
          const closeBrackets = (cleaned.match(/]/g) || []).length;
          for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += "]";
          for (let i = 0; i < openBraces - closeBraces; i++) cleaned += "}";
          const parsed = JSON.parse(cleaned);
          console.log("[Claude] JSON repair successful");
          return parsed;
        }
        throw parseErr;
      }

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[Claude] Attempt ${attempt} failed:`, lastError.message);
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }

  throw new Error(`Claude API failed after 3 attempts: ${lastError?.message}`);
}

// ─────────────────────────────────────────────────────────────────────
// CONSTRUCTION DU PROMPT SYSTÈME
// ─────────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `Tu es un expert financier spécialisé dans les PME africaines (Afrique de l'Ouest, zone FCFA/XOF).
Tu génères un plan financier OVO structuré sur 8 périodes pour un entrepreneur.

CONTEXTE FISCAL CÔTE D'IVOIRE (2025) :
- Devise : XOF (FCFA) — taux fixe 655.957 XOF/EUR
- TVA : 18% (0.18)
- IS régime simplifié (revenus ≤ 200M FCFA) : 4% du CA (0.04)
- IS régime réel (revenus > 200M FCFA) : 30% du bénéfice (0.30)
- Cotisations sociales patronales : 16.45% du salaire brut (0.1645)
- Inflation estimée : 3%/an (0.03)
- Charges bancaires : ~1% des revenus (0.01)

RÈGLES DE PROJECTION RÉALISTES :
- Croissance max 30%/an les 3 premières années de prévision, 15-20% ensuite
- Marge brute produits physiques : 30-60% selon secteur
- Marge brute services : 60-85% selon complexité
- Staff : effectif réel uniquement, pas de sur-estimation
- YEAR-2 et YEAR-1 = données historiques ou 0 si startup
- Volumes = entiers (jamais décimaux)
- Montants = FCFA, arrondir à 1000 FCFA près

CONTRAINTES TECHNIQUES EXCEL :
- Pour chaque produit/service actif : mix_r1 + mix_r2 + mix_r3 = 1.0 EXACTEMENT
- Pour chaque gamme utilisée : mix_ch1 + mix_ch2 = 1.0 EXACTEMENT
- Si gamme non utilisée : prix=0, cogs=0, mix=0
- Produit inactif (active=false) : TOUS volumes, prix et mix à 0

SORTIE OBLIGATOIRE :
- UNIQUEMENT un objet JSON valide — zéro markdown, zéro texte avant/après
- Respecter EXACTEMENT la structure demandée
- Tous montants en XOF (FCFA)`;
}

// ─────────────────────────────────────────────────────────────────────
// CONSTRUCTION DU PROMPT UTILISATEUR
// ─────────────────────────────────────────────────────────────────────

function buildUserPrompt(data: EntrepreneurData): string {
  const cy = data.current_year || new Date().getFullYear();

  return `Génère le plan financier OVO pour cette entreprise :

ENTREPRISE :
- Nom : ${data.company}
- Pays : ${data.country}
- Secteur : ${data.sector}
- Modèle : ${data.business_model}
- Année courante : ${cy}
- Employés actuels : ${data.employees || 0}
- CA actuel estimé : ${data.existing_revenue || 0} FCFA

PRODUITS (${(data.products || []).length}) :
${(data.products || []).map((p, i) => `  ${i+1}. ${p.name} — ${p.description}${p.price ? ` — Prix indicatif: ${p.price} FCFA` : ""}`).join("\n")}

SERVICES (${(data.services || []).length}) :
${(data.services || []).map((s, i) => `  ${i+1}. ${s.name} — ${s.description}${s.price ? ` — Prix indicatif: ${s.price} FCFA` : ""}`).join("\n")}

BESOINS FINANCIERS :
- Investissements démarrage : ${data.startup_costs || 0} FCFA
- Prêt OVO souhaité : ${data.loan_needed || 0} FCFA

${data.bmc_data ? `BUSINESS MODEL CANVAS :\n${JSON.stringify(data.bmc_data, null, 2)}` : ""}

INSTRUCTIONS :
Génère le JSON OVOFinancialPlanInput COMPLET avec :
1. Exactement ${Math.min(data.products.length, 8)} produits actifs UNIQUEMENT (pas de slots inactifs/vides)
2. Exactement ${Math.min(data.services.length, 5)} services actifs UNIQUEMENT (pas de slots inactifs/vides)
3. Au minimum 1 catégorie de staff (STAFF_CAT01)
4. CAPEX réaliste pour les immobilisations nécessaires
5. Prévisions sur 8 années (YEAR-2 à YEAR6)
6. Scénario : TYPICAL_CASE

JSON SCHEMA ATTENDU :
{
  "company": "string",
  "country": "string (en anglais)",
  "currency": "XOF",
  "exchange_rate_eur": 655.957,
  "vat_rate": 0.18,
  "inflation_rate": 0.03,
  "tax_regime_1": 0.04,
  "tax_regime_2": 0.30,
  "years": {
    "year_minus_2": ${cy-2},
    "year_minus_1": ${cy-1},
    "current_year": ${cy},
    "year2": ${cy+1},
    "year3": ${cy+2},
    "year4": ${cy+3},
    "year5": ${cy+4},
    "year6": ${cy+5}
  },
  "ranges": [
    {"slot": 1, "name": "LOW END", "description": ""},
    {"slot": 2, "name": "MEDIUM END", "description": ""},
    {"slot": 3, "name": "HIGH END", "description": ""}
  ],
  "channels": [
    {"slot": 1, "name": "B2B", "description": ""},
    {"slot": 2, "name": "B2C", "description": ""}
  ],
  "products": [
    {
      "slot": 1,
      "name": "Nom produit",
      "active": true,
      "description": "description",
      "range_flags": [1, 0, 0],
      "channel_flags": [0, 1],
      "per_year": [
        {
          "year": "YEAR-2",
          "unit_price_r1": 0, "unit_price_r2": 0, "unit_price_r3": 0,
          "mix_r1": 1.0, "mix_r2": 0, "mix_r3": 0,
          "cogs_r1": 0, "cogs_r2": 0, "cogs_r3": 0,
          "mix_r1_ch1": 0, "mix_r2_ch1": 0, "mix_r3_ch1": 0,
          "mix_r1_ch2": 1.0, "mix_r2_ch2": 0, "mix_r3_ch2": 0,
          "volume_h1": 0, "volume_h2": 0, "volume_q3": 0, "volume_q4": 0
        }
        // ... 7 autres années
      ]
    }
    // ... jusqu'à 20 slots (inactifs si pas de produit)
  ],
  "services": [ /* même structure, jusqu'à 10 slots */ ],
  "staff": [
    {
      "category_id": "STAFF_CAT01",
      "occupational_category": "EMPLOYE(E)S",
      "department": "DIRECTION",
      "social_security_rate": 0.1645,
      "per_year": [
        {"year": "YEAR-2", "headcount": 0, "gross_monthly_salary_per_person": 0, "annual_allowances_per_person": 0}
        // ... 7 autres années
      ]
    }
  ],
  "capex": [
    {"type": "OFFICE_EQUIPMENT", "slot": 1, "label": "Ordinateurs", "acquisition_year": ${cy}, "acquisition_value": 500000, "amortisation_rate": 0.333}
  ],
  "opex": {
    "marketing": {"research": [0,0,0,0,0,0,0,0,0,0], "advertising": [0,0,0,0,0,0,0,0,0,0], "receptions": [0,0,0,0,0,0,0,0,0,0], "purchase_studies": [0,0,0,0,0,0,0,0,0,0], "documentation": [0,0,0,0,0,0,0,0,0,0]},
    "taxes_on_staff": {"salaries_tax": [0,0,0,0,0,0,0,0,0,0], "apprenticeship": [0,0,0,0,0,0,0,0,0,0], "training": [0,0,0,0,0,0,0,0,0,0], "other": [0,0,0,0,0,0,0,0,0,0]},
    "office": {"rent": [0,0,0,0,0,0,0,0,0,0], "internet": [0,0,0,0,0,0,0,0,0,0], "telecom": [0,0,0,0,0,0,0,0,0,0], "supplies": [0,0,0,0,0,0,0,0,0,0], "fuel": [0,0,0,0,0,0,0,0,0,0], "water": [0,0,0,0,0,0,0,0,0,0], "electricity": [0,0,0,0,0,0,0,0,0,0], "cleaning": [0,0,0,0,0,0,0,0,0,0]},
    "other": {"health": [0,0,0,0,0,0,0,0,0,0], "directors": [0,0,0,0,0,0,0,0,0,0], "donations": [0,0,0,0,0,0,0,0,0,0]},
    "travel": {"nb_travellers": [0,0,0,0,0,0,0,0,0,0], "avg_cost": [0,0,0,0,0,0,0,0,0,0]},
    "insurance": {"building": [0,0,0,0,0,0,0,0,0,0], "company": [0,0,0,0,0,0,0,0,0,0]},
    "maintenance": {"movable": [0,0,0,0,0,0,0,0,0,0], "other": [0,0,0,0,0,0,0,0,0,0]},
    "third_parties": {"legal": [0,0,0,0,0,0,0,0,0,0], "accounting": [0,0,0,0,0,0,0,0,0,0], "transport": [0,0,0,0,0,0,0,0,0,0], "commissions": [0,0,0,0,0,0,0,0,0,0], "delivery": [0,0,0,0,0,0,0,0,0,0]}
  },
  "working_capital": {
    "stock_days": [0, 0, 45, 45, 45, 45, 60, 60, 60, 60],
    "receivable_days": [0, 0, 15, 15, 15, 15, 15, 15, 15, 15],
    "payable_days": [0, 0, 30, 30, 30, 30, 30, 30, 30, 30]
  },
  "opening_cash_year_minus_1": 0,
  "bank_charges_rate": [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
  "financing": {
    "loan_ovo_by_period": [0, 0, 0, 0, 0, ${data.loan_needed || 0}, 0, 0, 0, 0],
    "loan_family_by_period": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "loan_bank_by_period": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "existing_shareholders_capital": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "new_shareholders_capital": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "ovo_schedule": {"duration_years": 5, "by_period": [0, 0, 0, 1, 1, 1], "interest_rate": [0.07, 0.07, 0.07, 0.07, 0.07, 0.07]},
    "family_schedule": {"duration_years": 3, "by_period": [0, 0, 0, 0, 0, 0], "interest_rate": [0.10, 0.10, 0.10, 0.10, 0.10, 0.10]},
    "bank_schedule": {"duration_years": 2, "by_period": [0, 0, 0, 0, 0, 0], "interest_rate": [0.20, 0.20, 0.20, 0.20, 0.20, 0.20]}
  },
  "simulation_scenario": "TYPICAL_CASE",
  "key_assumptions": ["Croissance annuelle 20-25%", "Marché local prioritaire"]
}`;
}

// ─────────────────────────────────────────────────────────────────────
// ÉTAPE 3 : CONSTRUIRE LA LISTE DES CELLULES À ÉCRIRE
// ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function buildCellWrites(json: Record<string, any>): CellWrite[] {
  const writes: CellWrite[] = [];

  // Helper pour ajouter une cellule
  function w(sheet: string, row: number, col: string, value: string | number | null, type: CellWrite["type"] = "number") {
    if (value === null || value === undefined) return;
    writes.push({ sheet, row, col: COL[col], value, type });
  }

  // Helper pour écrire 10 valeurs dans les colonnes O→X
  function wFinance(sheet: string, row: number, values: number[], skipCols: string[] = []) {
    const cols = ["O","P","Q","R","S","T","U","V","W","X"];
    cols.forEach((col, i) => {
      if (!skipCols.includes(col)) {
        w(sheet, row, col, values[i] ?? 0, "number");
      }
    });
  }

  // ── ReadMe ──────────────────────────────────────────────────────────
  w("ReadMe", 3, "L", "French", "string");

  // ── InputsData Section 1 : Paramètres entreprise ───────────────────
  w("InputsData", 5,  "J", json.company,          "string");
  w("InputsData", 6,  "J", json.country,           "string");
  w("InputsData", 8,  "J", json.currency || "XOF", "string");
  w("InputsData", 9,  "J", json.exchange_rate_eur || 655.957, "number");
  w("InputsData", 10, "J", excelDateSerial(new Date()), "number"); // Date aujourd'hui
  w("InputsData", 12, "J", json.vat_rate || 0.18,        "number");
  w("InputsData", 14, "J", json.inflation_rate || 0.03,  "number");
  w("InputsData", 17, "J", json.tax_regime_1 || 0.04,    "number");
  w("InputsData", 18, "J", json.tax_regime_2 || 0.30,    "number");

  // ── InputsData Section 2 : Années ──────────────────────────────────
  const yrs = json.years || {};
  w("InputsData", 24, "J", yrs.year_minus_2, "number");
  w("InputsData", 25, "J", yrs.year_minus_1, "number");
  w("InputsData", 26, "J", yrs.current_year, "number");
  w("InputsData", 27, "J", yrs.current_year, "number"); // H1
  w("InputsData", 28, "J", yrs.current_year, "number"); // H2
  w("InputsData", 29, "J", yrs.year2, "number");
  w("InputsData", 30, "J", yrs.year3, "number");
  w("InputsData", 31, "J", yrs.year4, "number");
  w("InputsData", 32, "J", yrs.year5, "number");
  w("InputsData", 33, "J", yrs.year6, "number");

  // ── InputsData Section 3 : Gammes ──────────────────────────────────
  (json.ranges || []).forEach((r: { slot: number; name: string; description?: string }) => {
    const row = 69 + r.slot; // slot 1=row70, 2=row71, 3=row72
    w("InputsData", row, "H", r.name,            "string");
    w("InputsData", row, "J", r.description || r.name, "string");
  });

  // ── InputsData Section 3 : Canaux ──────────────────────────────────
  (json.channels || []).forEach((c: { slot: number; name: string; description?: string }) => {
    const row = 74 + c.slot; // slot 1=row75, 2=row76
    w("InputsData", row, "H", c.name,                 "string");
    w("InputsData", row, "J", c.description || c.name, "string");
  });

  // ── InputsData Section 3 : Produits (rows 36-55) ───────────────────
  const products = json.products || [];
  for (let i = 0; i < 20; i++) {
    const row = 36 + i;
    const p = products[i];
    if (p && p.active) {
      w("InputsData", row, "H", p.name,            "string");
      w("InputsData", row, "I", 1,                 "number");
      w("InputsData", row, "J", p.description || p.name, "string");
    } else {
      w("InputsData", row, "H", "-", "string");
      w("InputsData", row, "I", 0,   "number");
    }
  }

  // ── InputsData Section 3 : Services (rows 58-67) ───────────────────
  const services = json.services || [];
  for (let i = 0; i < 10; i++) {
    const row = 58 + i;
    const s = services[i];
    if (s && s.active) {
      w("InputsData", row, "H", s.name,                 "string");
      w("InputsData", row, "I", 1,                      "number");
      w("InputsData", row, "J", s.description || s.name, "string");
    } else {
      w("InputsData", row, "H", "-", "string");
      w("InputsData", row, "I", 0,   "number");
    }
  }

  // ── InputsData Section 4 : Matrice produits × gammes/canaux ─────────
  products.forEach((p: { slot: number; range_flags?: number[]; channel_flags?: number[] }, i: number) => {
    if (i >= 20) return;
    const row = 79 + i;
    const rf = p.range_flags   || [1, 0, 0];
    const cf = p.channel_flags || [0, 1];
    w("InputsData", row, "F", rf[0], "number");
    w("InputsData", row, "G", rf[1], "number");
    w("InputsData", row, "H", rf[2], "number");
    w("InputsData", row, "I", cf[0], "number");
    w("InputsData", row, "J", cf[1], "number");
  });

  services.forEach((s: { slot: number; range_flags?: number[]; channel_flags?: number[] }, i: number) => {
    if (i >= 10) return;
    const row = 101 + i;
    const rf = s.range_flags   || [1, 0, 0];
    const cf = s.channel_flags || [0, 1];
    w("InputsData", row, "F", rf[0], "number");
    w("InputsData", row, "G", rf[1], "number");
    w("InputsData", row, "H", rf[2], "number");
    w("InputsData", row, "I", cf[0], "number");
    w("InputsData", row, "J", cf[1], "number");
  });

  // ── InputsData Section 5 : Staff (rows 113-122) ─────────────────────
  const staffCats = json.staff || [];
  const STAFF_ROWS = [113,114,115,116,117,118,119,120,121,122];
  staffCats.forEach((cat: { category_id: string; occupational_category: string; department: string; social_security_rate: number }, i: number) => {
    if (i >= 10) return;
    const row = STAFF_ROWS[i];
    w("InputsData", row, "H", cat.occupational_category, "string");
    w("InputsData", row, "I", cat.department,             "string");
    w("InputsData", row, "J", cat.social_security_rate || 0.1645, "number");
  });

  // ── InputsData Section 6 : Prêts (paramètres) ──────────────────────
  const fin = json.financing || {};
  if (fin.ovo_schedule) {
    w("InputsData", 125, "I", 0.07,                              "number"); // taux OVO
    w("InputsData", 125, "J", fin.ovo_schedule.duration_years || 5, "number");
  }
  if (fin.family_schedule) {
    w("InputsData", 126, "I", 0.10,                                 "number");
    w("InputsData", 126, "J", fin.family_schedule.duration_years || 3, "number");
  }
  if (fin.bank_schedule) {
    w("InputsData", 127, "I", 0.20,                               "number");
    w("InputsData", 127, "J", fin.bank_schedule.duration_years || 2, "number");
  }

  // ── RevenueData : Volumes produits ──────────────────────────────────
  products.forEach((p: { slot: number; active: boolean; per_year?: Array<Record<string, number>> }, idx: number) => {
    const slot = idx + 1;
    const headerRow = PRODUCT_HEADER[slot];
    if (!headerRow) return;

    const perYear = p.per_year || [];
    const yearLabels = ["YEAR-2","YEAR-1","CURRENT YEAR","YEAR2","YEAR3","YEAR4","YEAR5","YEAR6"];

    yearLabels.forEach((yearLabel, yIdx) => {
      const yr = perYear.find((y: Record<string, unknown>) => y.year === yearLabel) || {};
      const row = headerRow + 1 + yIdx;

      if (!p.active) {
        // Produit inactif : tout à 0
        ["L","M","N","P","Q","R","S","T","U","W","X","Y","Z","AA","AB","AE","AF","AG","AH"]
          .forEach(col => w("RevenueData", row, col, 0, "number"));
        return;
      }

      // Prix unitaire par gamme
      w("RevenueData", row, "L", yr.unit_price_r1 || 0, "number");
      w("RevenueData", row, "M", yr.unit_price_r2 || 0, "number");
      w("RevenueData", row, "N", yr.unit_price_r3 || 0, "number");
      // Mix volume par gamme (somme = 1.0)
      w("RevenueData", row, "P", yr.mix_r1 ?? 1.0, "number");
      w("RevenueData", row, "Q", yr.mix_r2 || 0,   "number");
      w("RevenueData", row, "R", yr.mix_r3 || 0,   "number");
      // COGS unitaire
      w("RevenueData", row, "S", yr.cogs_r1 || 0,  "number");
      w("RevenueData", row, "T", yr.cogs_r2 || 0,  "number");
      w("RevenueData", row, "U", yr.cogs_r3 || 0,  "number");
      // Mix canal
      w("RevenueData", row, "W", yr.mix_r1_ch1 ?? 0, "number");
      w("RevenueData", row, "X", yr.mix_r2_ch1 || 0, "number");
      w("RevenueData", row, "Y", yr.mix_r3_ch1 || 0, "number");
      w("RevenueData", row, "Z", yr.mix_r1_ch2 ?? 1.0, "number");
      w("RevenueData", row, "AA", yr.mix_r2_ch2 || 0, "number");
      w("RevenueData", row, "AB", yr.mix_r3_ch2 || 0, "number");
      // Volumes trimestriels
      w("RevenueData", row, "AE", Math.round(yr.volume_h1 || 0), "number");
      w("RevenueData", row, "AF", Math.round(yr.volume_h2 || 0), "number");
      w("RevenueData", row, "AG", Math.round(yr.volume_q3 || 0), "number");
      w("RevenueData", row, "AH", Math.round(yr.volume_q4 || 0), "number");
    });
  });

  // ── RevenueData : Volumes services ──────────────────────────────────
  services.forEach((s: { slot: number; active: boolean; per_year?: Array<Record<string, number>> }, idx: number) => {
    const slot = idx + 1;
    const headerRow = SERVICE_HEADER[slot];
    if (!headerRow) return;

    const perYear = s.per_year || [];
    const yearLabels = ["YEAR-2","YEAR-1","CURRENT YEAR","YEAR2","YEAR3","YEAR4","YEAR5","YEAR6"];

    yearLabels.forEach((yearLabel, yIdx) => {
      const yr = perYear.find((y: Record<string, unknown>) => y.year === yearLabel) || {};
      const row = headerRow + 1 + yIdx;

      if (!s.active) {
        ["L","M","N","P","Q","R","S","T","U","W","X","Y","Z","AA","AB","AE","AF","AG","AH"]
          .forEach(col => w("RevenueData", row, col, 0, "number"));
        return;
      }

      w("RevenueData", row, "L", yr.unit_price_r1 || 0, "number");
      w("RevenueData", row, "M", yr.unit_price_r2 || 0, "number");
      w("RevenueData", row, "N", yr.unit_price_r3 || 0, "number");
      w("RevenueData", row, "P", yr.mix_r1 ?? 1.0, "number");
      w("RevenueData", row, "Q", yr.mix_r2 || 0,   "number");
      w("RevenueData", row, "R", yr.mix_r3 || 0,   "number");
      w("RevenueData", row, "S", yr.cogs_r1 || 0,  "number");
      w("RevenueData", row, "T", yr.cogs_r2 || 0,  "number");
      w("RevenueData", row, "U", yr.cogs_r3 || 0,  "number");
      w("RevenueData", row, "W", yr.mix_r1_ch1 ?? 0, "number");
      w("RevenueData", row, "X", yr.mix_r2_ch1 || 0, "number");
      w("RevenueData", row, "Y", yr.mix_r3_ch1 || 0, "number");
      w("RevenueData", row, "Z", yr.mix_r1_ch2 ?? 1.0, "number");
      w("RevenueData", row, "AA", yr.mix_r2_ch2 || 0, "number");
      w("RevenueData", row, "AB", yr.mix_r3_ch2 || 0, "number");
      w("RevenueData", row, "AE", Math.round(yr.volume_h1 || 0), "number");
      w("RevenueData", row, "AF", Math.round(yr.volume_h2 || 0), "number");
      w("RevenueData", row, "AG", Math.round(yr.volume_q3 || 0), "number");
      w("RevenueData", row, "AH", Math.round(yr.volume_q4 || 0), "number");
    });
  });

  // ── FinanceData : Staff ──────────────────────────────────────────────
  const STAFF_FIN_ROWS: Record<string, { eft: number; salary: number; allowances: number }> = {
    STAFF_CAT01: { eft:213, salary:214, allowances:215 },
    STAFF_CAT02: { eft:220, salary:221, allowances:222 },
    STAFF_CAT03: { eft:227, salary:228, allowances:229 },
    STAFF_CAT04: { eft:234, salary:235, allowances:236 },
    STAFF_CAT05: { eft:241, salary:242, allowances:243 },
    STAFF_CAT06: { eft:248, salary:249, allowances:250 },
    STAFF_CAT07: { eft:255, salary:256, allowances:257 },
    STAFF_CAT08: { eft:262, salary:263, allowances:264 },
    STAFF_CAT09: { eft:269, salary:270, allowances:271 },
    STAFF_CAT10: { eft:276, salary:277, allowances:278 },
  };

  staffCats.forEach((cat: { category_id: string; per_year: Array<{ year: string; headcount: number; gross_monthly_salary_per_person: number; annual_allowances_per_person: number }> }) => {
    const rows = STAFF_FIN_ROWS[cat.category_id];
    if (!rows) return;
    const perYear = cat.per_year || [];
    const periods = ["YEAR-2","YEAR-1","H1","H2","CURRENT YEAR","YEAR2","YEAR3","YEAR4","YEAR5","YEAR6"];
    const finCols  = ["O","P","Q","R","S","T","U","V","W","X"];

    periods.forEach((period, i) => {
      // Match: "CURRENT YEAR" couvre les 3 periodes H1/H2/CY
      const yr = perYear.find(y =>
        y.year === period ||
        (period === "H1" && y.year === "CURRENT YEAR H1") ||
        (period === "H2" && y.year === "CURRENT YEAR H2") ||
        (["H1","H2","CURRENT YEAR"].includes(period) && y.year === "CURRENT YEAR")
      ) || { headcount:0, gross_monthly_salary_per_person:0, annual_allowances_per_person:0 };

      w("FinanceData", rows.eft,        finCols[i], Math.round(yr.headcount || 0),                        "number");
      w("FinanceData", rows.salary,     finCols[i], yr.gross_monthly_salary_per_person || 0,              "number");
      w("FinanceData", rows.allowances, finCols[i], yr.annual_allowances_per_person    || 0,              "number");
    });
  });

  // ── FinanceData : OPEX Marketing ────────────────────────────────────
  const opex = json.opex || {};
  const mkt = opex.marketing || {};
  const MARKETING_ROWS: Record<string, number> = {
    research:201, purchase_studies:202, receptions:203, documentation:204, advertising:205
  };
  Object.entries(MARKETING_ROWS).forEach(([key, row]) => {
    wFinance("FinanceData", row, (mkt[key] || new Array(10).fill(0)));
  });

  // ── FinanceData : OPEX Taxes on Staff ───────────────────────────────
  const tax = opex.taxes_on_staff || {};
  wFinance("FinanceData", 283, tax.salaries_tax   || new Array(10).fill(0));
  wFinance("FinanceData", 284, tax.apprenticeship || new Array(10).fill(0));
  wFinance("FinanceData", 285, tax.training        || new Array(10).fill(0));
  wFinance("FinanceData", 286, tax.other           || new Array(10).fill(0));

  // ── FinanceData : OPEX Office ────────────────────────────────────────
  const off = opex.office || {};
  const OFFICE_ROWS: Record<string, number> = {
    rent:294, internet:295, telecom:296, supplies:297,
    fuel:300, water:301, electricity:302, cleaning:303
  };
  Object.entries(OFFICE_ROWS).forEach(([key, row]) => {
    wFinance("FinanceData", row, (off[key] || new Array(10).fill(0)));
  });

  // ── FinanceData : OPEX Other ─────────────────────────────────────────
  const oth = opex.other || {};
  wFinance("FinanceData", 311, oth.health    || new Array(10).fill(0));
  wFinance("FinanceData", 312, oth.directors || new Array(10).fill(0));
  wFinance("FinanceData", 313, oth.donations || new Array(10).fill(0));

  // ── FinanceData : Travel ─────────────────────────────────────────────
  const trv = opex.travel || {};
  wFinance("FinanceData", 322, trv.nb_travellers || new Array(10).fill(0));
  wFinance("FinanceData", 323, trv.avg_cost      || new Array(10).fill(0));

  // ── FinanceData : Insurance ──────────────────────────────────────────
  const ins = opex.insurance || {};
  wFinance("FinanceData", 326, ins.building || new Array(10).fill(0));
  wFinance("FinanceData", 327, ins.company  || new Array(10).fill(0));

  // ── FinanceData : Maintenance ────────────────────────────────────────
  const mnt = opex.maintenance || {};
  wFinance("FinanceData", 335, mnt.movable || new Array(10).fill(0));
  wFinance("FinanceData", 337, mnt.other   || new Array(10).fill(0));

  // ── FinanceData : Third Parties ──────────────────────────────────────
  const trd = opex.third_parties || {};
  const THIRD_ROWS: Record<string, number> = {
    legal:345, accounting:352, transport:348, commissions:350, delivery:349
  };
  Object.entries(THIRD_ROWS).forEach(([key, row]) => {
    wFinance("FinanceData", row, (trd[key] || new Array(10).fill(0)));
  });

  // ── FinanceData : CAPEX ──────────────────────────────────────────────
  const capexItems = json.capex || [];
  const OE_START = 408;
  const OA_START = 462;
  let oeCount = 0, oaCount = 0;

  capexItems.forEach((c: { type: string; acquisition_year: number; acquisition_value: number; amortisation_rate: number }) => {
    let row: number;
    if (c.type === "OFFICE_EQUIPMENT" && oeCount < 40) {
      row = OE_START + oeCount++;
    } else if (c.type === "OTHER_ASSETS" && oaCount < 20) {
      row = OA_START + oaCount++;
    } else return;

    w("FinanceData", row, "K", c.acquisition_year,  "number");
    w("FinanceData", row, "L", c.acquisition_value, "number");
    w("FinanceData", row, "M", c.amortisation_rate, "number");
  });

  // ── FinanceData : Working Capital ────────────────────────────────────
  const wc = json.working_capital || {};
  wFinance("FinanceData", 693, wc.stock_days      || [0,0,45,45,45,45,60,60,60,60]);
  wFinance("FinanceData", 697, wc.receivable_days || [0,0,15,15,15,15,15,15,15,15]);
  wFinance("FinanceData", 701, wc.payable_days    || [0,0,30,30,30,30,30,30,30,30]);

  // ── FinanceData : Cash initial ───────────────────────────────────────
  // ⚠ Seulement col P (col O = None dans le template)
  w("FinanceData", 749, "P", json.opening_cash_year_minus_1 || 0, "number");

  // ── FinanceData : Bank charges ───────────────────────────────────────
  // ⚠ Skip colonnes Q et R (None dans le template)
  const bcRates = json.bank_charges_rate || new Array(10).fill(0.01);
  wFinance("FinanceData", 729, bcRates, ["Q","R"]);

  // ── FinanceData : Sources de financement ────────────────────────────
  const FINANCE_COLS_6 = ["S","T","U","V","W","X"]; // cols S-X = périodes 4-9

  // Montants prêts (cols S-X uniquement, O/P = None)
  if (fin.loan_ovo_by_period) {
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 785, col, fin.loan_ovo_by_period[i+4] || 0, "number");
    });
  }
  if (fin.loan_family_by_period) {
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 786, col, fin.loan_family_by_period[i+4] || 0, "number");
    });
  }
  if (fin.loan_bank_by_period) {
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 787, col, fin.loan_bank_by_period[i+4] || 0, "number");
    });
  }
  // Apports actionnaires existants (cols O-X tous éditables)
  if (fin.existing_shareholders_capital) {
    wFinance("FinanceData", 788, fin.existing_shareholders_capital);
  }
  // Apports nouveaux actionnaires (cols S-X)
  if (fin.new_shareholders_capital) {
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 789, col, fin.new_shareholders_capital[i+4] || 0, "number");
    });
  }

  // Calendrier remboursement OVO
  if (fin.ovo_schedule) {
    w("FinanceData", 793, "J", fin.ovo_schedule.duration_years || 5, "number");
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 793, col, fin.ovo_schedule.by_period?.[i] ?? 0, "number");
      w("FinanceData", 797, col, fin.ovo_schedule.interest_rate?.[i] ?? 0.07, "number");
    });
  }
  // Famille/amis
  if (fin.family_schedule) {
    w("FinanceData", 802, "J", fin.family_schedule.duration_years || 3, "number");
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 802, col, fin.family_schedule.by_period?.[i] ?? 0, "number");
      w("FinanceData", 806, col, fin.family_schedule.interest_rate?.[i] ?? 0.10, "number");
    });
  }
  // Banque locale
  if (fin.bank_schedule) {
    w("FinanceData", 811, "J", fin.bank_schedule.duration_years || 2, "number");
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 811, col, fin.bank_schedule.by_period?.[i] ?? 0, "number");
      w("FinanceData", 815, col, fin.bank_schedule.interest_rate?.[i] ?? 0.20, "number");
    });
  }

  return writes;
}

// ─────────────────────────────────────────────────────────────────────
// ÉTAPE 4 : INJECTION DANS LE XLSM (manipulation ZIP/XML)
// ─────────────────────────────────────────────────────────────────────

/**
 * Stratégie : manipulation directe du ZIP/XML.
 * On ne passe PAS par ExcelJS pour éviter la corruption VBA.
 * On lit le fichier ZIP, on modifie uniquement les feuilles cibles,
 * on réécrit les valeurs numériques/string directement dans le XML.
 */
async function injectIntoXlsm(
  templateBuffer: ArrayBuffer,
  writes: CellWrite[]
): Promise<ArrayBuffer> {

  // Grouper les writes par feuille
  const bySheet: Record<string, CellWrite[]> = {};
  for (const cw of writes) {
    if (!bySheet[cw.sheet]) bySheet[cw.sheet] = [];
    bySheet[cw.sheet].push(cw);
  }

  // Lire le ZIP
  const zipEntries = await readZip(new Uint8Array(templateBuffer));

  // Modifier chaque feuille concernée
  for (const [sheetName, sheetWrites] of Object.entries(bySheet)) {
    const xmlPath = SHEET_FILES[sheetName];
    if (!xmlPath || !zipEntries[xmlPath]) {
      console.warn(`[inject] Sheet ${sheetName} not found at ${xmlPath}`);
      continue;
    }

    let xml = new TextDecoder().decode(zipEntries[xmlPath]);
    xml = applyWritesToXml(xml, sheetWrites);
    zipEntries[xmlPath] = new TextEncoder().encode(xml);

    console.log(`[inject] ${sheetName}: ${sheetWrites.length} cells updated`);
  }

  // Reconstruire le ZIP
  return await buildZip(zipEntries, new Uint8Array(templateBuffer));
}

/**
 * Applique les écritures dans le XML d'une feuille.
 * Gère les types : number, string (shared strings), date (serial Excel).
 *
 * Stratégie XML :
 *   - Trouver la cellule existante par son ref (ex: "J5")
 *   - Si existe : remplacer la valeur <v>...</v>
 *   - Si n'existe pas : insérer la cellule dans la bonne ligne <row>
 */
function applyWritesToXml(xml: string, writes: CellWrite[]): string {
  for (const cw of writes) {
    if (cw.value === null || cw.value === undefined) continue;

    const cellRef = colNumToLetter(cw.col) + cw.row;

    if (cw.type === "string") {
      // Pour les strings : utiliser inline string (t="inlineStr")
      // C'est plus simple que shared strings et compatible avec ExcelJS
      const strValue = String(cw.value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      xml = setCellValue(xml, cellRef, cw.row, strValue, "inlineStr");
    } else {
      // Nombre ou date (serial)
      const numValue = typeof cw.value === "number" ? cw.value : parseFloat(String(cw.value));
      xml = setCellValue(xml, cellRef, cw.row, String(numValue), "number");
    }
  }
  return xml;
}

/**
 * Met à jour ou insère une cellule dans le XML de la feuille.
 */
function setCellValue(
  xml: string,
  cellRef: string,
  rowNum: number,
  value: string,
  type: "number" | "inlineStr"
): string {

  // Attribut t= pour le type
  const tAttr = type === "inlineStr" ? ' t="inlineStr"' : "";
  // Contenu de la cellule
  const cellContent = type === "inlineStr"
    ? `<is><t>${value}</t></is>`
    : `<v>${value}</v>`;

  // Pattern pour trouver la cellule existante
  const existingPattern = new RegExp(
    `<c r="${cellRef}"[^>]*>(?:<f[^>]*>[^<]*</f>)?(?:<v>[^<]*</v>|<is>.*?</is>)?(?:<extLst>.*?</extLst>)?</c>`,
    "s"
  );

  const newCell = `<c r="${cellRef}"${tAttr}>${cellContent}</c>`;

  if (existingPattern.test(xml)) {
    // La cellule existe — la remplacer uniquement si elle ne contient pas de formule
    return xml.replace(existingPattern, (match) => {
      // Ne pas écraser les formules (<f> tag)
      if (match.includes("<f")) {
        console.warn(`[inject] Skipping formula cell ${cellRef}`);
        return match;
      }
      return newCell;
    });
  }

  // La cellule n'existe pas — l'insérer dans la bonne ligne
  // Chercher la ligne correspondante
  const rowPattern = new RegExp(`(<row[^>]*r="${rowNum}"[^>]*>)(.*?)(</row>)`, "s");

  if (rowPattern.test(xml)) {
    return xml.replace(rowPattern, (_, open, content, close) => {
      // Insérer la cellule à la bonne position dans la ligne (ordre alphabétique des refs)
      const inserted = insertCellInRow(content, newCell, cellRef);
      return `${open}${inserted}${close}`;
    });
  }

  // La ligne n'existe pas non plus — insérer une nouvelle ligne
  const sheetDataEndPattern = /(<\/sheetData>)/;
  const newRow = `<row r="${rowNum}">${newCell}</row>`;
  return xml.replace(sheetDataEndPattern, `${newRow}$1`);
}

/**
 * Insère une cellule dans le contenu d'une ligne en respectant l'ordre des colonnes.
 */
function insertCellInRow(rowContent: string, newCell: string, newRef: string): string {
  const cells = [...rowContent.matchAll(/<c r="([A-Z]+\d+)"[^>]*>.*?<\/c>/gs)];

  if (cells.length === 0) return newCell + rowContent;

  const newColNum = refToColNum(newRef);
  let insertPos = rowContent.length;

  for (const cell of cells) {
    const cellColNum = refToColNum(cell[1]);
    if (cellColNum > newColNum) {
      insertPos = cell.index!;
      break;
    }
  }

  return rowContent.slice(0, insertPos) + newCell + rowContent.slice(insertPos);
}

// ─────────────────────────────────────────────────────────────────────
// UTILITAIRES ZIP
// ─────────────────────────────────────────────────────────────────────

type ZipEntries = Record<string, Uint8Array>;

async function readZip(data: Uint8Array): Promise<ZipEntries> {
  // Lecture manuelle du format ZIP (End of Central Directory)
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const entries: ZipEntries = {};

  // Trouver le End of Central Directory (signature 0x06054b50)
  let eocdOffset = -1;
  for (let i = data.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) throw new Error("Invalid ZIP: EOCD not found");

  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const centralDirSize   = view.getUint32(eocdOffset + 12, true);
  let pos = centralDirOffset;

  while (pos < centralDirOffset + centralDirSize) {
    if (view.getUint32(pos, true) !== 0x02014b50) break; // Central dir signature

    const compMethod    = view.getUint16(pos + 10, true);
    const compSize      = view.getUint32(pos + 20, true);
    const uncompSize    = view.getUint32(pos + 24, true);
    const fileNameLen   = view.getUint16(pos + 28, true);
    const extraLen      = view.getUint16(pos + 30, true);
    const commentLen    = view.getUint16(pos + 32, true);
    const localOffset   = view.getUint32(pos + 42, true);

    const fileName = new TextDecoder().decode(data.slice(pos + 46, pos + 46 + fileNameLen));
    pos += 46 + fileNameLen + extraLen + commentLen;

    // Lire le local file header
    const localView      = new DataView(data.buffer, data.byteOffset + localOffset);
    const localFileNameLen = localView.getUint16(26, true);
    const localExtraLen    = localView.getUint16(28, true);
    const dataStart        = localOffset + 30 + localFileNameLen + localExtraLen;

    const compData = data.slice(dataStart, dataStart + compSize);

    if (compMethod === 0) {
      // Stored (non compressé)
      entries[fileName] = compData;
    } else if (compMethod === 8) {
      // Deflate
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();

      writer.write(compData);
      writer.close();

      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (value) chunks.push(value);
        done = d;
      }

      const result = new Uint8Array(uncompSize);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      entries[fileName] = result;
    }
  }

  return entries;
}

async function buildZip(entries: ZipEntries, original: Uint8Array): Promise<ArrayBuffer> {
  // Reconstruire le ZIP en recompressant les fichiers modifiés
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const [name, data] of Object.entries(entries)) {
    const nameBytes = new TextEncoder().encode(name);

    // Compresser avec deflate-raw
    const cs = new CompressionStream("deflate-raw");
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    writer.write(data);
    writer.close();

    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      if (value) chunks.push(value);
      done = d;
    }

    const compData = mergeUint8Arrays(chunks);
    const crc = crc32(data);

    // Local file header
    const localHeader = buildLocalHeader(nameBytes, compData.length, data.length, crc);
    parts.push(localHeader, nameBytes, compData);

    // Central directory entry
    centralDir.push(buildCentralDirEntry(nameBytes, compData.length, data.length, crc, offset));

    offset += localHeader.length + nameBytes.length + compData.length;
  }

  // Central directory + EOCD
  const cdData = mergeUint8Arrays(centralDir);
  const eocd   = buildEOCD(centralDir.length, cdData.length, offset);

  const allParts = [...parts, cdData, eocd];
  return mergeUint8Arrays(allParts).buffer;
}

function buildLocalHeader(name: Uint8Array, compSize: number, uncompSize: number, crc: number): Uint8Array {
  const buf = new Uint8Array(30);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x04034b50, true);  // Signature
  view.setUint16(4, 20, true);           // Version needed
  view.setUint16(6, 0, true);            // Flags
  view.setUint16(8, 8, true);            // Compression method (deflate)
  view.setUint16(10, 0, true);           // Mod time
  view.setUint16(12, 0, true);           // Mod date
  view.setUint32(14, crc, true);         // CRC-32
  view.setUint32(18, compSize, true);    // Compressed size
  view.setUint32(22, uncompSize, true);  // Uncompressed size
  view.setUint16(26, name.length, true); // Filename length
  view.setUint16(28, 0, true);           // Extra length
  return buf;
}

function buildCentralDirEntry(name: Uint8Array, compSize: number, uncompSize: number, crc: number, localOffset: number): Uint8Array {
  const buf = new Uint8Array(46 + name.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x02014b50, true);   // Signature
  view.setUint16(4, 20, true);           // Version made by
  view.setUint16(6, 20, true);           // Version needed
  view.setUint16(8, 0, true);            // Flags
  view.setUint16(10, 8, true);           // Compression
  view.setUint16(12, 0, true);           // Mod time
  view.setUint16(14, 0, true);           // Mod date
  view.setUint32(16, crc, true);         // CRC
  view.setUint32(20, compSize, true);    // Comp size
  view.setUint32(24, uncompSize, true);  // Uncomp size
  view.setUint16(28, name.length, true); // Filename len
  view.setUint16(30, 0, true);           // Extra len
  view.setUint16(32, 0, true);           // Comment len
  view.setUint16(34, 0, true);           // Disk start
  view.setUint16(36, 0, true);           // Internal attrs
  view.setUint32(38, 0, true);           // External attrs
  view.setUint32(42, localOffset, true); // Local offset
  buf.set(name, 46);
  return buf;
}

function buildEOCD(numEntries: number, cdSize: number, cdOffset: number): Uint8Array {
  const buf = new Uint8Array(22);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x06054b50, true);  // Signature
  view.setUint16(4, 0, true);            // Disk number
  view.setUint16(6, 0, true);            // CD disk
  view.setUint16(8, numEntries, true);   // Entries on disk
  view.setUint16(10, numEntries, true);  // Total entries
  view.setUint32(12, cdSize, true);      // CD size
  view.setUint32(16, cdOffset, true);    // CD offset
  view.setUint16(20, 0, true);           // Comment length
  return buf;
}

// ─────────────────────────────────────────────────────────────────────
// UTILITAIRES DIVERS
// ─────────────────────────────────────────────────────────────────────

function colNumToLetter(n: number): string {
  let result = "";
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function refToColNum(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let result = 0;
  for (const ch of letters) {
    result = result * 26 + (ch.charCodeAt(0) - 64);
  }
  return result;
}

function excelDateSerial(date: Date): number {
  // Excel serial date : jours depuis le 30 décembre 1899
  const epoch = new Date(1899, 11, 30);
  const diff  = date.getTime() - epoch.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function mergeUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function crc32(data: Uint8Array): number {
  const table = buildCRC32Table();
  let crc = 0xFFFFFFFF;
  for (const byte of data) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildCRC32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

function sanitize(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// deno-lint-ignore no-explicit-any
function extractSummary(json: Record<string, any>) {
  return {
    company:        json.company,
    active_products: (json.products || []).filter((p: { active: boolean }) => p.active).length,
    active_services: (json.services || []).filter((s: { active: boolean }) => s.active).length,
    scenario:        json.simulation_scenario,
    years:           json.years,
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}
