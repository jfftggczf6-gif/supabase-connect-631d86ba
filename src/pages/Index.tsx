import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Loader2, LogIn, ArrowRight, ArrowDown,
  Upload, Sparkles, ClipboardCheck,
  FileSearch, LayoutGrid, BarChart3, Target, TrendingUp, FileText,
  CheckCircle2, Shield, Lock, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Index() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  const DELIVERABLES = [
    { icon: FileSearch, title: t('pages.index_deliv_diagnostic_title'), desc: t('pages.index_deliv_diagnostic_desc') },
    { icon: LayoutGrid, title: t('pages.index_deliv_bmc_title'), desc: t('pages.index_deliv_bmc_desc') },
    { icon: BarChart3, title: t('pages.index_deliv_plan_title'), desc: t('pages.index_deliv_plan_desc') },
    { icon: Target, title: t('pages.index_deliv_odd_title'), desc: t('pages.index_deliv_odd_desc') },
    { icon: TrendingUp, title: t('pages.index_deliv_progress_title'), desc: t('pages.index_deliv_progress_desc') },
    { icon: FileText, title: t('pages.index_deliv_reports_title'), desc: t('pages.index_deliv_reports_desc') },
  ];

  const STEPS = [
    {
      step: '01',
      icon: Upload,
      title: t('pages.index_step1_title'),
      desc: t('pages.index_step1_desc'),
    },
    {
      step: '02',
      icon: Sparkles,
      title: t('pages.index_step2_title'),
      desc: t('pages.index_step2_desc'),
    },
    {
      step: '03',
      icon: ClipboardCheck,
      title: t('pages.index_step3_title'),
      desc: t('pages.index_step3_desc'),
    },
  ];

  const TRUST_ITEMS = [
    {
      icon: Shield,
      title: t('pages.index_trust_1_title'),
      desc: t('pages.index_trust_1_desc'),
    },
    {
      icon: Eye,
      title: t('pages.index_trust_2_title'),
      desc: t('pages.index_trust_2_desc'),
    },
    {
      icon: CheckCircle2,
      title: t('pages.index_trust_3_title'),
      desc: t('pages.index_trust_3_desc'),
    },
    {
      icon: Lock,
      title: t('pages.index_trust_4_title'),
      desc: t('pages.index_trust_4_desc'),
    },
  ];

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
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">{t('pages.index_tagline')}</span>
          </div>
          <Link to="/login">
            <Button variant="outline" size="sm" className="gap-2">
              <LogIn className="h-3.5 w-3.5" /> {t('pages.index_sign_in')}
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,47%,16%)] to-[hsl(222,47%,22%)] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        <div className="container relative py-20 md:py-28">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-black leading-[1.1] max-w-3xl">
            {t('pages.index_hero_title_1')}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(215,60%,55%)] to-[hsl(152,56%,45%)]">
              {t('pages.index_hero_title_2')}
            </span>
          </h1>
          <p className="text-base md:text-lg text-white/50 mt-5 max-w-xl leading-relaxed">
            {t('pages.index_hero_subtitle')}
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            {[
              { label: t('pages.index_badge_1') },
              { label: t('pages.index_badge_2') },
              { label: t('pages.index_badge_3') },
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
                {t('pages.index_cta_access')} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#comment-ca-marche">
              <Button size="lg" variant="ghost" className="gap-2 text-white/70 hover:text-white hover:bg-white/10">
                {t('pages.index_cta_how')} <ArrowDown className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Comment ca marche */}
      <section id="comment-ca-marche" className="container py-16 md:py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{t('pages.index_process')}</p>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">{t('pages.index_how_title')}</h2>
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
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{t('pages.index_deliverables_label')}</p>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">{t('pages.index_deliverables_title')}</h2>
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

      {/* Donnees fiables */}
      <section className="container py-16 md:py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{t('pages.index_reliability_label')}</p>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">{t('pages.index_reliability_title')}</h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
            {t('pages.index_reliability_subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {[
            { title: t('pages.index_reliability_1_title'), desc: t('pages.index_reliability_1_desc') },
            { title: t('pages.index_reliability_2_title'), desc: t('pages.index_reliability_2_desc') },
            { title: t('pages.index_reliability_3_title'), desc: t('pages.index_reliability_3_desc') },
            { title: t('pages.index_reliability_4_title'), desc: t('pages.index_reliability_4_desc') },
          ].map(item => (
            <div key={item.title} className="bg-card rounded-xl border p-5 hover:shadow-md transition-shadow">
              <h4 className="text-sm font-display font-bold text-foreground">{item.title}</h4>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vos donnees sont protegees */}
      <section className="bg-gradient-to-r from-[hsl(222,47%,14%)] to-[hsl(222,47%,20%)] text-white">
        <div className="container py-16 md:py-20">
          <div className="max-w-4xl mx-auto text-center mb-10">
            <Shield className="h-10 w-10 text-[hsl(152,56%,45%)] mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-display font-bold">{t('pages.index_trust_title')}</h2>
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
            <span className="hidden sm:inline">— {t('pages.index_footer_tagline')}</span>
          </div>
          <Link to="/login" className="text-primary hover:underline font-medium">
            {t('pages.index_sign_in')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
