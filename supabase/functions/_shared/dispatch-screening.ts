// Dispatch du diagnostic (screening) au worker Railway via ai_jobs + /run-agent.
// Partagé entre submit-candidature (auto-screen à la soumission) et
// add-candidature-documents (re-screen après ajout de docs par un coordinateur).
//
// Contexte : l'ancien autoScreen inline (EdgeRuntime.waitUntil) était recyclé par
// Supabase AVANT la fin de la chaîne (N docs + OCR + Claude ~60-120s). Sur Railway :
// pas de plafond 400s, parsing OCR/vision jusqu'au bout ; le worker écrit lui-même
// screening_score/screening_data (et un _error en cas d'échec).
//
// prefer_vision : false pour l'auto-screen (coût maîtrisé) ; true pour les re-screens
// manuels / ajout de docs (haute fidélité). Retourne true si le dispatch est accepté.

export async function dispatchScreening(
  supabase: any,
  opts: { programmeId: string; candidatureIds: string[]; organizationId?: string | null; preferVision?: boolean },
): Promise<boolean> {
  const railwayUrl = Deno.env.get("RAILWAY_AI_URL");
  const railwayKey = Deno.env.get("RAILWAY_AI_KEY");
  if (!railwayUrl || !railwayKey) {
    console.error("[dispatch-screening] RAILWAY_AI_URL / RAILWAY_AI_KEY non configurés");
    return false;
  }

  const payload = {
    programme_id: opts.programmeId,
    candidature_ids: opts.candidatureIds,
    prefer_vision: opts.preferVision ?? false,
  };

  // 1. INSERT ai_jobs (le worker fait un .select() pour vérifier l'existence)
  const { data: job, error: jobErr } = await supabase
    .from("ai_jobs")
    .insert({
      agent_name: "screen-candidatures",
      payload,
      status: "pending",
      organization_id: opts.organizationId ?? null,
    })
    .select("id")
    .single();
  if (jobErr || !job) {
    console.error("[dispatch-screening] INSERT ai_jobs failed:", jobErr?.message);
    return false;
  }

  // 2. POST /run-agent avec le job_id inséré
  try {
    const resp = await fetch(`${railwayUrl}/run-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Worker-API-Key": railwayKey },
      body: JSON.stringify({ agent_name: "screen-candidatures", job_id: job.id, payload }),
    });
    if (!resp.ok && resp.status !== 202) {
      const text = await resp.text().catch(() => "");
      console.error(`[dispatch-screening] worker dispatch failed: ${resp.status} ${text.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error("[dispatch-screening] worker unreachable:", e.message);
    return false;
  }
}

/** Marque une candidature en erreur de screening (panne visible côté UI). */
export async function markScreeningError(supabase: any, candidatureId: string, reason: string) {
  await supabase.from("candidatures").update({
    screening_data: { _error: reason.slice(0, 500), _at: new Date().toISOString(), _source: "dispatch" },
    updated_at: new Date().toISOString(),
  }).eq("id", candidatureId);
}
