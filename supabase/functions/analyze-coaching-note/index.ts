import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, callAI } from "../_shared/helpers_v5.ts";

const SYSTEM = `Tu analyses des notes de coaching (comptes-rendus de RDV entre un coach et un entrepreneur africain).

Produis :
1. Un TITRE court (5-8 mots)
2. Un RÉSUMÉ structuré (3-5 phrases)
3. Les INFORMATIONS FACTUELLES extraites

Pour chaque info, indique la catégorie (financier/commercial/operationnel/equipe_rh/legal/strategique) et si elle doit être injectée dans le pipeline IA (true = donnée factuelle utile, false = info de contexte).

IMPORTANT: JSON valide uniquement.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { raw_content, date_rdv, file_name } = await req.json();
    if (!raw_content || raw_content.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Contenu trop court" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await callAI(SYSTEM, `Analyse cette note :
${date_rdv ? `Date RDV : ${date_rdv}` : ""}
${file_name ? `Fichier : ${file_name}` : ""}

CONTENU :
${raw_content.substring(0, 10000)}

JSON : {"titre": "...", "resume": "...", "infos_extraites": [{"info": "...", "categorie": "...", "injecter": true|false}]}`, 4096, "claude-sonnet-4-20250514", 0);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
