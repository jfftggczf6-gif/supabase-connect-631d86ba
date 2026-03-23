import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ExternalLink, FileText, Upload } from 'lucide-react';

interface SourcesViewerProps {
  coachUploads?: { filename: string; category: string; created_at: string }[];
}

const BENCHMARK_SOURCES = [
  {
    name: "Damodaran Online",
    description: "Equity Risk Premiums par pays, WACC, betas sectoriels",
    url: "https://pages.stern.nyu.edu/~adamodar/",
    snapshot: "Données publiées janvier 2025",
    used_for: "WACC, ERP, décotes pays",
  },
  {
    name: "AVCA — African Private Equity Report",
    description: "Transactions PE réelles en Afrique, multiples sectoriels documentés",
    url: "https://www.avca.africa/research-publications/",
    snapshot: "Rapport annuel 2024 (485 deals, $5.5B)",
    used_for: "Multiples sectoriels, taille des deals",
  },
  {
    name: "I&P — IPAE Portfolio",
    description: "Données de 250+ PME accompagnées en Afrique francophone",
    url: "https://www.ietp.com/",
    snapshot: "Données portfolio 2023-2024",
    used_for: "Marges sectorielles, multiples PME, benchmarks opérationnels",
  },
  {
    name: "BCEAO / BEAC",
    description: "Données macroéconomiques officielles zone UEMOA et CEMAC",
    url: "https://www.bceao.int/",
    snapshot: "Données trimestrielles",
    used_for: "Taux directeurs, inflation, données monétaires",
  },
  {
    name: "Banque Mondiale",
    description: "Indicateurs climat des affaires par pays",
    url: "https://www.worldbank.org/",
    snapshot: "Données annuelles",
    used_for: "Risque pays, environnement réglementaire",
  },
  {
    name: "OHADA — SYSCOHADA révisé 2017",
    description: "Normes comptables applicables en zone OHADA",
    url: "https://www.ohada.org/",
    snapshot: "Référentiel en vigueur",
    used_for: "Structure des états financiers, nomenclature comptable",
  },
];

export default function SourcesViewer({ coachUploads }: SourcesViewerProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-display font-bold">Sources & références</h2>
      </div>

      {/* Section 1 — Documents entrepreneur */}
      {coachUploads && coachUploads.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Upload className="h-3.5 w-3.5" />
            Documents uploadés
          </h3>
          <div className="space-y-2">
            {coachUploads.map((doc, i) => (
              <div key={i} className="border rounded-lg p-3 bg-card">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {doc.category} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2 — Références et benchmarks */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5" />
          Références et benchmarks utilisés
        </h3>
        <div className="space-y-2">
          {BENCHMARK_SOURCES.map((source, i) => (
            <div key={i} className="border rounded-lg p-3 bg-card">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground">{source.description}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Utilisé pour : {source.used_for} · {source.snapshot}
                  </p>
                </div>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary border border-primary/30 rounded px-2 py-1 hover:bg-primary/5 transition-colors flex items-center gap-1 flex-shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                  Voir le site
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
