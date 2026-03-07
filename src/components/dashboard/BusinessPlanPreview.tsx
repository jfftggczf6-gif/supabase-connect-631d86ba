import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle } from "lucide-react";

interface BusinessPlanPreviewProps {
  data: Record<string, any>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border rounded-lg mb-3 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        <span className="font-semibold text-primary text-sm">{title}</span>
        {open ? <ChevronDown size={16} className="text-primary" /> : <ChevronRight size={16} className="text-primary" />}
      </button>
      {open && <div className="px-5 py-4 text-sm text-foreground/80 space-y-2">{children}</div>}
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

export default function BusinessPlanPreview({ data }: BusinessPlanPreviewProps) {
  const bp = data || {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-display font-bold text-primary">{bp.company_name || "Business Plan"}</h2>
        {bp.tagline && <p className="text-muted-foreground text-sm italic">{bp.tagline}</p>}
      </div>

      {/* Navigation badges */}
      <div className="flex flex-wrap gap-2 py-2 border-b border-border">
        {["Présentation", "Opérations", "Projet"].map(part => (
          <span key={part} className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">{part}</span>
        ))}
      </div>

      {/* PARTIE I */}
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pt-2">PARTIE I — PRÉSENTATION DE L'ENTREPRISE</p>

      <Section title="1. Informations sur l'entreprise">
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

      <Section title="2. Résumé de la gestion">
        <MultiText text={bp.resume_gestion} />
      </Section>

      <Section title="3. Revue historique">
        <MultiText text={bp.historique} />
      </Section>

      <Section title="4. Vision, mission et valeurs">
        <p className="font-medium text-muted-foreground mb-1">Vision</p>
        <MultiText text={bp.vision} />
        <p className="font-medium text-muted-foreground mt-3 mb-1">Mission</p>
        <MultiText text={bp.mission} />
        <p className="font-medium text-muted-foreground mt-3 mb-1">Valeurs</p>
        <BulletList items={bp.valeurs} />
      </Section>

      <Section title="5. L'entreprise">
        <p className="font-medium text-muted-foreground mb-1">Description générale</p>
        <MultiText text={bp.description_generale} />
        <p className="font-medium text-muted-foreground mt-3 mb-1">L'avenir</p>
        <MultiText text={bp.avenir} />
      </Section>

      <Section title="6. SWOT & Gestion des risques">
        <SwotTable swot={bp.swot} />
        <p className="font-medium text-muted-foreground mt-3 mb-1">Gestion des risques</p>
        <MultiText text={bp.gestion_risques} />
      </Section>

      {/* PARTIE II */}
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pt-2">PARTIE II — OPÉRATIONS COMMERCIALES</p>

      <Section title="7. Modèle de l'entreprise">
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

      <Section title="8. Marché, concurrence et environnement">
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
      </Section>

      <Section title="9. Stratégie marketing — Les 5P">
        {(["produit", "place", "prix", "promotion", "personnel"] as const).map((key, i) => (
          <div key={key} className="mb-3">
            <p className="font-medium text-muted-foreground mb-1">{["Produit", "Point(s) de vente", "Prix", "Promotion", "Personnel"][i]}</p>
            <MultiText text={bp.marketing_5p?.[key]} />
          </div>
        ))}
      </Section>

      <Section title="10. Équipe et organisation">
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

      <Section title="11. Description générale du projet">
        <MultiText text={bp.projet_description} />
      </Section>

      <Section title="12. Impact">
        <div className="space-y-2">
          <div><span className="font-medium">Social : </span><MultiText text={bp.impact_social} /></div>
          <div><span className="font-medium">Environnemental : </span><MultiText text={bp.impact_environnemental} /></div>
          <div><span className="font-medium">Économique : </span><MultiText text={bp.impact_economique} /></div>
        </div>
      </Section>

      <Section title="13. Financier">
        <p className="font-medium text-muted-foreground mb-1">Plan d'investissement</p>
        <MultiText text={bp.investissement_plan} />
        <p className="font-medium text-muted-foreground mt-3 mb-2">Plan financier</p>
        <MultiText text={bp.financement_plan} />
        <div className="mt-3">
          <FinancierTable tableau={bp.financier_tableau} />
        </div>
      </Section>

      <Section title="14. Attentes vis-à-vis d'OVO">
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
