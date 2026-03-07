import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet, Download, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TEMPLATES = [
  {
    key: 'bmc-sic',
    name: 'Questionnaire BMC & Impact Social',
    desc: "Document unifié — Business Model Canvas + Social Impact Canvas. Questionnaire complet couvrant la proposition de valeur, segments clients, bénéficiaires, impact et alignement ODD.",
    icon: FileText,
    color: '#059669',
    bg: 'bg-green-100',
    ext: '.docx',
    bucket: 'templates',
    path: 'Questionnaire_BMC_SIC.docx',
  },
  {
    key: 'inputs',
    name: 'Inputs Financiers',
    desc: "Feuille de saisie des données financières — Chiffre d'affaires, charges, investissements et hypothèses prévisionnelles sur 5 ans.",
    icon: FileSpreadsheet,
    color: '#d97706',
    bg: 'bg-yellow-100',
    ext: '.xlsx',
    bucket: 'templates',
    path: 'Analyse_financiere_INPUTS_ENTREPRENEURS_V2.xlsx',
  },
  {
    key: 'plan-ovo',
    name: 'Plan Financier OVO',
    desc: "Modèle financier macro-enabled — Projections cash-flow, bilan et compte de résultat sur 5 ans. Template officiel ESONO.",
    icon: BookOpen,
    color: '#7c3aed',
    bg: 'bg-purple-100',
    ext: '.xlsm',
    bucket: 'ovo-templates',
    path: 'PlanFinancierOVO-Template5Ans.xlsm',
  },
];

export default function Templates() {
  const handleDownload = async (tpl: typeof TEMPLATES[0]) => {
    try {
      const { data, error } = await supabase.storage
        .from(tpl.bucket)
        .download(tpl.path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = tpl.path.split('/').pop() || tpl.key;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${tpl.name} téléchargé`);
    } catch (err: any) {
      toast.error(err.message || 'Fichier non disponible');
    }
  };

  return (
    <DashboardLayout title="Templates Vierges" subtitle="Téléchargez les templates à distribuer à vos entrepreneurs">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {TEMPLATES.map(tpl => {
          const Icon = tpl.icon;
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
                >
                  <Download className="h-4 w-4" /> Télécharger
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
