import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, callAI } from "../_shared/helpers_v5.ts";

const SYSTEM = `Tu analyses des notes de coaching (comptes-rendus de RDV entre un coach et un entrepreneur africain).

Tu dois produire :
1. Un TITRE court (5-8 mots)
2. Un RÉSUMÉ structuré (3-5 phrases)
3. Les CORRECTIONS à appliquer aux livrables existants
4. Le CONTEXTE (infos utiles mais pas des corrections)
5. Les ACTIONS pour le coach

CORRECTIONS : ce sont des données factuelles nouvelles ou corrigées qui doivent modifier un livrable. Pour chaque correction, indique :
- "info" : la donnée (ex: "CA 2024 corrigé à 520M")
- "type" : "correction_chiffre" | "info_qualitative" | "investissement" | "info_rh" | "info_marche"
- "deliverable" : le livrable cible parmi : inputs_data, bmc_analysis, sic_analysis, plan_financier, business_plan, odd_analysis, diagnostic_data, valuation, onepager, investment_memo
- "field_path" : le chemin JSON du champ à modifier (ex: "compte_resultat.chiffre_affaires", "canvas.segments_clients", "effectifs.total")
- "action" : "remplacer" (écraser la valeur) | "enrichir" (ajouter l'info au texte existant)
- "value" : la nouvelle valeur (nombre si chiffre, texte si qualitatif)
- "priorite" : "haute" (chiffre financier critique) | "moyenne" (info utile) | "basse" (contexte)

MAPPING DES CHAMPS COURANTS :
- CA / Chiffre d'affaires → inputs_data > compte_resultat.chiffre_affaires
- Charges personnel / Salaires → inputs_data > compte_resultat.charges_personnel
- Effectifs / Employés → inputs_data > effectifs.total
- Résultat net → inputs_data > compte_resultat.resultat_net
- Marge brute → inputs_data > compte_resultat.marge_brute
- Trésorerie → inputs_data > bilan.tresorerie
- Clients / Segments → bmc_analysis > canvas.segments_clients
- Produits / Services → bmc_analysis > canvas.proposition_valeur
- Concurrents → bmc_analysis > canvas.concurrence
- Investissement / CAPEX → plan_financier > investissements
- Besoin financement → valuation > besoin_financement
- Impact social / Bénéficiaires → sic_analysis > impact
- ODD → odd_analysis > odd_alignment

CONTEXTE : infos qui ne modifient pas directement un livrable mais sont utiles pour le prochain pipeline (ex: "le concurrent a fermé", "le bilan sera prêt en avril").

ACTIONS COACH : rappels et tâches pour le coach (ex: "Relancer en avril pour le bilan", "Vérifier le contrat avec l'hôtel").

IMPORTANT: JSON valide uniquement.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { raw_content, date_rdv, file_name, enterprise_id } = await req.json();
    if (!raw_content || raw_content.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Contenu trop court" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing deliverables context if enterprise_id provided
    let existingContext = "";
    if (enterprise_id) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: deliverables } = await supabase
          .from("deliverables")
          .select("type, data, score")
          .eq("enterprise_id", enterprise_id);

        if (deliverables?.length) {
          const inputsData = deliverables.find((d: any) => d.type === "inputs_data")?.data;
          if (inputsData && typeof inputsData === "object") {
            const cr = (inputsData as any).compte_resultat || {};
            const eff = (inputsData as any).effectifs || {};
            existingContext = `\n\nDONNÉES ACTUELLES DE L'ENTREPRISE (pour détecter les corrections) :
CA actuel : ${cr.chiffre_affaires || "non renseigné"}
Charges personnel : ${cr.charges_personnel || "non renseigné"}
Résultat net : ${cr.resultat_net || "non renseigné"}
Effectifs : ${eff.total || "non renseigné"}
Trésorerie : ${(inputsData as any).bilan?.tresorerie || "non renseigné"}`;
          }
        }
      } catch (e) {
        console.warn("[analyze-coaching-note] Could not fetch context:", e);
      }
    }

    const result = await callAI(SYSTEM, `Analyse cette note de coaching :
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
      "info": "string — description de la correction",
      "type": "correction_chiffre | info_qualitative | investissement | info_rh | info_marche",
      "deliverable": "inputs_data | bmc_analysis | plan_financier | ...",
      "field_path": "string — chemin JSON",
      "action": "remplacer | enrichir",
      "value": "number ou string",
      "priorite": "haute | moyenne | basse"
    }
  ],
  "contexte": ["string — infos de contexte non-actionnables"],
  "actions_coach": ["string — tâches/rappels pour le coach"],
  "infos_extraites": [{"info": "string", "categorie": "string", "injecter": true|false}]
}`, 4096, "claude-sonnet-4-20250514", 0, { functionName: "analyze-coaching-note", enterpriseId: "" });

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
