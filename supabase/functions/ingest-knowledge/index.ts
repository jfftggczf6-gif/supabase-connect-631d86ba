// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/helpers_v5.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Non autorisé", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    // Verify user is coach
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return errorResponse("Non autorisé", 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    const { entries } = await req.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      return errorResponse("'entries' requis (tableau d'entrées knowledge_base)", 400);
    }

    // Validate and insert entries
    const validEntries = entries.map((e: any) => ({
      category: e.category || "general",
      title: e.title || "Sans titre",
      content: e.content || "",
      metadata: e.metadata || {},
      source: e.source || null,
      country: e.country || null,
      sector: e.sector || null,
      tags: e.tags || [],
    })).filter((e: any) => e.content.length > 10);

    const { data, error } = await supabase
      .from("knowledge_base")
      .insert(validEntries)
      .select("id, category, title");

    if (error) throw error;

    // Fire-and-forget : 2 indexations en parallèle pour rendre la doc immédiatement
    // searchable par les 2 catégories d'agents.
    //   - rag-ingest      → chunking + embeddings Voyage dans knowledge_chunks
    //                       (utilisé par les agents Python sur Railway via search_knowledge_chunks)
    //   - generate-embeddings (mode 'single') → embedding global Voyage 1024d sur
    //                       knowledge_base.embedding (utilisé par les 15 agents Deno
    //                       via search_knowledge / buildRAGContext)
    for (const entry of data || []) {
      fetch(`${supabaseUrl}/functions/v1/rag-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ kb_entry_id: entry.id, force: false }),
      }).catch((e) => console.warn(`[ingest-knowledge] rag-ingest failed for ${entry.id}:`, e.message));

      fetch(`${supabaseUrl}/functions/v1/generate-embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ mode: "single", id: entry.id }),
      }).catch((e) => console.warn(`[ingest-knowledge] generate-embeddings failed for ${entry.id}:`, e.message));
    }

    return jsonResponse({
      success: true,
      inserted: data?.length || 0,
      entries: data,
      rag_ingest_triggered: data?.length || 0,
    });
  } catch (e: any) {
    console.error("ingest-knowledge error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
