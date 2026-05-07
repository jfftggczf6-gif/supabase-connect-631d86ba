// generate-pe-slide-payload — Agent IA qui synthétise les 12 sections du memo
// + valuation + DD findings en un payload structuré pour la génération PPT.
//
// Produit un objet JSON `slide_payload` consommé par esono-render (memo-pptx.js)
// pour bâtir un deck IC classe mondiale (~17 slides) avec KPIs, bullets et
// données pour graphs natifs (donut, bar, line).
//
// Coût : 1 appel Sonnet 4.6 sur ~30k tokens d'input → ~$0.30-0.50 par memo.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, callAI, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { buildAgentContext } from "../_shared/agent-context.ts";

interface RequestBody {
  deal_id: string;
}

const SYSTEM = `Tu es un analyste financier senior dans un fonds de Private Equity. Tu produis le PAYLOAD STRUCTURÉ qui sera utilisé pour générer un deck PowerPoint de comité d'investissement classe mondiale (~17 slides), à partir du memo IC long-form déjà rédigé.

Ton job : SYNTHÉTISER le memo en éléments visuels (KPIs, bullets, données pour graphs). Tu ne ré-analyses pas — tu condenses et structures pour le format slide.

PRINCIPES :
- Chaque slide = UN message principal + 3-5 bullets clés + 1-2 KPIs + optionnellement 1 graph
- Bullets : phrases courtes percutantes (8-15 mots), JAMAIS de phrases longues
- KPIs : valeur visible + label court + delta optionnel ("CA 2024 / 2.82 Mds FCFA / +18% CAGR")
- Graphs : données chiffrées prêtes à plotter (pas de description verbale)
- Sources : citation courte inline ("source: SYSCOHADA 2024")

FORMAT JSON STRICT — pas de markdown autour, pas de fences, juste le JSON.`;

function buildUserPrompt(sections: any, valuation: any, deal: any, enterprise: any): string {
  const sectionSummaries = Object.entries(sections).map(([code, s]: [string, any]) => {
    const md = s.content_md ? String(s.content_md).slice(0, 4000) : '(vide)';
    return `── SECTION ${code} ──\n${md}`;
  }).join('\n\n');

  const valBlock = valuation && valuation.status === 'ready'
    ? `\n── VALUATION ──\n${JSON.stringify(valuation.synthesis ?? {}, null, 2)}`
    : '\n── VALUATION : non générée ──';

  return `Génère le slide_payload pour le deck PPT du deal "${enterprise.legal_name ?? deal.deal_ref}" (secteur: ${enterprise.sector ?? '—'}, pays: ${enterprise.country ?? '—'}, ticket: ${deal.ticket_demande ?? '—'}).

═══ MEMO IC SOURCE (12 sections rédigées en long-form) ═══
${sectionSummaries}

${valBlock}

═══ FORMAT DE RÉPONSE — JSON STRICT ═══
{
  "cover": {
    "title": "Investment Memorandum",
    "subtitle": "<Nom entreprise>",
    "tag1": "<Secteur · Pays>",
    "tag2": "<Ticket · Stage>"
  },

  "executive_summary": {
    "subtitle": "<phrase punchline 12-15 mots qui résume la thèse>",
    "kpis": [
      {"label": "CA 2024", "value": "2.82 Mds FCFA", "change": "+18% CAGR"},
      {"label": "EBITDA retraité", "value": "300 M FCFA", "change": "10.6% marge"},
      {"label": "Ticket recommandé", "value": "1.0 Md FCFA", "change": "Equity 24%"},
      {"label": "MOIC base", "value": "2.7x", "change": "TRI 22% · 5 ans"}
    ],
    "thesis_pillars": [
      {"title": "<Pilier 1 court 4-6 mots>", "body": "<1 phrase 15-20 mots>"},
      {"title": "<Pilier 2>", "body": "<1 phrase>"},
      {"title": "<Pilier 3>", "body": "<1 phrase>"}
    ],
    "recommendation": "go_direct | go_conditionnel | hold | reject",
    "score": <number 0-100>
  },

  "deal_overview": {
    "rows": [
      {"label": "Entreprise", "value": "<nom>"},
      {"label": "Secteur", "value": "<secteur>"},
      {"label": "Pays", "value": "<pays>"},
      {"label": "Stage du deal", "value": "<stage>"},
      {"label": "Ticket demandé", "value": "<ticket>"},
      {"label": "Lead analyste", "value": "<nom>"},
      {"label": "Score IR", "value": "<X/100>"}
    ]
  },

  "investment_thesis": {
    "subtitle": "<punchline thèse 10-12 mots>",
    "drivers": [
      {"icon": "growth", "title": "<Driver 1>", "kpi": "<chiffre clé>", "body": "<1-2 phrases>"},
      {"icon": "margin", "title": "<Driver 2>", "kpi": "<chiffre>", "body": "<1-2 phrases>"},
      {"icon": "exit", "title": "<Driver 3>", "kpi": "<chiffre>", "body": "<1-2 phrases>"}
    ]
  },

  "market": {
    "subtitle": "<positionnement marché 1 phrase>",
    "tam_sam_som": [
      {"label": "TAM", "value_num": <number en M ou Md cohérent>, "value_label": "2.4 Mds USD"},
      {"label": "SAM", "value_num": <number>, "value_label": "395 M USD"},
      {"label": "SOM", "value_num": <number>, "value_label": "120 M USD"}
    ],
    "competitors_share": [
      {"name": "<Concurrent 1>", "pdm": <number 0-100>},
      {"name": "<Concurrent 2>", "pdm": <number>},
      {"name": "<Concurrent 3>", "pdm": <number>},
      {"name": "Cible", "pdm": <number>, "highlight": true},
      {"name": "Autres", "pdm": <number>}
    ]
  },

  "business_model": {
    "subtitle": "<résumé BM 1 phrase>",
    "value_chain_steps": [
      {"step": "<Étape 1 ex: Sourcing API>", "value_add": "<court>"},
      {"step": "<Étape 2>", "value_add": "<court>"},
      {"step": "<Étape 3>", "value_add": "<court>"},
      {"step": "<Étape 4>", "value_add": "<court>"}
    ],
    "unit_economics": [
      {"label": "Marge brute", "value": "32%"},
      {"label": "Coût unitaire", "value": "612 FCFA"},
      {"label": "Break-even", "value": "1.85 Mds FCFA"}
    ]
  },

  "management": {
    "subtitle": "<équipe — punchline 1 phrase>",
    "key_people": [
      {"name": "<DG>", "role": "Directeur Général", "tenure": "<X ans>", "highlight": "<expertise clé>"},
      {"name": "<Dir Prod>", "role": "Directeur Production", "tenure": "<X ans>", "highlight": "<>"},
      {"name": "<Dir Com>", "role": "Directeur Commercial", "tenure": "<X ans>", "highlight": "<>"},
      {"name": "<Resp Q>", "role": "Responsable Qualité", "tenure": "<X ans>", "highlight": "<>"}
    ],
    "vacant_positions": ["DAF", "Resp R&D"]
  },

  "financials_pnl": {
    "subtitle": "<perf financière punchline>",
    "revenue_chart": [
      {"year": "2022", "value": <number>},
      {"year": "2023", "value": <number>},
      {"year": "2024", "value": <number>},
      {"year": "2025e", "value": <number>},
      {"year": "2026e", "value": <number>},
      {"year": "2027e", "value": <number>}
    ],
    "ebitda_chart": [
      {"year": "2022", "value": <number>},
      {"year": "2023", "value": <number>},
      {"year": "2024", "value": <number>},
      {"year": "2025e", "value": <number>},
      {"year": "2026e", "value": <number>},
      {"year": "2027e", "value": <number>}
    ],
    "key_ratios": [
      {"label": "Marge brute", "value": "32%"},
      {"label": "Marge EBITDA", "value": "10.6%"},
      {"label": "Croissance CA", "value": "+18% CAGR"}
    ]
  },

  "financials_balance": {
    "subtitle": "<bilan punchline>",
    "structure": [
      {"label": "Capitaux propres", "value_num": <number en M>, "value_label": "980 M FCFA"},
      {"label": "Dette financière", "value_num": <number>, "value_label": "530 M FCFA"},
      {"label": "Dettes fournisseurs", "value_num": <number>, "value_label": "680 M FCFA"}
    ],
    "key_ratios": [
      {"label": "Dette/EBITDA", "value": "0.88x"},
      {"label": "Liquidité rapide", "value": "0.5x"},
      {"label": "BFR", "value": "128 jours"}
    ]
  },

  "unit_economics": {
    "subtitle": "<unit eco punchline>",
    "cost_breakdown": [
      {"label": "API", "value": <number 0-100 pct>, "color": "purple"},
      {"label": "Excipients", "value": <number>, "color": "purpleLight"},
      {"label": "Conditionnement", "value": <number>, "color": "blue"},
      {"label": "Main d'œuvre", "value": <number>, "color": "amber"},
      {"label": "Énergies/Amort.", "value": <number>, "color": "slate"}
    ]
  },

  "esg_impact": {
    "subtitle": "<ESG punchline>",
    "odd_impacts": [
      {"odd": "ODD 3", "label": "Bonne santé", "level": "Direct", "kpi": "2M patients/an"},
      {"odd": "ODD 8", "label": "Travail décent", "level": "Direct", "kpi": "127 emplois"},
      {"odd": "ODD 9", "label": "Industrie", "level": "Direct", "kpi": "Production locale"}
    ],
    "ifc_2x": "potential | eligible | not_eligible",
    "co_investors": ["Proparco", "BII", "IFC", "FMO"]
  },

  "risks": {
    "subtitle": "<risques punchline>",
    "risk_matrix": [
      {"risk": "<risque 1>", "probability": "Low | Medium | High", "impact": "Low | Medium | High", "mitigation": "<phrase courte>"},
      {"risk": "<risque 2>", "probability": "...", "impact": "...", "mitigation": "<>"},
      {"risk": "<risque 3>", "probability": "...", "impact": "...", "mitigation": "<>"}
    ]
  },

  "valuation": {
    "subtitle": "<valuation punchline>",
    "method_weights": [
      {"method": "DCF", "weight_pct": <number>},
      {"method": "Multiples", "weight_pct": <number>},
      {"method": "ANCC", "weight_pct": <number>}
    ],
    "scenarios": [
      {"name": "Bear", "ev_value": <number>, "ev_label": "2.95 Mds FCFA", "moic": "1.6x", "tri": "10%"},
      {"name": "Base", "ev_value": <number>, "ev_label": "3.46 Mds FCFA", "moic": "2.7x", "tri": "22%"},
      {"name": "Bull", "ev_value": <number>, "ev_label": "4.28 Mds FCFA", "moic": "4.2x", "tri": "33%"}
    ],
    "key_terms": [
      {"label": "Pre-money", "value": "3.11 Mds FCFA"},
      {"label": "Ticket", "value": "1.0 Md FCFA"},
      {"label": "Equity stake", "value": "24%"},
      {"label": "Horizon sortie", "value": "5 ans"}
    ]
  },

  "use_of_proceeds": {
    "subtitle": "<usage des fonds punchline>",
    "allocation": [
      {"label": "CapEx extension", "value_pct": 60, "value_label": "1.65 Md FCFA"},
      {"label": "BFR croissance", "value_pct": 25, "value_label": "685 M FCFA"},
      {"label": "Structuration RH", "value_pct": 15, "value_label": "415 M FCFA"}
    ]
  },

  "plan_100j": {
    "subtitle": "<plan 100j punchline>",
    "milestones": [
      {"week": "S1-4", "title": "<Action 1>", "owner": "<>"},
      {"week": "S5-8", "title": "<Action 2>", "owner": "<>"},
      {"week": "S9-12", "title": "<Action 3>", "owner": "<>"},
      {"week": "S13-14", "title": "<Action 4>", "owner": "<>"}
    ]
  },

  "recommendation": {
    "verdict": "go_direct | go_conditionnel | hold | reject",
    "score": <number 0-100>,
    "headline": "<phrase punchline 10-15 mots qui justifie le verdict>",
    "conditions": ["<condition 1 si go_conditionnel>", "<condition 2>", "<condition 3>", "<condition 4>"],
    "next_steps": ["<étape 1>", "<étape 2>"]
  }
}

REMARQUES :
- Les "value_num" servent aux graphs (numbers seuls). Les "value_label" servent à l'affichage textuel ("2.82 Mds FCFA").
- Les "color" sont des hints pour la palette donut.
- Les "icon" sont des hints sémantiques (growth, margin, exit, market, esg, risk) — esono-render les mappera.
- Si une donnée est absente du memo, mets null/empty array — NE PAS inventer.`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Authorization required", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse("Not authenticated", 401);

    const body: RequestBody = await req.json();
    if (!body.deal_id) return errorResponse("deal_id required", 400);

    // 1) Récupérer deal + verif RLS
    const { data: deal } = await userClient
      .from("pe_deals")
      .select(`id, organization_id, deal_ref, stage, ticket_demande, currency, lead_analyst_id, enterprise_id,
               enterprises!inner(name, sector, country)`)
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal) return errorResponse("Deal not found or not accessible", 404);

    const enterprise = {
      legal_name: (deal as any).enterprises?.name ?? deal.deal_ref,
      sector: (deal as any).enterprises?.sector ?? '—',
      country: (deal as any).enterprises?.country ?? '—',
    };
    const dealCtx = {
      deal_ref: deal.deal_ref,
      stage_label: deal.stage,
      ticket_demande: deal.ticket_demande != null ? `${deal.ticket_demande} ${deal.currency ?? 'XOF'}` : '—',
    };

    // 2) Récupérer la dernière version 'ready' du memo + ses sections
    const { data: memo } = await adminClient
      .from('investment_memos')
      .select('id')
      .eq('deal_id', body.deal_id)
      .maybeSingle();
    if (!memo) return errorResponse("No memo for this deal", 400);

    const { data: versions } = await adminClient
      .from('memo_versions')
      .select('id')
      .eq('memo_id', memo.id)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(1);
    const versionId = versions?.[0]?.id;
    if (!versionId) return errorResponse("No ready memo version", 400);

    const { data: secsData } = await adminClient
      .from('memo_sections')
      .select('section_code, content_md, content_json')
      .eq('version_id', versionId);
    const sections: Record<string, any> = {};
    (secsData ?? []).forEach((s: any) => { sections[s.section_code] = s; });

    // 3) Récupérer la valuation
    const { data: valuation } = await adminClient
      .from('pe_valuation')
      .select('status, synthesis, currency')
      .eq('deal_id', body.deal_id)
      .maybeSingle();

    // 4) Tone PE + agent context
    const agentCtx = await buildAgentContext(adminClient, deal.organization_id, {
      deliverableType: 'slide_payload',
      country: enterprise.country,
      sector: enterprise.sector,
      enterpriseId: deal.id,
    });
    const systemPrompt = agentCtx.composeSystemPrompt(SYSTEM);
    const userPrompt = buildUserPrompt(sections, valuation, dealCtx, enterprise);

    // 5) Appel IA — Sonnet 4.6, 16k tokens output (gros JSON structuré)
    console.log(`[generate-pe-slide-payload] Generating for deal ${deal.id}`);
    const claudeResponse = await callAI(systemPrompt, userPrompt, 16384, undefined, 0.2, {
      functionName: 'generate-pe-slide-payload',
      enterpriseId: deal.id,
    });

    let slidePayload: any;
    try {
      slidePayload = typeof claudeResponse === 'string' ? JSON.parse(claudeResponse) : claudeResponse;
    } catch (e: any) {
      throw new Error(`Invalid JSON from Claude: ${e.message}`);
    }

    // 6) Stocker dans memo_versions
    const { error: updErr } = await adminClient
      .from('memo_versions')
      .update({
        slide_payload: slidePayload,
        slide_payload_generated_at: new Date().toISOString(),
        slide_payload_generated_by_agent: 'generate-pe-slide-payload',
      })
      .eq('id', versionId);
    if (updErr) throw new Error(`Update failed: ${updErr.message}`);

    return jsonResponse({
      success: true,
      version_id: versionId,
      slide_payload: slidePayload,
    });
  } catch (err: any) {
    console.error(`[generate-pe-slide-payload] error: ${err.message}`);
    return errorResponse(err.message ?? 'Internal error', 500);
  }
});
