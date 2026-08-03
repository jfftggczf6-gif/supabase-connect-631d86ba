// Envoi d'un email via Resend, partagé entre edge functions (notification équipe,
// mail de confirmation candidat, etc.). Non bloquant : renvoie false en cas d'échec
// (l'appelant décide ; on ne casse jamais le flux principal pour un email).

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}): Promise<boolean> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("[send-email] RESEND_API_KEY non configuré");
    return false;
  }
  const payload: Record<string, unknown> = {
    from: opts.from || "ESONO <noreply@esono.tech>",
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.replyTo) payload.reply_to = opts.replyTo;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.error(`[send-email] ${resp.status}:`, (await resp.text().catch(() => "")).slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[send-email] fetch error:", (e as Error).message);
    return false;
  }
}

/** Échappe le HTML pour interpoler du texte utilisateur en toute sécurité dans un email. */
export function escapeHtml(v: unknown): string {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
