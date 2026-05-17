// src/components/ba/sections/NotesRdvSection.tsx
// Section "Notes / RDV" du MandatShell. Brief notes_rdv_ba (Ordre 8.5).

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Loader2, MessageSquare, Sparkles, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { useBaDealNotes } from '@/hooks/useBaDealNotes';
import { NOTE_TYPE_META, type NoteInputType, type BaDealNote } from '@/types/notes-ba';

interface Props {
  dealId: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function NoteCard({ note, onApply }: { note: BaDealNote; onApply: (correctionId: string) => Promise<boolean> }) {
  const meta = NOTE_TYPE_META[note.input_type];
  const applied = note.corrections_applied ?? [];
  const corrections = note.infos_extraites ?? [];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.icon}</span>
          <div>
            <div className="text-sm font-semibold">{note.titre || `${meta.label} sans titre`}</div>
            <div className="text-[10px] text-muted-foreground">
              {note.author_name || 'Auteur inconnu'} ·{' '}
              {note.date_rdv ? `RDV : ${formatDate(note.date_rdv)} · ` : ''}
              Créé : {formatDate(note.created_at)}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] ${meta.color}`}>{meta.label}</Badge>
      </div>

      <div className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/80 mt-2 max-h-[150px] overflow-y-auto">
        {note.raw_content}
      </div>

      {note.resume_ia && (
        <div className="mt-3 pt-3 border-t bg-violet-50/30 -mx-4 px-4 py-2 rounded">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3 w-3 text-violet-600" />
            <span className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide">Résumé IA</span>
          </div>
          <p className="text-xs text-muted-foreground italic">{note.resume_ia}</p>
        </div>
      )}

      {corrections.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
              {corrections.length} correction{corrections.length > 1 ? 's' : ''} détectée{corrections.length > 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-1.5">
            {corrections.map(c => {
              const isApplied = applied.includes(c.id);
              return (
                <li key={c.id} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono shrink-0">
                    {c.section_code}
                  </Badge>
                  <span className="flex-1 text-muted-foreground">{c.description}</span>
                  {isApplied ? (
                    <Badge variant="outline" className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                      <Check className="h-2.5 w-2.5" /> Appliqué
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={async () => {
                        const ok = await onApply(c.id);
                        if (ok) toast.success(`${c.section_code} marqué comme à mettre à jour`);
                      }}
                    >
                      Mettre à jour
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

function AddNoteDialog({
  open, onOpenChange, dealId,
}: { open: boolean; onOpenChange: (v: boolean) => void; dealId: string }) {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { createNote, creating } = useBaDealNotes(dealId, currentOrg?.id, user?.id);

  const [type, setType] = useState<NoteInputType>('rdv');
  const [titre, setTitre] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState('');

  const reset = () => { setType('rdv'); setTitre(''); setDate(new Date().toISOString().slice(0, 10)); setContent(''); };

  const handleSubmit = async () => {
    const result = await createNote({
      input_type: type,
      titre: titre.trim(),
      date_rdv: type === 'rdv' || type === 'appel' ? date : null,
      raw_content: content.trim(),
    });
    if (result !== null) {
      toast.success('Note ajoutée — analyse IA lancée');
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!creating) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une note</DialogTitle>
          <DialogDescription className="text-xs">
            L'IA analysera automatiquement le contenu pour détecter des corrections à apporter aux sections IM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as NoteInputType)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">📝 Note</SelectItem>
                  <SelectItem value="rdv">🤝 RDV</SelectItem>
                  <SelectItem value="appel">📞 Appel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Date {type === 'note' && '(optionnelle)'}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={creating} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Titre / Personne rencontrée</Label>
            <Input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: RDV avec K. Cissé (CEO)"
              disabled={creating}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Contenu *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Décrivez les échanges, points clés, données chiffrées mentionnées, prochaines étapes…"
              rows={8}
              disabled={creating}
              className="text-xs font-sans"
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {content.length} caractères (10 min)
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={creating || content.trim().length < 10}>
            {creating ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analyse IA…</> : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function NotesRdvSection({ dealId }: Props) {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { notes, loading, error, markCorrectionApplied, reload } = useBaDealNotes(dealId, currentOrg?.id, user?.id);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4 max-w-4xl">
      <Card className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span><strong>{notes.length}</strong> note{notes.length > 1 ? 's' : ''} enregistrée{notes.length > 1 ? 's' : ''}</span>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Ajouter une note
        </Button>
      </Card>

      {error && <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 text-xs">{error}</Card>}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : notes.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <h3 className="text-sm font-semibold mb-1">Aucune note pour ce mandat</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Documentez vos RDV avec le mandant, vos appels, vos observations. L'IA détecte les corrections à apporter aux sections IM.
          </p>
          <Button size="sm" onClick={() => setAddOpen(true)} variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Première note
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onApply={(cid) => markCorrectionApplied(note.id, cid)}
            />
          ))}
        </div>
      )}

      <AddNoteDialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) reload(); }} dealId={dealId} />
    </div>
  );
}
