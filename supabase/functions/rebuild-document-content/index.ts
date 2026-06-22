// rebuild-document-content — reconcile Storage /reconstruction/ with enterprises.document_content
// Called after upload/delete to keep IA memory in sync with physical files.
// Storage = single source of truth. document_parsing_report.files[] = canonical parsed cache.
// document_content = derived view (concat + truncate).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext } from "../_shared/helpers_v5.ts";

const MAX_CONTENT = 600_000;

interface ReportFile {
  fileName: string;
  content?: string;
  category?: string;
  quality?: string;
  sizeBytes?: number;
  charsExtracted?: number;
  summary?: string;
  method?: string;
}

const CATEGORY_ORDER = [
  "etats_financiers",
  "releve_bancaire",
  "budget_previsionnel",
  "facture",
  "business_plan",
  "rapport_activite",
  "document_legal",
  "organigramme_rh",
  "photo_installation",
  "autre",
];

const QUALITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, failed: 3 };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth : session utilisateur normale, OU mode admin headless par token
    // (X-Admin-Token == ADMIN_REBUILD_TOKEN) pour ré-synchroniser une entreprise
    // côté serveur (récupération après désync). Bypass de verifyAndGetContext.
    const adminToken = Deno.env.get("ADMIN_REBUILD_TOKEN");
    const incomingAdmin = req.headers.get("X-Admin-Token");
    let supabase: any, enterprise: any, enterprise_id: string;
    if (adminToken && incomingAdmin === adminToken) {
      const body = await req.json().catch(() => ({}));
      enterprise_id = body?.enterprise_id;
      if (!enterprise_id) return errorResponse("enterprise_id requis (admin)", 400);
      supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: ent } = await supabase.from("enterprises").select("*").eq("id", enterprise_id).single();
      if (!ent) return errorResponse("Entreprise introuvable", 404);
      enterprise = ent;
    } else {
      const ctx = await verifyAndGetContext(req);
      supabase = ctx.supabase; enterprise = ctx.enterprise; enterprise_id = ctx.enterprise_id;
    }

    // 1. List storage /reconstruction/
    const { data: storageFiles, error: listErr } = await supabase.storage
      .from("documents")
      .list(`${enterprise_id}/reconstruction/`);
    if (listErr) return errorResponse("Erreur lecture Storage: " + listErr.message, 500);

    const allFiles = (storageFiles || []).filter(
      (f: any) => f.name !== ".emptyFolderPlaceholder" && f.metadata
    );

    // 1b. AUTO-CLEANUP legacy duplicates (files left over from the Date.now() prefix era)
    // Group by normalized name (strip ^\d+_). Within each group, keep the canonical one
    // (preferring the variant without prefix; otherwise the most recently created).
    // Delete the rest.
    const stripLegacy = (n: string) => n.replace(/^\d+_/, "");
    const groups = new Map<string, any[]>();
    for (const f of allFiles) {
      const key = stripLegacy(f.name);
      const arr = groups.get(key) || [];
      arr.push(f);
      groups.set(key, arr);
    }

    const pathsToDelete: string[] = [];
    for (const [normalized, variants] of groups.entries()) {
      if (variants.length <= 1) continue;
      // Prefer the variant whose name === normalized (= no prefix). Otherwise, the most recent.
      let keeper = variants.find((v: any) => v.name === normalized);
      if (!keeper) {
        keeper = variants.reduce((latest: any, current: any) =>
          new Date(current.created_at).getTime() > new Date(latest.created_at).getTime() ? current : latest
        );
      }
      for (const v of variants) {
        if (v.name !== keeper.name) {
          pathsToDelete.push(`${enterprise_id}/reconstruction/${v.name}`);
        }
      }
    }

    let cleanedDuplicates = 0;
    if (pathsToDelete.length > 0) {
      const { error: cleanupErr } = await supabase.storage.from("documents").remove(pathsToDelete);
      if (cleanupErr) {
        console.error("[rebuild-document-content] cleanup failed:", cleanupErr.message);
        // Non-fatal: proceed with current state, next call will retry
      } else {
        cleanedDuplicates = pathsToDelete.length;
      }
    }

    // Refresh the list after cleanup
    const validNames = new Set(
      cleanedDuplicates > 0
        ? allFiles
            .filter((f: any) => !pathsToDelete.includes(`${enterprise_id}/reconstruction/${f.name}`))
            .map((f: any) => f.name)
        : allFiles.map((f: any) => f.name)
    );

    // 2. Intersect with existing parsing report
    const existingReport = (enterprise.document_parsing_report || {}) as { files?: ReportFile[] };
    const existingFiles = existingReport.files || [];
    const keptFiles = existingFiles.filter((f) => validNames.has(f.fileName));
    const removedOrphans = existingFiles.length - keptFiles.length;

    // 3. Detect files present in Storage but missing from report (legacy or never parsed)
    const reportNames = new Set(keptFiles.map((f) => f.fileName));
    const missingContentFiles = Array.from(validNames).filter((n) => !reportNames.has(n as string));

    // 3b. RE-PARSE des fichiers présents en storage mais absents du cache.
    // Récupération après l'ancien bug "remplace au lieu de fusionner" : on télécharge
    // chaque fichier manquant, on le parse via Railway, et on l'ajoute au cache pour qu'il
    // entre dans document_content. Best-effort (timeout par fichier, échecs ignorés) ;
    // idempotent : un fichier re-parsé n'est plus "manquant" au prochain appel.
    let reparsedCount = 0;
    const reparseFailed: string[] = [];
    if (missingContentFiles.length > 0) {
      const RAILWAY_URL = Deno.env.get("RAILWAY_URL") || "https://esono-parser-production-8f89.up.railway.app";
      const PARSER_API_KEY = Deno.env.get("PARSER_API_KEY") || "";
      for (const storageName of missingContentFiles) {
        const cleanName = stripLegacy(storageName as string);
        try {
          const { data: fileData } = await supabase.storage
            .from("documents")
            .download(`${enterprise_id}/reconstruction/${storageName}`);
          if (!fileData) { reparseFailed.push(cleanName); continue; }
          const fd = new FormData();
          fd.append("file", fileData, cleanName);
          const resp = await fetch(`${RAILWAY_URL}/parse`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${PARSER_API_KEY}` },
            body: fd,
            signal: AbortSignal.timeout(25_000),
          });
          if (!resp.ok) { console.warn(`[rebuild] parse échoué ${cleanName}: ${resp.status}`); reparseFailed.push(cleanName); continue; }
          const parsed = await resp.json();
          if (parsed.content && parsed.content.length >= 10) {
            keptFiles.push({
              fileName: cleanName,
              content: parsed.content,
              category: parsed.category || "autre",
              quality: parsed.quality || "high",
              charsExtracted: parsed.content.length,
              method: parsed.method,
            });
            reportNames.add(cleanName);
            reparsedCount++;
            console.log(`[rebuild] re-parsé: ${cleanName} (${parsed.content.length} chars, ${parsed.category})`);
          } else {
            reparseFailed.push(cleanName);
          }
        } catch (e: any) {
          console.warn(`[rebuild] erreur re-parse ${cleanName}:`, e?.message);
          reparseFailed.push(cleanName);
        }
      }
    }

    // 4. Legacy guard: if no file in the report has a `content` field (pre-extension state),
    //    DO NOT overwrite document_content — we'd erase the IA memory. Instead, preserve
    //    the existing content as-is and let the caller know which files need reparsing.
    const hasAnyContent = keptFiles.some((f) => f.content && f.content.length >= 10);
    if (!hasAnyContent && keptFiles.length > 0) {
      const filesParsedOk = keptFiles.filter((f) => f.quality !== "failed").length;
      // Refresh metadata without touching document_content
      const newReport = {
        ...existingReport,
        files: keptFiles,
        total_files: keptFiles.length,
        files_parsed_ok: filesParsedOk,
        files_failed: keptFiles.length - filesParsedOk,
        rebuilt_at: new Date().toISOString(),
      };
      const { error: legacyUpdErr } = await supabase
        .from("enterprises")
        .update({
          document_files_count: filesParsedOk,
          document_parsing_report: newReport,
        })
        .eq("id", enterprise_id);
      if (legacyUpdErr) return errorResponse("Erreur update enterprise (legacy): " + legacyUpdErr.message, 500);

      return jsonResponse({
        ok: true,
        files_count: keptFiles.length,
        content_length: (enterprise.document_content || "").length,
        storage_count: validNames.size,
        removed_orphans: removedOrphans,
        cleaned_duplicates: cleanedDuplicates,
        missing_content_files: keptFiles.map((f) => f.fileName),
        legacy_preserved: true,
      });
    }

    // 5. Sort by category priority + quality, then concat
    const sorted = [...keptFiles].sort((a, b) => {
      const idxA = CATEGORY_ORDER.indexOf(a.category || "autre");
      const idxB = CATEGORY_ORDER.indexOf(b.category || "autre");
      if (idxA !== idxB) return idxA - idxB;
      return (QUALITY_ORDER[a.quality || "failed"] ?? 3) - (QUALITY_ORDER[b.quality || "failed"] ?? 3);
    });

    let rebuilt = "";
    for (const f of sorted) {
      if (rebuilt.length >= MAX_CONTENT) break;
      if (!f.content || f.content.length < 10) continue;
      const catLabel = f.category && f.category !== "autre" ? ` [${f.category.toUpperCase()}]` : "";
      const header = `\n\n══════ ${f.fileName}${catLabel} ══════\n`;
      const remaining = MAX_CONTENT - rebuilt.length - header.length;
      if (remaining <= 0) break;
      rebuilt += header + f.content.substring(0, remaining);
    }

    // 6. Update enterprise atomically
    const filesParsedOk = keptFiles.filter((f) => f.quality !== "failed").length;
    const newReport = {
      ...existingReport,
      files: keptFiles,
      total_files: keptFiles.length,
      files_parsed_ok: filesParsedOk,
      files_failed: keptFiles.length - filesParsedOk,
      total_chars_extracted: rebuilt.length,
      rebuilt_at: new Date().toISOString(),
    };

    const { error: updErr } = await supabase
      .from("enterprises")
      .update({
        document_content: rebuilt,
        document_files_count: filesParsedOk,
        document_parsing_report: newReport,
        document_content_updated_at: new Date().toISOString(),
      })
      .eq("id", enterprise_id);
    if (updErr) return errorResponse("Erreur update enterprise: " + updErr.message, 500);

    return jsonResponse({
      ok: true,
      files_count: keptFiles.length,
      content_length: rebuilt.length,
      storage_count: validNames.size,
      removed_orphans: removedOrphans,
      cleaned_duplicates: cleanedDuplicates,
      reparsed_count: reparsedCount,
      reparse_failed: reparseFailed,
      missing_content_files: missingContentFiles,
    });
  } catch (e: any) {
    const status = e?.status || 500;
    const message = e?.message || "Erreur inconnue";
    return errorResponse(message, status);
  }
});
