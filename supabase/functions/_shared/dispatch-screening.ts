// Dispatch du diagnostic (screening) au worker Railway via ai_jobs + /run-agent.
// Partagé entre submit-candidature (auto-screen à la soumission) et
// add-candidature-documents (re-screen après ajout de docs par un coordinateur).
//
// Contexte : l'ancien autoScreen inline (EdgeRuntime.waitUntil) était recyclé par
// Supabase AVANT la fin de la chaîne (N docs + OCR + Claude ~60-120s). Sur Railway :
// pas de plafond 400s, parsing OCR/vision jusqu'au bout ; le worker écrit lui-même
// screening_score/screening_data.
//
// prefer_vision : false pour l'auto-screen (coût maîtrisé) ; true pour les re-screens
// manuels / ajout de docs (haute fidélité).
//
// ⚠️ INVARIANT (incident du 31/08/2026) : un échec de dispatch ou de screening ne
// doit JAMAIS écrire dans `candidatures`. L'ancienne version remplaçait
// screening_data par un stub d'erreur, détruisant des diagnostics complets de
// ~40 Ko sans aucune archive — trois dossiers présélectionnés ont été perdus.
// Les erreurs vivent désormais dans ai_jobs, qui porte déjà candidature_id,
// error_message, error_kind et result.

export interface DispatchResult {
  ok: boolean;
  jobId?: string;
  error?: string;
}

export async function dispatchScreening(
  supabase: any,
  opts: { programmeId: string; candidatureIds: string[]; organizationId?: string | null; preferVision?: boolean },
): Promise<DispatchResult> {
  const railwayUrl = Deno.env.get("RAILWAY_AI_URL");
  const railwayKey = Deno.env.get("RAILWAY_AI_KEY");
  if (!railwayUrl || !railwayKey) {
    console.error("[dispatch-screening] RAILWAY_AI_URL / RAILWAY_AI_KEY non configurés");
    return { ok: false, error: "RAILWAY_AI_URL / RAILWAY_AI_KEY non configurés" };
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
      candidature_id: opts.candidatureIds.length === 1 ? opts.candidatureIds[0] : null,
    })
    .select("id")
    .single();
  if (jobErr || !job) {
    console.error("[dispatch-screening] INSERT ai_jobs failed:", jobErr?.message);
    return { ok: false, error: `INSERT ai_jobs failed: ${jobErr?.message ?? "unknown"}` };
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
      const error = `worker dispatch failed: ${resp.status} ${text.slice(0, 200)}`;
      console.error(`[dispatch-screening] ${error}`);
      return { ok: false, jobId: job.id, error };
    }
    return { ok: true, jobId: job.id };
  } catch (e: any) {
    const error = `worker unreachable: ${e.message}`;
    console.error(`[dispatch-screening] ${error}`);
    return { ok: false, jobId: job.id, error };
  }
}

/**
 * Trace un échec de dispatch SANS toucher au diagnostic existant.
 *
 * Avant : écrasait `candidatures.screening_data` par {_error,_at,_source}, ce qui
 * détruisait irréversiblement un diagnostic valide. L'intention — rendre la panne
 * visible — était bonne, l'implémentation détruisait la donnée.
 *
 * Désormais : l'échec est consigné dans ai_jobs. Si un job a été créé avant
 * l'échec, on le marque en erreur ; sinon (secrets absents, INSERT raté) on crée
 * une ligne porteuse de l'échec.
 */
export async function markScreeningError(
  supabase: any,
  candidatureId: string,
  reason: string,
  jobId?: string,
) {
  const nowIso = new Date().toISOString();
  const result = {
    ok: false,
    dispatch_error: reason.slice(0, 500),
    at: nowIso,
    source: "dispatch",
    candidature_id: candidatureId,
  };

  try {
    if (jobId) {
      await supabase.from("ai_jobs").update({
        status: "error",
        error_kind: "dispatch",
        error_message: reason.slice(0, 2000),
        result,
        finished_at: nowIso,
      }).eq("id", jobId);
      return;
    }

    await supabase.from("ai_jobs").insert({
      agent_name: "screen-candidatures",
      candidature_id: candidatureId,
      payload: { candidature_ids: [candidatureId] },
      status: "error",
      error_kind: "dispatch",
      error_message: reason.slice(0, 2000),
      result,
      finished_at: nowIso,
    });
  } catch (e: any) {
    // Dernier recours : ne jamais faire échouer l'appelant sur la traçabilité.
    console.error("[dispatch-screening] impossible de tracer l'échec:", e?.message);
  }
}
