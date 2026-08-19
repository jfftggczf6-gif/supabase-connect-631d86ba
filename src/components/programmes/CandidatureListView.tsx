// Vue liste dédiée des candidatures (brief 1) — sélection multiple pour l'envoi
// groupé. Onglet à côté du Kanban (Kanban et drag&drop INCHANGÉS).
//
// Filtres cumulables statut + pays (le programme est fixe sur cette page). Les
// candidatures SANS pays ne sont jamais masquées en silence : quand un pays est
// filtré, elles apparaissent dans une section « Sans pays (N) » à part, avec sa
// propre case d'inclusion. « Tout sélectionner » porte sur le résultat filtré,
// le compte est affiché avant d'ouvrir le composeur.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, MapPinOff, Send } from 'lucide-react';
import { missingDocLabels } from '@/lib/candidature-missing-docs';

export interface ListCandidature {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: string;
  form_data?: Record<string, any> | null;
  documents?: any[] | null;
}

interface LastEmail { type: string; subject: string; sent_at: string; delivery_status: string }

const STATUS_LABELS: Record<string, string> = {
  received: 'Reçue', in_review: 'Reçue', waitlisted: 'Reçue',
  pre_selected: 'Pré-sélectionnée', selected: 'Sélectionnée', rejected: 'Rejetée',
};

const DELIVERY_LABELS: Record<string, string> = {
  queued: 'en file', sent: 'envoyé', delivered: 'remis', bounced: 'rebond',
  complained: 'plainte', failed: 'échec',
};
function deliveryTone(s: string): string {
  if (s === 'delivered' || s === 'sent') return 'border-emerald-300 text-emerald-700';
  if (s === 'bounced' || s === 'failed' || s === 'complained') return 'border-red-300 text-red-700';
  return 'border-muted-foreground/30 text-muted-foreground';
}

const paysOf = (c: ListCandidature) => String(c.form_data?.pays ?? '').trim();

export default function CandidatureListView({
  candidatures, programme, onCardClick, onOpenComposer,
}: {
  candidatures: ListCandidature[];
  programme: any;
  onCardClick: (id: string) => void;
  onOpenComposer: (recipients: ListCandidature[]) => void;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [paysFilter, setPaysFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeSansPays, setIncludeSansPays] = useState(false);
  const [lastEmails, setLastEmails] = useState<Record<string, LastEmail>>({});

  // Dernier e-mail envoyé par candidature (lu du journal candidature_emails).
  useEffect(() => {
    const ids = candidatures.map((c) => c.id);
    if (ids.length === 0) { setLastEmails({}); return; }
    let annule = false;
    (async () => {
      const { data } = await supabase
        .from('candidature_emails')
        .select('candidature_id, type, subject, sent_at, delivery_status')
        .in('candidature_id', ids)
        .order('sent_at', { ascending: false });
      if (annule) return;
      const map: Record<string, LastEmail> = {};
      for (const row of data ?? []) {
        if (!map[row.candidature_id]) {
          map[row.candidature_id] = { type: row.type, subject: row.subject, sent_at: row.sent_at, delivery_status: row.delivery_status };
        }
      }
      setLastEmails(map);
    })();
    return () => { annule = true; };
  }, [candidatures]);

  const paysDisponibles = useMemo(() => {
    const s = new Set<string>();
    for (const c of candidatures) { const p = paysOf(c); if (p) s.add(p); }
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [candidatures]);

  const matchStatut = (c: ListCandidature) =>
    statusFilter === 'all' || (STATUS_LABELS[c.status] === STATUS_LABELS[statusFilter]) || c.status === statusFilter;

  // Résultat filtré (hors « sans pays » quand un pays précis est choisi).
  const filtres = useMemo(
    () => candidatures.filter((c) => matchStatut(c) && (paysFilter === 'all' || paysOf(c) === paysFilter)),
    [candidatures, statusFilter, paysFilter],
  );
  // Candidatures sans pays, sorties à part UNIQUEMENT quand un pays précis est filtré.
  const sansPays = useMemo(
    () => (paysFilter === 'all' ? [] : candidatures.filter((c) => matchStatut(c) && !paysOf(c))),
    [candidatures, statusFilter, paysFilter],
  );

  const toggle = (id: string) => setSelected((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const filtresIds = filtres.map((c) => c.id);
  const tousFiltresSelectionnes = filtresIds.length > 0 && filtresIds.every((id) => selected.has(id));
  const toggleTousFiltres = () => setSelected((prev) => {
    const n = new Set(prev);
    if (tousFiltresSelectionnes) filtresIds.forEach((id) => n.delete(id));
    else filtresIds.forEach((id) => n.add(id));
    return n;
  });

  // Sélection effective = cases cochées, mais on ne garde les « sans pays » que si
  // la case d'inclusion est active (jamais inclus par accident).
  const sansPaysIds = new Set(sansPays.map((c) => c.id));
  const selectionEffective = candidatures.filter(
    (c) => selected.has(c.id) && (!sansPaysIds.has(c.id) || includeSansPays),
  );

  const Ligne = ({ c, flagSansPays }: { c: ListCandidature; flagSansPays?: boolean }) => {
    const manquantes = missingDocLabels(programme?.form_fields, c.documents).length;
    const last = lastEmails[c.id];
    const p = paysOf(c);
    return (
      <TableRow key={c.id} className="cursor-pointer" onClick={() => onCardClick(c.id)}>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} aria-label="Sélectionner" />
        </TableCell>
        <TableCell className="font-medium">{c.company_name || '—'}</TableCell>
        <TableCell>{c.contact_name || '—'}</TableCell>
        <TableCell><Badge variant="outline">{STATUS_LABELS[c.status] || c.status}</Badge></TableCell>
        <TableCell>
          {p ? p : <span className="inline-flex items-center gap-1 text-amber-700"><MapPinOff className="h-3 w-3" /> inconnu</span>}
        </TableCell>
        <TableCell className="text-center">
          {manquantes > 0 ? <span className="text-amber-700">{manquantes}</span> : <span className="text-muted-foreground">0</span>}
        </TableCell>
        <TableCell className="text-xs">
          {last ? (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{last.type === 'relance' ? 'Relance' : 'Comm.'} · {new Date(last.sent_at).toLocaleDateString('fr-FR')}</span>
              <Badge variant="outline" className={`text-[10px] ${deliveryTone(last.delivery_status)}`}>{DELIVERY_LABELS[last.delivery_status] || last.delivery_status}</Badge>
            </span>
          ) : <span className="text-muted-foreground">—</span>}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="received">Reçue</SelectItem>
            <SelectItem value="pre_selected">Pré-sélectionnée</SelectItem>
            <SelectItem value="selected">Sélectionnée</SelectItem>
            <SelectItem value="rejected">Rejetée</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paysFilter} onValueChange={(v) => { setPaysFilter(v); setIncludeSansPays(false); }}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Pays" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les pays</SelectItem>
            {paysDisponibles.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{selectionEffective.length} sélectionnée{selectionEffective.length > 1 ? 's' : ''}</span>
          <Button
            className="gap-2"
            disabled={selectionEffective.length === 0}
            onClick={() => onOpenComposer(selectionEffective)}
          >
            <Send className="h-4 w-4" /> Envoyer un e-mail groupé
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                checked={tousFiltresSelectionnes}
                onCheckedChange={toggleTousFiltres}
                aria-label="Tout sélectionner (résultat filtré)"
              />
            </TableHead>
            <TableHead>Entreprise</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Pays</TableHead>
            <TableHead className="text-center">Pièces manq.</TableHead>
            <TableHead>Dernier e-mail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtres.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Aucune candidature pour ce filtre.</TableCell></TableRow>
          )}
          {filtres.map((c) => <Ligne key={c.id} c={c} />)}
        </TableBody>
      </Table>

      {/* Section « Sans pays » — visible et signalée quand un pays précis est filtré,
          jamais masquée en silence, jamais incluse sans la case ci-dessous. */}
      {sansPays.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200">
            <MapPinOff className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Sans pays ({sansPays.length})</span>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Checkbox checked={includeSansPays} onCheckedChange={(v) => setIncludeSansPays(!!v)} />
              Inclure dans la sélection
            </label>
          </div>
          <Table>
            <TableBody>
              {sansPays.map((c) => <Ligne key={c.id} c={c} flagSansPays />)}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
