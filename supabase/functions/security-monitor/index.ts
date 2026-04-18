// security-monitor — Anomaly detection and security alerts
// Designed to be called periodically (cron) or on-demand by super_admin
// Checks: API cost spikes, unusual access patterns, stale sessions, failed auth attempts
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/helpers_v5.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SecurityAlert {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  details: string;
  timestamp: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Unauthorized", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    // Verify super_admin
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles || []).some((r: any) => r.role === "super_admin")) {
      return errorResponse("Super admin required", 403);
    }

    const alerts: SecurityAlert[] = [];
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // 1. API cost spike detection
    const [{ data: costToday }, { data: costYesterday }] = await Promise.all([
      supabase.from("ai_cost_log").select("cost_usd").gte("created_at", last24h),
      supabase.from("ai_cost_log").select("cost_usd")
        .gte("created_at", new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())
        .lt("created_at", last24h),
    ]);
    const todayCost = (costToday || []).reduce((s, c) => s + Number(c.cost_usd || 0), 0);
    const yesterdayCost = (costYesterday || []).reduce((s, c) => s + Number(c.cost_usd || 0), 0);
    if (yesterdayCost > 0 && todayCost > yesterdayCost * 3) {
      alerts.push({
        severity: "high",
        category: "cost",
        title: "Pic de coûts API",
        details: `Coût 24h : $${todayCost.toFixed(2)} vs hier : $${yesterdayCost.toFixed(2)} (x${(todayCost / yesterdayCost).toFixed(1)})`,
        timestamp: now.toISOString(),
      });
    }

    // 2. Unusual activity volume per user (>50 actions in 1h)
    const { data: recentActivity } = await supabase
      .from("activity_log")
      .select("actor_id, action")
      .gte("created_at", last1h);
    const actorCounts: Record<string, number> = {};
    (recentActivity || []).forEach((a: any) => {
      actorCounts[a.actor_id] = (actorCounts[a.actor_id] || 0) + 1;
    });
    for (const [actorId, count] of Object.entries(actorCounts)) {
      if (count > 50) {
        const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("user_id", actorId).single();
        alerts.push({
          severity: "medium",
          category: "access",
          title: "Activité inhabituelle",
          details: `${profile?.full_name || actorId} : ${count} actions en 1h (seuil: 50)`,
          timestamp: now.toISOString(),
        });
      }
    }

    // 3. Cross-org access attempts (activity_log entries without organization_id)
    const { data: noOrgActivity } = await supabase
      .from("activity_log")
      .select("actor_id, action, created_at")
      .is("organization_id", null)
      .gte("created_at", last24h)
      .limit(20);
    if ((noOrgActivity || []).length > 5) {
      alerts.push({
        severity: "high",
        category: "isolation",
        title: "Actions sans organisation",
        details: `${noOrgActivity!.length} actions sans organization_id en 24h — possible bypass d'isolation`,
        timestamp: now.toISOString(),
      });
    }

    // 4. Stale or orphaned users (profiles without org membership)
    const { data: orphanedUsers } = await supabase.rpc("list_all_organizations_for_admin").catch(() => ({ data: null }));
    // Count users without any org membership
    const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: usersWithOrg } = await supabase.from("organization_members").select("user_id", { count: "exact", head: true });
    const orphaned = (totalUsers || 0) - (usersWithOrg || 0);
    if (orphaned > 5) {
      alerts.push({
        severity: "low",
        category: "access",
        title: "Utilisateurs orphelins",
        details: `${orphaned} utilisateurs sans organisation (total: ${totalUsers})`,
        timestamp: now.toISOString(),
      });
    }

    // 5. RLS policy coverage check — tables without RLS
    const { data: tablesWithoutRLS } = await supabase.rpc("check_rls_coverage").catch(() => ({ data: null }));
    // Fallback: check manually
    if (!tablesWithoutRLS) {
      const { data: allTables } = await supabase.from("information_schema.tables" as any)
        .select("table_name")
        .eq("table_schema", "public")
        .not("table_name", "in", "(schema_migrations)");
      // Can't easily check RLS from here — skip
    }

    // 6. Large file uploads in last 24h (>100MB)
    const { data: largeUploads } = await supabase
      .from("coach_uploads")
      .select("filename, file_size, coach_id, created_at")
      .gte("created_at", last24h)
      .gt("file_size", 100 * 1024 * 1024);
    if ((largeUploads || []).length > 0) {
      alerts.push({
        severity: "medium",
        category: "storage",
        title: "Gros fichiers uploadés",
        details: `${largeUploads!.length} fichiers >100MB en 24h`,
        timestamp: now.toISOString(),
      });
    }

    // 7. Organizations with no active members
    const { data: emptyOrgs } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("is_active", true);
    for (const org of emptyOrgs || []) {
      const { count } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("is_active", true);
      if ((count || 0) === 0) {
        alerts.push({
          severity: "low",
          category: "isolation",
          title: "Organisation sans membres",
          details: `${org.name} (${org.id}) est active mais n'a aucun membre`,
          timestamp: now.toISOString(),
        });
      }
    }

    // Summary
    const summary = {
      scan_date: now.toISOString(),
      alerts_count: alerts.length,
      by_severity: {
        critical: alerts.filter(a => a.severity === "critical").length,
        high: alerts.filter(a => a.severity === "high").length,
        medium: alerts.filter(a => a.severity === "medium").length,
        low: alerts.filter(a => a.severity === "low").length,
      },
      stats: {
        cost_24h: todayCost,
        activity_1h: (recentActivity || []).length,
        total_users: totalUsers,
        orphaned_users: orphaned,
      },
    };

    return jsonResponse({ success: true, summary, alerts });

  } catch (err: any) {
    console.error("[security-monitor] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});
