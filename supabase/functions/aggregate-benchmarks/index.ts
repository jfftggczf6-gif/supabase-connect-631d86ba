// Edge function: aggregate-benchmarks
// Cron job qui agrège les benchmarks à partir des entreprises traitées
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Récupérer tous les inputs_data avec des données financières
    const { data: deliverables } = await supabase
      .from('deliverables')
      .select('enterprise_id, data')
      .eq('type', 'inputs_data')
      .not('data', 'is', null);

    if (!deliverables?.length) {
      return new Response(JSON.stringify({ message: "Aucun livrable à agréger" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Récupérer les entreprises pour secteur/pays
    const entIds = [...new Set(deliverables.map(d => d.enterprise_id))];
    const { data: enterprises } = await supabase
      .from('enterprises')
      .select('id, sector, country')
      .in('id', entIds);

    const entMap = new Map(enterprises?.map(e => [e.id, e]) || []);

    // Agréger par secteur/pays
    const buckets: Record<string, number[]> = {};
    
    for (const d of deliverables) {
      const ent = entMap.get(d.enterprise_id);
      if (!ent?.sector || !ent?.country) continue;

      const secteur = ent.sector.toLowerCase().replace(/[\s\-\/]/g, '_');
      const pays = ent.country.toLowerCase().replace(/[\s'']/g, '_').replace(/côte_d_ivoire|cote_divoire/i, 'cote_d_ivoire');
      const key = `${secteur}|${pays}`;

      const data = d.data as any;
      const ca = data?.compte_resultat?.chiffre_affaires || data?.kpis?.chiffre_affaires;
      const margeBrute = data?.kpis?.marge_brute_pct || data?.sante_financiere?.marge_brute_pct;
      const ebitda = data?.kpis?.marge_ebitda_pct || data?.sante_financiere?.marge_ebitda_pct;

      if (!buckets[key]) buckets[key] = [];
      if (margeBrute != null) {
        buckets[key].push(margeBrute);
      }
    }

    let upserted = 0;
    for (const [key, margins] of Object.entries(buckets)) {
      if (margins.length < 3) continue; // Seuil minimum

      const [secteur, pays] = key.split('|');
      const sorted = margins.sort((a, b) => a - b);
      const p25 = sorted[Math.floor(sorted.length * 0.25)];
      const median = sorted[Math.floor(sorted.length * 0.5)];
      const p75 = sorted[Math.floor(sorted.length * 0.75)];

      await supabase
        .from('aggregated_benchmarks')
        .upsert({
          secteur,
          pays,
          nb_entreprises: margins.length,
          marge_brute_p25: p25,
          marge_brute_mediane: median,
          marge_brute_p75: p75,
          derniere_agregation: new Date().toISOString(),
        }, { onConflict: 'secteur,pays' });

      upserted++;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      aggregated: upserted, 
      total_deliverables: deliverables.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error("aggregate-benchmarks error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
