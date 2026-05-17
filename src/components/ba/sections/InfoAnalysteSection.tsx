// src/components/ba/sections/InfoAnalysteSection.tsx
// Section "Informations entreprise" du MandatShell.
// Brief info_analyste (Ordre 8) — 8 critères.
//
// 5 sous-sections : Identité · Actionnariat · Management · Activité · Financier.
// Pré-remplissage IA via EF extract-ba-info (Claude Sonnet sur document_content).

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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Loader2, Sparkles, Plus, Trash2, Building2, Users, Briefcase, FileText,
  TrendingUp, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInfoAnalysteBa } from '@/hooks/useInfoAnalysteBa';
import {
  LEGAL_FORMS, makeRowId,
  type IdentityInfo, type Shareholder, type ManagementMember,
  type ActivityInfo, type FinancialsSynth,
} from '@/types/info-analyste-ba';

interface Props {
  dealId: string;
}

function Section({
  title, Icon, aiFilled, children,
}: {
  title: string;
  Icon: typeof Building2;
  aiFilled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </h3>
        {aiFilled && (
          <Badge variant="outline" className="text-[10px] bg-violet-100 text-violet-700 border-violet-200 gap-1">
            <Sparkles className="h-2.5 w-2.5" /> Pré-rempli par IA
          </Badge>
        )}
      </div>
      {children}
    </Card>
  );
}

function ChipInput({
  label, values, onChange, placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setInput('');
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={add}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {values.map(v => (
            <Badge key={v} variant="secondary" className="text-[10px] gap-1 pr-1 pl-2 py-0.5">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter(x => x !== v))}
                className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InfoAnalysteSection({ dealId }: Props) {
  const { info, snapshot, loading, saving, aiLoading, error, saveSection, runAiPrefill } = useInfoAnalysteBa(dealId);

  // Drafts locaux par section pour permettre Annuler
  const [draftIdentity, setDraftIdentity] = useState<IdentityInfo | null>(null);
  const [draftShareholders, setDraftShareholders] = useState<Shareholder[] | null>(null);
  const [draftManagement, setDraftManagement] = useState<ManagementMember[] | null>(null);
  const [draftActivity, setDraftActivity] = useState<ActivityInfo | null>(null);
  const [draftFinancials, setDraftFinancials] = useState<FinancialsSynth | null>(null);

  const identity = draftIdentity ?? info.identity;
  const shareholders = draftShareholders ?? info.shareholders;
  const management = draftManagement ?? info.management;
  const activity = draftActivity ?? info.activity;
  const financials = draftFinancials ?? info.financials;

  const aiFilled = snapshot?.ba_info_ai_filled ?? false;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!snapshot) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-6 w-6 mx-auto mb-2 text-rose-500" />
        <h3 className="text-sm font-semibold">Pas d'entreprise rattachée</h3>
        <p className="text-xs text-muted-foreground mt-1">{error || 'Ce mandat n\'a pas encore d\'enterprise liée.'}</p>
      </Card>
    );
  }

  const totalPct = shareholders.reduce((s, sh) => s + (sh.pct || 0), 0);
  const pctOk = Math.abs(totalPct - 100) < 0.01 || shareholders.length === 0;

  const handleAi = async () => {
    if (!snapshot.document_content && (snapshot.document_files_count ?? 0) === 0) {
      toast.warning('Uploadez d\'abord les documents du mandant');
      return;
    }
    const ok = await runAiPrefill();
    if (ok) toast.success('Pré-remplissage IA terminé');
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Bandeau IA */}
      <Card className="p-3 flex items-center justify-between bg-gradient-to-r from-violet-50 to-blue-50 border-violet-200">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span>
            <strong>Pré-remplissage IA</strong> depuis les documents uploadés (Claude Sonnet).
            {aiFilled && <span className="text-emerald-700 ml-1.5">✓ Déjà appliqué</span>}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-violet-700 border-violet-300 hover:bg-violet-100"
          onClick={handleAi}
          disabled={aiLoading}
        >
          {aiLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Analyse…</> : <><Sparkles className="h-3 w-3" /> {aiFilled ? 'Re-analyser' : 'Lancer le pré-remplissage'}</>}
        </Button>
      </Card>

      {error && <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 text-xs">{error}</Card>}

      {/* SECTION 1 — Identité */}
      <Section title="Identité" Icon={Building2} aiFilled={aiFilled && !draftIdentity}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">RCCM</Label>
            <Input value={identity.rccm} onChange={(e) => setDraftIdentity({ ...identity, rccm: e.target.value })}
              placeholder="CI-ABJ-2020-B-12345" disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date de création</Label>
            <Input type="date" value={identity.date_creation_iso}
              onChange={(e) => setDraftIdentity({ ...identity, date_creation_iso: e.target.value })} disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Forme juridique</Label>
            <Select value={identity.legal_form || 'Autre'}
              onValueChange={(v) => setDraftIdentity({ ...identity, legal_form: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {LEGAL_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Capital social (XOF)</Label>
            <Input type="number" value={identity.capital_social ?? ''}
              onChange={(e) => setDraftIdentity({ ...identity, capital_social: e.target.value ? Number(e.target.value) : null })}
              placeholder="10 000 000" disabled={saving} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          {draftIdentity && (
            <Button variant="ghost" size="sm" onClick={() => setDraftIdentity(null)} disabled={saving}>Annuler</Button>
          )}
          <Button size="sm" onClick={async () => {
            const ok = await saveSection('identity', identity);
            if (ok) { setDraftIdentity(null); toast.success('Identité sauvegardée'); }
          }} disabled={!draftIdentity || saving}>
            {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> …</> : 'Sauvegarder'}
          </Button>
        </div>
      </Section>

      {/* SECTION 2 — Actionnariat */}
      <Section title="Actionnariat" Icon={Users} aiFilled={aiFilled && !draftShareholders && info.shareholders.length > 0}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Actionnaire</TableHead>
              <TableHead className="text-xs w-24">% capital</TableHead>
              <TableHead className="text-xs">Rôle</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shareholders.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground italic text-xs py-4">Aucun actionnaire renseigné</TableCell></TableRow>
            ) : shareholders.map((sh, i) => (
              <TableRow key={sh.id}>
                <TableCell>
                  <Input value={sh.name} onChange={(e) => {
                    const next = [...shareholders]; next[i] = { ...sh, name: e.target.value };
                    setDraftShareholders(next);
                  }} className="h-8 text-xs" />
                </TableCell>
                <TableCell>
                  <Input type="number" value={sh.pct} step={0.1} min={0} max={100} onChange={(e) => {
                    const next = [...shareholders]; next[i] = { ...sh, pct: Number(e.target.value) || 0 };
                    setDraftShareholders(next);
                  }} className="h-8 text-xs" />
                </TableCell>
                <TableCell>
                  <Input value={sh.role} onChange={(e) => {
                    const next = [...shareholders]; next[i] = { ...sh, role: e.target.value };
                    setDraftShareholders(next);
                  }} placeholder="Fondateur / Investisseur / …" className="h-8 text-xs" />
                </TableCell>
                <TableCell>
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600"
                    onClick={() => setDraftShareholders(shareholders.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between mt-2">
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() =>
            setDraftShareholders([...shareholders, { id: makeRowId(), name: '', pct: 0, role: '' }])
          }>
            <Plus className="h-3 w-3" /> Ajouter
          </Button>
          {shareholders.length > 0 && (
            <span className={`text-xs ${pctOk ? 'text-emerald-600' : 'text-rose-600'} font-semibold`}>
              {pctOk ? <CheckCircle2 className="inline h-3 w-3 mr-1" /> : <AlertCircle className="inline h-3 w-3 mr-1" />}
              Total : {totalPct.toFixed(1)}%
              {!pctOk && ' (devrait totaliser 100%)'}
            </span>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          {draftShareholders && (
            <Button variant="ghost" size="sm" onClick={() => setDraftShareholders(null)} disabled={saving}>Annuler</Button>
          )}
          <Button size="sm" onClick={async () => {
            const ok = await saveSection('shareholders', shareholders);
            if (ok) { setDraftShareholders(null); toast.success('Actionnariat sauvegardé'); }
          }} disabled={!draftShareholders || saving || !pctOk}>
            {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> …</> : 'Sauvegarder'}
          </Button>
        </div>
      </Section>

      {/* SECTION 3 — Management */}
      <Section title="Management clé" Icon={Users} aiFilled={aiFilled && !draftManagement && info.management.length > 0}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Nom</TableHead>
              <TableHead className="text-xs">Fonction</TableHead>
              <TableHead className="text-xs w-32">Ancienneté</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {management.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground italic text-xs py-4">Aucun manager renseigné</TableCell></TableRow>
            ) : management.map((m, i) => (
              <TableRow key={m.id}>
                <TableCell>
                  <Input value={m.name} onChange={(e) => {
                    const next = [...management]; next[i] = { ...m, name: e.target.value };
                    setDraftManagement(next);
                  }} className="h-8 text-xs" />
                </TableCell>
                <TableCell>
                  <Input value={m.role} placeholder="CEO / CFO / Directeur…"
                    onChange={(e) => {
                      const next = [...management]; next[i] = { ...m, role: e.target.value };
                      setDraftManagement(next);
                    }} className="h-8 text-xs" />
                </TableCell>
                <TableCell>
                  <Input type="number" value={m.anciennete_years} min={0} max={60}
                    onChange={(e) => {
                      const next = [...management]; next[i] = { ...m, anciennete_years: Number(e.target.value) || 0 };
                      setDraftManagement(next);
                    }} className="h-8 text-xs" />
                </TableCell>
                <TableCell>
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600"
                    onClick={() => setDraftManagement(management.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-start">
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() =>
            setDraftManagement([...management, { id: makeRowId(), name: '', role: '', anciennete_years: 0 }])
          }>
            <Plus className="h-3 w-3" /> Ajouter
          </Button>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          {draftManagement && (
            <Button variant="ghost" size="sm" onClick={() => setDraftManagement(null)} disabled={saving}>Annuler</Button>
          )}
          <Button size="sm" onClick={async () => {
            const ok = await saveSection('management', management);
            if (ok) { setDraftManagement(null); toast.success('Management sauvegardé'); }
          }} disabled={!draftManagement || saving}>
            {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> …</> : 'Sauvegarder'}
          </Button>
        </div>
      </Section>

      {/* SECTION 4 — Activité */}
      <Section title="Activité" Icon={Briefcase} aiFilled={aiFilled && !draftActivity && info.activity.description.length > 0}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Description détaillée</Label>
            <Textarea value={activity.description}
              onChange={(e) => setDraftActivity({ ...activity, description: e.target.value })}
              rows={3} disabled={saving} placeholder="Activité, produits, services, business model…" />
          </div>
          <ChipInput label="Produits / Services" values={activity.products}
            onChange={(products) => setDraftActivity({ ...activity, products })}
            placeholder="Ex: Solutions de paiement mobile" />
          <ChipInput label="Marchés cibles" values={activity.markets}
            onChange={(markets) => setDraftActivity({ ...activity, markets })}
            placeholder="Ex: PME UEMOA, B2B" />
          <ChipInput label="Clients clés" values={activity.key_clients}
            onChange={(key_clients) => setDraftActivity({ ...activity, key_clients })}
            placeholder="Ex: BCEAO, Total Sénégal" />
          <div className="space-y-1.5">
            <Label className="text-xs">Avantages compétitifs</Label>
            <Textarea value={activity.competitive_advantages}
              onChange={(e) => setDraftActivity({ ...activity, competitive_advantages: e.target.value })}
              rows={3} disabled={saving} placeholder="USP, moats, différenciation…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          {draftActivity && (
            <Button variant="ghost" size="sm" onClick={() => setDraftActivity(null)} disabled={saving}>Annuler</Button>
          )}
          <Button size="sm" onClick={async () => {
            const ok = await saveSection('activity', activity);
            if (ok) { setDraftActivity(null); toast.success('Activité sauvegardée'); }
          }} disabled={!draftActivity || saving}>
            {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> …</> : 'Sauvegarder'}
          </Button>
        </div>
      </Section>

      {/* SECTION 5 — Financier */}
      <Section title="Données financières synthétiques" Icon={TrendingUp} aiFilled={aiFilled && !draftFinancials && (info.financials.ca_n != null)}>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">CA N ({financials.currency})</Label>
            <Input type="number" value={financials.ca_n ?? ''} onChange={(e) =>
              setDraftFinancials({ ...financials, ca_n: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CA N-1</Label>
            <Input type="number" value={financials.ca_n_1 ?? ''} onChange={(e) =>
              setDraftFinancials({ ...financials, ca_n_1: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CA N-2</Label>
            <Input type="number" value={financials.ca_n_2 ?? ''} onChange={(e) =>
              setDraftFinancials({ ...financials, ca_n_2: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">EBITDA N</Label>
            <Input type="number" value={financials.ebitda_n ?? ''} onChange={(e) =>
              setDraftFinancials({ ...financials, ebitda_n: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Marge EBITDA (%)</Label>
            <Input type="number" step={0.1} value={financials.marge_ebitda_n ?? ''} onChange={(e) =>
              setDraftFinancials({ ...financials, marge_ebitda_n: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dette totale</Label>
            <Input type="number" value={financials.dette_totale ?? ''} onChange={(e) =>
              setDraftFinancials({ ...financials, dette_totale: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          {draftFinancials && (
            <Button variant="ghost" size="sm" onClick={() => setDraftFinancials(null)} disabled={saving}>Annuler</Button>
          )}
          <Button size="sm" onClick={async () => {
            const ok = await saveSection('financials', financials);
            if (ok) { setDraftFinancials(null); toast.success('Données financières sauvegardées'); }
          }} disabled={!draftFinancials || saving}>
            {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> …</> : 'Sauvegarder'}
          </Button>
        </div>
      </Section>
    </div>
  );
}
