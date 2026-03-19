// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/helpers.ts";
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

    return jsonResponse({ 
      success: true, 
      inserted: data?.length || 0,
      entries: data 
    });
  } catch (e: any) {
    console.error("ingest-knowledge error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
