// render-diagnostic — rend la PROSE d'un diagnostic de candidature dans une langue cible.
//
// INVARIANT : candidatures.screening_data n'est JAMAIS écrit par cette fonction.
// Le rendu va dans candidature_diagnostic_renders, indexé par (candidature, langue).
//
// Ce qui part au modèle : uniquement extractProse(screening_data), c'est-à-dire les
// chemins listés dans _shared/diagnostic-prose.ts. Le score, les montants, les
// statuts, les niveaux de preuve, les sévérités et les booléens de cohérence ne
// sont pas transmis — ils n'ont donc aucun moyen de bouger d'une langue à l'autre.
//
// Le prompt vient du registre (ai_prompts, code RENDER_DIAGNOSTIC, version active).
// Code, version et modèle sont enregistrés sur chaque ligne de rendu : un rendu
// reste explicable après coup, contrairement au diagnostic source dont l'audit du
// 2026-09-10 a montré qu'il ne conserve aucune trace de sa production.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractProse } from "../_shared/diagnostic-prose.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Langues rendables. `fr` est volontairement absente : la prose française EST
 *  screening_data — la rendre produirait une seconde vérité. */
const LOCALE_NAMES: Record<string, string> = {
  en: "anglais",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Non autorisé" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const candidatureId = body.candidature_id as string | undefined;
    const locale = String(body.locale || "").trim();
    const force = body.force === true;

    if (!candidatureId) return jsonRes({ error: "candidature_id requis" }, 400);
    if (locale === "fr") {
      // Pas une erreur : un appel fr est un no-op explicite, pour que l'appelant
      // n'ait pas à connaître cette règle.
      return jsonRes({ ok: true, skipped: true, reason: "la prose française est screening_data" });
    }
    if (!LOCALE_NAMES[locale]) {
      return jsonRes({ error: `Langue non prise en charge : ${locale || "(vide)"}` }, 400);
    }

    // ── Candidature + garde de portée (même règle que screen-candidatures) ──
    const { data: cand } = await supabase
      .from("candidatures")
      .select("id, programme_id, organization_id, screening_data, screening_date")
      .eq("id", candidatureId)
      .maybeSingle();
    if (!cand) return jsonRes({ error: "Candidature introuvable" }, 404);

    const { data: programme } = await supabase
      .from("programmes")
      .select("id, organization_id, chef_programme_id")
      .eq("id", cand.programme_id)
      .maybeSingle();
    if (!programme) return jsonRes({ error: "Programme non trouvé" }, 404);

    const [{ data: roleData }, { data: orgMems }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("organization_members").select("role, organization_id").eq("user_id", user.id).eq("is_active", true),
    ]);
    const ROLE_PRIORITY: Record<string, number> = { owner: 0, admin: 1, manager: 2, coach: 3, analyst: 4, entrepreneur: 5 };
    const bestMem = (orgMems || []).slice().sort((a: any, b: any) => (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99))[0];
    const isAdmin = roleData?.role === "super_admin";
    const isOwnerOrAdmin = bestMem?.role === "owner" || bestMem?.role === "admin" || bestMem?.role === "manager";
    const canAccess = isAdmin
      || (isOwnerOrAdmin && programme.organization_id === bestMem?.organization_id)
      || programme.chef_programme_id === user.id;
    if (!canAccess) return jsonRes({ error: "Accès refusé" }, 403);

    // ── Le diagnostic source doit exister et être exploitable ──
    const sd = cand.screening_data as Record<string, unknown> | null;
    if (!sd || (sd as any)._error || Object.keys(sd).length < 5) {
      return jsonRes({ error: "Aucun diagnostic exploitable à rendre pour cette candidature" }, 409);
    }

    // ── Rendu déjà à jour ? ──
    const { data: existing } = await supabase
      .from("candidature_diagnostic_renders")
      .select("id, source_screening_date, prompt_version, model, created_at")
      .eq("candidature_id", candidatureId)
      .eq("locale", locale)
      .maybeSingle();

    const upToDate = existing
      && String(existing.source_screening_date ?? "") === String(cand.screening_date ?? "");
    if (upToDate && !force) {
      return jsonRes({ ok: true, skipped: true, reason: "rendu déjà à jour", render_id: existing.id });
    }

    // ── Prompt depuis le registre ──
    const { data: prompt } = await supabase
      .from("ai_prompts")
      .select("code, version, model, temperature, max_tokens, system_prompt, user_prompt_template")
      .eq("code", "RENDER_DIAGNOSTIC")
      .eq("is_active", true)
      .maybeSingle();
    if (!prompt) return jsonRes({ error: "Prompt RENDER_DIAGNOSTIC actif introuvable dans ai_prompts" }, 500);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return jsonRes({ error: "ANTHROPIC_API_KEY non configurée" }, 500);

    // ── Seule la prose part au modèle ──
    const prose = extractProse(sd);
    if (Object.keys(prose).length === 0) {
      return jsonRes({ error: "Aucune prose extraite du diagnostic" }, 409);
    }

    const userPrompt = prompt.user_prompt_template
      .replace("{{locale}}", locale)
      .replace("{{locale_name}}", LOCALE_NAMES[locale])
      .replace("{{prose_json}}", JSON.stringify(prose, null, 2));

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: prompt.model,
        max_tokens: prompt.max_tokens,
        temperature: Number(prompt.temperature),
        system: prompt.system_prompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return jsonRes({ error: `Appel modèle échoué : ${resp.status} ${text.slice(0, 300)}` }, 502);
    }

    const payload = await resp.json();
    const raw = (payload.content || [])
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    let rendered: Record<string, unknown>;
    try {
      const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end <= start) throw new Error("pas de JSON dans la réponse");
      rendered = JSON.parse(cleaned.slice(start, end + 1));
    } catch (e: any) {
      // Pas de réparation partielle ici : un rendu tronqué produirait un texte
      // amputé présenté comme complet. On échoue, l'ancien rendu (s'il existe) survit.
      return jsonRes({ error: `Réponse modèle illisible : ${e.message}` }, 502);
    }

    const usage = payload.usage || {};
    const cost = ((usage.input_tokens || 0) * 3 + (usage.output_tokens || 0) * 15) / 1_000_000;

    const { data: saved, error: saveErr } = await supabase
      .from("candidature_diagnostic_renders")
      .upsert({
        candidature_id: candidatureId,
        locale,
        prose: rendered,
        prompt_code: prompt.code,
        prompt_version: prompt.version,
        model: prompt.model,
        source_screening_date: cand.screening_date,
        input_tokens: usage.input_tokens ?? null,
        output_tokens: usage.output_tokens ?? null,
        cost_usd: Number(cost.toFixed(4)),
        organization_id: cand.organization_id ?? programme.organization_id ?? null,
        created_by: user.id,
        created_at: new Date().toISOString(),
      }, { onConflict: "candidature_id,locale" })
      .select("id")
      .maybeSingle();

    if (saveErr) return jsonRes({ error: `Enregistrement du rendu échoué : ${saveErr.message}` }, 500);

    return jsonRes({
      ok: true,
      render_id: saved?.id ?? null,
      locale,
      prompt_code: prompt.code,
      prompt_version: prompt.version,
      model: prompt.model,
      usage: { input_tokens: usage.input_tokens ?? null, output_tokens: usage.output_tokens ?? null, cost_usd: Number(cost.toFixed(4)) },
    });
  } catch (e: any) {
    console.error("[render-diagnostic]", e);
    return jsonRes({ error: e?.message || "Erreur inconnue" }, 500);
  }
});
