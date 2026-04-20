// Phase 2 RAG — Recherche vectorielle
// Appelée par les agents de génération (generate-pre-screening, generate-business-plan, etc.)
// - Reçoit une query texte
// - Génère son embedding
// - Retourne les N chunks les plus pertinents
// - Format prêt à être injecté dans un prompt Claude

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateEmbedding(text: string, openaiKey: string): Promise<number[] | null> {
  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return jsonRes({ error: "OPENAI_API_KEY non configurée" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      query,
      match_count = 8,
      match_threshold = 0.3,
      country = null,
      sector = null,
      organization_id = null,
    } = body;

    if (!query || typeof query !== "string" || query.length < 3) {
      return jsonRes({ error: "query (string >=3 chars) requis" }, 400);
    }

    // 1. Générer embedding de la query
    const queryEmbedding = await generateEmbedding(query, openaiKey);
    if (!queryEmbedding) {
      return jsonRes({ error: "Impossible de générer l'embedding de la query" }, 500);
    }

    // 2. Recherche vectorielle via RPC
    const { data: chunks, error } = await supabase.rpc("search_knowledge_chunks", {
      query_embedding: queryEmbedding,
      match_threshold,
      match_count,
      filter_country: country,
      filter_sector: sector,
      filter_organization_id: organization_id,
    });

    if (error) {
      console.error("[rag-search] RPC error:", error);
      return jsonRes({ error: error.message }, 500);
    }

    // 3. Formatter pour prompt Claude (texte injectable)
    const formatted = (chunks || []).map((c: any, i: number) => {
      const sourceStr = c.source ? ` — ${c.source}` : "";
      const urlStr = c.source_url ? ` | ${c.source_url}` : "";
      const pubDate = c.publication_date ? ` (${c.publication_date})` : "";
      const simScore = ` [similarité: ${(c.similarity * 100).toFixed(0)}%]`;
      return `[REF-${i + 1}] ${c.title}${sourceStr}${pubDate}${urlStr}${simScore}
${c.content}`;
    }).join("\n---\n");

    return jsonRes({
      success: true,
      chunks_found: chunks?.length || 0,
      chunks: chunks || [],
      prompt_text: formatted,
    });

  } catch (e: any) {
    console.error("[rag-search] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
