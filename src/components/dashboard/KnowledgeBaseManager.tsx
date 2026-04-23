import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Database, Plus, Search, Sparkles, Globe, Loader2, Upload, Link, FileText, Building2, BookOpen, BarChart3, Trash2, Eye, RefreshCw, AlertTriangle } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { parseFile } from '@/lib/document-parser';

interface KBEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  country: string | null;
  sector: string | null;
  source: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at?: string | null;
  metadata?: Record<string, any> | null;
  layer: 'org' | 'shared';
}

// Liste UNIFIÉE de catégories (même pour l'org et pour les ressources ESONO partagées)
const UNIFIED_CATEGORIES = [
  'bailleurs', 'base_legale', 'benchmarks', 'classement', 'communique', 'dataset',
  'enquete', 'etude', 'fiscal', 'general', 'odd', 'rapport', 'reglementation', 'secteurs',
].sort();
const SHARED_CATEGORIES = UNIFIED_CATEGORIES;
const ORG_CATEGORIES = UNIFIED_CATEGORIES;

const CATEGORY_LABELS: Record<string, string> = {
  bailleurs: 'Bailleurs',
  base_legale: 'Base légale',
  benchmarks: 'Benchmarks',
  classement: 'Classement',
  communique: 'Communiqué',
  dataset: 'Dataset',
  enquete: 'Enquête',
  etude: 'Étude',
  fiscal: 'Fiscal',
  general: 'Général',
  odd: 'ODD',
  rapport: 'Rapport',
  reglementation: 'Réglementation',
  secteurs: 'Secteurs',
};

// Zones groupées : globales en premier, puis pays par ordre alphabétique
const ZONES_GLOBAL = ['Monde', 'Afrique', 'Afrique de l\'Ouest', 'Afrique de l\'Est', 'Afrique Centrale', 'UEMOA', 'CEMAC'];
const ZONES_COUNTRIES = ['Bénin', 'Burkina Faso', 'Cameroun', 'Congo', 'Côte d\'Ivoire', 'Gabon', 'Ghana', 'Guinée', 'Kenya', 'Madagascar', 'Mali', 'Maroc', 'Niger', 'Nigeria', 'RDC', 'Rwanda', 'Sénégal', 'Tanzanie', 'Togo', 'Tunisie', 'Uganda'].sort((a, b) => a.localeCompare(b, 'fr'));
const ZONES = [...ZONES_GLOBAL, ...ZONES_COUNTRIES];
const SECTORS_LIST = ['Agriculture', 'Agro-industrie', 'Aviculture', 'BTP', 'Commerce', 'Éducation', 'Énergie', 'Fintech', 'Immobilier', 'Mines', 'Pharmacie', 'Restauration', 'Santé', 'Services B2B', 'TIC', 'Textile', 'Transport'].sort((a, b) => a.localeCompare(b, 'fr'));
const SECTORS = ['Tous secteurs', ...SECTORS_LIST];

export default function KnowledgeBaseManager({ isAdmin = false }: { isAdmin?: boolean }) {
  const { currentOrg, isSuperAdmin } = useOrganization();
  const [activeTab, setActiveTab] = useState<string>('org');
  const [orgEntries, setOrgEntries] = useState<KBEntry[]>([]);
  const [sharedEntries, setSharedEntries] = useState<KBEntry[]>([]);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<KBEntry | null>(null);
  const [contentMode, setContentMode] = useState<'upload' | 'link' | 'text'>('upload');
  const [parsing, setParsing] = useState(false);
  const [parsedFileName, setParsedFileName] = useState('');
  const [newEntry, setNewEntry] = useState({ title: '', content: '', category: 'general', country: 'Monde', sector: 'Tous secteurs', source: '', tags: '' });
  const [chunkCounts, setChunkCounts] = useState<Record<string, number>>({});
  const [reindexing, setReindexing] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const promises: any[] = [
      // Shared KB (Couche 2)
      supabase.from('knowledge_base').select('id, title, category, content, country, sector, source, tags, created_at, updated_at, metadata').order('updated_at', { ascending: false }).limit(200),
      // Benchmarks (Couche 2)
      supabase.from('knowledge_benchmarks' as any).select('*').order('secteur').limit(100),
    ];

    // Org KB (Couche 1) — only if user has an org
    if (currentOrg?.id) {
      promises.push(
        supabase.from('organization_knowledge' as any).select('id, title, category, content, country, sector, source, tags, created_at, updated_at').eq('organization_id', currentOrg.id).eq('is_active', true).order('updated_at', { ascending: false }).limit(200)
      );
    }

    const results = await Promise.all(promises);

    setSharedEntries((results[0].data || []).map((e: any) => ({ ...e, layer: 'shared' as const })));
    setBenchmarks(results[1].data || []);
    const orgEntriesArr = results[2] ? (results[2].data || []).map((e: any) => ({ ...e, layer: 'org' as const })) : [];
    if (results[2]) setOrgEntries(orgEntriesArr);

    // Fetch chunk counts to detect entries that failed rag-ingest
    const allIds = [
      ...(results[0].data || []).map((e: any) => e.id),
      ...orgEntriesArr.map((e: any) => e.id),
    ];
    if (allIds.length) {
      const { data: allChunks } = await supabase
        .from('knowledge_chunks')
        .select('kb_entry_id, org_entry_id')
        .or(`kb_entry_id.in.(${allIds.join(',')}),org_entry_id.in.(${allIds.join(',')})`);
      const counts: Record<string, number> = {};
      for (const c of allChunks || []) {
        const id = (c as any).kb_entry_id || (c as any).org_entry_id;
        if (id) counts[id] = (counts[id] || 0) + 1;
      }
      setChunkCounts(counts);
    }
    setLoading(false);
  };

  const handleReindex = async (entry: KBEntry) => {
    setReindexing(entry.id);
    try {
      const payload = entry.layer === 'org' ? { org_entry_id: entry.id, force: true } : { kb_entry_id: entry.id, force: true };
      const result = await callEdgeFunction('rag-ingest', payload);
      if (result?.error) {
        toast({ title: 'Échec réindexation', description: result.error, variant: 'destructive' });
      } else if (result?.skipped) {
        toast({ title: 'Réindexation ignorée', description: result.reason || 'Contenu trop court' });
      } else {
        toast({ title: 'Indexation relancée', description: `${result?.chunks_created || 0} chunks générés` });
      }
      await fetchData();
    } catch (err: any) {
      toast({ title: 'Erreur réseau', description: err.message, variant: 'destructive' });
    } finally {
      setReindexing(null);
    }
  };

  useEffect(() => { fetchData(); }, [currentOrg?.id]);

  const currentEntries = activeTab === 'org' ? orgEntries : sharedEntries;
  // Catégories: union des prédéfinies + celles réellement présentes en base (capture les nouvelles type "rapport")
  const predefinedCategories = activeTab === 'org' ? ORG_CATEGORIES : SHARED_CATEGORIES;
  const dynamicCategories = useMemo(() => {
    const fromData = new Set<string>();
    for (const e of currentEntries) if (e.category) fromData.add(e.category);
    return Array.from(new Set([...predefinedCategories, ...fromData])).sort();
  }, [currentEntries, predefinedCategories]);
  const currentCategories = dynamicCategories;

  const filteredEntries = useMemo(() => {
    let result = currentEntries;
    if (filterCategory !== 'all') result = result.filter(e => e.category === filterCategory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.content?.toLowerCase().includes(q) ||
        e.country?.toLowerCase().includes(q) ||
        e.sector?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [currentEntries, filterCategory, search]);

  const callEdgeFunction = async (fnName: string, body: any = {}) => {
    const token = await getValidAccessToken(null);
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return resp.json();
  };

  const handleAddEntry = async () => {
    if (!newEntry.title || !newEntry.content) return;

    if (activeTab === 'org' && currentOrg?.id) {
      // Insert into organization_knowledge
      const { data: inserted, error } = await supabase.from('organization_knowledge' as any).insert({
        organization_id: currentOrg.id,
        category: newEntry.category,
        title: newEntry.title,
        content: newEntry.content,
        country: newEntry.country || null,
        sector: newEntry.sector || null,
        source: newEntry.source || null,
        tags: newEntry.tags ? newEntry.tags.split(',').map(t => t.trim()) : [],
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }).select('id').single();
      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        return;
      }
      // Chunking + embeddings Voyage (RAG Phase 2) — on log les échecs au lieu de les avaler
      const insertedId = (inserted as any)?.id;
      if (insertedId) {
        try {
          const ragResult = await callEdgeFunction('rag-ingest', { org_entry_id: insertedId, force: false });
          if (ragResult?.error) {
            console.warn('[rag-ingest] failed:', ragResult.error);
            toast({
              title: 'Document ajouté mais indexation RAG échouée',
              description: `${ragResult.error}. Clique sur le bouton "Réindexer" dans la liste pour réessayer.`,
            });
          } else if (ragResult?.skipped) {
            console.info('[rag-ingest] skipped:', ragResult.reason);
          }
        } catch (err: any) {
          console.warn('[rag-ingest] exception:', err);
          toast({
            title: 'Document ajouté mais indexation RAG échouée',
            description: `Erreur réseau : ${err.message}. Utilise "Réindexer" dans la liste.`,
          });
        }
      }
    } else {
      // Insert into shared knowledge_base via EF
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
      if (!result.success) {
        toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Document ajouté' });
    setShowAddDialog(false);
    setNewEntry({ title: '', content: '', category: 'general', country: 'Monde', sector: 'Tous secteurs', source: '', tags: '' });
    setParsedFileName('');
    fetchData();
  };

  const handleDeleteOrgEntry = async (id: string) => {
    if (!confirm('Supprimer ce document ?')) return;
    await supabase.from('organization_knowledge' as any).update({ is_active: false }).eq('id', id);
    toast({ title: 'Document supprimé' });
    fetchData();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  // Add document dialog content (shared between tabs)
  const addDocumentDialog = (
    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {activeTab === 'org' ? `Ajouter une ressource — ${currentOrg?.name || 'mon organisation'}` : 'Ajouter une ressource ESONO'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={newEntry.category} onValueChange={v => setNewEntry(p => ({ ...p, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {currentCategories.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || (c.charAt(0).toUpperCase() + c.slice(1))}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Titre *" value={newEntry.title} onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))} />

          {/* Content mode toggle */}
          <div className="flex gap-1 border border-border rounded-lg p-0.5">
            {[
              { key: 'upload' as const, icon: Upload, label: 'Fichier' },
              { key: 'link' as const, icon: Link, label: 'Lien' },
              { key: 'text' as const, icon: FileText, label: 'Texte' },
            ].map(m => (
              <button key={m.key} type="button" onClick={() => setContentMode(m.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${contentMode === m.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                <m.icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            ))}
          </div>

          {contentMode === 'upload' && (
            <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${parsing ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
              {parsing ? (
                <div className="flex items-center gap-2 text-sm text-primary"><Loader2 className="h-5 w-5 animate-spin" /> Extraction du contenu...</div>
              ) : parsedFileName && newEntry.content ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600"><FileText className="h-5 w-5" /> {parsedFileName} — {newEntry.content.length.toLocaleString()} caractères</div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload className="h-6 w-6" />
                  <span className="text-sm">Glisser un fichier ou cliquer</span>
                  <span className="text-xs">PDF, Word, Excel, PowerPoint</span>
                </div>
              )}
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setParsing(true);
                setParsedFileName(file.name);
                try {
                  const parsed = await parseFile(file);
                  if (parsed.quality === 'failed' || !parsed.content || parsed.content.length < 10) {
                    toast({
                      title: 'Extraction impossible',
                      description: `Le contenu de "${file.name}" n'a pas pu être extrait. Essaie l'onglet "Texte" pour coller le contenu manuellement, ou le format "Lien" pour pointer vers une URL.`,
                      variant: 'destructive',
                    });
                    setParsedFileName('');
                  } else {
                    setNewEntry(p => ({ ...p, content: parsed.content, title: p.title || file.name.replace(/\.[^.]+$/, '') }));
                    toast({ title: 'Contenu extrait', description: `${parsed.content.length.toLocaleString()} caractères` });
                  }
                } catch (err: any) {
                  console.error('[KB Upload] Error:', err);
                  const msg = err?.message?.includes('fetch') || err?.message?.includes('network')
                    ? `Service de parsing indisponible. Bascule sur l'onglet "Texte" pour coller le contenu.`
                    : `Erreur upload: ${err?.message || 'inconnue'}. Essaie l'onglet "Texte" en attendant.`;
                  toast({ title: 'Upload échoué', description: msg, variant: 'destructive' });
                  setParsedFileName('');
                }
                setParsing(false);
              }} />
            </label>
          )}
          {contentMode === 'link' && (
            <Input placeholder="https://example.com/rapport.pdf" onChange={e => setNewEntry(p => ({ ...p, source: p.source || e.target.value }))} />
          )}
          {contentMode === 'text' && (
            <Textarea placeholder="Collez le contenu..." rows={6} value={newEntry.content} onChange={e => setNewEntry(p => ({ ...p, content: e.target.value }))} />
          )}
          {contentMode === 'upload' && newEntry.content && (
            <div className="max-h-24 overflow-y-auto rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">{newEntry.content.slice(0, 500)}{newEntry.content.length > 500 && '...'}</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Zone *</label>
              <select value={newEntry.country} onChange={e => setNewEntry(p => ({ ...p, country: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Secteur *</label>
              <select value={newEntry.sector} onChange={e => setNewEntry(p => ({ ...p, sector: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background">
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <Input placeholder="Source * (URL, document, organisme...)" value={newEntry.source} onChange={e => setNewEntry(p => ({ ...p, source: e.target.value }))} />
          <Input placeholder="Tags (séparés par virgule)" value={newEntry.tags} onChange={e => setNewEntry(p => ({ ...p, tags: e.target.value }))} />
          <Button
            onClick={handleAddEntry}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!newEntry.title || !newEntry.content || !newEntry.country || !newEntry.sector || !newEntry.source}
          >
            Ajouter
          </Button>
          {(!newEntry.title || !newEntry.content || !newEntry.country || !newEntry.sector || !newEntry.source) && (
            <p className="text-[10px] text-muted-foreground">Tous les champs avec * sont obligatoires (titre, contenu, zone, secteur, source)</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  // Document table (reusable for both tabs)
  const renderDocumentTable = (entries: KBEntry[], showDelete = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Titre</TableHead>
          <TableHead>Catégorie</TableHead>
          <TableHead>Zone</TableHead>
          <TableHead>Secteur</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="w-24 text-right">Action</TableHead>
          {showDelete && <TableHead className="w-10" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(e => {
          // Date document : metadata.publication_date > metadata.document_date > updated_at > created_at
          const docDate = e.metadata?.publication_date || e.metadata?.document_date || e.updated_at || e.created_at;
          // Zone/Secteur : champ direct, sinon fallback metadata
          const zone = e.country || e.metadata?.country || e.metadata?.region || '—';
          const sector = e.sector || e.metadata?.sector || '—';
          return (
          <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setPreviewEntry(e)}>
            <TableCell className="font-medium max-w-[300px]">
              <div className="flex items-center gap-1.5">
                <span className="truncate">{e.title}</span>
                {chunkCounts[e.id] === 0 || chunkCounts[e.id] === undefined ? (
                  (e.content && e.content.length >= 100) ? (
                    <span title="Ce document n'est pas indexé dans le RAG — l'IA ne peut pas le trouver par recherche sémantique. Clique sur Réindexer pour corriger.">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    </span>
                  ) : null
                ) : null}
              </div>
            </TableCell>
            <TableCell><Badge variant="outline" className="text-xs">{CATEGORY_LABELS[e.category] || (e.category.charAt(0).toUpperCase() + e.category.slice(1))}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">{zone}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{sector}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDate(docDate)}</TableCell>
            <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
              <div className="flex items-center justify-end gap-1.5">
                {(chunkCounts[e.id] === 0 || chunkCounts[e.id] === undefined) && e.content && e.content.length >= 100 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-[11px] text-amber-700 border-amber-400 hover:bg-amber-50"
                    onClick={() => handleReindex(e)}
                    disabled={reindexing === e.id}
                    title="Relancer le chunking et les embeddings RAG"
                  >
                    {reindexing === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Réindexer
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-[11px] bg-white text-violet-700 border-violet-400 hover:bg-violet-50 hover:border-violet-600"
                  onClick={() => setPreviewEntry(e)}
                  title="Voir le contenu de cette ressource"
                >
                  <Eye className="h-3 w-3" /> Voir
                </Button>
              </div>
            </TableCell>
            {showDelete && (
              <TableCell>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(ev) => { ev.stopPropagation(); handleDeleteOrgEntry(e.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            )}
          </TableRow>
          );
        })}
        {!entries.length && (
          <TableRow><TableCell colSpan={showDelete ? 7 : 6} className="text-center text-muted-foreground py-8">Aucun document trouvé</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      {/* 3 sections as tabs */}
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setFilterCategory('all'); setSearch(''); }}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="org" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Ressources {currentOrg?.name || 'de mon organisation'} ({orgEntries.length})
            </TabsTrigger>
            <TabsTrigger value="shared" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Ressources ESONO ({sharedEntries.length})
            </TabsTrigger>
            <TabsTrigger value="benchmarks" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Benchmarks ({benchmarks.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {(activeTab === 'org' || (activeTab === 'shared' && isSuperAdmin)) && (
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-3.5 w-3.5" /> Ajouter une ressource
              </Button>
            )}
          </div>
        </div>

        {/* Filters bar */}
        {activeTab !== 'benchmarks' && (
          <div className="flex gap-2 mt-3">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {currentCategories.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || (c.charAt(0).toUpperCase() + c.slice(1))}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par titre, zone, secteur..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        )}

        {/* Section 1: Documents de l'organisation (Couche 1) */}
        <TabsContent value="org">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !currentOrg ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune organisation</p>
              <p className="text-sm mt-1">Rejoignez une organisation pour accéder à son espace de connaissances.</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                {renderDocumentTable(filteredEntries, true)}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Section 2: Ressources ESONO partagées (Couche 2) */}
        <TabsContent value="shared">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Card>
              <CardContent className="p-0">
                {renderDocumentTable(filteredEntries, false)}
              </CardContent>
            </Card>
          )}

          {/* Admin actions */}
          {isAdmin && (
            <Card className="mt-4">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Actions admin</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={async () => { setActionLoading('seed'); await callEdgeFunction('seed-knowledge-base'); fetchData(); setActionLoading(null); }} disabled={!!actionLoading} variant="outline" size="sm" className="gap-1.5 text-xs">
                  {actionLoading === 'seed' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />} Seeder
                </Button>
                <Button onClick={async () => { setActionLoading('emb'); await callEdgeFunction('generate-embeddings', { mode: 'backfill' }); setActionLoading(null); }} disabled={!!actionLoading} variant="outline" size="sm" className="gap-1.5 text-xs">
                  {actionLoading === 'emb' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Embeddings
                </Button>
                <Button onClick={async () => { setActionLoading('macro'); await callEdgeFunction('refresh-macro-data'); fetchData(); setActionLoading(null); }} disabled={!!actionLoading} variant="outline" size="sm" className="gap-1.5 text-xs">
                  {actionLoading === 'macro' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />} Données macro
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Section 3: Benchmarks sectoriels */}
        <TabsContent value="benchmarks">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : benchmarks.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucun benchmark disponible</p>
              <p className="text-sm mt-1">Les benchmarks sectoriels seront alimentés par l'équipe ESONO et le pipeline aggregate-benchmarks.</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Secteur</TableHead>
                      <TableHead>Pays / Zone</TableHead>
                      <TableHead>Marge brute</TableHead>
                      <TableHead>CAPEX typique</TableHead>
                      <TableHead>Multiples</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {benchmarks.map((b: any, i: number) => {
                      // Marge brute : médiane ou range min-max
                      const margeBrute = b.marge_brute_mediane != null
                        ? `${b.marge_brute_mediane}%`
                        : (b.marge_brute_min != null && b.marge_brute_max != null)
                          ? `${b.marge_brute_min}-${b.marge_brute_max}%`
                          : '—';
                      // Multiples EBITDA range
                      const multiples = (b.multiple_ebitda_min != null && b.multiple_ebitda_max != null)
                        ? `${b.multiple_ebitda_min}x-${b.multiple_ebitda_max}x`
                        : '—';
                      // CAPEX depuis JSONB capex_typiques
                      const capex = b.capex_typiques?.range || b.capex_typiques?.median || '—';
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{b.secteur || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{b.pays || b.zone || '—'}</TableCell>
                          <TableCell className="text-sm">{margeBrute}</TableCell>
                          <TableCell className="text-sm">{capex}</TableCell>
                          <TableCell className="text-sm">{multiples}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate" title={b.source || ''}>{b.source || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {addDocumentDialog}

      {/* Preview dialog */}
      {previewEntry && (
        <Dialog open={!!previewEntry} onOpenChange={() => setPreviewEntry(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">{previewEntry.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Métadonnées */}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{CATEGORY_LABELS[previewEntry.category] || (previewEntry.category.charAt(0).toUpperCase() + previewEntry.category.slice(1))}</Badge>
                <Badge variant={previewEntry.layer === 'org' ? 'default' : 'secondary'}>{previewEntry.layer === 'org' ? currentOrg?.name : 'ESONO'}</Badge>
                {(previewEntry.country || previewEntry.metadata?.country || previewEntry.metadata?.region) && (
                  <Badge variant="secondary">📍 {previewEntry.country || previewEntry.metadata?.country || previewEntry.metadata?.region}</Badge>
                )}
                {(previewEntry.sector || previewEntry.metadata?.sector) && (
                  <Badge variant="secondary">🏢 {previewEntry.sector || previewEntry.metadata?.sector}</Badge>
                )}
                {(previewEntry.tags || []).map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">#{tag}</Badge>
                ))}
              </div>

              {/* Source (nom publisher + URL cliquable seulement si lien direct vers le doc) */}
              {(() => {
                const rawUrl = previewEntry.metadata?.source_url
                  || (previewEntry.source?.startsWith('http') ? previewEntry.source : null);
                // On n'affiche le lien que s'il pointe réellement vers un document (pas une page d'accueil)
                const isDirectDocLink = (u: string | null): boolean => {
                  if (!u) return false;
                  try {
                    const parsed = new URL(u);
                    if (!parsed.pathname || parsed.pathname === '/') return false;
                    const segments = parsed.pathname.split('/').filter(Boolean);
                    const hasFileExt = /\.(pdf|docx?|xlsx?|html?|pptx?)$/i.test(parsed.pathname);
                    return hasFileExt || segments.length >= 2;
                  } catch { return false; }
                };
                const showLink = isDirectDocLink(rawUrl);
                const hasPublisher = previewEntry.source && !previewEntry.source.startsWith('http');
                if (!hasPublisher && !showLink) return null;
                return (
                  <div className="bg-muted/30 rounded-lg p-3 text-sm">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Source</p>
                    {hasPublisher && <p className="text-foreground font-medium">{previewEntry.source}</p>}
                    {showLink && (
                      <a
                        href={rawUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all text-xs mt-1 inline-flex items-center gap-1"
                      >
                        🔗 Consulter le document original ↗
                      </a>
                    )}
                  </div>
                );
              })()}

              {/* Date */}
              <p className="text-xs text-muted-foreground">
                Date : {formatDate(previewEntry.metadata?.publication_date || previewEntry.metadata?.document_date || previewEntry.updated_at || previewEntry.created_at)} · {previewEntry.content.length.toLocaleString()} caractères
              </p>

              {/* Contenu */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">Contenu</p>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap bg-card border rounded-lg p-4 text-sm max-h-[400px] overflow-y-auto">
                  {previewEntry.content}
                </div>
              </div>

            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
