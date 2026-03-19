// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers.ts";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

async function getEmbedding(text: string): Promise<number[]> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000),
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error: ${response.status} — ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { mode = "backfill", id } = body;

    if (mode === "single" && id) {
      const { data: entry } = await sb.from("knowledge_base").select("title, content, category").eq("id", id).single();
      if (!entry) throw new Error("Entry not found");

      const textToEmbed = `${entry.category}: ${entry.title}\n${entry.content}`;
      const embedding = await getEmbedding(textToEmbed);

      await sb.from("knowledge_base")
        .update({ embedding: JSON.stringify(embedding) })
        .eq("id", id);

      return new Response(JSON.stringify({ success: true, id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode: backfill — generate embeddings for all entries without one
    const { data: entries } = await sb
      .from("knowledge_base")
      .select("id, title, content, category")
      .is("embedding", null)
      .limit(50);

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "All entries already have embeddings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let errors = 0;

    for (let i = 0; i < entries.length; i += 5) {
      const batch = entries.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (entry) => {
          const textToEmbed = `${entry.category}: ${entry.title}\n${entry.content}`;
          const embedding = await getEmbedding(textToEmbed);
          await sb.from("knowledge_base")
            .update({ embedding: JSON.stringify(embedding) })
            .eq("id", entry.id);
          return entry.id;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") processed++;
        else { errors++; console.error("Embedding error:", r.reason); }
      }

      if (i + 5 < entries.length) await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ success: true, processed, errors, total: entries.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-embeddings error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
