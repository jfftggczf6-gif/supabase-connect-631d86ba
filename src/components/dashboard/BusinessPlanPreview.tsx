import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, CheckCircle } from "lucide-react";
import MarketAnalysisSection from "./MarketAnalysisSection";
import SectionEditButton from "./SectionEditButton";
import EditableField from './EditableField';

interface BusinessPlanPreviewProps {
  data: Record<string, any>;
  enterpriseId?: string;
  deliverableId?: string;
  onUpdated?: () => void;
}

function Section({ title, children, editBtn, id }: { title: string; children: React.ReactNode; editBtn?: React.ReactNode; id?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} className="border border-border rounded-lg mb-3 overflow-hidden group scroll-mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 bg-white hover:bg-muted/30 transition-colors text-left"
      >
        <span className="font-semibold text-primary text-sm flex items-center gap-2">{title} {editBtn}</span>
        {open ? <ChevronDown size={16} className="text-primary" /> : <ChevronRight size={16} className="text-primary" />}
      </button>
      {open && <div className="px-5 py-4 text-sm text-foreground/80 space-y-2 bg-white">{children}</div>}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="list-disc list-inside space-y-1">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

function MultiText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="space-y-1">
      {String(text).split("\n").filter(l => l.trim()).map((line, i) => (
        <p key={i} className={line.trim().startsWith("•") || line.trim().startsWith("-") ? "pl-4" : ""}>{line}</p>
      ))}
    </div>
  );
}

function SwotTable({ swot }: { swot: Record<string, string[]> }) {
  const cells = [
    { title: "💪 Points forts", items: swot?.forces || [], cls: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" },
    { title: "⚠️ Faiblesses", items: swot?.faiblesses || [], cls: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" },
    { title: "🚀 Opportunités", items: swot?.opportunites || [], cls: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800" },
    { title: "🛡️ Menaces", items: swot?.menaces || [], cls: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cells.map(({ title, items, cls }) => (
        <div key={title} className={`rounded-lg p-3 border ${cls}`}>
          <p className="font-semibold text-xs mb-2">{title}</p>
          <ul className="space-y-1">
            {items.map((item, i) => <li key={i} className="text-xs">• {item}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FinancierTable({ tableau }: { tableau: Record<string, Record<string, string>> }) {
  const rows = [
    { label: "Contribution locale", key: "contrib_locale", bold: false },
    { label: "Prêts locaux", key: "prets_locaux", bold: false },
    { label: "Prêts étrangers (OVO)", key: "prets_etrangers", bold: false },
    { label: "Subventions", key: "subventions", bold: false },
    { label: "Total financement", key: "total", bold: true },
    { label: "Revenu", key: "revenu", bold: false },
    { label: "Dépenses", key: "depenses", bold: false },
    { label: "Marge brute", key: "marge_brute", bold: false },
    { label: "Bénéfice net", key: "benefice_net", bold: true },
    { label: "Seuil de rentabilité", key: "seuil_rentabilite", bold: true },
    { label: "Trésorerie finale", key: "tresorerie_finale", bold: true },
  ];
  const a = tableau || {};
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="text-left px-3 py-2 font-semibold border border-border">Plan financier</th>
            <th className="text-center px-3 py-2 font-semibold border border-border">1ère année</th>
            <th className="text-center px-3 py-2 font-semibold border border-border">2ème année</th>
            <th className="text-center px-3 py-2 font-semibold border border-border">3ème année</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key, bold }) => (
            <tr key={key} className={bold ? "bg-muted/50 font-semibold" : "hover:bg-muted/30"}>
              <td className="px-3 py-1.5 border border-border">{label}</td>
              <td className="px-3 py-1.5 border border-border text-center">{a.annee1?.[key] || "—"}</td>
              <td className="px-3 py-1.5 border border-border text-center">{a.annee2?.[key] || "—"}</td>
              <td className="px-3 py-1.5 border border-border text-center">{a.annee3?.[key] || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BusinessPlanPreview({ data, enterpriseId, deliverableId, onUpdated }: BusinessPlanPreviewProps) {
  const { t } = useTranslation();
  const bp = data || {};

  const editBtn = (sectionPath: string, sectionTitle: string) =>
    enterpriseId && onUpdated ? (
      <SectionEditButton enterpriseId={enterpriseId} deliverableType="business_plan" sectionPath={sectionPath} sectionTitle={sectionTitle} onUpdated={onUpdated} />
    ) : null;

  const editable = (fieldPath: string, value: any, mode: 'text' | 'number' = 'text', children: React.ReactNode) => {
    if (!enterpriseId || !deliverableId) return <>{children}</>;
    return (
      <EditableField enterpriseId={enterpriseId} deliverableId={deliverableId} deliverableType="business_plan" fieldPath={fieldPath} currentValue={value} mode={mode}>
        {children}
      </EditableField>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-display font-bold text-primary">{bp.company_name || "Business Plan"}</h2>
        {bp.tagline && <p className="text-muted-foreground text-sm italic">{bp.tagline}</p>}
      </div>

      {/* Table des matières — interactive */}
      <div className="rounded-lg border border-border bg-white p-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Table des matières</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div>
            <p className="font-semibold text-xs text-primary mb-1">I — Présentation</p>
            <ul className="space-y-0.5 text-xs">
              {[
                { id: 'bp-1', label: '1. Informations sur l\'entreprise' },
                { id: 'bp-2', label: '2. Résumé de la gestion' },
                { id: 'bp-3', label: '3. Revue historique' },
                { id: 'bp-4', label: '4. Vision, mission et valeurs' },
                { id: 'bp-5', label: '5. L\'entreprise' },
                { id: 'bp-6', label: '6. SWOT & Risques' },
              ].map(s => (
                <li key={s.id}><button onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="text-muted-foreground hover:text-primary hover:underline transition-colors text-left">{s.label}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-xs text-primary mb-1">II — Opérations</p>
            <ul className="space-y-0.5 text-xs">
              {[
                { id: 'bp-7', label: '7. Modèle de l\'entreprise' },
                { id: 'bp-8', label: '8. Marché & concurrence' },
                { id: 'bp-9', label: '9. Stratégie marketing' },
                { id: 'bp-10', label: '10. Équipe et organisation' },
              ].map(s => (
                <li key={s.id}><button onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="text-muted-foreground hover:text-primary hover:underline transition-colors text-left">{s.label}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-xs text-primary mb-1">III — Projet</p>
            <ul className="space-y-0.5 text-xs">
              {[
                { id: 'bp-11', label: '11. Description du projet' },
                { id: 'bp-12', label: '12. Impact' },
                { id: 'bp-13', label: '13. Financier' },
                { id: 'bp-14', label: '14. Attentes' },
              ].map(s => (
                <li key={s.id}><button onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="text-muted-foreground hover:text-primary hover:underline transition-colors text-left">{s.label}</button></li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* PARTIE I */}
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pt-2">PARTIE I — PRÉSENTATION DE L'ENTREPRISE</p>

      <Section title="1. Informations sur l'entreprise" id="bp-1">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          {[
            ["Fondateur", bp.founder], ["Email", bp.email], ["Site web", bp.website],
            ["Localisation", bp.location], ["Date de création", bp.date_creation],
            ["N° entreprise", bp.numero_entreprise],
          ].map(([label, val]) => (
            <div key={label as string} className="flex gap-2">
              <span className="font-medium text-muted-foreground min-w-[120px]">{label as string} :</span>
              <span>{(val as string) || "—"}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="2. Résumé de la gestion" id="bp-2" editBtn={editBtn('resume_gestion', 'Résumé de Gestion')}>
        {editable('resume_gestion', bp.resume_gestion, 'text', <MultiText text={bp.resume_gestion} />)}
      </Section>

      <Section title="3. Revue historique" id="bp-3" editBtn={editBtn('historique', 'Historique')}>
        {editable('historique', bp.historique, 'text', <MultiText text={bp.historique} />)}
      </Section>

      <Section title="4. Vision, mission et valeurs" id="bp-4" editBtn={editBtn('vision', 'Vision')}>
        <p className="font-medium text-muted-foreground mb-1">Vision</p>
        {editable('vision', bp.vision, 'text', <MultiText text={bp.vision} />)}
        <p className="font-medium text-muted-foreground mt-3 mb-1">Mission</p>
        {editable('mission', bp.mission, 'text', <MultiText text={bp.mission} />)}
        <p className="font-medium text-muted-foreground mt-3 mb-1">Valeurs</p>
        <BulletList items={bp.valeurs} />
      </Section>

      <Section title="5. L'entreprise" id="bp-5">
        <p className="font-medium text-muted-foreground mb-1">Description générale</p>
        {editable('description_generale', bp.description_generale, 'text', <MultiText text={bp.description_generale} />)}
        <p className="font-medium text-muted-foreground mt-3 mb-1">L'avenir</p>
        {editable('avenir', bp.avenir, 'text', <MultiText text={bp.avenir} />)}
      </Section>

      <Section title="6. SWOT & Gestion des risques" id="bp-6">
        <SwotTable swot={bp.swot} />
        <p className="font-medium text-muted-foreground mt-3 mb-1">Gestion des risques</p>
        <MultiText text={bp.gestion_risques} />
      </Section>

      {/* PARTIE II */}
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pt-2">PARTIE II — OPÉRATIONS COMMERCIALES</p>

      <Section title="7. Modèle de l'entreprise" id="bp-7">
        {[
          ["Produit / Proposition de valeur", bp.modele_produit],
          ["Clients & Canaux", bp.modele_clients],
          ["Revenus & Dépenses", bp.modele_revenus_depenses],
          ["Activités & Ressources", bp.modele_activites_ressources],
        ].map(([label, val]) => (
          <div key={label as string} className="mb-3">
            <p className="font-medium text-muted-foreground mb-1">{label as string}</p>
            <MultiText text={val as string} />
          </div>
        ))}
      </Section>

      <Section title="8. Marché, concurrence et environnement" id="bp-8" editBtn={editBtn('analyse_marche', 'Analyse de Marché')}>
        {bp.analyse_marche ? (
          <MarketAnalysisSection marche={bp.analyse_marche} />
        ) : (
          <>
            {[
              ["Marché & Potentiel", bp.marche_potentiel],
              ["Compétitivité", bp.competitivite],
              ["Tendances marché", bp.tendances_marche],
            ].map(([label, val]) => (
              <div key={label as string} className="mb-3">
                <p className="font-medium text-muted-foreground mb-1">{label as string}</p>
                <MultiText text={val as string} />
              </div>
            ))}
          </>
        )}
      </Section>

      <Section title="9. Stratégie marketing — Les 5P" id="bp-9" editBtn={editBtn('marketing_5p', 'Marketing 5P')}>
        {(["produit", "place", "prix", "promotion", "personnel"] as const).map((key, i) => (
          <div key={key} className="mb-3">
            <p className="font-medium text-muted-foreground mb-1">{["Produit", "Point(s) de vente", "Prix", "Promotion", "Personnel"][i]}</p>
            <MultiText text={bp.marketing_5p?.[key]} />
          </div>
        ))}
      </Section>

      <Section title="10. Équipe et organisation" id="bp-10" editBtn={editBtn('equipe', 'Équipe')}>
        {[
          ["Équipe de direction", bp.equipe_direction],
          ["Personnel", bp.personnel],
          ["Organigramme", bp.organigramme],
          ["Autres parties prenantes", bp.autres_parties],
        ].map(([label, val]) => (
          <div key={label as string} className="mb-3">
            <p className="font-medium text-muted-foreground mb-1">{label as string}</p>
            <MultiText text={val as string} />
          </div>
        ))}
      </Section>

      {/* PARTIE III */}
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pt-2">PARTIE III — VOTRE PROJET</p>

      <Section title="11. Description générale du projet" id="bp-11">
        <MultiText text={bp.projet_description} />
      </Section>

      <Section title="12. Impact" id="bp-12">
        <div className="space-y-2">
          <div><span className="font-medium">Social : </span><MultiText text={bp.impact_social} /></div>
          <div><span className="font-medium">Environnemental : </span><MultiText text={bp.impact_environnemental} /></div>
          <div><span className="font-medium">Économique : </span><MultiText text={bp.impact_economique} /></div>
        </div>
      </Section>

      <Section title="13. Financier" id="bp-13">
        <p className="font-medium text-muted-foreground mb-1">Plan d'investissement</p>
        <MultiText text={bp.investissement_plan} />
        <p className="font-medium text-muted-foreground mt-3 mb-2">Plan financier</p>
        <MultiText text={bp.financement_plan} />
        <div className="mt-3">
          <FinancierTable tableau={bp.financier_tableau} />
        </div>
      </Section>

      <Section title="14. Attentes vis-à-vis d'OVO" id="bp-14">
        <p className="font-medium text-muted-foreground mb-1">Financement demandé</p>
        <MultiText text={bp.ovo_financier} />
        <p className="font-medium text-muted-foreground mt-3 mb-1">Expertise souhaitée</p>
        <MultiText text={bp.ovo_expertise} />
      </Section>

      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
        <CheckCircle size={14} className="text-[hsl(var(--success))]" />
        Business Plan généré par esono · Format OVO officiel
      </div>
    </div>
  );
}
