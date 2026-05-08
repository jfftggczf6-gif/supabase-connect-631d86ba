// railway-dispatch — Helper pour dispatcher un agent vers esono-ai-worker
// (Railway) puis poller ai_jobs jusqu'à completion. Permet de garder une UX
// synchrone côté front pendant la migration progressive des agents IA.
//
// Si la génération dépasse 350s, on renvoie une 504 et le job continue
// côté worker (le front peut retry — le worker est idempotent).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 350_000;

export interface DispatchResult {
  success: true;
  job_id: string;
  result: any;
  duration_ms: number;
}

export interface DispatchError {
  success: false;
  error: string;
  status: number;
  job_id?: string;
}

export interface DispatchOpts {
  agentName: string;
  payload: Record<string, unknown>;
  userId: string;
  organizationId: string | null;
  /** Liens optionnels pour la queryabilité côté front */
  dealId?: string;
  candidatureId?: string;
  memoId?: string;
  /** Override timeout (default 350s) */
  pollTimeoutMs?: number;
}

/**
 * Insère un ai_job, dispatche au worker Railway, attend la completion.
 * Retourne le résultat du job en cas de succès, ou une erreur formatée.
 */
export async function dispatchAndPoll(opts: DispatchOpts): Promise<DispatchResult | DispatchError> {
  const RAILWAY_AI_URL = Deno.env.get("RAILWAY_AI_URL");
  const RAILWAY_AI_KEY = Deno.env.get("RAILWAY_AI_KEY");
  if (!RAILWAY_AI_URL || !RAILWAY_AI_KEY) {
    return { success: false, error: "Worker non configuré (RAILWAY_AI_URL/RAILWAY_AI_KEY)", status: 500 };
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: job, error: jobErr } = await adminClient
    .from("ai_jobs")
    .insert({
      agent_name: opts.agentName,
      payload: opts.payload,
      status: "pending",
      deal_id: opts.dealId ?? null,
      candidature_id: opts.candidatureId ?? null,
      memo_id: opts.memoId ?? null,
      organization_id: opts.organizationId,
      user_id: opts.userId,
    })
    .select("id")
    .single();
  if (jobErr || !job) {
    return { success: false, error: `INSERT job: ${jobErr?.message ?? "unknown"}`, status: 500 };
  }

  const dispatchResp = await fetch(`${RAILWAY_AI_URL}/run-agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-API-Key": RAILWAY_AI_KEY,
    },
    body: JSON.stringify({
      agent_name: opts.agentName,
      job_id: job.id,
      payload: opts.payload,
    }),
  });
  if (!dispatchResp.ok) {
    const txt = await dispatchResp.text();
    return {
      success: false,
      error: `Worker dispatch failed (${dispatchResp.status}): ${txt}`,
      status: 502,
      job_id: job.id,
    };
  }

  const startedAt = Date.now();
  const timeout = opts.pollTimeoutMs ?? POLL_TIMEOUT_MS;
  while (Date.now() - startedAt < timeout) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const { data: row } = await adminClient
      .from("ai_jobs")
      .select("status, result, error_message, error_kind")
      .eq("id", job.id)
      .single();
    if (!row) continue;

    if (row.status === "ready") {
      return {
        success: true,
        job_id: job.id,
        result: row.result,
        duration_ms: Date.now() - startedAt,
      };
    }
    if (row.status === "error") {
      return {
        success: false,
        error: `Worker error (${row.error_kind ?? "unknown"}): ${row.error_message ?? "no message"}`,
        status: 500,
        job_id: job.id,
      };
    }
  }

  return {
    success: false,
    error: "Polling timeout — la génération continue en arrière-plan, réessaie dans 1-2 min",
    status: 504,
    job_id: job.id,
  };
}
