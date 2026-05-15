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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    // Auth user
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Non autorisé" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const userRole = roleData?.role;
    const isAdmin = userRole === "super_admin";

    const body = await req.json();
    const { action } = body;

    // Resolve user's organization + org role (for multi-tenant)
    // Si body.organization_id fourni, on récupère la membership pour CETTE org (important: un user
    // peut avoir plusieurs memberships avec des rôles différents — on privilégie l'org active).
    // Sinon, on trie par priorité de rôle pour prendre la plus privilégiée.
    const ROLE_PRIORITY: Record<string, number> = {
      owner: 0, admin: 1, manager: 2, coach: 3, analyst: 4, entrepreneur: 5,
    };
    let userOrg: { organization_id: string; role: string } | null = null;
    if (body.organization_id) {
      const { data } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .eq("organization_id", body.organization_id)
        .eq("is_active", true)
        .maybeSingle();
      userOrg = data as any;
    }
    if (!userOrg) {
      // Pas d'org spécifique → prendre la membership la plus privilégiée
      const { data: allMems } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .eq("is_active", true);
      const sorted = (allMems || []).sort((a: any, b: any) =>
        (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99)
      );
      userOrg = (sorted[0] as any) || null;
    }
    const userOrgId = body.organization_id || userOrg?.organization_id || null;
    const orgRole = userOrg?.role;

    // Mapping rôle legacy + rôle d'org → capacités
    // owner/admin/manager + managing_director/investment_manager (PE) = équivalent chef_programme
    //   (peuvent créer/gérer programmes ou appels à candidatures pour leur fonds)
    // analyst/coach = équivalent coach (lecture seule filtrée)
    const isChefProg =
      userRole === "chef_programme" ||
      orgRole === "owner" ||
      orgRole === "admin" ||
      orgRole === "manager" ||
      orgRole === "managing_director" ||
      orgRole === "investment_manager";
    const isCoach =
      userRole === "coach" ||
      orgRole === "coach" ||
      orgRole === "analyst";

    // Helper : l'utilisateur peut-il gérer (update/publish/delete) un programme donné ?
    // Règles:
    // - super_admin : tout
    // - owner/admin/managing_director : tous les programmes de leur org
    // - manager/investment_manager/chef_programme : uniquement leurs propres programmes
    const canManage = (prog: { chef_programme_id?: string | null; organization_id?: string | null }) => {
      if (isAdmin) return true;
      if (
        (orgRole === "owner" || orgRole === "admin" || orgRole === "managing_director")
        && userOrgId && prog.organization_id === userOrgId
      ) return true;
      if (isChefProg && prog.chef_programme_id === user.id) return true;
      return false;
    };

    // ═══════ CREATE ═══════
    if (action === "create") {
      if (!isAdmin && !isChefProg) return jsonRes({ error: "Accès refusé" }, 403);

      const insertData: Record<string, any> = {
        name: body.name,
        description: body.description || null,
        organization: body.organization || null,
        organization_id: userOrgId,
        logo_url: body.logo_url || null,
        country_filter: body.country_filter || [],
        sector_filter: body.sector_filter || [],
        budget: body.budget || null,
        nb_places: body.nb_places || null,
        currency: body.currency || "",
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        programme_start: body.programme_start || null,
        programme_end: body.programme_end || null,
        form_fields: body.form_fields || [],
        criteria_id: body.criteria_id || null,
        created_by: user.id,
        chef_programme_id: isChefProg ? user.id : (body.chef_programme_id || user.id),
        status: "draft",
      };

      if (!insertData.name) return jsonRes({ error: "Le nom du programme est requis" }, 400);

      const { data: prog, error: insertErr } = await supabase
        .from("programmes")
        .insert(insertData)
        .select()
        .single();

      if (insertErr) {
        console.error("[manage-programme] create error:", insertErr);
        return jsonRes({ error: insertErr.message }, 500);
      }

      return jsonRes({ success: true, programme: prog });
    }

    // ═══════ UPDATE ═══════
    if (action === "update") {
      if (!body.id) return jsonRes({ error: "id requis" }, 400);

      // Check ownership
      const { data: prog } = await supabase
        .from("programmes")
        .select("chef_programme_id, organization_id")
        .eq("id", body.id)
        .single();
      if (!prog || !canManage(prog)) {
        return jsonRes({ error: "Accès refusé" }, 403);
      }

      const { id, action: _, ...updateFields } = body;
      const { data: updated, error: updateErr } = await supabase
        .from("programmes")
        .update({ ...updateFields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (updateErr) return jsonRes({ error: updateErr.message }, 500);
      return jsonRes({ success: true, programme: updated });
    }

    // ═══════ GET ═══════
    if (action === "get") {
      if (!body.id) return jsonRes({ error: "id requis" }, 400);

      const { data: prog, error: getErr } = await supabase
        .from("programmes")
        .select("*")
        .eq("id", body.id)
        .single();

      if (getErr || !prog) return jsonRes({ error: "Programme non trouvé" }, 404);

      // Check access
      if (!isAdmin) {
        const canView = canManage(prog) || (isCoach && ["open", "in_progress", "completed"].includes(prog.status));
        if (!canView) return jsonRes({ error: "Accès refusé" }, 403);
      }

      return jsonRes({ success: true, programme: prog });
    }

    // ═══════ LIST ═══════
    if (action === "list") {
      let query = supabase.from("programmes").select("*").order("created_at", { ascending: false });

      // Filtre par organisation :
      // - Si le body fournit organization_id explicitement (switcher d'org côté UI),
      //   on filtre TOUJOURS dessus, même pour le super_admin (sinon le switcher ne sert à rien).
      // - Sinon : non-admin filtré par sa propre org ; super_admin sans org ciblée → tout.
      if (body.organization_id) {
        query = query.eq("organization_id", body.organization_id);
      } else if (!isAdmin && userOrgId) {
        query = query.eq("organization_id", userOrgId);
      }

      // owner/admin/managing_director de l'org → voient TOUS les programmes de l'org
      if (orgRole === "owner" || orgRole === "admin" || orgRole === "managing_director") {
        // pas de filtre additionnel, déjà filtré par organization_id
      } else if (isChefProg) {
        // manager / investment_manager / chef_programme legacy → filtre par leurs programmes
        query = query.or(`chef_programme_id.eq.${user.id},created_by.eq.${user.id}`);
      } else if (isCoach) {
        query = query.in("status", ["open", "in_progress", "completed"]);
      } else if (!isAdmin) {
        return jsonRes({ error: "Accès refusé" }, 403);
      }

      const { data: programmes, error: listErr } = await query;
      if (listErr) return jsonRes({ error: listErr.message }, 500);

      // Count candidatures per programme
      const progIds = (programmes || []).map((p: any) => p.id);
      let countsMap: Record<string, number> = {};
      if (progIds.length > 0) {
        const { data: countRows } = await supabase
          .from("candidatures")
          .select("programme_id")
          .in("programme_id", progIds);
        if (countRows) {
          for (const row of countRows) {
            countsMap[row.programme_id] = (countsMap[row.programme_id] || 0) + 1;
          }
        }
      }
      const programmesWithCounts = (programmes || []).map((p: any) => ({
        ...p,
        candidatures_count: countsMap[p.id] || 0,
      }));

      return jsonRes({ success: true, programmes: programmesWithCounts });
    }

    // ═══════ PUBLISH ═══════
    if (action === "publish") {
      if (!body.id) return jsonRes({ error: "id requis" }, 400);

      const { data: prog } = await supabase
        .from("programmes")
        .select("chef_programme_id, organization_id, name, status, type, form_slug")
        .eq("id", body.id)
        .single();

      if (!prog) return jsonRes({ error: "Programme non trouvé" }, 404);
      if (!canManage(prog)) return jsonRes({ error: "Accès refusé" }, 403);
      // Publication acceptée tant que le formulaire n'a pas déjà un slug.
      // Le status programme (draft/open/closed/in_progress) n'est plus une
      // contrainte — formulaire et programme sont des cycles indépendants.
      if (prog.form_slug) return jsonRes({ error: "Le formulaire est déjà publié" }, 400);

      // Génération du slug (même logique pour tous les types — cohorte ou appel).
      // Le formulaire devient public sous /candidature/<slug>.
      const slug = prog.name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        + "-" + Date.now().toString(36);

      // Status update : si draft → passe à 'open' (candidatures ouvertes).
      // Sinon (legacy open/closed ou in_progress), garde tel quel.
      const newStatus = prog.status === "draft" ? "open" : prog.status;

      const { data: updated, error: pubErr } = await supabase
        .from("programmes")
        .update({ status: newStatus, form_slug: slug, updated_at: new Date().toISOString() })
        .eq("id", body.id)
        .select()
        .single();

      if (pubErr) return jsonRes({ error: pubErr.message }, 500);
      return jsonRes({ success: true, programme: updated, form_url: `/candidature/${slug}` });
    }

    // ═══════ CLOSE ═══════
    if (action === "close") {
      if (!body.id) return jsonRes({ error: "id requis" }, 400);

      const { data: prog } = await supabase
        .from("programmes")
        .select("chef_programme_id, organization_id, status, end_date")
        .eq("id", body.id)
        .single();

      if (!prog) return jsonRes({ error: "Programme non trouvé" }, 404);
      if (!canManage(prog)) return jsonRes({ error: "Accès refusé" }, 403);

      // 'close' clôture les candidatures. Cas autorisés :
      //  - status='open' → passe en 'closed' (workflow classique)
      //  - status='in_progress' → garde 'in_progress' mais ferme les candidatures via end_date
      //    (cas où on a démarré le programme tôt sans clore l'appel)
      if (prog.status === "open") {
        const { data: updated, error: closeErr } = await supabase
          .from("programmes")
          .update({ status: "closed", end_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
          .eq("id", body.id)
          .select()
          .single();
        if (closeErr) return jsonRes({ error: closeErr.message }, 500);
        return jsonRes({ success: true, programme: updated });
      }

      if (prog.status === "in_progress") {
        // On ferme juste les candidatures (date de fin = aujourd'hui), status reste in_progress
        const { data: updated, error: closeErr } = await supabase
          .from("programmes")
          .update({ end_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
          .eq("id", body.id)
          .select()
          .single();
        if (closeErr) return jsonRes({ error: closeErr.message }, 500);
        return jsonRes({ success: true, programme: updated });
      }

      return jsonRes({ error: "Le programme doit être en 'candidatures ouvertes' ou 'en cours' pour clôturer les candidatures" }, 400);
    }

    // ═══════ START ═══════
    if (action === "start") {
      if (!body.id) return jsonRes({ error: "id requis" }, 400);

      const { data: prog } = await supabase
        .from("programmes")
        .select("chef_programme_id, organization_id, status")
        .eq("id", body.id)
        .single();

      if (!prog) return jsonRes({ error: "Programme non trouvé" }, 404);
      if (!canManage(prog)) return jsonRes({ error: "Accès refusé" }, 403);
      // Statuts pré-démarrage acceptés : draft (nouveau workflow unifié), open et closed (legacy)
      if (!["draft", "open", "closed"].includes(prog.status)) {
        return jsonRes({ error: "Le programme doit être en brouillon (ou candidatures ouvertes/fermées) pour être démarré" }, 400);
      }

      const { data: updated, error: startErr } = await supabase
        .from("programmes")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", body.id)
        .select()
        .single();

      if (startErr) return jsonRes({ error: startErr.message }, 500);
      return jsonRes({ success: true, programme: updated });
    }

    // ═══════ COMPLETE ═══════
    if (action === "complete") {
      if (!body.id) return jsonRes({ error: "id requis" }, 400);

      const { data: prog } = await supabase
        .from("programmes")
        .select("chef_programme_id, organization_id, status")
        .eq("id", body.id)
        .single();

      if (!prog) return jsonRes({ error: "Programme non trouvé" }, 404);
      if (!canManage(prog)) return jsonRes({ error: "Accès refusé" }, 403);
      if (prog.status !== "in_progress") return jsonRes({ error: "Seul un programme en cours peut être clôturé" }, 400);

      const { data: updated, error: completeErr } = await supabase
        .from("programmes")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", body.id)
        .select()
        .single();

      if (completeErr) return jsonRes({ error: completeErr.message }, 500);
      return jsonRes({ success: true, programme: updated });
    }

    // ═══════ CREATE_COHORTE ═══════
    if (action === "create_cohorte") {
      if (!isAdmin && !isChefProg) return jsonRes({ error: "Accès refusé" }, 403);
      if (!body.name) return jsonRes({ error: "Le nom de la cohorte est requis" }, 400);
      if (!body.enterprise_ids?.length) return jsonRes({ error: "Sélectionnez au moins une entreprise" }, 400);

      const { data: prog, error: insertErr } = await supabase
        .from("programmes")
        .insert({
          name: body.name,
          description: body.description || null,
          organization: body.organization || null,
          organization_id: userOrgId,
          type: "cohorte_directe",
          status: "in_progress",
          budget: body.budget || null,
          nb_places: body.enterprise_ids.length,
          currency: body.currency || "",
          programme_start: body.programme_start || new Date().toISOString().slice(0, 10),
          programme_end: body.programme_end || null,
          country_filter: [],
          sector_filter: [],
          form_fields: [],
          created_by: user.id,
          chef_programme_id: isChefProg ? user.id : (body.chef_programme_id || user.id),
        })
        .select()
        .single();

      if (insertErr) return jsonRes({ error: insertErr.message }, 500);

      const candidatures = [];
      for (const enterpriseId of body.enterprise_ids) {
        const { data: ent } = await supabase
          .from("enterprises")
          .select("name, contact_name, contact_email, contact_phone, coach_id, score_ir")
          .eq("id", enterpriseId)
          .single();
        if (!ent) continue;

        const { data: cand, error: candErr } = await supabase
          .from("candidatures")
          .insert({
            programme_id: prog.id,
            enterprise_id: enterpriseId,
            organization_id: userOrgId,
            company_name: ent.name,
            contact_name: ent.contact_name || null,
            contact_email: ent.contact_email || null,
            contact_phone: ent.contact_phone || null,
            status: "selected",
            assigned_coach_id: ent.coach_id || null,
            form_data: {},
            documents: [],
            screening_data: { score_initial: ent.score_ir || 0, integrated_at: new Date().toISOString() },
            submitted_at: new Date().toISOString(),
            committee_notes: "Intégré directement dans la cohorte",
          })
          .select("id")
          .single();
        if (!candErr && cand) candidatures.push(cand);
      }

      return jsonRes({
        success: true,
        programme: prog,
        nb_entreprises_integrees: candidatures.length,
        message: `Cohorte "${body.name}" créée avec ${candidatures.length} entreprises`
      });
    }

    // ═══════ ADD_ENTERPRISE ═══════
    if (action === "add_enterprise") {
      if (!body.programme_id || !body.enterprise_id) return jsonRes({ error: "programme_id et enterprise_id requis" }, 400);

      const { data: prog } = await supabase
        .from("programmes")
        .select("chef_programme_id, organization_id, name")
        .eq("id", body.programme_id)
        .single();
      if (!prog) return jsonRes({ error: "Programme non trouvé" }, 404);
      if (!canManage(prog)) return jsonRes({ error: "Accès refusé" }, 403);

      const { data: existing } = await supabase
        .from("candidatures")
        .select("id")
        .eq("programme_id", body.programme_id)
        .eq("enterprise_id", body.enterprise_id)
        .maybeSingle();
      if (existing) return jsonRes({ error: "Cette entreprise est déjà dans le programme" }, 400);

      const { data: ent } = await supabase
        .from("enterprises")
        .select("name, contact_name, contact_email, contact_phone, coach_id, score_ir")
        .eq("id", body.enterprise_id)
        .single();
      if (!ent) return jsonRes({ error: "Entreprise non trouvée" }, 404);

      const { data: cand, error: candErr } = await supabase
        .from("candidatures")
        .insert({
          programme_id: body.programme_id,
          enterprise_id: body.enterprise_id,
          organization_id: userOrgId,
          company_name: ent.name,
          contact_name: ent.contact_name || null,
          contact_email: ent.contact_email || null,
          contact_phone: ent.contact_phone || null,
          status: "selected",
          assigned_coach_id: ent.coach_id || null,
          form_data: {},
          documents: [],
          screening_data: { score_initial: ent.score_ir || 0, integrated_at: new Date().toISOString() },
          submitted_at: new Date().toISOString(),
          committee_notes: `Ajouté à "${prog.name}" le ${new Date().toLocaleDateString('fr-FR')}`,
        })
        .select()
        .single();
      if (candErr) return jsonRes({ error: candErr.message }, 500);

      return jsonRes({ success: true, candidature: cand, message: `${ent.name} ajoutée au programme` });
    }

    // ═══════ REMOVE_ENTERPRISE ═══════
    if (action === "remove_enterprise") {
      if (!body.programme_id || !body.enterprise_id) return jsonRes({ error: "programme_id et enterprise_id requis" }, 400);

      const { data: prog } = await supabase
        .from("programmes")
        .select("chef_programme_id, organization_id")
        .eq("id", body.programme_id)
        .single();
      if (!prog) return jsonRes({ error: "Programme non trouvé" }, 404);
      if (!canManage(prog)) return jsonRes({ error: "Accès refusé" }, 403);

      const { error: delErr } = await supabase
        .from("candidatures")
        .delete()
        .eq("programme_id", body.programme_id)
        .eq("enterprise_id", body.enterprise_id);
      if (delErr) return jsonRes({ error: delErr.message }, 500);

      return jsonRes({ success: true, message: "Entreprise retirée du programme" });
    }

    if (action === "delete") {
      if (!body.id) return jsonRes({ error: "id requis" }, 400);
      const { data: prog } = await supabase.from("programmes").select("chef_programme_id, organization_id, status").eq("id", body.id).single();
      if (!prog) return jsonRes({ error: "Programme non trouvé" }, 404);
      if (!canManage(prog)) return jsonRes({ error: "Accès refusé" }, 403);

      // Delete related data first (FK constraints — order matters)
      const { data: kpiIds } = await supabase.from("programme_kpis").select("id").eq("programme_id", body.id);
      if (kpiIds?.length) {
        await supabase.from("programme_kpi_history").delete().in("kpi_id", kpiIds.map((k: any) => k.id));
      }
      await supabase.from("programme_kpis").delete().eq("programme_id", body.id);
      await supabase.from("candidatures").delete().eq("programme_id", body.id);
      // Delete programme
      const { error: delErr } = await supabase.from("programmes").delete().eq("id", body.id);
      if (delErr) return jsonRes({ error: delErr.message }, 500);

      return jsonRes({ success: true, message: "Programme supprimé" });
    }

    return jsonRes({ error: `Action inconnue: ${action}` }, 400);

  } catch (e: any) {
    console.error("[manage-programme] error:", e);
    return jsonRes({ error: e.message || "Erreur inconnue" }, 500);
  }
});
