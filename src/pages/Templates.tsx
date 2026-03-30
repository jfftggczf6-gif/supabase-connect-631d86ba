import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

const TEMPLATES = [
  {
    key: 'bmc-sic',
    name: 'Questionnaire BMC & Social Impact Canvas',
    desc: "Document unifié — Business Model Canvas + Social Impact Canvas + alignement ODD. Questionnaire complet couvrant la proposition de valeur, segments clients, bénéficiaires, impact social et environnemental.",
    icon: FileText,
    color: '#059669',
    bg: 'bg-green-100',
    ext: '.docx',
    bucket: 'templates',
    path: 'Questionnaire_BM_and_Social_Impact_Canvas.docx',
    publicPath: '/templates/Questionnaire_BM_and_Social_Impact_Canvas.docx',
  },
  {
    key: 'inputs',
    name: 'Inputs Financiers',
    desc: "Feuille de saisie des données financières — Historiques, produits/services, coûts, ressources humaines, investissements et hypothèses prévisionnelles sur 5 ans.",
    icon: FileSpreadsheet,
    color: '#d97706',
    bg: 'bg-yellow-100',
    ext: '.xlsx',
    bucket: 'templates',
    path: 'Analyse_financiere_INPUTS_ENTREPRENEURS_V2.xlsx',
    publicPath: '/templates/Analyse_financiere_INPUTS_ENTREPRENEURS_V2.xlsx',
  },
];

export default function Templates() {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (tpl: typeof TEMPLATES[0]) => {
    setDownloading(tpl.key);
    try {
      // Try downloading from bucket first
      const { data, error } = await supabase.storage
        .from(tpl.bucket)
        .download(tpl.path);

      if (!error && data) {
        triggerDownload(data, tpl.path);
        toast.success(`${tpl.name} téléchargé`);
        return;
      }

      // Fallback: fetch from public folder, upload to bucket, then serve
      const res = await fetch(tpl.publicPath);
      if (!res.ok) throw new Error('Fichier non disponible');
      const blob = await res.blob();

      await supabase.storage.from(tpl.bucket).upload(tpl.path, blob, {
        contentType: blob.type,
        upsert: true,
      });

      triggerDownload(blob, tpl.path);
      toast.success(`${tpl.name} téléchargé`);
    } catch (err: any) {
      toast.error(err.message || 'Fichier non disponible');
    } finally {
      setDownloading(null);
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.split('/').pop() || filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Templates Vierges" subtitle="Téléchargez les templates à distribuer à vos entrepreneurs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {TEMPLATES.map(tpl => {
          const Icon = tpl.icon;
          const isLoading = downloading === tpl.key;
          return (
            <Card key={tpl.key} className="hover:shadow-md transition-all border-2 hover:border-primary/30 group">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`h-12 w-12 rounded-xl ${tpl.bg} flex items-center justify-center flex-none`}>
                    <Icon className="h-6 w-6" style={{ color: tpl.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight">{tpl.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground mt-1 inline-block">
                      {tpl.ext}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">{tpl.desc}</p>
                <Button
                  className="w-full gap-2" variant="outline"
                  onClick={() => handleDownload(tpl)}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Télécharger
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
