// supabase/functions/extract-ba-info/index.ts
// Extrait les infos structurées BA (identity, shareholders, management, activity,
// financials) depuis enterprises.document_content via Claude Sonnet.
// Merge dans enterprises.ba_info_metadata sans écraser ce que l'Analyste a saisi.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Tu es un assistant d'analyse financière pour une banque d'affaires africaine. Tu extrais des données structurées depuis le contenu textuel de documents d'entreprise (liasses fiscales SYSCOHADA, statuts, pitch decks, relevés).

Retourne UN SEUL objet JSON valide avec EXACTEMENT cette structure (ne jamais inventer de valeurs : null/[]/'' si non trouvé) :

{
  "identity": {
    "rccm": "",
    "date_creation_iso": "YYYY-MM-DD ou ''",
    "legal_form": "SARL/SA/SAS/SASU/EI/SCS/GIE/Coopérative/Autre/''",
    "capital_social": null
  },
  "shareholders": [{"id":"r-1","name":"","pct":0,"role":""}],
  "management": [{"id":"r-1","name":"","role":"","anciennete_years":0}],
  "activity": {
    "description": "",
    "products": [],
    "markets": [],
    "key_clients": [],
    "competitive_advantages": ""
  },
  "financials": {
    "ca_n": null, "ca_n_1": null, "ca_n_2": null,
    "ebitda_n": null, "marge_ebitda_n": null,
    "dette_totale": null, "currency": "XOF"
  }
}

Règles :
- Si l'info n'est PAS dans le contenu, mets null (number) ou '' (string) ou [] (array).
- Pourcentages actionnariat doivent totaliser 100 si tu en mets.
- Montants en XOF par défaut. Convertis EUR→XOF (×655.957) ou USD→XOF (×600 approx) si tu rencontres ces devises.
- Ne JAMAIS commenter, retourne UNIQUEMENT le JSON.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return err(401, 'Missing Authorization');

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) return err(500, 'ANTHROPIC_API_KEY non configurée');

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return err(401, 'Invalid token');

    const { enterprise_id, deal_id } = await req.json();
    if (!enterprise_id) return err(400, 'enterprise_id requis');

    const admin = createClient(url, serviceKey);

    // 1. Récup enterprise + content
    const { data: ent, error: eErr } = await admin
      .from('enterprises')
      .select('id, organization_id, name, sector, country, ba_info_metadata, document_content')
      .eq('id', enterprise_id)
      .maybeSingle();
    if (eErr) return err(500, `Lecture enterprise : ${eErr.message}`);
    if (!ent) return err(404, 'Enterprise introuvable');

    // 2. Si pas de document_content, aussi tenter pe_deal_documents.content_extracted
    let combinedContent = (ent as any).document_content ?? '';
    if (deal_id) {
      const { data: docs } = await admin
        .from('pe_deal_documents')
        .select('filename, content_extracted')
        .eq('deal_id', deal_id)
        .not('content_extracted', 'is', null);
      const dealContent = (docs ?? []).map((d: any) => `=== ${d.filename} ===\n${d.content_extracted}`).join('\n\n');
      if (dealContent) combinedContent = (combinedContent ? combinedContent + '\n\n' : '') + dealContent;
    }

    if (!combinedContent.trim()) {
      return err(400, "Aucun contenu de document à analyser. Uploadez d'abord les documents du mandant.");
    }

    // 3. Tronque si trop long (Claude prend ~200k tokens mais on garde du contexte)
    const MAX_CHARS = 150_000;
    const truncated = combinedContent.length > MAX_CHARS
      ? combinedContent.slice(0, MAX_CHARS) + '\n\n[…contenu tronqué…]'
      : combinedContent;

    const userPrompt = `Entreprise : ${(ent as any).name}\nSecteur : ${(ent as any).sector ?? 'non renseigné'}\nPays : ${(ent as any).country ?? 'non renseigné'}\n\nContenu des documents :\n\n${truncated}\n\nExtrait les données structurées au format JSON.`;

    // 4. Appel Claude
    const t0 = Date.now();
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const duration = Date.now() - t0;
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return err(500, `Claude API ${aiResp.status} : ${txt.slice(0, 500)}`);
    }
    const aiJson = await aiResp.json();
    const rawText = (aiJson.content?.[0]?.text ?? '').trim();
    const inputTokens = aiJson.usage?.input_tokens ?? 0;
    const outputTokens = aiJson.usage?.output_tokens ?? 0;

    // 5. Parse JSON (tolère ```json wrappers)
    let extracted: any = {};
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
      extracted = JSON.parse(cleaned);
    } catch (_e) {
      return err(500, `Parsing JSON Claude échoué : ${rawText.slice(0, 300)}`);
    }

    // 6. Merge non-destructif : on garde ce que l'Analyste a déjà mis
    const existing = ((ent as any).ba_info_metadata ?? {}) as any;
    const merged = {
      identity: { ...(extracted.identity ?? {}), ...(existing.identity ?? {}) },
      shareholders: existing.shareholders?.length ? existing.shareholders : (extracted.shareholders ?? []),
      management: existing.management?.length ? existing.management : (extracted.management ?? []),
      activity: { ...(extracted.activity ?? {}), ...(existing.activity ?? {}) },
      financials: { ...(extracted.financials ?? {}), ...(existing.financials ?? {}) },
    };

    // 7. Save
    const { error: upErr } = await admin
      .from('enterprises')
      .update({
        ba_info_metadata: merged,
        ba_info_ai_filled: true,
        ba_info_updated_at: new Date().toISOString(),
      })
      .eq('id', enterprise_id);
    if (upErr) return err(500, `Update échoué : ${upErr.message}`);

    // 8. Log coût IA (best effort)
    try {
      const inputCost = (inputTokens / 1_000_000) * 3;
      const outputCost = (outputTokens / 1_000_000) * 15;
      const cost_usd = inputCost + outputCost;
      await admin.from('ai_cost_log').insert({
        enterprise_id,
        organization_id: (ent as any).organization_id,
        function_name: 'extract-ba-info',
        model: 'claude-sonnet-4-6',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd,
        duration_ms: duration,
      });
    } catch (_) {}

    return ok({ success: true, merged, duration_ms: duration, tokens: { input: inputTokens, output: outputTokens } });
  } catch (e: any) {
    console.error('[extract-ba-info]', e);
    return err(500, e?.message ?? 'Erreur serveur');
  }
});

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
