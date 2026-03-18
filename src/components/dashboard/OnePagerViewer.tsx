import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, TrendingUp, Users, Globe, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  data: Record<string, any>;
  onRegenerate?: () => void;
}

export default function OnePagerViewer({ data, onRegenerate }: Props) {
  const ent = data.entreprise || {};
  const traction = data.traction || {};
  const kpis = data.kpis_financiers || {};
  const besoin = data.besoin_financement || {};
  const marche = data.marche || {};
  const ps = data.probleme_solution || {};

  const handleDownloadHtml = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>One-Pager ${ent.nom || ''}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;font-size:13px;color:#1a1a2e}
h1{font-size:22px;margin:0}h2{font-size:14px;color:#6c63ff;margin:16px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.metric{background:#f8f9fa;padding:12px;border-radius:8px;text-align:center}
.metric .val{font-size:20px;font-weight:700;color:#1a1a2e}.metric .label{font-size:10px;color:#888;text-transform:uppercase}
.tag{display:inline-block;background:#e8e6ff;color:#6c63ff;padding:2px 8px;border-radius:4px;font-size:11px;margin:2px}
</style></head><body>
<h1>${ent.nom || 'Entreprise'}</h1>
<p style="color:#888">${ent.secteur || ''} · ${ent.pays || ''} · ${ent.effectifs || ''} employés</p>
<h2>Proposition de Valeur</h2><p>${data.proposition_valeur || ''}</p>
<h2>Problème & Solution</h2><p><strong>Problème :</strong> ${ps.probleme || ''}</p><p><strong>Solution :</strong> ${ps.solution || ''}</p>
<h2>Marché</h2><p>TAM : ${marche.tam || '—'} · SAM : ${marche.sam || '—'}</p><p>${marche.description || ''}</p>
<h2>Traction</h2><div class="grid">
<div class="metric"><div class="label">CA N-2</div><div class="val">${traction.ca_y_2 || '—'}</div></div>
<div class="metric"><div class="label">CA N-1</div><div class="val">${traction.ca_y_1 || '—'}</div></div>
<div class="metric"><div class="label">CA N</div><div class="val">${traction.ca_y0 || '—'}</div></div>
<div class="metric"><div class="label">Croissance</div><div class="val">${traction.croissance || '—'}</div></div>
</div>
<h2>KPIs Financiers</h2><div class="grid">
<div class="metric"><div class="label">Marge Brute</div><div class="val">${kpis.marge_brute || '—'}</div></div>
<div class="metric"><div class="label">EBITDA</div><div class="val">${kpis.ebitda || '—'}</div></div>
<div class="metric"><div class="label">Résultat Net</div><div class="val">${kpis.resultat_net || '—'}</div></div>
<div class="metric"><div class="label">Trésorerie</div><div class="val">${kpis.tresorerie || '—'}</div></div>
</div>
<h2>Impact ODD</h2>${(data.impact_odd || []).map((o: string) => `<span class="tag">${o}</span>`).join(' ')}
<h2>Besoin de Financement</h2><p><strong>${besoin.montant || '—'}</strong> — ${besoin.type || ''}</p><p>${besoin.utilisation || ''}</p>
${data.valorisation_indicative ? `<h2>Valorisation Indicative</h2><p>${data.valorisation_indicative}</p>` : ''}
<h2>Points Forts</h2><ul>${(data.points_forts || []).map((p: string) => `<li>${p}</li>`).join('')}</ul>
<h2>Équipe</h2><p>${data.equipe || ''}</p>
<h2>Contact</h2><p>${data.contact?.nom || ''} — ${data.contact?.email || ''} — ${data.contact?.telephone || ''}</p>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `OnePager_${ent.nom || 'entreprise'}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const scoreBg = (data.score || 0) >= 70 ? 'bg-emerald-100 text-emerald-700' : (data.score || 0) >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-cyan-600" /> One-Pager Investisseur
        </h2>
        <div className="flex items-center gap-3">
          <Badge className={`text-lg px-4 py-2 ${scoreBg}`}>{data.score || 0}/100</Badge>
          <Button variant="outline" size="sm" onClick={handleDownloadHtml}><Download className="h-3.5 w-3.5 mr-1" /> HTML</Button>
          {onRegenerate && <button onClick={onRegenerate} className="text-xs text-muted-foreground underline">Regénérer</button>}
        </div>
      </div>

      {/* A4-like card */}
      <Card className="max-w-3xl mx-auto shadow-lg border-2">
        <CardContent className="p-8 space-y-5">
          {/* Header */}
          <div className="border-b pb-4">
            <h1 className="text-2xl font-display font-bold">{ent.nom || 'Entreprise'}</h1>
            <p className="text-sm text-muted-foreground">{ent.secteur} · {ent.pays} · {ent.effectifs} employés · {ent.forme_juridique}</p>
          </div>

          {/* Proposition de valeur */}
          <div>
            <p className="text-sm font-semibold text-primary mb-1">Proposition de Valeur</p>
            <p className="text-sm">{data.proposition_valeur}</p>
          </div>

          {/* Problème / Solution */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-red-50">
              <p className="text-xs font-semibold text-red-600 mb-1">Problème</p>
              <p className="text-xs">{ps.probleme}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50">
              <p className="text-xs font-semibold text-emerald-600 mb-1">Solution</p>
              <p className="text-xs">{ps.solution}</p>
            </div>
          </div>

          {/* Marché */}
          <div>
            <p className="text-sm font-semibold flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Marché</p>
            <div className="flex gap-4 mt-1">
              <span className="text-xs"><strong>TAM :</strong> {marche.tam}</span>
              <span className="text-xs"><strong>SAM :</strong> {marche.sam}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{marche.description}</p>
          </div>

          {/* Traction + KPIs */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { l: 'CA N-2', v: traction.ca_y_2 },
              { l: 'CA N-1', v: traction.ca_y_1 },
              { l: 'CA N', v: traction.ca_y0 },
              { l: 'Croissance', v: traction.croissance },
            ].map((m, i) => (
              <div key={i} className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] uppercase text-muted-foreground">{m.l}</p>
                <p className="text-sm font-bold">{m.v || '—'}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { l: 'Marge Brute', v: kpis.marge_brute },
              { l: 'EBITDA', v: kpis.ebitda },
              { l: 'Résultat Net', v: kpis.resultat_net },
              { l: 'Trésorerie', v: kpis.tresorerie },
            ].map((m, i) => (
              <div key={i} className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] uppercase text-muted-foreground">{m.l}</p>
                <p className="text-sm font-bold">{m.v || '—'}</p>
              </div>
            ))}
          </div>

          {/* Impact ODD */}
          {data.impact_odd && data.impact_odd.length > 0 && (
            <div>
              <p className="text-sm font-semibold flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Impact ODD</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {data.impact_odd.map((o: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">{o}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Besoin + Valorisation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-indigo-50">
              <p className="text-xs font-semibold text-indigo-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Besoin de Financement</p>
              <p className="text-lg font-bold mt-1">{besoin.montant || '—'}</p>
              <p className="text-xs text-muted-foreground">{besoin.type} — {besoin.utilisation}</p>
            </div>
            {data.valorisation_indicative && (
              <div className="p-3 rounded-lg bg-violet-50">
                <p className="text-xs font-semibold text-violet-600">Valorisation Indicative</p>
                <p className="text-lg font-bold mt-1">{data.valorisation_indicative}</p>
              </div>
            )}
          </div>

          {/* Points forts */}
          {data.points_forts && (
            <div>
              <p className="text-sm font-semibold">✨ Points Forts</p>
              <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-0.5">
                {data.points_forts.map((p: string, i: number) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {/* Équipe + Contact */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t">
            <div>
              <p className="text-xs font-semibold flex items-center gap-1"><Users className="h-3 w-3" /> Équipe</p>
              <p className="text-xs text-muted-foreground mt-1">{data.equipe}</p>
            </div>
            <div>
              <p className="text-xs font-semibold">Contact</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.contact?.nom}<br />{data.contact?.email}<br />{data.contact?.telephone}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
