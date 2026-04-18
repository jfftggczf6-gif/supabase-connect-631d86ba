import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function exportToPdf(htmlContent: string, filename: string = 'livrable.pdf') {
  // Use proxy-parser EF instead of direct Railway call (security: API key stays server-side)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/proxy-parser`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      endpoint: '/generate-pdf',
      method: 'POST',
      payload: { html: htmlContent, filename },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`PDF generation failed: ${response.status} ${errText}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
