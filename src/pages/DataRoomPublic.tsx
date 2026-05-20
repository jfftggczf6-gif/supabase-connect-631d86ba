// src/pages/DataRoomPublic.tsx
// Page publique data room — route /data-room/:token.
// Brief P7 #31 : token dans l'URL, auto-validation, plus de formulaire.
// Rétro-compatibilité : si l'URL contient un slug humain et non un token 64-char,
// on garde le formulaire d'accès historique.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, FileText, Download, Shield, BarChart3, Briefcase, Users, Globe,
  FolderOpen, Lock, AlertTriangle, Clock, BookOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Brief #31 fix : 12 sections IM dans l'ordre standard
const MEMO_SECTION_LABELS: Record<string, string> = {
  executive_summary:       '§1 Résumé exécutif',
  shareholding_governance: '§2 Actionnariat & gouvernance',
  top_management:          '§3 Top management',
  services:                '§4 Services',
  competition_market:      '§5 Concurrence & marché',
  unit_economics:          '§6 Units economics',
  financials_pnl:          '§7 États financiers PnL',
  financials_balance:      '§8 États financiers Bilan',
  investment_thesis:       "§9 Thèse d'investissement",
  support_requested:       '§10 Accompagnement demandé',
  esg_risks:               '§11 ESG / Risques',
  annexes:                 '§12 Annexes',
};
const MEMO_SECTION_ORDER = Object.keys(MEMO_SECTION_LABELS);

const CATEGORY_META: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  legal: { label: 'Juridique', icon: Shield, color: 'bg-violet-100 text-violet-700' },
  finance: { label: 'Finance', icon: BarChart3, color: 'bg-emerald-100 text-emerald-600' },
  commercial: { label: 'Commercial', icon: Briefcase, color: 'bg-amber-100 text-amber-600' },
  team: { label: 'Équipe', icon: Users, color: 'bg-purple-100 text-purple-600' },
  impact: { label: 'ESG / Impact', icon: Globe, color: 'bg-teal-100 text-teal-600' },
  other: { label: 'Autres', icon: FileText, color: 'bg-muted text-muted-foreground' },
};

// Un token 64-char hex/base64 a au moins 40 caractères.
function looksLikeToken(s: string | undefined): boolean {
  return !!s && s.length >= 32 && /^[A-Za-z0-9_-]+$/.test(s);
}

type Status = 'idle' | 'loading' | 'ok' | 'expired' | 'invalid' | 'error';

export default function DataRoomPublic() {
  const { slug } = useParams<{ slug: string }>();
  const tokenInUrl = looksLikeToken(slug);

  const [inputToken, setInputToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const validate = async (token: string, slugOpt?: string) => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/access-data-room`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: slugOpt, token, action: 'validate' }),
        },
      );
      if (resp.status === 410) { setStatus('expired'); return; }
      if (resp.status === 403) { setStatus('invalid'); return; }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erreur' }));
        setErrorMsg(err.error || `Erreur ${resp.status}`);
        setStatus('error');
        return;
      }
      const payload = await resp.json();
      setData(payload);
      setStatus('ok');
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  // Auto-validation si l'URL contient un token
  useEffect(() => {
    if (tokenInUrl && slug && status === 'idle') {
      validate(slug);
    }
  }, [tokenInUrl, slug, status]);

  // ────── Token expiré ──────────────────────────────────────────────────────
  if (status === 'expired') {
    return (
      <ShellHeader>
        <Card className="p-8 max-w-md mx-auto text-center mt-16">
          <Clock className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h2 className="font-display font-bold text-xl mb-2">Lien expiré</h2>
          <p className="text-sm text-muted-foreground">
            Ce lien d'accès à la data room a expiré. Contactez le cabinet qui vous l'a transmis pour le renouveler.
          </p>
        </Card>
      </ShellHeader>
    );
  }

  // ────── Token invalide ────────────────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <ShellHeader>
        <Card className="p-8 max-w-md mx-auto text-center mt-16">
          <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
          <h2 className="font-display font-bold text-xl mb-2">Lien invalide</h2>
          <p className="text-sm text-muted-foreground">
            Le lien que vous avez utilisé n'est pas reconnu. Vérifiez l'URL ou demandez un nouveau lien.
          </p>
        </Card>
      </ShellHeader>
    );
  }

  // ────── Loading auto-validation ───────────────────────────────────────────
  if (status === 'loading' && tokenInUrl) {
    return (
      <ShellHeader>
        <div className="flex flex-col items-center justify-center mt-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p className="text-sm text-muted-foreground">Vérification du lien d'accès…</p>
        </div>
      </ShellHeader>
    );
  }

  // ────── Formulaire historique (slug humain) ────────────────────────────────
  if (status !== 'ok') {
    return (
      <ShellHeader>
        <div className="container max-w-md py-16">
          <Card className="p-8">
            <div className="text-center mb-6">
              <Lock className="h-10 w-10 text-primary mx-auto mb-3" />
              <h2 className="font-display font-bold text-xl mb-1">Accès Data Room</h2>
              <p className="text-sm text-muted-foreground">Entrez le token d'accès qui vous a été communiqué</p>
            </div>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Entrez votre token d'accès"
                value={inputToken}
                onChange={e => setInputToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && validate(inputToken.trim(), slug)}
              />
              {errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
              <Button
                onClick={() => validate(inputToken.trim(), slug)}
                disabled={status === 'loading' || !inputToken.trim()}
                className="w-full"
              >
                {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Accéder
              </Button>
            </div>
          </Card>
        </div>
      </ShellHeader>
    );
  }

  // ────── OK : vue IM + documents ───────────────────────────────────────────
  const { enterprise, investor_name, can_download, documents, cabinet_name, memo, memo_sections } = data;
  const categories = Object.keys(CATEGORY_META);
  const grouped = categories.map(cat => ({
    ...CATEGORY_META[cat],
    id: cat,
    docs: (documents || []).filter((d: any) => d.category === cat),
  })).filter(g => g.docs.length > 0);

  // Brief #31 fix : tri sections memo dans l'ordre standard 12 sections
  const sectionsByCode: Record<string, any> = {};
  for (const s of (memo_sections || [])) sectionsByCode[s.section_code] = s;
  const orderedSections = MEMO_SECTION_ORDER
    .map(code => ({ code, label: MEMO_SECTION_LABELS[code], data: sectionsByCode[code] }))
    .filter(x => x.data);

  return (
    <ShellHeader cabinetName={cabinet_name}>
      <div className="container max-w-6xl py-8">
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl mb-1">{enterprise?.name || 'Entreprise'}</h1>
          <p className="text-sm text-muted-foreground">
            {enterprise?.sector && `${enterprise.sector} · `}
            {enterprise?.country || ''}
          </p>
          {investor_name && (
            <p className="text-xs text-muted-foreground mt-2">
              Bienvenue {investor_name}. Voici l'Information Memorandum partagé avec vous.
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {!can_download && (
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                Lecture seule — téléchargement désactivé
              </Badge>
            )}
            {memo?.stage && (
              <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
                Memo {memo.stage === 'note_ic_finale' ? 'IC finale' : memo.stage === 'note_ic1' ? 'IC1' : memo.stage}
              </Badge>
            )}
            {memo?.overall_score != null && (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                Score {memo.overall_score}/100
              </Badge>
            )}
          </div>
        </div>

        {/* IM 12 sections (Brief #31 fix) */}
        {orderedSections.length > 0 && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4 text-violet-600" />
              Information Memorandum
              <Badge variant="outline" className="text-[10px]">{orderedSections.length} sections</Badge>
            </div>
            {orderedSections.map(s => (
              <Card key={s.code} className="p-5">
                <h3 className="font-semibold text-sm mb-3 text-violet-700">{s.label}</h3>
                <div className="prose prose-sm max-w-none">
                  {s.data.content_md ? (
                    <ReactMarkdown>{s.data.content_md}</ReactMarkdown>
                  ) : s.data.content_json ? (
                    <pre className="text-[11px] whitespace-pre-wrap bg-muted/40 p-3 rounded">
                      {JSON.stringify(s.data.content_json, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Section vide</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Documents data room (table data_room_documents) */}
        {grouped.length > 0 && (
          <div className="space-y-6">
            <div className="text-sm font-semibold flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-violet-600" />
              Documents complémentaires
            </div>
            {grouped.map(cat => {
              const CatIcon = cat.icon;
              return (
                <Card key={cat.id} className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-8 w-8 rounded-lg ${cat.color} flex items-center justify-center`}>
                      <CatIcon className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-sm">{cat.label}</h3>
                    <Badge variant="outline" className="text-[10px]">{cat.docs.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {cat.docs.map((doc: any) => (
                      <div key={doc.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50">
                        <FileText className="h-4 w-4 text-muted-foreground flex-none" />
                        <span className="text-sm flex-1 truncate">{doc.label}</span>
                        {can_download && doc.download_url && (
                          <Button variant="ghost" size="sm" className="gap-1 text-xs" asChild>
                            <a href={doc.download_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3 w-3" /> Télécharger
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {orderedSections.length === 0 && grouped.length === 0 && (
          <Card className="p-8 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Aucun contenu partagé pour le moment.</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              L'IM n'a peut-être pas encore été généré. Contactez {cabinet_name || 'le cabinet'}.
            </p>
          </Card>
        )}

        <div className="text-center text-[10px] text-muted-foreground/70 mt-10 pt-6 border-t">
          Document strictement confidentiel — accès tracé. Distribution interdite.
        </div>
      </div>
    </ShellHeader>
  );
}

function ShellHeader({ children, cabinetName }: { children: React.ReactNode; cabinetName?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <span className="font-display font-bold text-lg tracking-tight">
            {cabinetName || 'ESONO'}
          </span>
          <Badge variant="outline" className="text-xs">Data Room</Badge>
        </div>
      </header>
      {children}
    </div>
  );
}
