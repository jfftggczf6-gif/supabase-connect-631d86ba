import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Generate PDF from a compliance report data object
 */
export async function exportComplianceReportPdf(data: any, enterpriseName: string) {
  const sections = data.sections || {};
  const redFlags = data.red_flags || [];
  const conclusion = data.conclusion || {};

  const sectionHtml = Object.entries(sections).map(([key, section]: [string, any]) => `
    <div style="margin-bottom:24px; page-break-inside:avoid;">
      <h3 style="color:#1B2A4A; border-bottom:2px solid #1B2A4A; padding-bottom:6px; text-transform:capitalize;">
        ${key.replace(/_/g, ' ')}
      </h3>
      ${section.observations_cles?.length ? `
        <h4 style="color:#059669; margin:12px 0 6px;">Observations clés</h4>
        <ul>${section.observations_cles.map((o: string) => `<li style="margin:4px 0; font-size:11px;">${o}</li>`).join('')}</ul>
      ` : ''}
      ${section.a_clarifier?.length ? `
        <h4 style="color:#D97706; margin:12px 0 6px;">À clarifier</h4>
        <ul>${section.a_clarifier.map((o: string) => `<li style="margin:4px 0; font-size:11px;">${o}</li>`).join('')}</ul>
      ` : ''}
      ${section.recommandations?.length ? `
        <h4 style="color:#DC2626; margin:12px 0 6px;">Recommandations</h4>
        <ul>${section.recommandations.map((o: string) => `<li style="margin:4px 0; font-size:11px;">${o}</li>`).join('')}</ul>
      ` : ''}
    </div>
  `).join('');

  const redFlagsHtml = redFlags.length ? `
    <div style="background:#FEF2F2; border:1px solid #FECACA; border-radius:8px; padding:16px; margin:20px 0; page-break-inside:avoid;">
      <h3 style="color:#DC2626; margin:0 0 12px;">⚠️ Red Flags détectés</h3>
      ${redFlags.map((rf: any) => `
        <p style="margin:6px 0; font-size:11px;"><strong>${rf.id?.replace(/_/g, ' ')}</strong> (${rf.severity}) — ${rf.details}</p>
      `).join('')}
    </div>
  ` : '';

  const conclusionHtml = conclusion.summary ? `
    <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:8px; padding:16px; margin:20px 0; page-break-inside:avoid;">
      <h3 style="color:#1B2A4A; margin:0 0 8px;">Conclusion — ${conclusion.verdict?.replace(/_/g, ' ') || ''}</h3>
      <p style="font-size:12px; margin:0 0 12px;">${conclusion.summary}</p>
      ${conclusion.actions_prioritaires?.length ? `
        <h4 style="margin:8px 0 4px;">Actions prioritaires</h4>
        <ol>${conclusion.actions_prioritaires.map((a: string) => `<li style="font-size:11px; margin:3px 0;">${a}</li>`).join('')}</ol>
      ` : ''}
    </div>
  ` : '';

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
    <title>Compliance Report — ${enterpriseName}</title>
    <style>
      @page { size: A4; margin: 20mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; line-height: 1.5; }
      h2 { color: #1B2A4A; font-size: 18px; margin: 0 0 4px; }
      h3 { font-size: 14px; margin: 16px 0 8px; }
      h4 { font-size: 12px; margin: 8px 0 4px; }
      ul, ol { padding-left: 20px; }
      .header { background: #1B2A4A; color: white; padding: 24px; margin: -20mm -20mm 20px -20mm; text-align: center; }
      .header h1 { margin: 0; font-size: 20px; }
      .header p { margin: 4px 0 0; color: #8BB8E8; font-size: 12px; }
      .score { text-align: center; font-size: 36px; font-weight: bold; color: #1B2A4A; margin: 16px 0; }
      .footer { text-align: center; font-size: 10px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
    </style>
  </head><body>
    <div class="header">
      <h1>COMPLIANCE FEEDBACK REPORT</h1>
      <p>${enterpriseName} — ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>
    <div class="score">${data.score_compliance || '—'}/100</div>
    ${sectionHtml}
    ${redFlagsHtml}
    ${conclusionHtml}
    <div class="footer">
      Généré par ESONO BIS Studio — Document confidentiel<br/>
      Ondernemers voor Ondernemers (OVO)
    </div>
  </body></html>`;

  await generateAndDownloadPdf(html, `Compliance_Report_${enterpriseName.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generate PDF from an IC Decision Report data object
 */
export async function exportICReportPdf(data: any, enterpriseName: string) {
  const risksHtml = (data.analyse_risques || []).map((r: any) => `
    <tr>
      <td style="padding:6px 8px; border:1px solid #dee2e6; font-size:11px;">${r.risque}</td>
      <td style="padding:6px 8px; border:1px solid #dee2e6; font-size:11px; text-align:center;">${r.severite}</td>
      <td style="padding:6px 8px; border:1px solid #dee2e6; font-size:11px;">${r.mitigation || '—'}</td>
    </tr>
  `).join('');

  const conditionsHtml = (data.conditions || []).map((c: string, i: number) => `<li style="margin:4px 0; font-size:11px;">${c}</li>`).join('');

  const verdictColor = data.recommandation_ic === 'APPROUVER' ? '#059669' :
    data.recommandation_ic === 'APPROUVER_SOUS_CONDITIONS' ? '#D97706' :
    data.recommandation_ic === 'REPORTER' ? '#EA580C' : '#DC2626';

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
    <title>IC Decision Report — ${enterpriseName}</title>
    <style>
      @page { size: A4; margin: 20mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; line-height: 1.5; }
      .header { background: #1B2A4A; color: white; padding: 24px; margin: -20mm -20mm 20px -20mm; text-align: center; }
      .header h1 { margin: 0; font-size: 20px; }
      .header p { margin: 4px 0 0; color: #8BB8E8; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      .verdict { text-align: center; font-size: 24px; font-weight: bold; padding: 16px; border-radius: 8px; margin: 20px 0; }
      h3 { color: #1B2A4A; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
      .footer { text-align: center; font-size: 10px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
    </style>
  </head><body>
    <div class="header">
      <h1>INVESTMENT COMMITTEE DECISION REPORT</h1>
      <p>${enterpriseName} — ${data.report_date || new Date().toLocaleDateString('fr-FR')}</p>
    </div>
    <div class="verdict" style="background:${verdictColor}15; color:${verdictColor}; border:2px solid ${verdictColor};">
      ${(data.recommandation_ic || 'EN ATTENTE').replace(/_/g, ' ')}
    </div>
    ${data.resume_executif ? `<h3>Résumé exécutif</h3><p style="font-size:12px;">${data.resume_executif}</p>` : ''}
    ${data.analyse_financiere ? `
      <h3>Analyse financière</h3>
      <table>
        <tr><td style="padding:4px 8px; font-weight:bold; width:40%;">CA</td><td style="padding:4px 8px;">${data.analyse_financiere.ca?.toLocaleString() || '—'}</td></tr>
        <tr><td style="padding:4px 8px; font-weight:bold;">Marge brute</td><td style="padding:4px 8px;">${data.analyse_financiere.marge_brute_pct || '—'}%</td></tr>
        <tr><td style="padding:4px 8px; font-weight:bold;">DSCR</td><td style="padding:4px 8px;">${data.analyse_financiere.dscr || '—'}x</td></tr>
        <tr><td style="padding:4px 8px; font-weight:bold;">VAN</td><td style="padding:4px 8px;">${data.analyse_financiere.van?.toLocaleString() || '—'}</td></tr>
        <tr><td style="padding:4px 8px; font-weight:bold;">TRI</td><td style="padding:4px 8px;">${data.analyse_financiere.tri || '—'}%</td></tr>
      </table>
    ` : ''}
    ${risksHtml ? `
      <h3>Analyse des risques</h3>
      <table><thead><tr>
        <th style="padding:6px 8px; border:1px solid #dee2e6; background:#f8f9fa; text-align:left;">Risque</th>
        <th style="padding:6px 8px; border:1px solid #dee2e6; background:#f8f9fa;">Sévérité</th>
        <th style="padding:6px 8px; border:1px solid #dee2e6; background:#f8f9fa; text-align:left;">Mitigation</th>
      </tr></thead><tbody>${risksHtml}</tbody></table>
    ` : ''}
    ${conditionsHtml ? `<h3>Conditions</h3><ol>${conditionsHtml}</ol>` : ''}
    ${data.vote_suggere ? `<h3>Vote suggéré</h3><p style="font-size:12px; font-style:italic;">${data.vote_suggere}</p>` : ''}
    <div class="footer">
      Généré par ESONO BIS Studio — Document confidentiel<br/>
      À soumettre au Comité d'Investissement
    </div>
  </body></html>`;

  await generateAndDownloadPdf(html, `IC_Decision_Report_${enterpriseName.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generate PDF from ODD portfolio data
 */
export async function exportODDPortfolioPdf(kpis: any[], oddCoverage: any[], programmeName: string, enterprisesCount: number) {
  const kpisHtml = kpis.map(k => `
    <tr>
      <td style="padding:8px; border:1px solid #dee2e6; font-size:11px;">ODD ${k.sdg}</td>
      <td style="padding:8px; border:1px solid #dee2e6; font-size:11px; font-weight:bold;">${k.kpi_name}</td>
      <td style="padding:8px; border:1px solid #dee2e6; font-size:11px; text-align:center;">${k.value?.toLocaleString() || '—'} ${k.unit}</td>
      <td style="padding:8px; border:1px solid #dee2e6; font-size:11px; text-align:center; color:${(k.delta_pct || 0) >= 0 ? '#059669' : '#DC2626'};">
        ${k.delta_pct != null ? `${k.delta_pct >= 0 ? '+' : ''}${k.delta_pct.toFixed(1)}%` : '—'}
      </td>
    </tr>
  `).join('');

  const coverageHtml = oddCoverage.map(o => `
    <tr>
      <td style="padding:6px 8px; border:1px solid #dee2e6; font-size:11px;">ODD ${o.sdg_number}</td>
      <td style="padding:6px 8px; border:1px solid #dee2e6; font-size:11px;">${o.sdg_name}</td>
      <td style="padding:6px 8px; border:1px solid #dee2e6; font-size:11px; text-align:center;">${o.enterprises_count}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
    <title>Rapport Impact ODD — ${programmeName}</title>
    <style>
      @page { size: A4; margin: 20mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; line-height: 1.5; }
      .header { background: #1B2A4A; color: white; padding: 24px; margin: -20mm -20mm 20px -20mm; text-align: center; }
      .header h1 { margin: 0; font-size: 20px; }
      .header p { margin: 4px 0 0; color: #8BB8E8; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      h3 { color: #1B2A4A; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
      .footer { text-align: center; font-size: 10px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
    </style>
  </head><body>
    <div class="header">
      <h1>RAPPORT D'IMPACT — OBJECTIFS DE DÉVELOPPEMENT DURABLE</h1>
      <p>${programmeName} — ${enterprisesCount} entreprises — ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>
    <h3>KPIs Impact (Framework OVO / Impact Frontiers)</h3>
    <table><thead><tr>
      <th style="padding:8px; border:1px solid #dee2e6; background:#f8f9fa;">ODD</th>
      <th style="padding:8px; border:1px solid #dee2e6; background:#f8f9fa;">Indicateur</th>
      <th style="padding:8px; border:1px solid #dee2e6; background:#f8f9fa; text-align:center;">Valeur actuelle</th>
      <th style="padding:8px; border:1px solid #dee2e6; background:#f8f9fa; text-align:center;">Évolution Y-o-Y</th>
    </tr></thead><tbody>${kpisHtml}</tbody></table>
    <h3>Couverture ODD par le portefeuille</h3>
    <table><thead><tr>
      <th style="padding:6px 8px; border:1px solid #dee2e6; background:#f8f9fa;">ODD</th>
      <th style="padding:6px 8px; border:1px solid #dee2e6; background:#f8f9fa;">Nom</th>
      <th style="padding:6px 8px; border:1px solid #dee2e6; background:#f8f9fa; text-align:center;">Entreprises</th>
    </tr></thead><tbody>${coverageHtml}</tbody></table>
    <div class="footer">
      Généré par ESONO BIS Studio — Framework Impact Frontiers<br/>
      Document confidentiel — ${new Date().toLocaleDateString('fr-FR')}
    </div>
  </body></html>`;

  await generateAndDownloadPdf(html, `Rapport_Impact_ODD_${programmeName.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Core: send HTML to proxy-parser for PDF conversion and download
 */
async function generateAndDownloadPdf(html: string, filename: string) {
  toast.info('Génération du PDF...');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/proxy-parser`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      endpoint: '/generate-pdf',
      method: 'POST',
      payload: { html, filename },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`PDF generation failed: ${resp.status} — ${err.slice(0, 200)}`);
  }

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('PDF téléchargé');
}
