import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Maximize2, Download, Presentation } from 'lucide-react';
import { toast } from 'sonner';
import { exportToPdf } from '@/lib/export-pdf';

interface Props {
  data: Record<string, any>;
  onRegenerate?: () => void;
}

const SLIDE_COLORS: Record<string, string> = {
  cover: 'from-indigo-600 to-violet-700',
  probleme: 'from-red-500 to-red-700',
  solution: 'from-emerald-500 to-emerald-700',
  marche: 'from-blue-500 to-blue-700',
  business_model: 'from-amber-500 to-amber-700',
  traction: 'from-teal-500 to-teal-700',
  financier: 'from-purple-600 to-purple-800',
  impact: 'from-green-500 to-green-700',
  equipe: 'from-cyan-500 to-cyan-700',
  concurrence: 'from-orange-500 to-orange-700',
  ask: 'from-violet-600 to-violet-800',
  contact: 'from-slate-600 to-slate-800',
};

export default function PitchDeckViewer({ data, onRegenerate }: Props) {
  const slides = data.slides || [];
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const slide = slides[currentSlide];
  if (!slide) return <p className="text-muted-foreground text-center py-12">Aucune slide générée</p>;

  const contenu = slide.contenu || {};
  const gradient = SLIDE_COLORS[slide.type] || 'from-gray-600 to-gray-800';

  const scoreBg = (data.score || 0) >= 70 ? 'bg-emerald-100 text-emerald-700' : (data.score || 0) >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  const handleDownloadHtml = () => {
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pitch Deck</title>
<style>body{margin:0;font-family:Arial,sans-serif}.slide{width:100%;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:60px 80px;box-sizing:border-box;color:white;page-break-after:always}
h1{font-size:36px;margin:0 0 20px}h2{font-size:28px;margin:0 0 16px}ul{font-size:18px;line-height:2}
.metrics{display:flex;gap:24px;margin-top:20px}.metric{background:rgba(255,255,255,0.15);padding:16px 24px;border-radius:12px;text-align:center}
.metric .val{font-size:24px;font-weight:700}.metric .label{font-size:12px;opacity:0.8}
@media print{.slide{min-height:auto;height:100vh}}
</style></head><body>`;
    slides.forEach((s: any) => {
      const c = s.contenu || {};
      const bg = s.type === 'cover' ? '#4338ca' : s.type === 'probleme' ? '#dc2626' : s.type === 'solution' ? '#059669' : '#1e40af';
      html += `<div class="slide" style="background:${bg}">`;
      html += `<h2>${s.titre}</h2>`;
      if (c.headline) html += `<h1>${c.headline}</h1>`;
      if (c.bullets?.length) html += `<ul>${c.bullets.map((b: string) => `<li>${b}</li>`).join('')}</ul>`;
      if (c.chiffres_cles?.length) {
        html += `<div class="metrics">${c.chiffres_cles.map((m: any) => `<div class="metric"><div class="label">${m.label}</div><div class="val">${m.valeur}</div></div>`).join('')}</div>`;
      }
      html += `</div>`;
    });
    html += `</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `PitchDeck_${data.metadata?.entreprise || 'entreprise'}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  const slideComponent = (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} text-white p-8 md:p-12 min-h-[400px] flex flex-col justify-center relative ${fullscreen ? 'min-h-screen rounded-none' : ''}`}>
      <div className="absolute top-4 right-4 text-white/40 text-xs">{currentSlide + 1} / {slides.length}</div>
      <p className="text-xs uppercase tracking-widest text-white/60 mb-2">{slide.titre}</p>
      <h2 className="text-2xl md:text-4xl font-display font-bold mb-6">{contenu.headline || slide.titre}</h2>

      {contenu.bullets && contenu.bullets.length > 0 && (
        <ul className="space-y-2 mb-6">
          {contenu.bullets.map((b: string, i: number) => (
            <li key={i} className="text-sm md:text-base text-white/90 flex items-start gap-2">
              <span className="text-white/50 mt-1">•</span> {b}
            </li>
          ))}
        </ul>
      )}

      {contenu.chiffres_cles && contenu.chiffres_cles.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-auto">
          {contenu.chiffres_cles.map((m: any, i: number) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/60">{m.label}</p>
              <p className="text-lg md:text-xl font-bold">{m.valeur}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) handleFullscreen(); }}>
        {slideComponent}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={handleFullscreen}>Quitter</Button>
          <Button variant="secondary" size="sm" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold flex items-center gap-2">
          <Presentation className="h-6 w-6 text-pink-600" /> Pitch Deck
        </h2>
        <div className="flex items-center gap-3">
          <Badge className={`text-lg px-4 py-2 ${scoreBg}`}>{data.score || 0}/100</Badge>
          <Button variant="outline" size="sm" onClick={handleFullscreen}><Maximize2 className="h-3.5 w-3.5 mr-1" /> Plein écran</Button>
          <Button variant="outline" size="sm" onClick={handleDownloadHtml}><Download className="h-3.5 w-3.5 mr-1" /> HTML</Button>
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              // Build same HTML as handleDownloadHtml
              let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pitch Deck</title><style>body{margin:0;font-family:Arial,sans-serif}.slide{width:100%;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:60px 80px;box-sizing:border-box;color:white;page-break-after:always}h1{font-size:36px;margin:0 0 20px}h2{font-size:28px;margin:0 0 16px}ul{font-size:18px;line-height:2}@media print{.slide{min-height:auto;height:100vh}}</style></head><body>`;
              slides.forEach((s: any) => {
                const c = s.contenu || {};
                const bg = s.type === 'cover' ? '#4338ca' : s.type === 'probleme' ? '#dc2626' : s.type === 'solution' ? '#059669' : '#1e40af';
                html += `<div class="slide" style="background:${bg}"><h2>${s.titre || ''}</h2>`;
                if (c.points) html += '<ul>' + (c.points as string[]).map((p: string) => `<li>${p}</li>`).join('') + '</ul>';
                if (c.texte) html += `<p>${c.texte}</p>`;
                html += '</div>';
              });
              html += '</body></html>';
              await exportToPdf(html, 'pitch_deck.pdf');
              toast.success('PDF téléchargé');
            } catch (err: any) { toast.error(`Erreur PDF : ${err.message}`); }
          }}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
          {onRegenerate && <button onClick={onRegenerate} className="text-xs text-muted-foreground underline">Regénérer</button>}
        </div>
      </div>

      {slideComponent}

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="sm" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
        </Button>
        <div className="flex gap-1.5">
          {slides.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-2.5 w-2.5 rounded-full transition-all ${i === currentSlide ? 'bg-primary scale-125' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'}`}
            />
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
          Suivant <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Presenter Notes */}
      {contenu.notes_presentateur && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">📝 Notes du présentateur</p>
            <p className="text-sm text-muted-foreground">{contenu.notes_presentateur}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
