import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import {
  Loader2, LogIn, ArrowRight, ArrowDown,
  Upload, Sparkles, ClipboardCheck,
  FileSearch, LayoutGrid, BarChart3, TrendingUp, Stethoscope, Briefcase,
  CheckCircle2, ShieldCheck, Users, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const DELIVERABLES = [
  { icon: FileSearch, title: 'Diagnostic initial', desc: 'Score + guide coach + points bloquants + actions recommandées' },
  { icon: LayoutGrid, title: 'Business Model Canvas', desc: '9 blocs analysés automatiquement' },
  { icon: BarChart3, title: 'Plan financier', desc: 'Projections 5 ans, 3 scénarios, SYSCOHADA natif' },
  { icon: TrendingUp, title: 'Valorisation', desc: 'DCF + multiples calibrés Afrique, calcul déterministe' },
  { icon: Stethoscope, title: 'Bilan de progression', desc: 'Ce qui va coincer, ce qui est solide, prochaines étapes' },
  { icon: Briefcase, title: 'Mémo investisseur', desc: 'Format comité d\'investissement, prêt à présenter' },
];

const STEPS = [
  {
    step: '01',
    icon: Upload,
    title: 'Uploadez les documents de l\'entrepreneur',
    desc: 'États financiers, pitch deck, BMC. L\'IA extrait et structure les données automatiquement.',
  },
  {
    step: '02',
    icon: Sparkles,
    title: 'L\'IA génère le diagnostic et les livrables',
    desc: 'Diagnostic initial avec guide d\'accompagnement, business plan, valorisation, mémo investisseur. 12 livrables en quelques minutes.',
  },
  {
    step: '03',
    icon: ClipboardCheck,
    title: 'Accompagnez avec des données fiables',
    desc: 'Notes de coaching, suivi de progression, rapports pour le programme. Chaque chiffre est sourcé et vérifiable.',
  },
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
            Votre assistant IA pour accompagner les{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(215,60%,55%)] to-[hsl(152,56%,45%)]">
              PME africaines
            </span>
          </h1>
          <p className="text-base md:text-lg text-white/50 mt-5 max-w-xl leading-relaxed">
            Diagnostic, structuration, coaching — ESONO aide les coachs et les programmes à rendre les entreprises investissables.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            {[
              { label: 'Diagnostic en 2 min' },
              { label: '12 livrables auto' },
              { label: 'Suivi de coaching intégré' },
            ].map(badge => (
              <div key={badge.label} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(152,56%,45%)]" />
                <p className="text-xs font-semibold text-white/90">{badge.label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/login">
              <Button size="lg" className="gap-2 bg-white text-primary hover:bg-white/90 font-bold">
                Accéder à mon espace coach <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#comment-ca-marche">
              <Button size="lg" variant="ghost" className="gap-2 text-white/70 hover:text-white hover:bg-white/10">
                Découvrir la plateforme <ArrowDown className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="container py-16 md:py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Processus</p>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">Comment ça marche</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {STEPS.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="relative bg-card rounded-xl border p-6 hover:shadow-md transition-shadow">
                <span className="text-4xl font-display font-black text-muted/60 absolute top-4 right-4">{s.step}</span>
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-display font-bold text-foreground pr-10">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ce que l'IA produit */}
      <section className="bg-card border-y">
        <div className="container py-16 md:py-20">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Livrables</p>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">Ce que l'IA produit pour vous</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {DELIVERABLES.map(d => {
              const Icon = d.icon;
              return (
                <div key={d.title} className="bg-background rounded-xl border p-5 hover:shadow-md hover:border-primary/20 transition-all group">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="text-sm font-display font-bold text-foreground">{d.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{d.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pour les programmes */}
      <section className="container py-16 md:py-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Programmes</p>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight">
              Gérez 30 entrepreneurs avec la même rigueur qu'un cabinet de conseil
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                { icon: Users, text: 'Multi-entrepreneurs dans un seul dashboard' },
                { icon: BookOpen, text: 'Notes de coaching intégrées au pipeline IA' },
                { icon: ClipboardCheck, text: 'Rapports de suivi pour le chef de programme' },
                { icon: CheckCircle2, text: 'Matching critères programme automatique' },
              ].map(item => (
                <li key={item.text} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm text-foreground leading-relaxed">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gradient-to-br from-primary/5 to-[hsl(152,56%,38%)]/5 rounded-2xl border p-8 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <p className="text-3xl font-display font-black text-foreground">12</p>
            <p className="text-sm text-muted-foreground mt-1">livrables générés par entrepreneur</p>
            <div className="h-px w-16 bg-border my-4" />
            <p className="text-3xl font-display font-black text-foreground">~5 min</p>
            <p className="text-sm text-muted-foreground mt-1">du document à l'analyse complète</p>
          </div>
        </div>
      </section>

      {/* Données fiables */}
      <section className="bg-gradient-to-r from-[hsl(222,47%,14%)] to-[hsl(222,47%,20%)] text-white">
        <div className="container py-16 md:py-20">
          <div className="max-w-4xl mx-auto text-center mb-10">
            <ShieldCheck className="h-10 w-10 text-[hsl(152,56%,45%)] mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-display font-bold">Données fiables</h2>
            <p className="text-white/50 mt-3 max-w-xl mx-auto">
              Chaque chiffre a une source. Chaque benchmark est tracé.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {[
              { title: 'Benchmarks sourcés', desc: 'I&P, AVCA, Damodaran — chaque référence est citée' },
              { title: 'Calculs déterministes', desc: 'Valorisation DCF et multiples — pas générés par l\'IA' },
              { title: 'SYSCOHADA natif', desc: 'Pas une adaptation de normes IFRS — conçu pour l\'Afrique' },
              { title: 'Risques terrain', desc: 'EBITDA ajusté, dettes cachées, cash invisible — intégrés' },
            ].map(item => (
              <div key={item.title} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h4 className="text-sm font-display font-bold text-white/90">{item.title}</h4>
                <p className="text-xs text-white/40 mt-2 leading-relaxed">{item.desc}</p>
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
            <span className="hidden sm:inline">— Investment Readiness pour l'Afrique</span>
          </div>
          <Link to="/login" className="text-primary hover:underline font-medium">
            Se connecter
          </Link>
        </div>
      </footer>
    </div>
  );
}
