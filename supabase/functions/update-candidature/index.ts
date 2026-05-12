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

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  received: ["pre_selected", "selected", "rejected"],
  in_review: ["pre_selected", "selected", "rejected"], // backward compat
  pre_selected: ["selected", "rejected"],
  rejected: ["received", "pre_selected"],
  selected: [], // Final state
};

const DEFAULT_MODULES = ["bmc", "sic", "inputs", "framework", "diagnostic", "plan_financier", "business_plan"];

// Copie server-side (sans transit RAM par l'edge fn) avec retry exponentiel.
// `destinationBucket` permet la copie cross-bucket (ex: candidature_uploads → documents).
// 3 tentatives, backoff 500ms / 1500ms. "Already exists" = succès idempotent.
async function copyWithRetry(
  supabase: any,
  fromBucket: string,
  fromPath: string,
  toPath: string,
  maxAttempts = 3,
): Promise<{ ok: boolean; error?: string }> {
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { error } = await supabase.storage
        .from(fromBucket)
        .copy(fromPath, toPath, { destinationBucket: "documents" });
      if (!error) return { ok: true };
      lastErr = error.message || String(error);
      if (/already exists|duplicate|resource already/i.test(lastErr)) return { ok: true };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 500 * (3 ** (attempt - 1))));
    }
  }
  return { ok: false, error: lastErr };
}

async function createEnterpriseFromCandidature(
  candidature: any,
  coachId: string | null,
  programmeId: string,
  programmeName: string,
  supabase: any,
): Promise<{
  enterprise: any;
  tempPassword: string;
  docs: { total: number; transferred: number; skipped: number; failed: string[] };
}> {
  // 1. Create user account (idempotent : si l'email existe déjà — typiquement
  //    suite à un retry après un échec partiel — on récupère l'user existant
  //    au lieu de planter avec "User already registered").
  const tempPassword = `ESONO-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  let userId: string;
  const { data: newUser, error: createUserErr } = await supabase.auth.admin.createUser({
    email: candidature.contact_email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: candidature.contact_name },
  });

  if (createUserErr) {
    // Email déjà enregistré : on récupère l'user existant via listUsers
    if (/already.*registered|email_exists|user.*already.*exist/i.test(createUserErr.message || "")) {
      const { data: usersPage } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = usersPage?.users?.find((u: any) => (u.email || "").toLowerCase() === candidature.contact_email.toLowerCase());
      if (!existing) throw new Error(`Création compte: email déjà pris mais user introuvable`);
      userId = existing.id;
      console.log(`[update-candidature] User déjà existant réutilisé: ${userId}`);
    } else {
      throw new Error(`Création compte: ${createUserErr.message}`);
    }
  } else {
    userId = newUser.user.id;
  }

  // 2. Create profile + role
  await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: candidature.contact_name,
    email: candidature.contact_email,
    phone: candidature.contact_phone,
  }, { onConflict: "user_id" });

  await supabase.from("user_roles").upsert({
    user_id: userId,
    role: "entrepreneur",
  }, { onConflict: "user_id" });

  // 3. Get organization_id from programme
  const { data: progData } = await supabase.from("programmes").select("organization_id").eq("id", programmeId).single();
  const orgId = progData?.organization_id || candidature.organization_id || null;

  // 4. Create enterprise (idempotent : si une entreprise existe déjà pour ce
  //    user dans cette org, on la réutilise au lieu d'en créer un doublon —
  //    cas typique d'un retry après échec partiel).
  let enterprise: any;
  const { data: existingEnt } = await supabase
    .from("enterprises")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (existingEnt) {
    enterprise = existingEnt;
    console.log(`[update-candidature] Enterprise existante réutilisée: ${enterprise.name} (${enterprise.id})`);
  } else {
    const { data: created, error: entErr } = await supabase.from("enterprises").insert({
      user_id: userId,
      coach_id: coachId || null,
      organization_id: orgId,
      name: candidature.company_name,
      sector: candidature.form_data?.sector || null,
      country: candidature.form_data?.country || candidature.form_data?.pays || null,
      city: candidature.form_data?.city || candidature.form_data?.ville || null,
      contact_name: candidature.contact_name,
      contact_email: candidature.contact_email,
      contact_phone: candidature.contact_phone,
      employees_count: candidature.form_data?.effectif || candidature.form_data?.employees || 0,
    }).select().single();
    if (entErr) throw new Error(`Création entreprise: ${entErr.message}`);
    enterprise = created;
  }

  // 4b. Create enterprise_coaches entry (N-à-N) — try/catch car le builder
  //     Supabase ne supporte pas .catch() chainé (n'est pas une vraie Promise).
  if (coachId) {
    try {
      await supabase.from("enterprise_coaches").insert({
        enterprise_id: enterprise.id, coach_id: coachId, role: 'principal',
        assigned_by: coachId, organization_id: orgId, is_active: true,
      });
    } catch (e) {
      console.warn(`[update-candidature] enterprise_coaches insert skipped:`, e);
    }
  }

  // 4c. Rattacher l'entrepreneur à l'org
  if (orgId) {
    try {
      await supabase.from("organization_members").upsert({
        organization_id: orgId, user_id: userId, role: 'entrepreneur', is_active: true,
      }, { onConflict: "organization_id,user_id" });
    } catch (e) {
      console.warn(`[update-candidature] organization_members upsert skipped:`, e);
    }
  }

  // 5. Create default modules (with organization_id)
  await supabase.from("enterprise_modules").insert(
    DEFAULT_MODULES.map(m => ({
      enterprise_id: enterprise.id,
      organization_id: orgId,
      module: m,
      status: "not_started",
      progress: 0,
    }))
  );

  // 5. Transfer screening diagnostic as first deliverable
  if (candidature.screening_data) {
    await supabase.from("deliverables").upsert({
      enterprise_id: enterprise.id,
      type: "pre_screening",
      version: 1,
      data: {
        ...candidature.screening_data,
        source: "candidature_screening",
        programme_id: programmeId,
        programme_name: programmeName,
        candidature_id: candidature.id,
      },
      score: candidature.screening_score,
      ai_generated: true,
    }, { onConflict: "enterprise_id,type" });
    console.log(`[update-candidature] Diagnostic transféré → pre_screening pour ${enterprise.name}`);
  }

  // 6. Transfer candidature documents to enterprise
  const docs = Array.isArray(candidature.documents) ? candidature.documents : [];
  let transferredCount = 0;
  let skippedCount = 0;
  const failedDocs: string[] = [];
  if (docs.length > 0) {
    const RAILWAY_URL = Deno.env.get("RAILWAY_URL") || "https://esono-parser-production-8f89.up.railway.app";
    const PARSER_API_KEY = Deno.env.get("PARSER_API_KEY") || "";
    const parsedContents: string[] = [];

    // Skip-if-exists : on liste les docs déjà transférés pour ne pas re-traiter
    // ce qui a déjà été fait (cas retry après timeout / erreur partielle).
    let alreadyTransferred = new Set<string>();
    try {
      const { data: existingFiles } = await supabase.storage
        .from("documents")
        .list(`${enterprise.id}/reconstruction/`, { limit: 1000 });
      alreadyTransferred = new Set(
        (existingFiles || []).map((f: any) => f.name.replace(/^\d+_/, ''))
      );
      if (alreadyTransferred.size > 0) {
        console.log(`[transfer-doc] ${alreadyTransferred.size} doc(s) déjà transférés, skip lors de la boucle`);
      }
    } catch (e) {
      console.warn(`[transfer-doc] list existing failed (non-blocking):`, e);
    }

    for (const doc of docs) {
      if (!doc.storage_path) continue;
      const safeName = doc.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');

      // Skip si déjà transféré (idempotence sur retry)
      if (alreadyTransferred.has(safeName)) {
        skippedCount++;
        continue;
      }

      const parts = doc.storage_path.split("/");
      const bucket = parts[0];
      const filePath = parts.slice(1).join("/");
      const entPath = `${enterprise.id}/reconstruction/${Date.now()}_${safeName}`;

      // Copie server-side avec retry (3 tentatives, backoff exponentiel).
      // Pas de transit par la RAM de l'edge fn → robuste sur grosses batches.
      const { ok, error: copyErr } = await copyWithRetry(supabase, bucket, filePath, entPath);
      if (!ok) {
        console.warn(`[transfer-doc] Copy failed after retries: ${doc.file_name} — ${copyErr}`);
        failedDocs.push(doc.file_name);
        continue;
      }
      transferredCount++;

      // Parse via Railway — download séparé pour ne charger en RAM qu'au
      // moment du parse (puis libéré). Best-effort : si parse échoue, le
      // transfer reste validé.
      try {
        const { data: fileData } = await supabase.storage.from(bucket).download(filePath);
        if (fileData) {
          const formData = new FormData();
          formData.append("file", fileData, doc.file_name);
          const parseResp = await fetch(`${RAILWAY_URL}/parse`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${PARSER_API_KEY}` },
            body: formData,
            signal: AbortSignal.timeout(10_000),
          });
          if (parseResp.ok) {
            const parsed = await parseResp.json();
            if (parsed.content && parsed.content.length > 10) {
              parsedContents.push(`\n══════ ${doc.file_name} (${parsed.category || 'candidature'}) ══════\n${parsed.content}`);
            }
          }
        }
      } catch (parseErr: any) {
        console.warn(`[transfer-doc] Parse skipped for ${doc.file_name}:`, parseErr.message);
      }

      console.log(`[transfer-doc] ✅ ${doc.file_name} → enterprise ${enterprise.name}`);
    }

    console.log(`[transfer-doc] Résumé : ${transferredCount} nouveaux, ${skippedCount} skippés (déjà là), ${failedDocs.length} échecs`);

    // Save parsed content to enterprise
    if (parsedContents.length > 0) {
      await supabase.from("enterprises").update({
        document_content: parsedContents.join("\n").slice(0, 300000),
        document_parsing_report: JSON.stringify({
          parsed_at: new Date().toISOString(),
          source: "candidature_transfer",
          files: docs.map((d: any) => d.file_name),
        }),
        data_changed_at: new Date().toISOString(),
      }).eq("id", enterprise.id);
      console.log(`[transfer-doc] ${parsedContents.length} doc(s) parsed and saved to document_content`);
    }
  }

  // 7. Link candidature to enterprise
  await supabase.from("candidatures").update({
    enterprise_id: enterprise.id,
    assigned_coach_id: coachId,
    status: "selected",
    updated_at: new Date().toISOString(),
  }).eq("id", candidature.id);

  return {
    enterprise,
    tempPassword,
    docs: {
      total: docs.length,
      transferred: transferredCount,
      skipped: skippedCount,
      failed: failedDocs,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Non autorisé" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const isAdmin = roleData?.role === "super_admin";
    const isChef = roleData?.role === "chef_programme";
    if (!isAdmin && !isChef) return jsonRes({ error: "Accès refusé" }, 403);

    const body = await req.json();
    const { candidature_id, action, new_status, coach_id, committee_notes, candidature_ids } = body;

    // ═══════ BULK MOVE ═══════
    if (action === "bulk_move") {
      if (!candidature_ids?.length || !new_status) return jsonRes({ error: "candidature_ids et new_status requis" }, 400);

      // Get candidatures with their programmes
      const { data: cands } = await supabase
        .from("candidatures")
        .select("id, status, programme_id")
        .in("id", candidature_ids);

      if (!cands?.length) return jsonRes({ error: "Aucune candidature trouvée" }, 404);

      // Check programme ownership for all
      if (isChef) {
        const progIds = [...new Set(cands.map(c => c.programme_id))];
        const { data: progs } = await supabase
          .from("programmes")
          .select("id, chef_programme_id")
          .in("id", progIds);
        const unauthorized = progs?.find(p => p.chef_programme_id !== user.id);
        if (unauthorized) return jsonRes({ error: "Accès refusé à un des programmes" }, 403);
      }

      // Validate transitions
      const invalid = cands.filter(c => !VALID_TRANSITIONS[c.status]?.includes(new_status));
      if (invalid.length) {
        return jsonRes({
          error: `Transition invalide pour ${invalid.length} candidature(s)`,
          invalid: invalid.map(c => ({ id: c.id, current_status: c.status })),
        }, 400);
      }

      const { error: bulkErr } = await supabase
        .from("candidatures")
        .update({ status: new_status, updated_at: new Date().toISOString() })
        .in("id", candidature_ids);

      if (bulkErr) return jsonRes({ error: bulkErr.message }, 500);
      return jsonRes({ success: true, moved: candidature_ids.length, new_status });
    }

    // Single candidature actions
    if (!candidature_id) return jsonRes({ error: "candidature_id requis" }, 400);

    // Get candidature + programme
    const { data: candidature } = await supabase
      .from("candidatures")
      .select("*, programmes:programme_id(id, name, chef_programme_id)")
      .eq("id", candidature_id)
      .single();

    if (!candidature) return jsonRes({ error: "Candidature non trouvée" }, 404);

    const programme = candidature.programmes;
    if (isChef && programme?.chef_programme_id !== user.id) return jsonRes({ error: "Accès refusé" }, 403);

    // ═══════ RETRY DOC TRANSFER ═══════
    // Réservé aux candidatures déjà sélectionnées dont le transfer initial a
    // partiellement échoué (timeout, parser down, etc.). Re-lance l'étape 6 du
    // pipeline createEnterpriseFromCandidature en mode idempotent : skip-if-exists
    // sur chaque doc → ne transfère que ce qui manque.
    if (action === "retry_doc_transfer") {
      if (candidature.status !== "selected" || !candidature.enterprise_id) {
        return jsonRes({ error: "Candidature non sélectionnée ou sans entreprise liée" }, 400);
      }
      try {
        const { data: ent } = await supabase.from("enterprises").select("id, name").eq("id", candidature.enterprise_id).single();
        if (!ent) return jsonRes({ error: "Entreprise liée introuvable" }, 404);

        // Réutilise la même logique en construisant une candidature artificielle
        // pour passer dans createEnterpriseFromCandidature. Mais c'est plus
        // simple et plus sûr d'extraire juste la boucle de transfer ici.
        const docs = Array.isArray(candidature.documents) ? candidature.documents : [];
        if (docs.length === 0) return jsonRes({ success: true, transferred: 0, skipped: 0, message: "Aucun document à transférer" });

        const { data: existingFiles } = await supabase.storage
          .from("documents")
          .list(`${ent.id}/reconstruction/`, { limit: 1000 });
        const alreadyTransferred = new Set(
          (existingFiles || []).map((f: any) => f.name.replace(/^\d+_/, ''))
        );

        let transferred = 0, skipped = 0;
        const failed: string[] = [];
        for (const doc of docs) {
          if (!doc.storage_path) continue;
          const safeName = doc.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
          if (alreadyTransferred.has(safeName)) { skipped++; continue; }

          const parts = doc.storage_path.split("/");
          const bucket = parts[0];
          const filePath = parts.slice(1).join("/");
          const entPath = `${ent.id}/reconstruction/${Date.now()}_${safeName}`;

          const { ok, error: copyErr } = await copyWithRetry(supabase, bucket, filePath, entPath);
          if (ok) {
            transferred++;
          } else {
            failed.push(doc.file_name);
            console.warn(`[retry-transfer] ${doc.file_name} failed after retries:`, copyErr);
          }
        }
        return jsonRes({ success: true, transferred, skipped, failed, total: docs.length });
      } catch (e: any) {
        return jsonRes({ error: `Retry transfer failed: ${e?.message || 'unknown'}` }, 500);
      }
    }

    // ═══════ MOVE ═══════
    if (action === "move") {
      if (!new_status) return jsonRes({ error: "new_status requis" }, 400);

      const valid = VALID_TRANSITIONS[candidature.status];
      if (!valid?.includes(new_status)) {
        return jsonRes({ error: `Transition ${candidature.status} → ${new_status} non autorisée` }, 400);
      }

      // Si transition vers "selected" : on crée l'entreprise EN SYNCHRONE.
      // Auparavant on faisait ça en background via EdgeRuntime.waitUntil pour
      // accélérer la réponse — mais les erreurs étaient avalées silencieusement
      // (le user voyait "sélectionné" alors que l'entreprise n'avait jamais été
      // créée, cas FOODSEN 12/05). On accepte 2-4s d'attente supplémentaire
      // pour que le user voie l'erreur tout de suite si ça plante.
      if (new_status === "selected") {
        try {
          const result = await createEnterpriseFromCandidature(
            candidature, coach_id || null, programme.id, programme.name, supabase
          );
          console.log(`[update-candidature] ✅ Enterprise créée: ${result.enterprise.name} (${result.enterprise.id})`);

          // Status update + lien enterprise_id, après création réussie
          const { error: moveErr } = await supabase
            .from("candidatures")
            .update({
              status: "selected",
              enterprise_id: result.enterprise.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", candidature_id);
          if (moveErr) {
            console.error(`[update-candidature] Status update échoué après création: ${moveErr.message}`);
            return jsonRes({ error: `Entreprise créée mais update candidature impossible: ${moveErr.message}`, enterprise_id: result.enterprise.id }, 500);
          }

          return jsonRes({
            success: true,
            status: "selected",
            enterprise_id: result.enterprise.id,
            enterprise_name: result.enterprise.name,
            docs: result.docs,
          });
        } catch (e: any) {
          console.error(`[update-candidature] ❌ Enterprise creation failed for candidature ${candidature_id} (${candidature.company_name}):`, e?.message, e?.stack);
          return jsonRes({
            error: `Création entreprise impossible : ${e?.message || 'erreur inconnue'}`,
            candidature_status_unchanged: true,
          }, 500);
        }
      }

      // Simple status move (non-selected ou autres transitions)
      const { error: moveErr } = await supabase
        .from("candidatures")
        .update({ status: new_status, updated_at: new Date().toISOString() })
        .eq("id", candidature_id);

      if (moveErr) return jsonRes({ error: moveErr.message }, 500);
      return jsonRes({ success: true, status: new_status });
    }

    // ═══════ ASSIGN COACH ═══════
    if (action === "assign_coach") {
      if (!coach_id) return jsonRes({ error: "coach_id requis" }, 400);

      // Verify coach exists and has coach role
      const { data: coachRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", coach_id)
        .maybeSingle();

      if (!coachRole || coachRole.role !== "coach") {
        return jsonRes({ error: "L'utilisateur spécifié n'est pas un coach" }, 400);
      }

      const updateData: any = {
        assigned_coach_id: coach_id,
        updated_at: new Date().toISOString(),
      };

      // If also selecting
      if (new_status === "selected") {
        try {
          const result = await createEnterpriseFromCandidature(
            candidature, coach_id, programme.id, programme.name, supabase
          );
          return jsonRes({
            success: true,
            status: "selected",
            enterprise_created: true,
            enterprise_id: result.enterprise.id,
            temp_password: result.tempPassword,
            docs: result.docs,
          });
        } catch (e: any) {
          return jsonRes({ error: `Erreur création entreprise: ${e.message}` }, 500);
        }
      }

      const { error: assignErr } = await supabase
        .from("candidatures")
        .update(updateData)
        .eq("id", candidature_id);

      if (assignErr) return jsonRes({ error: assignErr.message }, 500);
      return jsonRes({ success: true, coach_assigned: coach_id });
    }

    // ═══════ ADD NOTE ═══════
    if (action === "add_note") {
      if (!committee_notes) return jsonRes({ error: "committee_notes requis" }, 400);

      const existing = candidature.committee_notes || "";
      const timestamp = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
      const newNotes = existing
        ? `${existing}\n\n[${timestamp}] ${committee_notes}`
        : `[${timestamp}] ${committee_notes}`;

      const { error: noteErr } = await supabase
        .from("candidatures")
        .update({
          committee_notes: newNotes,
          committee_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidature_id);

      if (noteErr) return jsonRes({ error: noteErr.message }, 500);
      return jsonRes({ success: true, committee_notes: newNotes });
    }

    if (action === "committee_decision") {
      const { committee_decision } = body;
      if (!committee_decision) return jsonRes({ error: "committee_decision requis" }, 400);
      const { error: decErr } = await supabase.from("candidatures").update({
        committee_decision,
        committee_date: new Date().toISOString(),
      }).eq("id", candidature_id);
      if (decErr) return jsonRes({ error: decErr.message }, 500);
      return jsonRes({ success: true, committee_decision });
    }

    return jsonRes({ error: `Action inconnue: ${action}` }, 400);

  } catch (e: any) {
    console.error("[update-candidature] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
