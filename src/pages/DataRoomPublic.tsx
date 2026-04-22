import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Download, Shield, BarChart3, Briefcase, Users, Globe, FolderOpen, Lock } from 'lucide-react';

const CATEGORY_META: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  legal: { label: 'Juridique', icon: Shield, color: 'bg-violet-100 text-violet-700' },
  finance: { label: 'Finance', icon: BarChart3, color: 'bg-emerald-100 text-emerald-600' },
  commercial: { label: 'Commercial', icon: Briefcase, color: 'bg-amber-100 text-amber-600' },
  team: { label: 'Équipe', icon: Users, color: 'bg-purple-100 text-purple-600' },
  impact: { label: 'ESG / Impact', icon: Globe, color: 'bg-teal-100 text-teal-600' },
  other: { label: 'Autres', icon: FileText, color: 'bg-muted text-muted-foreground' },
};

export default function DataRoomPublic() {
  const { slug } = useParams<{ slug: string }>();
  const [inputToken, setInputToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [validated, setValidated] = useState(false);

  const handleValidate = async () => {
    if (!slug || !inputToken.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/access-data-room`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, token: inputToken.trim(), action: 'validate' }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error || 'Token invalide');
      }
      setData(await resp.json());
      setValidated(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Token entry form
  if (!validated) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/80 backdrop-blur-sm">
          <div className="container flex h-14 items-center justify-between">
            <span className="font-display font-bold text-lg tracking-tight">ESONO</span>
            <Badge variant="outline" className="text-xs">Data Room</Badge>
          </div>
        </header>

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
                onKeyDown={e => e.key === 'Enter' && handleValidate()}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button onClick={handleValidate} disabled={loading || !inputToken.trim()} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Accéder
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Document view (after validation)
  const { enterprise, investor_name, can_download, documents } = data;
  const categories = Object.keys(CATEGORY_META);
  const grouped = categories.map(cat => ({
    ...CATEGORY_META[cat],
    id: cat,
    docs: (documents || []).filter((d: any) => d.category === cat),
  })).filter(g => g.docs.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <span className="font-display font-bold text-lg tracking-tight">ESONO</span>
          <Badge variant="outline" className="text-xs">Data Room</Badge>
        </div>
      </header>

      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl mb-1">{enterprise?.name || 'Entreprise'}</h1>
          <p className="text-sm text-muted-foreground">
            {enterprise?.sector && `${enterprise.sector} · `}
            {enterprise?.country || ''}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Bienvenue {investor_name}. Voici les documents partagés avec vous.
          </p>
        </div>

        <div className="space-y-6">
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

        {grouped.length === 0 && (
          <Card className="p-8 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Aucun document partagé pour le moment.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
