import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const enterpriseId = body.enterprise_id;
    if (!enterpriseId) {
      return new Response(JSON.stringify({ error: "enterprise_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch enterprise + deliverables
    const { data: ent } = await supabase.from("enterprises").select("*").eq("id", enterpriseId).single();
    if (!ent) throw new Error("Enterprise not found");

    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("type, data, score")
      .eq("enterprise_id", enterpriseId);

    const getDeliv = (type: string) => deliverables?.find((d: any) => d.type === type);

    const inputs = getDeliv("inputs_data")?.data || {};
    const cr = inputs.compte_resultat || {};
    const bil = inputs.bilan || {};
    const scoring = getDeliv("diagnostic_data")?.data?._scoring || {};
    const oddData = getDeliv("odd_analysis")?.data || {};
    const planFin = getDeliv("plan_financier")?.data || {};

    // Enterprise profile
    const ca = Number(cr.chiffre_affaires || cr.ca || 0);
    const margeBrute = Number(inputs.kpis?.marge_brute_pct || (ca > 0 && cr.marge_brute ? (cr.marge_brute / ca * 100) : 0));
    const ebitda = Number(cr.ebitda || cr.resultat_exploitation || 0);
    const resultatNet = Number(cr.resultat_net || 0);
    const effectif = Number(ent.employees_count || inputs.effectif_total || 0);
    const pays = ent.country || '';
    const secteur = (ent.sector || "").toLowerCase().replace(/[\s\-\/]/g, "_");
    const historique = inputs.historique_3ans ? 3 : (inputs.compte_resultat_n_moins_1 ? 2 : 1);
    const scoreIr = Number(getDeliv("diagnostic_data")?.score || getDeliv("pre_screening")?.score || 0);

    // ODD alignment
    const oddsAligned = new Set<string>();
    const cibles = oddData.evaluation_cibles_odd?.cibles || [];
    cibles.forEach((c: any) => {
      if (c.evaluation === "positif") {
        const oddNum = String(c.target_id || c.cible || "").split(".")[0];
        if (oddNum) oddsAligned.add(oddNum);
      }
    });

    // 2. Fetch active funding programs
    const { data: programs } = await supabase
      .from("funding_programs")
      .select("*")
      .eq("is_active", true);

    if (!programs || programs.length === 0) {
      return new Response(JSON.stringify({ matches: [], message: "Aucun programme actif" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Match each program
    const matches = programs.map((prog: any) => {
      const criteriaMet: string[] = [];
      const criteriaMissing: string[] = [];
      const gaps: Record<string, any> = {};

      // Pays
      if (prog.pays_eligibles.length === 0 || prog.pays_eligibles.some((p: string) => pays.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(pays.toLowerCase()))) {
        criteriaMet.push("Pays éligible");
      } else {
        criteriaMissing.push(`Pays non éligible (requis: ${prog.pays_eligibles.join(", ")})`);
        gaps.pays = { requis: prog.pays_eligibles, actuel: pays };
      }

      // Secteur
      if (prog.secteurs_eligibles.length === 0 || prog.secteurs_eligibles.some((s: string) => secteur.includes(s) || s.includes(secteur))) {
        criteriaMet.push("Secteur éligible");
      } else {
        criteriaMissing.push(`Secteur non éligible (requis: ${prog.secteurs_eligibles.join(", ")})`);
        gaps.secteur = { requis: prog.secteurs_eligibles, actuel: secteur };
      }

      // CA minimum
      if (prog.ca_min > 0) {
        if (ca >= prog.ca_min) {
          criteriaMet.push(`CA suffisant (${(ca/1e6).toFixed(0)}M ≥ ${(prog.ca_min/1e6).toFixed(0)}M)`);
        } else {
          criteriaMissing.push(`CA insuffisant (${(ca/1e6).toFixed(0)}M < ${(prog.ca_min/1e6).toFixed(0)}M requis)`);
          gaps.ca = { requis: prog.ca_min, actuel: ca, ecart: prog.ca_min - ca };
        }
      } else {
        criteriaMet.push("Pas de CA minimum");
      }

      // Marge brute
      if (prog.marge_brute_min && prog.marge_brute_min > 0) {
        if (margeBrute >= prog.marge_brute_min) {
          criteriaMet.push(`Marge brute OK (${margeBrute.toFixed(0)}% ≥ ${prog.marge_brute_min}%)`);
        } else {
          criteriaMissing.push(`Marge brute insuffisante (${margeBrute.toFixed(0)}% < ${prog.marge_brute_min}%)`);
          gaps.marge_brute = { requis: prog.marge_brute_min, actuel: margeBrute };
        }
      }

      // EBITDA positif
      if (prog.ebitda_positif) {
        if (ebitda > 0) {
          criteriaMet.push("EBITDA positif");
        } else {
          criteriaMissing.push("EBITDA négatif ou nul");
          gaps.ebitda = { requis: "> 0", actuel: ebitda };
        }
      }

      // Résultat net positif
      if (prog.resultat_net_positif) {
        if (resultatNet > 0) {
          criteriaMet.push("Résultat net positif");
        } else {
          criteriaMissing.push("Résultat net négatif");
          gaps.resultat_net = { requis: "> 0", actuel: resultatNet };
        }
      }

      // Historique
      if (prog.historique_min_ans > 0) {
        if (historique >= prog.historique_min_ans) {
          criteriaMet.push(`Historique suffisant (${historique} ans)`);
        } else {
          criteriaMissing.push(`Historique insuffisant (${historique} ans < ${prog.historique_min_ans} requis)`);
          gaps.historique = { requis: prog.historique_min_ans, actuel: historique };
        }
      }

      // Effectif
      if (prog.effectif_min > 0) {
        if (effectif >= prog.effectif_min) {
          criteriaMet.push(`Effectif suffisant (${effectif})`);
        } else {
          criteriaMissing.push(`Effectif insuffisant (${effectif} < ${prog.effectif_min} requis)`);
          gaps.effectif = { requis: prog.effectif_min, actuel: effectif };
        }
      }

      // États financiers certifiés
      if (prog.etats_financiers_certifies) {
        // On ne peut pas vérifier automatiquement — on flag comme manquant sauf si score inputs > 80
        const inputsScore = Number(getDeliv("inputs_data")?.score || 0);
        if (inputsScore >= 80) {
          criteriaMet.push("Données financières fiables");
        } else {
          criteriaMissing.push("États financiers à certifier");
          gaps.certification = { requis: true, actuel: false };
        }
      }

      // Score IR
      if (prog.score_ir_min > 0) {
        if (scoreIr >= prog.score_ir_min) {
          criteriaMet.push(`Score IR OK (${scoreIr} ≥ ${prog.score_ir_min})`);
        } else {
          criteriaMissing.push(`Score IR insuffisant (${scoreIr} < ${prog.score_ir_min})`);
          gaps.score_ir = { requis: prog.score_ir_min, actuel: scoreIr, ecart: prog.score_ir_min - scoreIr };
        }
      }

      // ODD
      if (prog.odd_requis && prog.odd_requis.length > 0) {
        const oddMet = prog.odd_requis.filter((o: string) => oddsAligned.has(o));
        if (oddMet.length >= prog.odd_requis.length) {
          criteriaMet.push(`ODD alignés (${oddMet.length}/${prog.odd_requis.length})`);
        } else {
          const missing = prog.odd_requis.filter((o: string) => !oddsAligned.has(o));
          criteriaMissing.push(`ODD manquants: ${missing.join(", ")}`);
          gaps.odd = { requis: prog.odd_requis, alignes: Array.from(oddsAligned), manquants: missing };
        }
      }

      // Impact social
      if (prog.impact_social_requis) {
        const sicScore = Number(getDeliv("sic_analysis")?.score || 0);
        if (sicScore >= 40) {
          criteriaMet.push("Impact social documenté");
        } else {
          criteriaMissing.push("Impact social à documenter");
          gaps.impact_social = { requis: true, score_sic: sicScore };
        }
      }

      // Conformité IFC
      if (prog.conformite_ifc) {
        criteriaMissing.push("Conformité IFC PS à vérifier");
        gaps.ifc = { requis: true, actuel: "non vérifié" };
      }

      // Calculate match score
      const totalCriteria = criteriaMet.length + criteriaMissing.length;
      const matchScore = totalCriteria > 0 ? Math.round((criteriaMet.length / totalCriteria) * 100) : 0;

      return {
        program_id: prog.id,
        program_name: prog.name,
        organisme: prog.organisme,
        type_financement: prog.type_financement,
        ticket: `${(prog.ticket_min / 1e6).toFixed(0)}-${(prog.ticket_max / 1e6).toFixed(0)}M ${prog.devise}`,
        match_score: matchScore,
        criteria_met: criteriaMet,
        criteria_missing: criteriaMissing,
        gap_analysis: gaps,
        description: prog.description,
      };
    });

    // Sort by match score
    matches.sort((a: any, b: any) => b.match_score - a.match_score);

    // 4. Save matches in DB
    const { data: entOrg } = await supabase.from("enterprises").select("organization_id").eq("id", enterpriseId).single();
    for (const m of matches) {
      await supabase.from("funding_matches").upsert({
        enterprise_id: enterpriseId,
        organization_id: entOrg?.organization_id || null,
        funding_program_id: m.program_id,
        match_score: m.match_score,
        criteria_met: m.criteria_met,
        criteria_missing: m.criteria_missing,
        gap_analysis: m.gap_analysis,
        computed_at: new Date().toISOString(),
      }, { onConflict: "enterprise_id,funding_program_id" });
    }

    return new Response(JSON.stringify({
      success: true,
      enterprise: ent.name,
      pays,
      secteur,
      ca: ca,
      score_ir: scoreIr,
      matches,
      total_programs: programs.length,
      eligible: matches.filter((m: any) => m.match_score >= 70).length,
      conditionnel: matches.filter((m: any) => m.match_score >= 40 && m.match_score < 70).length,
      non_eligible: matches.filter((m: any) => m.match_score < 40).length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("match-funding error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
