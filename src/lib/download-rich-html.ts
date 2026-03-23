import { getValidAccessToken } from './getValidAccessToken';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Fetch rich HTML from download-deliverable edge function.
 */
async function fetchRichHtml(
  type: string,
  enterpriseId: string,
  authSession: any,
  navigate: any,
): Promise<string> {
  const token = await getValidAccessToken(authSession, navigate);
  const url = `${SUPABASE_URL}/functions/v1/download-deliverable?type=${type}&enterprise_id=${enterpriseId}&format=html&_ts=${Date.now()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erreur téléchargement HTML');
  }
  return await res.text();
}

export async function downloadRichHtml(
  type: string,
  enterpriseId: string,
  enterpriseName: string,
  authSession: any,
  navigate: any,
) {
  try {
    const html = await fetchRichHtml(type, enterpriseId, authSession, navigate);
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const safeName = enterpriseName.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${safeName}_${type}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast.success('HTML téléchargé');
  } catch (err: any) {
    toast.error(err.message || 'Erreur HTML');
  }
}

export async function downloadRichPdf(
  type: string,
  enterpriseId: string,
  enterpriseName: string,
  authSession: any,
  navigate: any,
) {
  try {
    const token = await getValidAccessToken(authSession, navigate);
    const url = `${SUPABASE_URL}/functions/v1/download-deliverable?type=${type}&enterprise_id=${enterpriseId}&format=pdf&_ts=${Date.now()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erreur génération PDF');
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const safeName = enterpriseName.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${safeName}_${type}_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast.success('PDF téléchargé');
  } catch (err: any) {
    toast.error(err.message || 'Erreur PDF');
  }
}
