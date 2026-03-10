import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import {
  Loader2, LogIn, Rocket, GraduationCap, CheckCircle2, ArrowRight,
  Upload, Sparkles, Users, LayoutGrid, Globe,
  BarChart3, Stethoscope, ListChecks, FileText, Target, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const MODULES = [
  { step: 1, code: 'diagnostic', title: 'Diagnostic Expert Global', desc: 'Score crédibilité /100, risques, plan d\'action', icon: Stethoscope, deliverables: ['HTML Diagnostic', 'JSON'] },
  { step: 2, code: 'bmc', title: 'Business Model Canvas', desc: '9 blocs — Analysez votre modèle économique', icon: LayoutGrid, deliverables: ['HTML BMC', 'JSON'] },
  { step: 3, code: 'sic', title: 'Social Impact Canvas', desc: '5 sections, 14 questions, ODD, SMART', icon: Globe, deliverables: ['HTML SIC', 'JSON'] },
  { step: 4, code: 'framework', title: 'Plan Financier Intermédiaire', desc: 'Modélisation financière 5 ans, ratios', icon: BarChart3, deliverables: ['HTML', 'Excel (XLSX)'] },
  { step: 5, code: 'plan_ovo', title: 'Plan Financier Final', desc: 'Projections 3 scénarios sur 5 ans', icon: ListChecks, deliverables: ['HTML', 'Excel (XLSX)'] },
  { step: 6, code: 'business_plan', title: 'Business Plan', desc: 'Document complet max 20 pages', icon: FileText, deliverables: ['HTML', 'JSON', 'DOCX'] },
  { step: 7, code: 'odd', title: 'ODD', desc: 'Évaluation investment readiness — 17 ODD', icon: Target, deliverables: ['HTML', 'JSON', 'Excel (XLSX)'] },
];

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm font-display font-bold text-primary-foreground">ES</span>
            </div>
            <span className="text-lg font-display font-bold text-foreground tracking-tight">ESONO</span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">INVESTMENT READINESS</span>
          </div>
          <Link to="/login">
            <Button variant="outline" size="sm" className="gap-2">
              <LogIn className="h-3.5 w-3.5" /> Se connecter
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,47%,16%)] to-[hsl(222,47%,22%)] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        <div className="container relative py-20 md:py-28">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-black leading-[1.1] max-w-3xl">
            Préparez votre PME africaine à <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(215,60%,55%)] to-[hsl(152,56%,45%)]">l'investissement</span>
          </h1>
          <p className="text-base md:text-lg text-white/50 mt-5 max-w-xl leading-relaxed">
            7 modules séquentiels — du Diagnostic Expert au dossier investisseur complet.
            IA + coaching humain pour les PME africaines.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            {[
              { icon: Upload, label: 'Upload intelligent', desc: 'Analyse auto des documents' },
              { icon: Sparkles, label: 'IA assistée', desc: 'Génération des livrables' },
              { icon: Users, label: 'Coaching humain', desc: 'Rapports détaillés IA' },
            ].map(badge => (
              <div key={badge.label} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10">
                <badge.icon className="h-4 w-4 text-white/40" />
                <div>
                  <p className="text-xs font-semibold text-white/90">{badge.label}</p>
                  <p className="text-[10px] text-white/40">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/register?role=entrepreneur">
              <Button size="lg" className="gap-2 bg-white text-primary hover:bg-white/90 font-bold">
                <Rocket className="h-4 w-4" /> Commencer gratuitement
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="ghost" className="gap-2 text-white/70 hover:text-white hover:bg-white/10">
                J'ai déjà un compte <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Data flow diagram */}
      <section className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between overflow-x-auto gap-0 pb-2">
            {MODULES.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <div key={mod.code} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground mt-1 text-center leading-tight">{mod.step}. {mod.title.split(' ').slice(0, 2).join(' ')}</span>
                  </div>
                  {i < MODULES.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 mx-1 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7 Modules */}
      <section className="container py-16">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Architecture</p>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">7 Modules Séquentiels</h2>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Du diagnostic initial au dossier investisseur complet — chaque module alimente le suivant.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MODULES.map(mod => (
            <ModuleShowcaseCard key={mod.code} mod={mod} />
          ))}
        </div>
      </section>

      {/* Role cards */}
      <section className="bg-card border-t">
        <div className="container py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-display font-bold text-foreground">Choisissez votre espace</h2>
            <p className="text-muted-foreground mt-2">Deux profils, une même plateforme.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <RoleCard
              icon={Rocket}
              iconBg="bg-primary/10"
              iconColor="text-primary"
              title="Espace Entrepreneur"
              desc="Uploadez vos documents, complétez les 7 modules et générez votre dossier investisseur complet."
              features={[
                'Diagnostic expert, Business Model Canvas, Social Impact Canvas',
                'Génération IA : Framework, Plan OVO, Business Plan, ODD',
                '7+ livrables téléchargeables (Excel, HTML, DOCX)',
              ]}
              linkTo="/register?role=entrepreneur"
              linkLabel="Créer mon compte entrepreneur"
            />
            <RoleCard
              icon={GraduationCap}
              iconBg="bg-info/10"
              iconColor="text-info"
              title="Espace Coach"
              desc="Gérez vos entrepreneurs, suivez leur progression, analysez leurs dossiers et validez les livrables."
              features={[
                'Dashboard multi-entrepreneurs avec scores IR',
                'Rapports détaillés générés par IA',
                'Suivi de progression et validation des modules',
              ]}
              linkTo="/register?role=coach"
              linkLabel="Créer mon compte coach"
            />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-gradient-to-r from-[hsl(222,47%,14%)] to-[hsl(222,47%,20%)] text-white">
        <div className="container py-10">
          <div className="flex flex-wrap justify-center gap-12 text-center">
            {[
              { value: '7', unit: 'modules', label: 'Parcours complet' },
              { value: '7+', unit: 'livrables', label: 'Excel, HTML, DOCX' },
              { value: 'IA', unit: '+ Coach', label: 'Double validation' },
              { value: 'Afrique', unit: '', label: 'PME africaines' },
            ].map(stat => (
              <div key={stat.value}>
                <p className="text-2xl font-display font-black">
                  {stat.value} <span className="text-sm font-medium text-white/40">{stat.unit}</span>
                </p>
                <p className="text-xs text-white/40 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container py-8 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <span className="text-[8px] font-display font-bold text-primary-foreground">ES</span>
            </div>
            <span className="font-display font-bold text-foreground">ESONO</span>
          </div>
          <p>© {new Date().getFullYear()} ESONO — Investment Readiness Platform</p>
        </div>
      </footer>
    </div>
  );
}

function ModuleShowcaseCard({ mod }: { mod: typeof MODULES[0] }) {
  const Icon = mod.icon;

  return (
    <div className="bg-card rounded-xl border p-4 hover:shadow-md hover:border-primary/20 transition-all group">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-muted-foreground">#{mod.step}</span>
            <h4 className="text-sm font-display font-bold text-foreground truncate">{mod.title}</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
        </div>
      </div>
      {mod.deliverables.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {mod.deliverables.map(d => (
            <span key={d} className="text-[9px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleCard({ icon: Icon, iconBg, iconColor, title, desc, features, linkTo, linkLabel }: {
  icon: any; iconBg: string; iconColor: string; title: string; desc: string;
  features: string[]; linkTo: string; linkLabel: string;
}) {
  return (
    <div className="bg-background rounded-xl border p-6 hover:shadow-lg transition-shadow">
      <div className={`h-12 w-12 rounded-xl ${iconBg} flex items-center justify-center mb-4`}>
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>
      <h3 className="text-lg font-display font-bold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2">{desc}</p>
      <ul className="mt-4 space-y-2">
        {features.map(item => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
      <Link to={linkTo} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        {linkLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
