// proxy-parser — Proxies requests to Railway parser without exposing API key client-side
// Security: API key stays server-side, frontend never sees it
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/helpers_v5.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PARSER_URL = Deno.env.get("PARSER_URL") || Deno.env.get("RAILWAY_URL") || "";
const PARSER_API_KEY = Deno.env.get("PARSER_API_KEY") || "";

// Max file size: 200 MB
const MAX_FILE_SIZE = 200 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/msword", // .doc
  "application/vnd.ms-excel", // .xls
  "text/csv", "text/plain", "text/markdown",
  "image/jpeg", "image/png", "image/webp",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-powerpoint", // .ppt
]);

// Blocked extensions
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".sh", ".bat", ".cmd", ".msi", ".dll", ".com", ".scr",
  ".js", ".vbs", ".wsf", ".ps1", ".jar", ".py", ".rb",
  ".html", ".htm", ".svg", ".xml",
  ".zip", ".tar", ".gz", ".7z", ".rar",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Unauthorized", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    if (!PARSER_URL || !PARSER_API_KEY) {
      return errorResponse("Parser not configured", 500);
    }

    const contentType = req.headers.get("content-type") || "";

    // JSON request (e.g., /health, /generate-pdf)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const endpoint = body.endpoint || "/health";

      const resp = await fetch(`${PARSER_URL}${endpoint}`, {
        method: body.method || "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PARSER_API_KEY}`,
        },
        body: body.payload ? JSON.stringify(body.payload) : undefined,
      });

      const data = await resp.json().catch(() => ({}));
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // File upload (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) return errorResponse("No file provided", 400);

      // S6: Server-side file validation
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400);
      }

      // Check extension
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (BLOCKED_EXTENSIONS.has(ext)) {
        return errorResponse(`File type not allowed: ${ext}`, 400);
      }

      // Check MIME type
      if (file.type && !ALLOWED_MIMES.has(file.type) && file.type !== "application/octet-stream") {
        return errorResponse(`MIME type not allowed: ${file.type}`, 400);
      }

      // Forward to Railway
      const proxyForm = new FormData();
      proxyForm.append("file", file);
      // Forward other form fields
      for (const [key, val] of formData.entries()) {
        if (key !== "file") proxyForm.append(key, val);
      }

      const endpoint = formData.get("endpoint")?.toString() || "/parse";
      const resp = await fetch(`${PARSER_URL}${endpoint}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${PARSER_API_KEY}` },
        body: proxyForm,
      });

      const data = await resp.json().catch(() => ({}));
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return errorResponse("Unsupported content type", 400);
  } catch (err: any) {
    console.error("[proxy-parser] Error:", err);
    return errorResponse(err.message || "Internal error", 500);
  }
});
