import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, callAI } from "../_shared/helpers_v5.ts";

// ─────────────────────────────────────────────────────────────────────────────
// analyze-pe-deal-note
// Équivalent PE de analyze-coaching-note : analyse une note (texte ou
// extraction de fichier) déposée par l'analyste / IM / MD sur un deal,
// produit un titre, un résumé, des corrections proposées sur les sections
// du memo / pré-screening, du contexte et des actions analyste.
// ─────────────────────────────────────────────────────────────────────────────

const MEMO_SECTIONS = [
  "executive_summary",
  "shareholding_governance",
  "top_management",
  "services",
  "competition_market",
  "unit_economics",
  "financials_pnl",
  "financials_balance",
  "investment_thesis",
  "support_requested",
  "esg_risks",
  "annexes",
];

const SYSTEM = `Tu analyses des notes d'analyste d'investissement Private Equity (compte-rendus de RDV avec l'entrepreneur, due diligence terrain, échanges téléphoniques, lectures de documents complémentaires).

Tu dois produire :
1. Un TITRE court (5-8 mots)
2. Un RÉSUMÉ structuré (3-5 phrases)
3. Les CORRECTIONS à appliquer aux livrables existants (memo d'investissement, pré-screening 360°)
4. Le CONTEXTE (infos utiles mais pas des corrections)
5. Les ACTIONS pour l'analyste

CORRECTIONS : ce sont des données factuelles nouvelles ou corrigées qui doivent modifier une section du memo. Pour chaque correction :
- "info" : description courte (ex: "CA 2024 corrigé à 8.2 Mds FCFA")
- "type" : "correction_chiffre" | "info_qualitative" | "info_rh" | "info_marche" | "info_gouvernance" | "info_esg"
- "section_code" : code de section parmi : ${MEMO_SECTIONS.join(", ")}
- "field_path" : chemin JSON dans content_json (ex: "pnl.ca", "equipe_dirigeante.rows.0.profil_eval", "kpis_suivi.rows.2.t0"). Utilise un point pour les indices d'array.
- "action" : "remplacer" (écraser) | "enrichir" (concaténer au texte existant)
- "value" : nouvelle valeur (number ou string)
- "priorite" : "haute" | "moyenne" | "basse"

MAPPING DES CHAMPS COURANTS :
- CA / Chiffre d'affaires → "financials_pnl" > pnl.ca
- EBITDA / Marge → "financials_pnl" > pnl.ebitda
- Effectifs → "top_management" > capacite_absorption.evaluation
- Cap table / Actionnaires → "shareholding_governance" > cap_table.rows
- Concurrents → "competition_market" > concurrents.rows
- Marché / TAM → "competition_market" > tam_sam_som
- ODD / Impact → "esg_risks" > odd_kpis
- Red flags → "esg_risks" > red_flags_syscohada
- Thèse → "investment_thesis" > paragraphs

CONTEXTE : infos qui ne modifient pas directement un livrable mais utiles pour la prochaine génération (ex: "le CFO part en mai", "Adiwale a déjà co-investi").

ACTIONS ANALYSTE : rappels et tâches (ex: "Demander la liasse 2024", "Vérifier l'agrément BPF avant l'IC").

IMPORTANT: JSON valide uniquement, pas de markdown autour.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { raw_content, date_rdv, file_name, deal_id } = await req.json();
    if (!raw_content || raw_content.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Contenu trop court" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Contexte deal : récupère les sections existantes pour aider la détection des corrections
    let existingContext = "";
    if (deal_id) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: memo } = await supabase
          .from("investment_memos")
          .select("id")
          .eq("deal_id", deal_id)
          .maybeSingle();

        if (memo?.id) {
          const { data: vers } = await supabase
            .from("memo_versions")
            .select("id, memo_sections(section_code, content_json)")
            .eq("memo_id", memo.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const sections = (vers?.[0]?.memo_sections ?? []) as any[];
          // Résumé compact des champs clés pour orienter l'IA
          const pnl = sections.find((s) => s.section_code === "financials_pnl")?.content_json?.pnl;
          const equipe = sections.find((s) => s.section_code === "top_management")?.content_json?.equipe_dirigeante;
          if (pnl || equipe) {
            existingContext = `\n\nDONNÉES ACTUELLES DU DEAL (pour détecter les corrections) :
CA : ${pnl?.ca ?? "non renseigné"}
EBITDA : ${pnl?.ebitda ?? "non renseigné"}
Équipe dirigeante : ${equipe?.rows?.length ?? 0} membre(s)`;
          }
        }
      } catch (e) {
        console.warn("[analyze-pe-deal-note] Could not fetch context:", e);
      }
    }

    const result = await callAI(SYSTEM, `Analyse cette note analyste PE :
${date_rdv ? `Date RDV : ${date_rdv}` : ""}
${file_name ? `Fichier : ${file_name}` : ""}

CONTENU :
${raw_content.substring(0, 10000)}
${existingContext}

Réponds en JSON :
{
  "titre": "string — 5-8 mots",
  "resume": "string — 3-5 phrases",
  "corrections": [
    {
      "info": "string",
      "type": "correction_chiffre | info_qualitative | info_rh | info_marche | info_gouvernance | info_esg",
      "section_code": "executive_summary | shareholding_governance | top_management | services | competition_market | unit_economics | financials_pnl | financials_balance | investment_thesis | support_requested | esg_risks | annexes",
      "field_path": "string — chemin JSON",
      "action": "remplacer | enrichir",
      "value": "number ou string",
      "priorite": "haute | moyenne | basse"
    }
  ],
  "contexte": ["string"],
  "actions_analyste": ["string"],
  "infos_extraites": [{"info": "string", "categorie": "string", "injecter": true}]
}`, 4096, "claude-sonnet-4-20250514", 0, { functionName: "analyze-pe-deal-note", enterpriseId: "" });

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
