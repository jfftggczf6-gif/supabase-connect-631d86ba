import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Database, RefreshCw, Plus, Search, Sparkles, Globe, Loader2 } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface KBEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  country: string | null;
  sector: string | null;
  source: string | null;
  tags: string[] | null;
  auto_refresh: boolean | null;
  expires_at: string | null;
  last_refreshed_at: string | null;
  created_at: string;
  has_embedding: boolean;
}

const CATEGORIES = ['benchmarks', 'fiscal', 'secteurs', 'bailleurs', 'odd', 'reglementation', 'general'];

const CATEGORY_LABELS: Record<string, string> = {
  benchmarks: 'Benchmarks',
  fiscal: 'Fiscal',
  secteurs: 'Secteurs',
  bailleurs: 'Bailleurs',
  odd: 'ODD',
  reglementation: 'Réglementation',
  general: 'Général',
};

const ZONES = ['Monde', 'Afrique', 'Afrique de l\'Ouest', 'UEMOA', 'CEMAC', 'Afrique de l\'Est', 'Afrique du Nord', 'Afrique Australe', 'Côte d\'Ivoire', 'Sénégal', 'Cameroun', 'Mali', 'Burkina Faso', 'RDC', 'Guinée', 'Togo', 'Bénin', 'Niger', 'Maroc', 'Kenya', 'Nigeria', 'Ghana'];

export default function KnowledgeBaseManager({ isAdmin = false }: { isAdmin?: boolean }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<KBEntry | null>(null);
  const [newEntry, setNewEntry] = useState({ title: '', content: '', category: 'benchmarks', country: '', sector: '', source: '', tags: '' });

  const fetchEntries = async () => {
    setLoading(true);
    // We can't select embedding directly (it's a vector), but we can check if it's null
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('id, title, category, content, country, sector, source, tags, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Map entries - we can't easily check embedding from client, so we'll use the metadata
    const mapped: KBEntry[] = (data || []).map((e: any) => ({
      ...e,
      auto_refresh: false, // Will be set from metadata if available
      expires_at: null,
      last_refreshed_at: null,
      has_embedding: false, // We can't check from client easily
    }));

    setEntries(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const stats = useMemo(() => ({
    total: entries.length,
    autoRefresh: entries.filter(e => e.auto_refresh).length,
    categories: [...new Set(entries.map(e => e.category))].length,
  }), [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (filterCategory !== 'all') result = result.filter(e => e.category === filterCategory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.country?.toLowerCase().includes(q) ||
        e.sector?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, filterCategory, search]);

  const callEdgeFunction = async (fnName: string, body: any = {}) => {
    const token = await getValidAccessToken(null);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/${fnName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return resp.json();
  };

  const handleSeed = async () => {
    setActionLoading('seed');
    try {
      const result = await callEdgeFunction('seed-knowledge-base');
      toast({ title: 'Base seedée', description: `${result.inserted || 0} entrées insérées` });
      fetchEntries();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleGenerateEmbeddings = async () => {
    setActionLoading('embeddings');
    try {
      const result = await callEdgeFunction('generate-embeddings', { mode: 'backfill' });
      toast({ title: 'Embeddings générés', description: `${result.processed || 0} traités, ${result.errors || 0} erreurs` });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleRefreshMacro = async () => {
    setActionLoading('macro');
    try {
      const result = await callEdgeFunction('refresh-macro-data');
      toast({ title: 'Données macro rafraîchies', description: `${result.inserted || 0} nouvelles, ${result.updated || 0} mises à jour` });
      fetchEntries();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleAddEntry = async () => {
    if (!newEntry.title || !newEntry.content) return;
    const result = await callEdgeFunction('ingest-knowledge', {
      entries: [{
        category: newEntry.category,
        title: newEntry.title,
        content: newEntry.content,
        country: newEntry.country || null,
        sector: newEntry.sector || null,
        source: newEntry.source || null,
        tags: newEntry.tags ? newEntry.tags.split(',').map(t => t.trim()) : [],
      }],
    });
    if (result.success) {
      toast({ title: 'Entrée ajoutée' });
      setShowAddDialog(false);
      setNewEntry({ title: '', content: '', category: 'benchmarks', country: '', sector: '', source: '', tags: '' });
      fetchEntries();
    } else {
      toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Actions techniques — superadmin uniquement */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions techniques</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={handleSeed} disabled={!!actionLoading} variant="outline" className="gap-2">
              {actionLoading === 'seed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Seeder la base
            </Button>
            <Button onClick={handleGenerateEmbeddings} disabled={!!actionLoading} variant="outline" className="gap-2">
              {actionLoading === 'embeddings' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Générer les embeddings
            </Button>
            <Button onClick={handleRefreshMacro} disabled={!!actionLoading} variant="outline" className="gap-2">
              {actionLoading === 'macro' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              Rafraîchir données macro
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Ajouter un document */}
      <div className="flex justify-end">
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Ajouter un document</Button>
          </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Ajouter un document à la base de connaissances</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Select value={newEntry.category} onValueChange={v => setNewEntry(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Titre *" value={newEntry.title} onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))} />
                <Textarea placeholder="Contenu" rows={6} value={newEntry.content} onChange={e => setNewEntry(p => ({ ...p, content: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <select value={newEntry.country} onChange={e => setNewEntry(p => ({ ...p, country: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                    <option value="">— Zone *</option>
                    {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <select value={newEntry.sector} onChange={e => setNewEntry(p => ({ ...p, sector: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                    <option value="">— Secteur *</option>
                    {(['Tous secteurs', 'Agro-industrie', 'Aviculture', 'Agriculture', 'Commerce', 'Restauration', 'Services B2B', 'TIC', 'Énergie', 'Santé', 'BTP', 'Transport', 'Éducation', 'Immobilier', 'Textile', 'Mines']).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <Input placeholder="Source *" value={newEntry.source} onChange={e => setNewEntry(p => ({ ...p, source: e.target.value }))} />
                <Input placeholder="Tags (séparés par virgule)" value={newEntry.tags} onChange={e => setNewEntry(p => ({ ...p, tags: e.target.value }))} />
                <Button onClick={handleAddEntry} className="w-full" disabled={!newEntry.title || !newEntry.content || !newEntry.source || !newEntry.country || !newEntry.sector}>Ajouter</Button>
              </div>
            </DialogContent>
          </Dialog>
      </div>

      {/* Entries list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">Documents ({filteredEntries.length})</CardTitle>
            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Secteur</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date publication</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map(e => (
                <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setPreviewEntry(e)}>
                  <TableCell className="font-medium max-w-[300px] truncate">{e.title}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{CATEGORY_LABELS[e.category] || e.category}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.country || 'Monde'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.sector || 'Tous secteurs'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{e.source || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(e.created_at)}</TableCell>
                </TableRow>
              ))}
              {!filteredEntries.length && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun document trouvé</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview dialog */}
      {previewEntry && (
        <Dialog open={!!previewEntry} onOpenChange={() => setPreviewEntry(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{previewEntry.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{CATEGORY_LABELS[previewEntry.category] || previewEntry.category}</Badge>
                {previewEntry.country && <Badge variant="secondary">{previewEntry.country}</Badge>}
                {previewEntry.sector && <Badge variant="secondary">{previewEntry.sector}</Badge>}
              </div>
              {previewEntry.source && <p className="text-sm text-muted-foreground">Source : {previewEntry.source}</p>}
              <div className="prose prose-sm max-w-none whitespace-pre-wrap bg-muted/30 rounded-lg p-4 text-sm">
                {previewEntry.content}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
