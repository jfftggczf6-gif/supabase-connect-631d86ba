import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
function jsonRes(data: any, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return jsonRes({ error: "Non autorisé" }, 401);
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const programmeId = body.programme_id;
    if (!programmeId) return jsonRes({ error: "programme_id requis" }, 400);

    // Get enterprises via candidatures
    const { data: cands } = await supabase.from("candidatures").select("enterprise_id").eq("programme_id", programmeId).eq("status", "selected");
    const entIds = (cands || []).map(c => c.enterprise_id).filter(Boolean);
    if (!entIds.length) return jsonRes({ success: true, impact: { auto_kpis: {}, custom_kpis: [], odd_detail: {}, par_pays: {}, par_secteur: {}, progression: {} } });

    // Batch fetch
    const [{ data: enterprises }, { data: deliverables }, { data: coachingNotes }, { data: customKpis }] = await Promise.all([
      supabase.from("enterprises").select("id, name, score_ir, sector, country, employees_count, coach_id").in("id", entIds),
      supabase.from("deliverables").select("enterprise_id, type, data, score").in("enterprise_id", entIds),
      supabase.from("coaching_notes").select("id").in("enterprise_id", entIds),
      supabase.from("programme_kpis").select("*").eq("programme_id", programmeId),
    ]);

    const ents = enterprises || [];
    const delivs = deliverables || [];
    const getDeliv = (entId: string, type: string) => {
      const d = delivs.find(d => d.enterprise_id === entId && d.type === type);
      return d?.data && typeof d.data === "object" ? d.data as Record<string, any> : null;
    };

    // AUTO KPIs
    let emploisTotal = 0, caTotal = 0, resultatNetTotal = 0, beneficiairesDirects = 0;
    let oddSet = new Set<string>(), ciblesPositives = 0, sicScoreSum = 0, sicCount = 0;

    for (const e of ents) {
      const inputs = getDeliv(e.id, "inputs_data");
      const odd = getDeliv(e.id, "odd_analysis");
      const sic = getDeliv(e.id, "sic_analysis");

      emploisTotal += inputs?.effectifs?.total || inputs?.effectif_total || e.employees_count || 0;
      caTotal += Number(inputs?.compte_resultat?.chiffre_affaires || inputs?.compte_resultat?.ca || 0);
      resultatNetTotal += Number(inputs?.compte_resultat?.resultat_net || 0);

      if (odd?.evaluation_cibles_odd?.cibles) {
        for (const c of odd.evaluation_cibles_odd.cibles) {
          if (c.evaluation === "positif") {
            oddSet.add(c.odd_parent || c.target_id?.split(".")[0]);
            ciblesPositives++;
          }
        }
      }

      if (sic) {
        sicScoreSum += sic.score_global || sic.score || 0;
        sicCount++;
        beneficiairesDirects += Number(sic.chiffres_cles?.beneficiaires_directs?.nombre || 0);
      }
    }

    const autoKpis: Record<string, any> = {
      emplois_total: { value: emploisTotal, unit: "emplois", category: "emploi" },
      ca_total_cohorte: { value: caTotal, unit: "FCFA", category: "financier" },
      resultat_net_total: { value: resultatNetTotal, unit: "FCFA", category: "financier" },
      odd_couverts: { value: oddSet.size, unit: "ODD", category: "impact_social" },
      cibles_odd_positives: { value: ciblesPositives, unit: "cibles", category: "impact_social" },
      score_impact_social_moyen: { value: sicCount ? Math.round(sicScoreSum / sicCount) : 0, unit: "/100", category: "impact_social" },
      beneficiaires_directs: { value: beneficiairesDirects, unit: "personnes", category: "impact_social" },
      score_ir_moyen: { value: ents.length ? Math.round(ents.reduce((s, e) => s + (e.score_ir || 0), 0) / ents.length) : 0, unit: "/100", category: "gouvernance" },
      nb_livrables_total: { value: delivs.length, unit: "livrables", category: "gouvernance" },
      nb_notes_coaching: { value: (coachingNotes || []).length, unit: "sessions", category: "formation" },
      nb_pays: { value: new Set(ents.map(e => e.country).filter(Boolean)).size, unit: "pays", category: "impact_social" },
      nb_secteurs: { value: new Set(ents.map(e => e.sector).filter(Boolean)).size, unit: "secteurs", category: "impact_social" },
      nb_entreprises: { value: ents.length, unit: "entreprises", category: "gouvernance" },
    };

    // ODD detail
    const oddParCount: Record<string, { nom: string; nb_entreprises: Set<string>; cibles_positives: number }> = {};
    for (const e of ents) {
      const odd = getDeliv(e.id, "odd_analysis");
      const resume = odd?.evaluation_cibles_odd?.resume_par_odd || {};
      for (const [key, val] of Object.entries(resume) as any[]) {
        const num = key.replace("odd_", "");
        if (!oddParCount[num]) oddParCount[num] = { nom: val.nom || `ODD ${num}`, nb_entreprises: new Set(), cibles_positives: 0 };
        if (val.cibles_positives > 0) {
          oddParCount[num].nb_entreprises.add(e.id);
          oddParCount[num].cibles_positives += val.cibles_positives;
        }
      }
    }
    const parOdd: Record<string, any> = {};
    for (const [num, v] of Object.entries(oddParCount)) {
      if (v.nb_entreprises.size > 0) parOdd[num] = { nom: v.nom, nb_entreprises: v.nb_entreprises.size, cibles_positives: v.cibles_positives };
    }

    // Par pays / secteur
    const parPays: Record<string, any> = {};
    const parSecteur: Record<string, any> = {};
    for (const e of ents) {
      const inputs = getDeliv(e.id, "inputs_data");
      const ca = Number(inputs?.compte_resultat?.chiffre_affaires || inputs?.compte_resultat?.ca || 0);
      const emp = inputs?.effectifs?.total || e.employees_count || 0;
      if (e.country) {
        if (!parPays[e.country]) parPays[e.country] = { nb_entreprises: 0, ca_total: 0, emplois: 0 };
        parPays[e.country].nb_entreprises++;
        parPays[e.country].ca_total += ca;
        parPays[e.country].emplois += emp;
      }
      if (e.sector) {
        if (!parSecteur[e.sector]) parSecteur[e.sector] = { nb_entreprises: 0, ca_total: 0 };
        parSecteur[e.sector].nb_entreprises++;
        parSecteur[e.sector].ca_total += ca;
      }
    }

    // Progression
    const scores = ents.map(e => e.score_ir || 0).filter(s => s > 0);
    const scoreMoyen = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const pipelineComplete = ents.filter(e => delivs.filter(d => d.enterprise_id === e.id).length >= 12).length;

    return jsonRes({
      success: true,
      impact: {
        auto_kpis: autoKpis,
        custom_kpis: customKpis || [],
        odd_detail: { odd_adresses: [...oddSet].map(Number).sort(), par_odd: parOdd },
        par_pays: parPays,
        par_secteur: parSecteur,
        progression: {
          score_actuel_moyen: scoreMoyen,
          nb_entreprises_pipeline_complet: pipelineComplete,
          taux_completion_pipeline: ents.length ? Math.round((pipelineComplete / ents.length) * 100) : 0,
        },
      },
    });
  } catch (e: any) {
    console.error("[get-programme-impact] error:", e);
    return jsonRes({ error: e.message || "Erreur" }, 500);
  }
});
