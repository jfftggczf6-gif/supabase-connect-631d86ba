import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import {
  Loader2, LogIn, ArrowRight, ArrowDown,
  Upload, Sparkles, ClipboardCheck,
  FileSearch, LayoutGrid, BarChart3, Target, TrendingUp, FileText,
  CheckCircle2, Shield, Lock, Eye, Users, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const DELIVERABLES = [
  { icon: FileSearch, title: 'Diagnostic initial', desc: 'Points bloquants, actions recommandées, guide d\'accompagnement personnalisé' },
  { icon: LayoutGrid, title: 'Business Model Canvas', desc: '9 blocs analysés, forces et faiblesses identifiées' },
  { icon: BarChart3, title: 'Plan financier', desc: 'Projections sur 5 ans, 3 scénarios, adapté aux normes SYSCOHADA' },
  { icon: Target, title: 'Analyse d\'impact (ODD)', desc: 'Indicateurs SMART, théorie du changement, contribution aux ODD' },
  { icon: TrendingUp, title: 'Bilan de progression', desc: 'Ce qui a avancé, ce qui reste, prochaines étapes' },
  { icon: FileText, title: 'Rapports de coaching', desc: 'Rapport de suivi et rapport final, générés depuis vos notes' },
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
    desc: 'Diagnostic initial avec guide d\'accompagnement, business plan, plan financier, analyse d\'impact. 12 livrables en quelques minutes.',
  },
  {
    step: '03',
    icon: ClipboardCheck,
    title: 'Accompagnez et suivez la progression',
    desc: 'Notes de coaching intégrées à l\'analyse, bilan de progression automatique, rapports de suivi pour le programme.',
  },
];

const TRUST_ITEMS = [
  {
    icon: Shield,
    title: 'Données non utilisées pour entraîner l\'IA',
    desc: 'Les données de vos entrepreneurs ne servent pas à entraîner les modèles. Politique de non-rétention des données.',
  },
  {
    icon: Eye,
    title: 'Chaque programme a son espace isolé',
    desc: 'Les données d\'un programme ne sont jamais visibles par un autre programme.',
  },
  {
    icon: CheckCircle2,
    title: 'Chaque chiffre cite sa source',
    desc: 'Pas de chiffres inventés. Les analyses sont traçables et vérifiables.',
  },
  {
    icon: Lock,
    title: 'Accès sécurisé',
    desc: 'Authentification, chiffrement des données, contrôle d\'accès par rôle.',
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
            ESONO aide les coachs à diagnostiquer, structurer et suivre leurs entrepreneurs — avec des données fiables.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            {[
              { label: 'Diagnostic en 2 minutes' },
              { label: '12 livrables générés automatiquement' },
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
                Accéder à mon espace <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#comment-ca-marche">
              <Button size="lg" variant="ghost" className="gap-2 text-white/70 hover:text-white hover:bg-white/10">
                Voir comment ça marche <ArrowDown className="h-4 w-4" />
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

      {/* Ce que l'IA produit pour le coach */}
      <section className="bg-card border-y">
        <div className="container py-16 md:py-20">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Livrables</p>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">Ce que l'IA produit pour le coach</h2>
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

      {/* Vos données sont protégées */}
      <section className="bg-gradient-to-r from-[hsl(222,47%,14%)] to-[hsl(222,47%,20%)] text-white">
        <div className="container py-16 md:py-20">
          <div className="max-w-4xl mx-auto text-center mb-10">
            <Shield className="h-10 w-10 text-[hsl(152,56%,45%)] mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-display font-bold">Vos données sont protégées</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {TRUST_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center mb-3">
                    <Icon className="h-4.5 w-4.5 text-[hsl(152,56%,45%)]" />
                  </div>
                  <h4 className="text-sm font-display font-bold text-white/90">{item.title}</h4>
                  <p className="text-xs text-white/40 mt-2 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
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
            <span className="hidden sm:inline">— L'assistant IA des coachs d'entreprise en Afrique</span>
          </div>
          <Link to="/login" className="text-primary hover:underline font-medium">
            Se connecter
          </Link>
        </div>
      </footer>
    </div>
  );
}
