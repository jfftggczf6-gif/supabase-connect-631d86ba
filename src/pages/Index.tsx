import { useEffect, useRef, useState, type ReactNode } from 'react';
// Clé animée pour forcer un cross-fade sur les sections qui dépendent du segment
// (utilisée via `key={segment}` + classe `animate-in fade-in duration-300` de tailwindcss-animate).
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Loader2, ArrowRight, Shield, Globe2, Database, FileCheck2,
  Target, FileText, TrendingUp, Zap, ScrollText, BarChart3,
  Upload, Sparkles, CheckCircle2, XCircle, Quote,
} from 'lucide-react';

// Destination unique du CTA "Réserver une démo live".
// Cal.com : open-source, privacy-friendly, no cookies = no banner RGPD.
const DEMO_URL = 'https://cal.com/phil-yace-d73gey/demo-esono';

// ─────────────────────────────────────────────────────────────────────────────
// Palette (rappel du brief) — appliquée via arbitrary Tailwind values pour éviter
// toute rupture avec le reste du design system de l'app (esono.tech).
//   canvas  #FAFAF7   surface #FFFFFF
//   brand-600 #7C3AED  brand-700 #6D28D9  brand-50 #F5F3FF
//   accent-500 #C9A96E  accent-600 #B08F52
//   ink-900 #1A1625  ink-700 #3D3651  ink-500 #6B6680
//   border #EDE9FE
//   success #2F8F5A  danger #B84444
// ─────────────────────────────────────────────────────────────────────────────

type Segment = 'program' | 'pe';

// ─────────────────── Content (unique source de vérité) ───────────────────────
const CONTENT = {
  nav: {
    // "Tarifs" retiré temporairement (pas de section pricing en V1).
    links: [
      { label: 'Produit', href: '#solution' },
      { label: 'Sécurité', href: '#security' },
    ],
    cta: 'Réserver une démo live',
  },
  hero: {
    eyebrow: "L'infrastructure analytique pour l'Afrique francophone",
    h1: 'Vos analyses financières PME en heures, pas en semaines.',
    subheadline:
      "ESONO automatise l'analyse de vos entreprises en produisant diagnostic, scoring, investment memo, business plan, reporting, via des agents IA spécialisés.",
  },
  switcher: {
    intro: 'Deux marchés. Un seul moteur. Choisissez votre contexte.',
    program: {
      label: 'Opérateur de programme',
      sublabel: 'Vous accompagnez des cohortes de PME pour le compte de bailleurs.',
    },
    pe: {
      label: 'Fonds Private Equity',
      sublabel: 'Vous investissez dans des PME africaines via un fonds structuré.',
    },
  },
  problem: {
    title: "Le problème n'est pas le talent. C'est le système.",
    program: {
      sub: "Vous traitez beaucoup de dossiers avec peu d'outils. Ça ne tient plus.",
      cards: [
        { icon: BarChart3, title: 'Volume ingérable', body: 'Vos cohortes plafonnent à 40 ou 50 PME. Vos coaches sont saturés à 2 ou 3 entreprises chacun. Impossible de scaler.' },
        { icon: ScrollText, title: 'Chaos des formats', body: "Candidatures en PDF, Excel mal formés, WhatsApp. Vos équipes reformatent avant même d'analyser." },
        { icon: FileText, title: 'Pression du reporting', body: "CSRD, IRIS+, 2X Criteria. Vos bailleurs exigent l'aligné. Vous le produisez à la main, les nuits et les week-ends." },
      ],
      quote: { text: "Ce n'est pas un problème de talent. C'est un problème de système, d'outils et de données.", author: 'Program Manager, opérateur bailleur, Abidjan' },
    },
    pe: {
      sub: '2 mois de pre-screening par deal. Vous ne tenez pas le rythme de déploiement.',
      cards: [
        { icon: TrendingUp, title: 'Déploiement trop lent', body: "100 homme mois par an juste pour filtrer 50 deals sérieux. Le fonds vieillit avant que le dernier deal ne soit signé." },
        { icon: BarChart3, title: 'Diète Excel permanente', body: "Vos analystes font du retraitement comptable toute la journée, avant même de commencer l'analyse." },
        { icon: Target, title: 'Turnover junior', body: "Vous formez, ils partent en master ou chez un concurrent. La connaissance repart à zéro à chaque cycle." },
      ],
      quote: { text: "80 % des dossiers qui arrivent sont mal structurés. On passe notre temps à retraiter avant d'analyser.", author: 'Analyste, fonds PE mid-market francophone' },
    },
  },
  solution: {
    title: "La couche analytique que vos équipes n'ont jamais eue.",
    sub: "Un moteur d'agents IA spécialisés. Brandé à votre identité. Pensé pour les exigences de l'Afrique francophone.",
    program: [
      { icon: Target, title: 'Scorez et sélectionnez objectivement', body: 'Chaque candidature notée sur 6 dimensions : solidité financière, gouvernance, potentiel, impact, qualité des données. Décisions de comité assumées, défendables auprès du bailleur.' },
      { icon: FileText, title: 'Livrables homogènes, brandés à votre identité', body: '11 livrables standards générés automatiquement : BMC, SIC, Plan Financier, Business Plan, ODD, Investment Memo. Export Word, Excel, PDF selon vos templates.' },
      { icon: BarChart3, title: 'Reporting bailleur en temps réel', body: "CSRD, IRIS+, 2X Criteria natifs. Exportez le reporting de cohorte en un clic, aligné sur les exigences siège d'Enabel, GIZ, AFD, BAD." },
    ],
    pe: [
      { icon: Zap, title: '10× votre pipeline de pre-screening', body: "Uploadez un deal, obtenez en 30 minutes un diagnostic complet, un scoring à 6 dimensions, et les red flags SYSCOHADA détectés. Vos analystes se concentrent sur l'arbitrage." },
      { icon: FileText, title: 'Investment Memo en living document', body: "12 sections versionnées, de la pre-screening au comité IC. Enrichissement continu au fil de la diligence. Plus de copier-coller Word, plus de perte d'historique." },
      { icon: TrendingUp, title: 'Monitoring PnL vs Business Plan', body: "Suivi post-investissement automatisé, alertes sur les écarts, reporting LP prêt à l'export. Vos participations restent sous contrôle sans que vos analystes y passent leurs semaines." },
    ],
  },
  how: {
    title: 'Trois étapes. La méthode ESONO.',
    sub: "Ingérer, Analyser, Livrer. Un parcours simple, conçu pour s'insérer dans votre workflow existant.",
    program: [
      { n: 1, icon: Upload, title: 'Ingérer', body: "Formulaire de candidature public brandé à votre organisation. Les entrepreneurs uploadent leurs documents. ESONO extrait, structure et valide automatiquement." },
      { n: 2, icon: Sparkles, title: 'Analyser', body: "Scoring automatique à 6 dimensions, détection des red flags SYSCOHADA, diagnostic initial. Vous voyez en un clic qui mérite l'accompagnement." },
      { n: 3, icon: FileCheck2, title: 'Livrer', body: "Vos coaches passent au stratégique. BMC, Business Plan, Investment Memo, reporting d'impact générés à votre charte, prêts à envoyer au bailleur." },
    ],
    pe: [
      { n: 1, icon: Upload, title: 'Ingérer', body: "Uploadez les documents du deal : pitch deck, états financiers, data room. ESONO extrait et valide les données SYSCOHADA, identifie les incohérences." },
      { n: 2, icon: Sparkles, title: 'Analyser', body: '34 agents IA spécialisés produisent diagnostic, scoring 6D, valuation DCF et pré-screening en moins de 30 minutes. Tout est traçable, sourcé, auditable.' },
      { n: 3, icon: FileCheck2, title: 'Livrer', body: "Vous éditez le living document à mesure que la diligence avance. Export IC Paper au format de votre fonds en un clic. Décision au comité, sans friction." },
    ],
  },
  proof: {
    title: 'Plus de 30 entreprises analysées en 2 mois.',
    testimonials: [
      { text: '80 % des dossiers qui arrivent sont mal structurés. ESONO fait le retraitement que mes analystes feraient en 3 jours, en 30 minutes.', author: 'Analyste, fonds PE mid-market francophone, Abidjan' },
      { text: "On ne savait pas qu'un outil comme ça pouvait exister. La démo sur notre propre dossier a tout débloqué.", author: 'Program Manager, opérateur bailleur, UEMOA' },
    ],
  },
  security: {
    title: 'Conçu pour les exigences institutionnelles.',
    sub: "SYSCOHADA, RGPD, Row Level Security, souveraineté des données. La conformité n'est pas un add on, c'est la fondation.",
    pillars: [
      { icon: Shield, title: 'Isolation multi-tenant', body: "Row Level Security stricte par organisation. Les données d'un client ne peuvent jamais être visibles par un autre, par construction." },
      { icon: Globe2, title: 'RGPD natif', body: "Traitement conforme, consentements explicites, droit à l'oubli opérationnel. Vos PME et leurs dirigeants restent maîtres de leurs données." },
      { icon: Database, title: 'SYSCOHADA natif', body: 'Plan comptable, calculs, conventions et ratios alignés sur le référentiel OHADA. Zéro transposition, zéro approximation.' },
      { icon: FileCheck2, title: 'Traçabilité IA', body: 'Chaîne de traitement IA documentée et auditable. Chaque livrable est sourcé. Prêt à être présenté à vos LPs ou à votre bailleur.' },
    ],
    callout: {
      title: "L'IA propose. L'humain décide.",
      body: "ESONO industrialise la collecte, l'extraction et la première analyse. Vos équipes gardent le jugement métier, la relation client et la décision finale. C'est une couche analytique, pas un remplacement d'analyste.",
    },
  },
  contrast: {
    title: 'Deux trajectoires. À vous de choisir.',
    sub: 'Ce que ça change concrètement, au quotidien.',
    program: [
      { without: 'Cohortes plafonnées à 40 ou 50 PME', with: '3 à 5× plus de PME accompagnées' },
      { without: 'Coaches sur la structuration de dossiers', with: "Coaches sur l'accompagnement stratégique" },
      { without: 'Sélection subjective, difficile à défendre', with: 'Scoring objectif, décisions de comité assumées' },
      { without: 'Reporting bailleur qui ronge les soirées', with: 'CSRD, IRIS+, 2X exportés en un clic' },
      { without: "Bailleur frustré par l'impact perçu", with: 'Impact démontré, financement re débloqué' },
    ],
    pe: [
      { without: '2 mois de pre-screening par deal', with: '30 minutes de pre-screening par deal' },
      { without: 'Analystes sur Excel toute la journée', with: 'Analystes sur les décisions stratégiques' },
      { without: 'Turnover junior qui efface la connaissance', with: 'Living document qui capitalise en continu' },
      { without: 'LP reporting manuel, stressant', with: 'LP reporting exporté en un clic' },
      { without: 'Déploiement qui traîne, IRR sous pression', with: 'Pipeline 10×, IRR protégé, LPs rassurés' },
    ],
  },
  finalCta: {
    title: 'Voyez ESONO sur votre propre dossier.',
    sub: '30 minutes. Apportez une candidature récente, un deal en cours, un dossier réel. Repartez avec une démonstration concrète de ce qui change.',
    microTrust: "Sans engagement. Démo sur votre dossier. Avec l'équipe fondatrice.",
  },
  footer: {
    tagline: "L'infrastructure analytique pour l'Afrique francophone.",
    columns: [
      { title: 'Produit', links: [{ label: 'Module Programme', href: '#solution' }, { label: 'Module Private Equity', href: '#solution' }, { label: 'Sécurité & Conformité', href: '#security' }] },
      { title: 'Ressources', links: [{ label: 'Documentation', href: '#' }, { label: 'Changelog', href: '#' }, { label: 'Status', href: '#' }] },
      { title: 'Contact', links: [
        { label: 'philyace@gmail.com', href: 'mailto:philyace@gmail.com' },
        { label: 'WhatsApp +33 6 15 51 09 76', href: 'https://wa.me/33615510976' },
        { label: "Abidjan, Côte d'Ivoire", href: '#' },
      ] },
    ],
    bottom: '© 2026 ESONO BIS Studio. Tous droits réservés. Mentions légales. Confidentialité.',
  },
};

// ───────────────────────────────── UI bits ────────────────────────────────────

function PrimaryCTA({ size = 'lg', href = DEMO_URL, className = '' }: { size?: 'sm' | 'md' | 'lg' | 'xl'; href?: string; className?: string }) {
  const sizes: Record<string, string> = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
    xl: 'px-10 py-5 text-lg',
  };
  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-2 rounded-lg font-body font-medium bg-[#C9A96E] text-white hover:bg-[#B08F52] transition-colors duration-200 shadow-sm hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6E3D] ${sizes[size]} ${className}`}
    >
      Réserver une démo live
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

// AnimatedSection : fade-in + translate-y léger au scroll via IntersectionObserver.
// Pas de dépendance externe, animation pure CSS.
function AnimatedSection({ children, className = '', as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div'; [k: string]: any }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1, rootMargin: '0px 0px -80px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <Tag
      ref={ref as any}
      className={`${className} transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function BrandPattern() {
  return (
    <svg className="absolute inset-0 opacity-[0.05] pointer-events-none" width="100%" height="100%" aria-hidden="true">
      <defs>
        <pattern id="esono-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="2" fill="currentColor" />
          <path d="M 20 20 Q 60 0 100 20 T 180 20" stroke="currentColor" strokeWidth="0.5" fill="none" />
          <circle cx="100" cy="20" r="2" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#esono-pattern)" className="text-[#7C3AED]" />
    </svg>
  );
}

// ─── Illustrations SVG custom pour les 3 étapes de "Comment ça marche" ───
function IllustrationIngerer() {
  return (
    <svg viewBox="0 0 120 64" className="h-14 w-24 text-[#7C3AED]" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="22" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="10" y="16" width="16" height="22" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="16" y="22" width="16" height="22" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M38 33 L68 33" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M62 27 L70 33 L62 39" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="74" y="17" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="90" cy="33" r="3" fill="currentColor" />
    </svg>
  );
}
function IllustrationAnalyser() {
  return (
    <svg viewBox="0 0 120 64" className="h-14 w-24 text-[#7C3AED]" fill="none" aria-hidden="true">
      <circle cx="18" cy="32" r="7" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="60" cy="14" r="5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="60" cy="50" r="5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="102" cy="32" r="7" stroke="currentColor" strokeWidth="1.2" />
      <path d="M24 29 L56 15" stroke="currentColor" strokeWidth="1.1" />
      <path d="M24 35 L56 49" stroke="currentColor" strokeWidth="1.1" />
      <path d="M64 15 L96 29" stroke="currentColor" strokeWidth="1.1" />
      <path d="M64 49 L96 35" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="18" cy="32" r="2" fill="currentColor" />
      <circle cx="102" cy="32" r="2" fill="currentColor" />
    </svg>
  );
}
function IllustrationLivrer() {
  return (
    <svg viewBox="0 0 120 64" className="h-14 w-24 text-[#7C3AED]" fill="none" aria-hidden="true">
      <rect x="8" y="16" width="28" height="32" rx="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M44 32 L74 32" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M68 26 L76 32 L68 38" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="82" y="10" width="26" height="44" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M88 26 L92 30 L102 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M88 38 L102 38" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M88 44 L98 44" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
const STEP_ILLUSTRATIONS = [IllustrationIngerer, IllustrationAnalyser, IllustrationLivrer];

// Placeholder Investment Memo / Livrables — adapte le contenu selon le segment sélectionné
function DashboardMockup({ segment }: { segment: Segment }) {
  const peData = {
    toolbar: 'esono.tech · Investment Memo · Kouassi Agro',
    subtitle: "Série A · Côte d'Ivoire · Agro-industrie",
    scoreLabel: 'Score 84',
    statut: 'En diligence',
    counts: { done: 5, progress: 3, empty: 4 },
    rows: [
      { n: 1, title: 'Synthèse exécutive', status: 'done' },
      { n: 2, title: "Thèse d'investissement", status: 'done' },
      { n: 3, title: 'Marché & positionnement', status: 'done' },
      { n: 4, title: 'Business model', status: 'done' },
      { n: 5, title: 'Équipe & gouvernance', status: 'done' },
      { n: 6, title: 'États financiers SYSCOHADA', status: 'progress' },
      { n: 7, title: 'Projections 5 ans', status: 'progress' },
      { n: 8, title: 'Valorisation DCF & multiples', status: 'progress' },
      { n: 9, title: 'Structuration du deal', status: 'empty' },
      { n: 10, title: 'Risques & mitigation', status: 'empty' },
      { n: 11, title: 'Conditions suspensives', status: 'empty' },
      { n: 12, title: 'Plan post-investissement', status: 'empty' },
    ],
  };
  const programData = {
    toolbar: 'esono.tech · Livrables · Kouassi Agro',
    subtitle: "Cohorte Q2-26 · Côte d'Ivoire · Agro-industrie",
    scoreLabel: 'Score IR 78',
    statut: 'En accompagnement',
    counts: { done: 4, progress: 3, empty: 4 },
    rows: [
      { n: 1, title: 'Pre-screening', status: 'done' },
      { n: 2, title: 'Business Model Canvas', status: 'done' },
      { n: 3, title: 'Stratégie & impact (SIC)', status: 'done' },
      { n: 4, title: 'Inputs financiers', status: 'done' },
      { n: 5, title: 'Plan financier 5 ans', status: 'progress' },
      { n: 6, title: 'Business Plan', status: 'progress' },
      { n: 7, title: 'Due Diligence ODD', status: 'progress' },
      { n: 8, title: 'Valorisation', status: 'empty' },
      { n: 9, title: 'One-pager bailleur', status: 'empty' },
      { n: 10, title: 'Investment Memo', status: 'empty' },
      { n: 11, title: 'Rapport de cohorte', status: 'empty' },
    ],
  };
  const data = segment === 'program' ? programData : peData;
  const dotColor = (s: string) => s === 'done' ? 'bg-[#2F8F5A]' : s === 'progress' ? 'bg-[#A78BFA]' : 'bg-[#B8B5C4]';
  return (
    <div key={`dashboard-${segment}`} className="relative rounded-2xl border border-[#EDE9FE] bg-white shadow-[0_4px_8px_rgba(61,43,87,0.08),0_16px_40px_rgba(61,43,87,0.08)] overflow-hidden animate-in fade-in duration-300">
      <div className="flex items-center gap-1.5 border-b border-[#EDE9FE] px-4 py-3 bg-[#F5F3FF]">
        <div className="h-2.5 w-2.5 rounded-full bg-[#B84444]/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#C8801F]/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#2F8F5A]/40" />
        <div className="ml-4 flex-1 text-[11px] text-[#6B6680]">{data.toolbar}</div>
      </div>
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-serif text-base font-semibold text-[#6D28D9]">Kouassi Agro Industries</h3>
            <p className="text-[11px] text-[#6B6680]">{data.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#FDF6EC] px-3 py-1 text-[11px] font-medium text-[#8A6E3D]">{data.scoreLabel}</span>
            <span className="rounded-full bg-[#F5F3FF] px-3 py-1 text-[11px] font-medium text-[#7C3AED]">{data.statut}</span>
          </div>
        </div>
        <div className="mb-3 flex items-center gap-4 text-[10px] text-[#6B6680] flex-wrap">
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2F8F5A]" /> Validé ({data.counts.done})</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#A78BFA]" /> En cours ({data.counts.progress})</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#B8B5C4]" /> À compléter ({data.counts.empty})</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.rows.map(s => (
            <div key={s.n} className="flex items-center gap-2.5 rounded-md border border-[#EDE9FE] bg-white px-3 py-2">
              <span className={`h-2 w-2 rounded-full flex-none ${dotColor(s.status)}`} />
              <span className="text-[11px] font-medium text-[#3D3651] flex-none w-5">{s.n}.</span>
              <span className="text-[11px] text-[#1A1625] truncate">{s.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Placeholder Pipeline Board — utilisé dans le hero
function HeroMockup() {
  const cols: { title: string; items: { name: string; sector: string; score: number }[] }[] = [
    { title: 'Pre-screening', items: [
      { name: 'Kouassi Agro', sector: 'Agro-industrie', score: 84 },
      { name: 'Dakar Logistics', sector: 'Logistique', score: 76 },
    ] },
    { title: 'Diligence', items: [
      { name: 'Lomé Pharma', sector: 'Pharma', score: 91 },
      { name: 'Bouaké Textile', sector: 'Textile', score: 68 },
    ] },
    { title: 'IC final', items: [
      { name: 'Ouaga Tech', sector: 'Tech', score: 82 },
      { name: 'Abidjan Fintech', sector: 'Fintech', score: 79 },
    ] },
  ];
  return (
    <div className="relative rounded-2xl border border-[#EDE9FE] bg-white shadow-[0_4px_8px_rgba(61,43,87,0.08),0_16px_40px_rgba(61,43,87,0.08)] overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-[#EDE9FE] px-4 py-3 bg-[#F5F3FF]">
        <div className="h-2.5 w-2.5 rounded-full bg-[#B84444]/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#C8801F]/40" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#2F8F5A]/40" />
        <div className="ml-4 flex-1 text-[11px] text-[#6B6680]">esono.tech · Pipeline · Q2 2026</div>
      </div>
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-base font-semibold text-[#6D28D9]">Deals actifs</h3>
          <span className="rounded-full bg-[#FDF6EC] px-3 py-1 text-[11px] font-medium text-[#8A6E3D]">6 en pipeline</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {cols.map((col, i) => (
            <div key={i} className="rounded-lg bg-[#F5F3FF] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#3D3651]">{col.title}</span>
                <span className="text-[11px] text-[#6B6680]">{col.items.length}</span>
              </div>
              <div className="space-y-2">
                {col.items.map((it, j) => (
                  <div key={j} className="rounded-md bg-white p-2.5 shadow-[0_1px_2px_rgba(61,43,87,0.04)]">
                    <div className="mb-1 text-[11px] font-medium text-[#1A1625]">{it.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#6B6680]">{it.sector}</span>
                      <span className="text-[10px] font-semibold text-[#B08F52]">{it.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────── Page ────────────────────────────────────

export default function Index() {
  const { user, loading } = useAuth();
  const [segment, setSegment] = useState<Segment>('pe');

  // Persistance du segment + override par query string (?segment=pe|program)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('esono-segment') as Segment | null;
      if (stored === 'pe' || stored === 'program') setSegment(stored);
      const qs = new URLSearchParams(window.location.search).get('segment') as Segment | null;
      if (qs === 'pe' || qs === 'program') setSegment(qs);
    } catch { /* no-op */ }
  }, []);

  const chooseSegment = (s: Segment) => {
    setSegment(s);
    try { localStorage.setItem('esono-segment', s); } catch { /* no-op */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7]">
        <Loader2 className="h-8 w-8 animate-spin text-[#7C3AED]" />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;

  const problem = CONTENT.problem[segment];
  const solution = CONTENT.solution[segment];
  const how = CONTENT.how[segment];
  const contrast = CONTENT.contrast[segment];

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1625] font-body antialiased">
      {/* ─────────────── Header ─────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#EDE9FE] bg-[#FAFAF7]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <a href="#" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#6D28D9] flex items-center justify-center">
              <span className="text-[11px] font-serif font-bold text-white">ES</span>
            </div>
            <span className="text-lg font-serif font-semibold text-[#6D28D9] tracking-tight">ESONO</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            {CONTENT.nav.links.map(l => (
              <a key={l.href} href={l.href} className="text-sm text-[#3D3651] hover:text-[#6D28D9] transition-colors">{l.label}</a>
            ))}
            <Link to="/login" className="text-sm text-[#3D3651] hover:text-[#6D28D9] transition-colors">Se connecter</Link>
          </nav>
          <div className="flex items-center gap-3">
            {/* Masqué sur mobile pour éviter le doublon avec le sticky bottom CTA */}
            <PrimaryCTA size="md" className="hidden md:inline-flex" />
          </div>
        </div>
      </header>

      {/* ─────────────── Hero ─────────────── */}
      <section className="relative overflow-hidden">
        <BrandPattern />
        <div className="relative mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-medium tracking-widest uppercase text-[#B08F52]">{CONTENT.hero.eyebrow}</p>
              <h1 className="mt-5 font-serif font-semibold text-[#6D28D9] leading-[1.1]" style={{ fontSize: 'clamp(2.25rem, 4.5vw, 3.75rem)' }}>
                {CONTENT.hero.h1}
              </h1>
              <p className="mt-6 text-[17px] leading-relaxed text-[#3D3651] max-w-xl">{CONTENT.hero.subheadline}</p>
              <div className="mt-9">
                <PrimaryCTA size="xl" />
              </div>
            </div>
            <div className="lg:pl-6">
              <HeroMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── Segment switcher ─────────────── */}
      <section className="border-y border-[#EDE9FE] bg-white">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 py-10">
          <p className="text-center text-sm text-[#6B6680] mb-5">{CONTENT.switcher.intro}</p>
          <div role="tablist" aria-label="Sélectionner votre segment" className="mx-auto grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-3xl">
            {(['program', 'pe'] as Segment[]).map(s => {
              const meta = CONTENT.switcher[s];
              const active = segment === s;
              return (
                <button
                  key={s}
                  role="tab"
                  aria-selected={active}
                  onClick={() => chooseSegment(s)}
                  className={`rounded-xl border p-5 text-left transition-all ${active ? 'border-[#7C3AED] bg-[#F5F3FF] shadow-sm' : 'border-[#EDE9FE] bg-white hover:border-[#A78BFA]'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border-2 ${active ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#B8B5C4] bg-white'}`} />
                    <div>
                      <div className={`font-serif font-semibold ${active ? 'text-[#6D28D9]' : 'text-[#3D3651]'}`}>{meta.label}</div>
                      <div className="mt-1 text-sm text-[#6B6680]">{meta.sublabel}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────── 3 · Problème ─────────────── */}
      <AnimatedSection className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 py-20 md:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="font-serif font-semibold text-[#6D28D9]" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>{CONTENT.problem.title}</h2>
          <p key={`sub-${segment}`} className="mt-4 text-[#3D3651] text-lg animate-in fade-in duration-300">{problem.sub}</p>
        </div>
        <div key={`cards-${segment}`} className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {problem.cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} className="rounded-xl bg-white border border-[#EDE9FE] p-6 shadow-[0_1px_2px_rgba(61,43,87,0.04),0_2px_8px_rgba(61,43,87,0.04)] hover:shadow-[0_2px_4px_rgba(61,43,87,0.06),0_8px_24px_rgba(61,43,87,0.06)] transition-shadow">
                <div className="h-11 w-11 rounded-xl bg-[#F5F3FF] flex items-center justify-center">
                  <Icon className="h-5 w-5 text-[#7C3AED]" />
                </div>
                <h3 className="mt-4 font-serif font-semibold text-[#1A1625] text-lg">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#3D3651]">{c.body}</p>
              </div>
            );
          })}
        </div>
        <blockquote key={`quote-${segment}`} className="mt-10 rounded-xl bg-[#F5F3FF] p-8 max-w-4xl mx-auto animate-in fade-in duration-300">
          <Quote className="h-6 w-6 text-[#A78BFA] mb-3" />
          <p className="font-serif text-xl italic text-[#6D28D9]">« {problem.quote.text} »</p>
          <footer className="mt-3 text-sm text-[#6B6680]">{problem.quote.author}</footer>
        </blockquote>
      </AnimatedSection>

      {/* ─────────────── 4 · Solution ─────────────── */}
      <section id="solution" className="bg-white border-y border-[#EDE9FE]">
        <AnimatedSection as="div" className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 py-20 md:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="font-serif font-semibold text-[#6D28D9]" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>{CONTENT.solution.title}</h2>
            <p className="mt-4 text-[#3D3651] text-lg">{CONTENT.solution.sub}</p>
          </div>
          <div key={`sol-${segment}`} className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {solution.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="rounded-xl bg-[#FAFAF7] border border-[#EDE9FE] p-6 hover:shadow-[0_2px_4px_rgba(61,43,87,0.06),0_8px_24px_rgba(61,43,87,0.06)] transition-shadow">
                  <div className="h-11 w-11 rounded-xl bg-[#6D28D9] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mt-4 font-serif font-semibold text-[#1A1625] text-lg">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#3D3651]">{c.body}</p>
                </div>
              );
            })}
          </div>
          {/* Mockup Investment Memo / Livrables — adapte le contenu selon le segment sélectionné */}
          <div className="mt-14 max-w-4xl mx-auto">
            <DashboardMockup segment={segment} />
          </div>
          <div className="mt-12 text-center">
            <PrimaryCTA size="lg" />
          </div>
        </AnimatedSection>
      </section>

      {/* ─────────────── 5 · Comment ça marche ─────────────── */}
      <AnimatedSection className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 py-20 md:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="font-serif font-semibold text-[#6D28D9]" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>{CONTENT.how.title}</h2>
          <p className="mt-4 text-[#3D3651] text-lg">{CONTENT.how.sub}</p>
        </div>
        <div key={`how-${segment}`} className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          {how.map((s, i) => {
            const Illustration = STEP_ILLUSTRATIONS[i] ?? (() => null);
            return (
              <div key={i} className="relative rounded-xl bg-white border border-[#EDE9FE] p-6">
                <span className="absolute top-5 right-5 text-5xl font-serif font-semibold text-[#F5F3FF]">{s.n}</span>
                <div className="h-14 flex items-start">
                  <Illustration />
                </div>
                <h3 className="mt-4 font-serif font-semibold text-[#1A1625] text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#3D3651] relative z-10">{s.body}</p>
              </div>
            );
          })}
        </div>
      </AnimatedSection>

      {/* ─────────────── 6 · Preuve ─────────────── */}
      <section className="bg-[#6D28D9] text-white relative overflow-hidden">
        <BrandPattern />
        <AnimatedSection as="div" className="relative mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 py-20 md:py-24">
          <div className="text-center">
            <h2 className="font-serif font-semibold" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>{CONTENT.proof.title}</h2>
          </div>
          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {CONTENT.proof.testimonials.map((t, i) => (
              <figure key={i} className="rounded-xl bg-white/5 border border-white/10 p-7 backdrop-blur-sm">
                <Quote className="h-6 w-6 text-[#C9A96E] mb-3" />
                <blockquote className="font-serif text-lg leading-relaxed text-white/90">« {t.text} »</blockquote>
                <figcaption className="mt-4 text-sm text-white/60">{t.author}</figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-12 text-center">
            <PrimaryCTA size="lg" />
          </div>
        </AnimatedSection>
      </section>

      {/* ─────────────── 7 · Sécurité ─────────────── */}
      <AnimatedSection id="security" className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 py-20 md:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="font-serif font-semibold text-[#6D28D9]" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>{CONTENT.security.title}</h2>
          <p className="mt-4 text-[#3D3651] text-lg">{CONTENT.security.sub}</p>
        </div>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CONTENT.security.pillars.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="rounded-xl bg-white border border-[#EDE9FE] p-6">
                <div className="h-10 w-10 rounded-lg bg-[#F5F3FF] flex items-center justify-center">
                  <Icon className="h-5 w-5 text-[#7C3AED]" />
                </div>
                <h3 className="mt-4 font-serif font-semibold text-[#1A1625]">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#3D3651]">{p.body}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-10 rounded-xl bg-[#F5F3FF] border border-[#EDE9FE] p-8 max-w-4xl mx-auto text-center">
          <h3 className="font-serif font-semibold text-[#6D28D9] text-2xl">{CONTENT.security.callout.title}</h3>
          <p className="mt-3 text-[#3D3651] leading-relaxed">{CONTENT.security.callout.body}</p>
        </div>
      </AnimatedSection>

      {/* ─────────────── 8 · Contraste ─────────────── */}
      <section className="bg-white border-y border-[#EDE9FE]">
        <AnimatedSection as="div" className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 py-20 md:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="font-serif font-semibold text-[#6D28D9]" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>{CONTENT.contrast.title}</h2>
            <p className="mt-4 text-[#3D3651] text-lg">{CONTENT.contrast.sub}</p>
          </div>
          <div key={`contrast-${segment}`} className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="rounded-xl border border-[#EDE9FE] bg-[#FAFAF7] p-6">
              <div className="flex items-center gap-2 mb-5">
                <XCircle className="h-5 w-5 text-[#B84444]" />
                <h3 className="font-serif font-semibold text-[#6D28D9]">Sans ESONO</h3>
              </div>
              <ul className="space-y-3">
                {contrast.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#3D3651]">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-[#B84444] shrink-0" />
                    <span>{r.without}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#7C3AED]/20 bg-[#F5F3FF] p-6">
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle2 className="h-5 w-5 text-[#2F8F5A]" />
                <h3 className="font-serif font-semibold text-[#6D28D9]">Avec ESONO</h3>
              </div>
              <ul className="space-y-3">
                {contrast.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#1A1625] font-medium">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-[#2F8F5A] shrink-0" />
                    <span>{r.with}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* ─────────────── 9 · CTA final ─────────────── */}
      <section id="demo" className="relative overflow-hidden">
        <BrandPattern />
        <AnimatedSection as="div" className="relative mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-serif font-semibold text-[#6D28D9]" style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)' }}>{CONTENT.finalCta.title}</h2>
            <p className="mt-5 text-lg text-[#3D3651] leading-relaxed">{CONTENT.finalCta.sub}</p>
            <div className="mt-9">
              <PrimaryCTA size="xl" />
            </div>
            <p className="mt-5 text-sm text-[#6B6680]">{CONTENT.finalCta.microTrust}</p>
          </div>
        </AnimatedSection>
      </section>

      {/* ─────────────── Footer ─────────────── */}
      <footer className="bg-[#1E1B4B] text-white/80">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-[#C9A96E] flex items-center justify-center">
                  <span className="text-[11px] font-serif font-bold text-[#6D28D9]">ES</span>
                </div>
                <span className="text-lg font-serif font-semibold text-white">ESONO</span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{CONTENT.footer.tagline}</p>
            </div>
            {CONTENT.footer.columns.map(col => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-white mb-3">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map(l => (
                    <li key={l.label}>
                      <a href={l.href} className="text-sm text-white/60 hover:text-white transition-colors">{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 pt-6 border-t border-white/10 text-xs text-white/40">{CONTENT.footer.bottom}</div>
        </div>
      </footer>

      {/* ─────────────── Sticky mobile CTA ─────────────── */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-40">
        <PrimaryCTA size="md" className="w-full justify-center shadow-[0_8px_24px_rgba(61,43,87,0.25)]" />
      </div>
    </div>
  );
}
