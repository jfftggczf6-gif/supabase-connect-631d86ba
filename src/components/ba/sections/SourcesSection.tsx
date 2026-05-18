// src/components/ba/sections/SourcesSection.tsx
// Brief sources_references (Ordre 9) — vue lecture seule des sources mobilisées
// pour un mandat BA. 3 sections : documents mandant, sources externes citées
// dans l'IM, entretiens réalisés.

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, FileText, BookOpen, MessageSquare, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORY_LABELS } from '@/lib/document-parser';

interface Props {
  dealId: string;
}

interface DocRow {
  id: string;
  filename: string;
  category: string | null;
  size_bytes: number | null;
  chars_extracted: number | null;
  created_at: string;
}

interface NoteRow {
  id: string;
  titre: string | null;
  input_type: string;
  date_rdv: string | null;
  author_name: string | null;
  created_at: string;
}

interface ExternalSource {
  section_code: string;
  excerpt: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const NOTE_TYPE_ICON: Record<string, string> = {
  note: '📝', rdv: '🤝', appel: '📞',
};

/** Extrait des sources externes depuis content_md des sections IM
 *  via heuristique : lignes contenant Source/IFC/BCEAO/FMI/AFD/URLs.
 *  Sera enrichi quand les agents IA ajouteront un champ structuré. */
function extractExternalSources(sections: { section_code: string; content_md: string | null }[]): ExternalSource[] {
  const out: ExternalSource[] = [];
  const pattern = /(?:^|\n)([^\n]*(?:Source\s*:|IFC|BCEAO|FMI|Banque Mondiale|AFD|BIO|OMS|WHO|http[s]?:\/\/)[^\n]*)/gi;
  for (const s of sections) {
    if (!s.content_md) continue;
    let match;
    while ((match = pattern.exec(s.content_md)) !== null) {
      const excerpt = match[1].trim().replace(/^[-•]\s*/, '').slice(0, 180);
      if (excerpt.length > 10) {
        out.push({ section_code: s.section_code, excerpt });
      }
      if (out.length >= 30) break;
    }
    if (out.length >= 30) break;
  }
  return out;
}

export default function SourcesSection({ dealId }: Props) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [external, setExternal] = useState<ExternalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const docsP = supabase
          .from('pe_deal_documents')
          .select('id, filename, category, size_bytes, chars_extracted, created_at')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: false });

        const notesP = supabase
          .from('pe_deal_notes')
          .select('id, titre, input_type, date_rdv, author_id, created_at')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: false });

        const memoP = supabase
          .from('investment_memos')
          .select('id')
          .eq('deal_id', dealId)
          .maybeSingle();

        const [{ data: docsData }, { data: notesData }, { data: memo }] = await Promise.all([docsP, notesP, memoP]);
        if (cancelled) return;

        setDocs(((docsData || []) as any[]).map(d => ({
          id: d.id, filename: d.filename, category: d.category ?? null,
          size_bytes: d.size_bytes ?? null, chars_extracted: d.chars_extracted ?? null,
          created_at: d.created_at,
        })));

        const authorIds = [...new Set(((notesData || []) as any[]).map(n => n.author_id).filter(Boolean))];
        const authorMap = new Map<string, string>();
        if (authorIds.length) {
          const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', authorIds);
          for (const p of (profs || []) as any[]) {
            if (p.full_name) authorMap.set(p.user_id, p.full_name);
          }
        }
        setNotes(((notesData || []) as any[]).map(n => ({
          id: n.id, titre: n.titre ?? null, input_type: n.input_type || 'note',
          date_rdv: n.date_rdv ?? null, author_name: authorMap.get(n.author_id) ?? null,
          created_at: n.created_at,
        })));

        if (memo) {
          const { data: vers } = await supabase
            .from('memo_versions')
            .select('id')
            .eq('memo_id', (memo as any).id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (vers) {
            const { data: sections } = await supabase
              .from('memo_sections')
              .select('section_code, content_md')
              .eq('version_id', (vers as any).id);
            if (!cancelled) setExternal(extractExternalSources((sections || []) as any[]));
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Erreur chargement sources');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <header>
        <h2 className="text-base font-semibold">Sources & références</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Vue lecture seule de toutes les sources mobilisées pour ce mandat.
        </p>
      </header>

      {error && (
        <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold">Documents fournis par le mandant</h3>
          <Badge variant="outline" className="text-[10px]">{docs.length}</Badge>
        </div>
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucun document uploadé pour ce mandat.</p>
        ) : (
          <ul className="divide-y">
            {docs.map(d => (
              <li key={d.id} className="py-2 flex items-center gap-3 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.filename}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    {d.category && CATEGORY_LABELS[d.category as keyof typeof CATEGORY_LABELS] && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                        {CATEGORY_LABELS[d.category as keyof typeof CATEGORY_LABELS]}
                      </Badge>
                    )}
                    <span>{formatSize(d.size_bytes)}</span>
                    {d.chars_extracted != null && (
                      <span>· {d.chars_extracted.toLocaleString('fr-FR')} caractères extraits</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{shortDate(d.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold">Sources externes citées dans l'IM</h3>
          <Badge variant="outline" className="text-[10px]">{external.length}</Badge>
        </div>
        {external.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Aucune source externe détectée dans les sections IM (génère d'abord le memo pour voir les citations).
          </p>
        ) : (
          <ul className="space-y-2">
            {external.map((s, i) => (
              <li key={i} className="text-xs flex items-start gap-2 py-1.5 border-b last:border-b-0">
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono shrink-0">
                  {s.section_code}
                </Badge>
                <span className="flex-1 text-muted-foreground italic">"{s.excerpt}"</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold">Entretiens & notes</h3>
          <Badge variant="outline" className="text-[10px]">{notes.length}</Badge>
        </div>
        {notes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucun entretien enregistré pour ce mandat.</p>
        ) : (
          <ul className="divide-y">
            {notes.map(n => (
              <li key={n.id} className="py-2 flex items-center gap-3 text-xs">
                <span className="text-base shrink-0">{NOTE_TYPE_ICON[n.input_type] || '📝'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{n.titre || `${n.input_type[0].toUpperCase() + n.input_type.slice(1)} sans titre`}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {n.author_name || 'Auteur inconnu'}
                    {n.date_rdv ? ` · RDV ${shortDate(n.date_rdv)}` : ''}
                    {' · Créé ' + shortDate(n.created_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
