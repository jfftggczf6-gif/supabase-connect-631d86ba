import { Badge } from '@/components/ui/badge';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { exportToPdf } from '@/lib/export-pdf';

interface Props {
  data: Record<string, any>;
  onRegenerate?: () => void;
}

export default function OnePagerViewer({ data, onRegenerate }: Props) {
  const score = data.score || 0;
  const pres = data.presentation_entreprise || {};
  const equipe = data.equipe_gouvernance || {};
  const traction = data.traction_finances || {};
  const criteres = data.criteres_ip || {};

  // Fallback for old format
  const isIPFormat = !!data.apercu_projet || !!data.presentation_entreprise;

  const scoreBg = score >= 70 ? 'bg-emerald-100 text-emerald-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  const handleDownloadHtml = () => {
    const sectionRow = (label: string, content: string) =>
      `<tr><td class="label">${label}</td><td class="content">${content}</td></tr>`;

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${data.titre || 'One-Pager I&P'}</title>
<style>
@page{size:A4 portrait;margin:14mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Segoe UI",Arial,sans-serif;font-size:9pt;color:#1e293b;max-width:190mm;margin:0 auto;line-height:1.5}
h1{font-size:14pt;color:#1e3a5f;text-align:center;padding:10px 0;border-bottom:3px solid #1e3a5f;margin-bottom:10px}
.apercu{font-size:9pt;color:#475569;margin-bottom:12px;text-align:justify}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
td.label{background:#1e3a5f;color:white;width:130px;padding:8px 10px;font-size:8pt;font-weight:600;vertical-align:top;border:1px solid #1e3a5f}
td.content{padding:8px 10px;font-size:8pt;border:1px solid #cbd5e1;vertical-align:top}
td.content p{margin:2px 0}
.criteres-title{font-size:10pt;font-weight:700;color:#1e3a5f;margin:10px 0 6px}
.criteres-subtitle{font-size:8pt;color:#64748b;margin-bottom:6px}
.crit-row{padding:4px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:3px;font-size:8pt}
.crit-row strong{color:#1e3a5f}
</style></head><body>
<h1>${data.titre || `I&P Company One-Pager – ${pres.nom || ''}`}</h1>
<div class="apercu">${data.apercu_projet || ''}</div>
<table>
${sectionRow('Présentation de l\'entreprise', `
<p><strong>Nom :</strong> ${pres.nom || '—'}</p>
<p><strong>Secteur :</strong> ${pres.secteur || '—'}</p>
<p><strong>Localisation :</strong> ${pres.localisation || '—'}</p>
<p><strong>Site web :</strong> ${pres.site_web || '—'}</p>
<p><strong>Année de création :</strong> ${pres.annee_creation || '—'}</p>
<p><strong>Forme juridique :</strong> ${pres.forme_juridique || '—'}</p>
<p><strong>Financement recherché :</strong> ${pres.financement_recherche || '—'}</p>
<p><strong>Objectif :</strong> ${pres.objectif || '—'}</p>
`)}
${sectionRow('Équipe et gouvernance', `
<p><strong>Fondateur :</strong> ${equipe.fondateur || '—'}</p>
<p><strong>Dirigé par des femmes :</strong> ${equipe.dirige_par_femmes || '—'}</p>
<p><strong>Compétences :</strong> ${equipe.competences || '—'}</p>
<p><strong>Taille de l'équipe :</strong> ${equipe.taille_equipe || '—'}</p>
<p><strong>Gouvernance :</strong> ${equipe.gouvernance || '—'}</p>
<p><strong>Formelle :</strong> ${equipe.formelle || '—'}</p>
`)}
${sectionRow('Traction et finances', `
<p><strong>Ventes :</strong> ${traction.ventes || '—'}</p>
<p><strong>CA année dernière :</strong> ${traction.ca_annee_derniere || '—'}</p>
<p><strong>Accès au financement :</strong> ${traction.acces_financement || '—'}</p>
<p><strong>Croissance :</strong> ${traction.croissance || '—'}</p>
<p><strong>Économie unitaire :</strong> ${traction.economie_unitaire || '—'}</p>
<p><strong>Rentabilité :</strong> ${traction.rentabilite || '—'}</p>
<p><strong>Plan de croissance :</strong> ${traction.plan_croissance || '—'}</p>
`)}
${sectionRow('Potentiel du marché', `<p>${data.potentiel_marche || '—'}</p>`)}
${sectionRow('Impact', `<p>${data.impact || '—'}</p>`)}
</table>
${criteres ? `
<div class="criteres-title">Critères I&P</div>
<div class="criteres-subtitle">Documentation disponible OVO</div>
<div class="crit-row"><strong>Généralités :</strong> ${criteres.generalites || '—'}</div>
<div class="crit-row"><strong>Financier :</strong> ${criteres.financier || '—'}</div>
<div class="crit-row"><strong>Juridique :</strong> ${criteres.juridique || '—'}</div>
<div class="crit-row"><strong>Impact :</strong> ${criteres.impact_doc || '—'}</div>
<div class="crit-row"><strong>RH :</strong> ${criteres.rh || '—'}</div>
` : ''}
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `OnePager_IP_${pres.nom || 'entreprise'}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('HTML téléchargé');
  };

  // Fallback: render old format if data doesn't match I&P structure
  if (!isIPFormat) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Format de one-pager non reconnu. Regénérez pour obtenir le format I&P.</p>
        {onRegenerate && (
          <button onClick={onRegenerate} className="mt-2 text-sm underline text-primary">Regénérer</button>
        )}
      </div>
    );
  }

  const SectionRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[160px_1fr] border-b last:border-b-0">
      <div className="bg-[#1e3a5f] text-white p-3 text-xs font-semibold flex items-start">
        {label}
      </div>
      <div className="p-3 text-xs leading-relaxed space-y-1">
        {children}
      </div>
    </div>
  );

  const Field = ({ label, value }: { label: string; value?: string }) => (
    <p><span className="font-medium">{label} :</span> {value || '—'}</p>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-cyan-600" /> One-Pager I&P
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleDownloadHtml}>
            <Download className="h-3.5 w-3.5 mr-1" /> HTML A4
          </Button>
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              // Reuse the same HTML generation logic from handleDownloadHtml
              const sectionRow = (label: string, content: string) =>
                `<tr><td class="label">${label}</td><td class="content">${content}</td></tr>`;
              const d = data;
              const sections = [
                d.proposition_investissement && sectionRow('Proposition d\'investissement', d.proposition_investissement),
                d.entreprise && sectionRow('Entreprise', d.entreprise),
                d.marche && sectionRow('Marché', d.marche),
                d.modele_economique && sectionRow('Modèle économique', d.modele_economique),
                d.performance_financiere && sectionRow('Performance financière', d.performance_financiere),
                d.impact && sectionRow('Impact', d.impact),
                d.risques && sectionRow('Risques', d.risques),
                d.recommandation && sectionRow('Recommandation', d.recommandation),
              ].filter(Boolean).join('');
              const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${d.titre || 'One-Pager'}</title><style>@page{size:A4 portrait;margin:14mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Segoe UI",sans-serif;font-size:9pt;color:#1E293B}table{width:100%;border-collapse:collapse}td{padding:8px;vertical-align:top;border-bottom:1px solid #e2e8f0}.label{width:25%;font-weight:700;font-size:8.5pt;color:#64748b}.content{font-size:9pt}</style></head><body><table>${sections}</table></body></html>`;
              await exportToPdf(html, `onepager_${d.titre?.replace(/[^a-zA-Z0-9]/g, '_') || 'livrable'}.pdf`);
              toast.success('PDF téléchargé');
            } catch (err: any) { toast.error(`Erreur PDF : ${err.message}`); }
          }}>
            <Download className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
          <Badge className={`text-lg px-4 py-2 ${scoreBg}`}>{score}/100</Badge>
          {onRegenerate && (
            <button onClick={onRegenerate} className="text-xs text-muted-foreground underline">Regénérer</button>
          )}
        </div>
      </div>

      {/* Titre */}
      <div className="text-center pb-3 border-b-2 border-[#1e3a5f]">
        <h1 className="text-lg font-bold text-[#1e3a5f]">
          {data.titre || `I&P Company One-Pager – ${pres.nom}`}
        </h1>
      </div>

      {/* Aperçu du projet */}
      <div>
        <h2 className="text-sm font-bold text-[#1e3a5f] mb-2">Aperçu du projet</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">{data.apercu_projet}</p>
      </div>

      {/* Tableau 5 sections */}
      <div className="border rounded-lg overflow-hidden">
        <SectionRow label="Présentation de l'entreprise">
          <Field label="Nom" value={pres.nom} />
          <Field label="Secteur" value={pres.secteur} />
          <Field label="Localisation" value={pres.localisation} />
          <Field label="Site web" value={pres.site_web} />
          <Field label="Année de création" value={pres.annee_creation} />
          <Field label="Forme juridique" value={pres.forme_juridique} />
          <Field label="Financement recherché" value={pres.financement_recherche} />
          <Field label="Objectif" value={pres.objectif} />
        </SectionRow>

        <SectionRow label="Équipe et gouvernance">
          <Field label="Fondateur" value={equipe.fondateur} />
          <Field label="Dirigé par des femmes" value={equipe.dirige_par_femmes} />
          <Field label="Compétences" value={equipe.competences} />
          <Field label="Taille de l'équipe" value={equipe.taille_equipe} />
          <Field label="Gouvernance" value={equipe.gouvernance} />
          <Field label="Formelle" value={equipe.formelle} />
        </SectionRow>

        <SectionRow label="Traction et finances">
          <Field label="Ventes" value={traction.ventes} />
          <Field label="CA année dernière" value={traction.ca_annee_derniere} />
          <Field label="Accès au financement" value={traction.acces_financement} />
          <Field label="Croissance" value={traction.croissance} />
          <Field label="Économie unitaire" value={traction.economie_unitaire} />
          <Field label="Rentabilité" value={traction.rentabilite} />
          <Field label="Plan de croissance" value={traction.plan_croissance} />
        </SectionRow>

        <SectionRow label="Potentiel du marché">
          <p>{data.potentiel_marche || '—'}</p>
        </SectionRow>

        <SectionRow label="Impact">
          <p>{data.impact || '—'}</p>
        </SectionRow>
      </div>

      {/* Critères I&P */}
      {criteres && Object.keys(criteres).length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-[#1e3a5f] mb-2">Critères I&P</h2>
          <p className="text-xs font-medium text-muted-foreground mb-2">Documentation disponible OVO</p>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Généralités', value: criteres.generalites },
              { label: 'Financier', value: criteres.financier },
              { label: 'Juridique', value: criteres.juridique },
              { label: 'Impact', value: criteres.impact_doc },
              { label: 'RH', value: criteres.rh },
            ].map((c, i) => (
              <div key={i} className="p-2 rounded-lg bg-secondary border">
                <span className="font-medium">{c.label} :</span> {c.value || '—'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
