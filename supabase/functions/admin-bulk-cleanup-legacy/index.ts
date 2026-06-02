// admin-bulk-cleanup-legacy — ONE-SHOT admin function to clean up legacy duplicates
// across ALL enterprises affected by the pre-fix Date.now() prefix bug.
//
// Auth: header X-Admin-Token must match Deno.env.get("ADMIN_BULK_TOKEN").
// Body (optional): { enterprise_id?: string }  → if absent, runs for all enterprises.
//
// For each enterprise's /reconstruction/ folder :
//   1. Group files by normalized name (strip ^\d+_)
//   2. For each group with >1 variant, keep the canonical (no prefix) or most recent
//   3. Delete the others via storage.remove() (uses service_role, bypasses RLS)
//   4. Refresh enterprises.document_parsing_report.files (drop orphans)
//   5. Refresh enterprises.document_files_count
//   6. PRESERVE document_content (legacy state — do not erase IA memory)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers_v5.ts";

interface ReportFile {
  fileName: string;
  content?: string;
  quality?: string;
  [key: string]: any;
}

interface CleanupResult {
  enterprise_id: string;
  enterprise_name: string | null;
  files_before: number;
  files_after: number;
  files_deleted: number;
  delete_errors: string[];
}

function jsonResp(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminToken = Deno.env.get("ADMIN_BULK_TOKEN");
    if (!adminToken) return jsonResp({ error: "ADMIN_BULK_TOKEN not configured" }, 500);
    if (req.headers.get("X-Admin-Token") !== adminToken) {
      return jsonResp({ error: "Forbidden" }, 403);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const targetEnterpriseId: string | undefined = body.enterprise_id;

    // Find enterprises that have files in /reconstruction/
    const enterpriseIdsSet = new Set<string>();
    if (targetEnterpriseId) {
      enterpriseIdsSet.add(targetEnterpriseId);
    } else {
      const { data: rows, error: queryErr } = await admin
        .from("enterprises")
        .select("id")
        .gt("document_files_count", 0);
      if (queryErr) return jsonResp({ error: "Query enterprises failed: " + queryErr.message }, 500);
      for (const r of rows || []) enterpriseIdsSet.add((r as any).id);
    }

    const stripLegacy = (n: string) => n.replace(/^\d+_/, "");
    const results: CleanupResult[] = [];

    for (const enterpriseId of enterpriseIdsSet) {
      // Get enterprise name + current report
      const { data: ent } = await admin
        .from("enterprises")
        .select("name, document_parsing_report")
        .eq("id", enterpriseId)
        .maybeSingle();

      const { data: storageFiles, error: listErr } = await admin.storage
        .from("documents")
        .list(`${enterpriseId}/reconstruction/`);
      if (listErr) {
        results.push({
          enterprise_id: enterpriseId,
          enterprise_name: ent?.name || null,
          files_before: 0,
          files_after: 0,
          files_deleted: 0,
          delete_errors: ["list_error: " + listErr.message],
        });
        continue;
      }

      const allFiles = (storageFiles || []).filter(
        (f: any) => f.name !== ".emptyFolderPlaceholder" && f.metadata
      );

      // Group by normalized
      const groups = new Map<string, any[]>();
      for (const f of allFiles) {
        const key = stripLegacy(f.name);
        const arr = groups.get(key) || [];
        arr.push(f);
        groups.set(key, arr);
      }

      const pathsToDelete: string[] = [];
      const keptNames = new Set<string>();
      for (const [normalized, variants] of groups.entries()) {
        if (variants.length === 1) {
          keptNames.add(variants[0].name);
          continue;
        }
        let keeper = variants.find((v: any) => v.name === normalized);
        if (!keeper) {
          keeper = variants.reduce((latest: any, current: any) =>
            new Date(current.created_at).getTime() > new Date(latest.created_at).getTime()
              ? current
              : latest
          );
        }
        keptNames.add(keeper.name);
        for (const v of variants) {
          if (v.name !== keeper.name) {
            pathsToDelete.push(`${enterpriseId}/reconstruction/${v.name}`);
          }
        }
      }

      const deleteErrors: string[] = [];
      let actuallyDeleted = 0;

      if (pathsToDelete.length > 0) {
        const { data: removed, error: rmErr } = await admin.storage
          .from("documents")
          .remove(pathsToDelete);
        if (rmErr) {
          deleteErrors.push("remove_error: " + rmErr.message);
        } else {
          actuallyDeleted = removed?.length ?? pathsToDelete.length;
        }
      }

      // Refresh report.files to drop orphan entries (those no longer in storage)
      const existingReport = (ent?.document_parsing_report as any) || {};
      const existingReportFiles: ReportFile[] = existingReport.files || [];
      const keptReportFiles = existingReportFiles.filter((f) => keptNames.has(f.fileName));
      const filesParsedOk = keptReportFiles.filter((f) => f.quality !== "failed").length;

      const newReport = {
        ...existingReport,
        files: keptReportFiles,
        total_files: keptReportFiles.length,
        files_parsed_ok: filesParsedOk,
        files_failed: keptReportFiles.length - filesParsedOk,
        rebuilt_at: new Date().toISOString(),
        bulk_cleanup_at: new Date().toISOString(),
      };

      // Update enterprise — DO NOT touch document_content (preserve legacy IA memory)
      await admin
        .from("enterprises")
        .update({
          document_files_count: filesParsedOk,
          document_parsing_report: newReport,
        })
        .eq("id", enterpriseId);

      results.push({
        enterprise_id: enterpriseId,
        enterprise_name: ent?.name || null,
        files_before: allFiles.length,
        files_after: allFiles.length - actuallyDeleted,
        files_deleted: actuallyDeleted,
        delete_errors: deleteErrors,
      });
    }

    const summary = {
      enterprises_scanned: results.length,
      enterprises_with_cleanup: results.filter((r) => r.files_deleted > 0).length,
      total_files_deleted: results.reduce((s, r) => s + r.files_deleted, 0),
      errors: results.flatMap((r) => r.delete_errors).filter((s) => s.length > 0),
      details: results,
    };

    return jsonResp({ ok: true, ...summary });
  } catch (e: any) {
    return jsonResp({ error: e?.message || "Unknown error" }, 500);
  }
});
