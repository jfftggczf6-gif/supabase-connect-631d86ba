// Phase 2 RAG — Ingestion d'un document dans knowledge_chunks
// Appelée après ajout/upload d'une entrée dans knowledge_base ou organization_knowledge
// - Découpe le contenu en chunks de ~500 tokens
// - Génère les embeddings (OpenAI text-embedding-3-small, 1536 dim)
// - Stocke les chunks avec embeddings pour recherche vectorielle future

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

// Découpe un texte en chunks de ~500 tokens (~2000 chars) avec overlap de 50 tokens
// pour préserver le contexte à la jointure des chunks
function chunkText(text: string, targetCharsPerChunk = 2000, overlapChars = 200): string[] {
  if (!text || text.length < 100) return text ? [text] : [];

  // Essayer de découper sur les sauts de paragraphe d'abord
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    if (current.length + p.length + 2 <= targetCharsPerChunk) {
      current += (current ? "\n\n" : "") + p;
    } else {
      if (current) chunks.push(current);
      // Si le paragraphe seul dépasse la taille, le découper sur les phrases
      if (p.length > targetCharsPerChunk) {
        const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
        let sub = "";
        for (const s of sentences) {
          if (sub.length + s.length <= targetCharsPerChunk) {
            sub += s;
          } else {
            if (sub) chunks.push(sub.trim());
            sub = s;
          }
        }
        if (sub) chunks.push(sub.trim());
        current = "";
      } else {
        current = p;
      }
    }
  }
  if (current) chunks.push(current);

  // Ajouter overlap entre chunks consécutifs (pour préserver le contexte)
  if (overlapChars > 0 && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = chunks[i - 1].slice(-overlapChars);
      chunks[i] = prevEnd + "\n\n" + chunks[i];
    }
  }

  return chunks;
}

// Voyage AI embeddings — voyage-3 (1024 dim), optimisé RAG multilingue (FR excellent)
async function generateEmbedding(text: string, voyageKey: string, inputType: 'document' | 'query' = 'document'): Promise<number[] | null> {
  try {
    const resp = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${voyageKey}`,
      },
      body: JSON.stringify({
        input: text.slice(0, 32000),  // Voyage limit: 32K tokens
        model: "voyage-3",
        input_type: inputType,  // 'document' pour ingestion, 'query' pour recherche
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[embedding] Voyage error ${resp.status}: ${err.slice(0, 200)}`);
      return null;
    }
    const data = await resp.json();
    return data.data?.[0]?.embedding || null;
  } catch (e: any) {
    console.error(`[embedding] Exception:`, e.message);
    return null;
  }
}

// Voyage supporte les batchs — plus efficace que 1 appel/chunk
// Voyage renvoie data[] indexé par `index` (pas forcément dans l'ordre des inputs)
async function generateEmbeddingsBatch(texts: string[], voyageKey: string): Promise<(number[] | null)[]> {
  try {
    const resp = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${voyageKey}`,
      },
      body: JSON.stringify({
        input: texts.map(t => t.slice(0, 32000)),
        model: "voyage-3",
        input_type: "document",
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[embedding-batch] Voyage error ${resp.status} (${texts.length} items): ${err.slice(0, 300)}`);
      return texts.map(() => null);
    }
    const data = await resp.json();
    const items: any[] = data.data || [];
    console.log(`[embedding-batch] Voyage returned ${items.length}/${texts.length} embeddings`);
    // Reconstruire dans l'ordre d'origine via `index`
    const out: (number[] | null)[] = texts.map(() => null);
    for (const item of items) {
      const idx = typeof item.index === "number" ? item.index : -1;
      if (idx >= 0 && idx < out.length && Array.isArray(item.embedding)) {
        out[idx] = item.embedding;
      }
    }
    return out;
  } catch (e: any) {
    console.error(`[embedding-batch] Exception:`, e.message);
    return texts.map(() => null);
  }
}

// Retry individuel pour les items qui ont échoué en batch
async function retryFailedEmbeddings(
  texts: string[],
  embeddings: (number[] | null)[],
  voyageKey: string,
): Promise<(number[] | null)[]> {
  const out = [...embeddings];
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) {
      console.log(`[embedding-retry] Retrying index ${i} individually`);
      out[i] = await generateEmbedding(texts[i], voyageKey, "document");
      // Petite pause pour éviter le rate-limit
      await new Promise(r => setTimeout(r, 150));
    }
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const voyageKey = Deno.env.get("VOYAGE_API_KEY");
    if (!voyageKey) return jsonRes({ error: "VOYAGE_API_KEY non configurée" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { kb_entry_id, org_entry_id, force = false } = body;

    if (!kb_entry_id && !org_entry_id) {
      return jsonRes({ error: "kb_entry_id ou org_entry_id requis" }, 400);
    }

    // 1. Récupérer le doc source
    let doc: any = null;
    if (kb_entry_id) {
      const { data } = await supabase
        .from("knowledge_base")
        .select("id, title, content, category, sector, country, source, metadata")
        .eq("id", kb_entry_id)
        .maybeSingle();
      doc = data;
    } else {
      const { data } = await supabase
        .from("organization_knowledge")
        .select("id, title, content, category, sector, country, source, metadata")
        .eq("id", org_entry_id)
        .maybeSingle();
      doc = data;
    }

    if (!doc) return jsonRes({ error: "Document introuvable" }, 404);
    if (!doc.content || doc.content.length < 100) {
      return jsonRes({ skipped: true, reason: "content trop court (<100 chars)" });
    }

    // 2. Supprimer les chunks existants si force=true
    if (force) {
      if (kb_entry_id) {
        await supabase.from("knowledge_chunks").delete().eq("kb_entry_id", kb_entry_id);
      } else {
        await supabase.from("knowledge_chunks").delete().eq("org_entry_id", org_entry_id);
      }
    } else {
      // Vérifier si déjà ingéré
      const field = kb_entry_id ? "kb_entry_id" : "org_entry_id";
      const id = kb_entry_id || org_entry_id;
      const { count } = await supabase
        .from("knowledge_chunks")
        .select("id", { count: "exact", head: true })
        .eq(field, id);
      if ((count || 0) > 0) {
        return jsonRes({ skipped: true, reason: "déjà ingéré", existing_chunks: count });
      }
    }

    // 3. Chunker le contenu
    const chunks = chunkText(doc.content);
    if (chunks.length === 0) return jsonRes({ skipped: true, reason: "aucun chunk produit" });

    // 4. Générer les embeddings par batch (Voyage: max 128 inputs/call)
    const inserts: any[] = [];
    let embedSuccess = 0;
    let embedFail = 0;

    const BATCH_SIZE = 64;  // Conservative pour rester dans les limites Voyage
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batch = chunks.slice(batchStart, batchStart + BATCH_SIZE);
      let embeddings = await generateEmbeddingsBatch(batch, voyageKey);

      // Retry per-item pour les nulls (batch peut échouer silencieusement)
      if (embeddings.some(e => e === null)) {
        embeddings = await retryFailedEmbeddings(batch, embeddings, voyageKey);
      }

      for (let i = 0; i < batch.length; i++) {
        const embedding = embeddings[i];
        if (embedding) embedSuccess++;
        else {
          embedFail++;
          console.error(`[rag-ingest] Chunk ${batchStart + i} has no embedding after retry — skipping insert`);
          continue;  // Ne pas insérer un chunk sans embedding (inutile pour vector search)
        }

        inserts.push({
          kb_entry_id: kb_entry_id || null,
          org_entry_id: org_entry_id || null,
          chunk_index: batchStart + i,
          content: batch[i],
          token_count: Math.ceil(batch[i].length / 4),
          title: doc.title,
          source: doc.source,
          country: doc.country,
          sector: doc.sector,
          category: doc.category,
          source_url: doc.metadata?.source_url || null,
          publication_date: doc.metadata?.publication_date || null,
          embedding,
        });
      }
    }

    // Insert par batch de 10
    for (let i = 0; i < inserts.length; i += 10) {
      const batch = inserts.slice(i, i + 10);
      const { error } = await supabase.from("knowledge_chunks").insert(batch);
      if (error) {
        console.error("[rag-ingest] batch insert error:", error);
        return jsonRes({ error: error.message, chunks_inserted: i }, 500);
      }
    }

    return jsonRes({
      success: true,
      doc_title: doc.title,
      chunks_created: chunks.length,
      embeddings_success: embedSuccess,
      embeddings_failed: embedFail,
    });

  } catch (e: any) {
    console.error("[rag-ingest] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
