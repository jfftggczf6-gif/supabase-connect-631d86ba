const PARSER_URL = import.meta.env.VITE_PARSER_URL;
const PARSER_API_KEY = import.meta.env.VITE_PARSER_API_KEY;

export async function exportToPdf(htmlContent: string, filename: string = 'livrable.pdf') {
  if (!PARSER_URL) {
    throw new Error('PARSER_URL not configured');
  }

  const response = await fetch(`${PARSER_URL}/generate-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PARSER_API_KEY}`,
    },
    body: JSON.stringify({ html: htmlContent, filename }),
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
