// SectionMetadataFooter — bloc gris sobre en bas de chaque section du memo PE.
// Regroupe les métadonnées process (auteurs, version, auto-gen, score) qui étaient
// précédemment éparpillées en haut de section dans des badges colorés.
// Style aligné sur la charte unifiée : noir/gris + violet pour titres, pas de couleurs.

interface MetaShape {
  redige_par?: string;
  data_par?: string;
  review_par?: string;
  valide_par?: string;
  version_label?: string;
  version_note?: string;
  auto_gen_note?: string;
  last_generated_at?: string;
  score_memo?: number;
}

interface FooterShape {
  auto_gen_summary?: string;
  last_generated_at?: string;
  sections_redigees?: number;
  sections_total?: number;
  validations_im?: number;
  validations_md?: number;
  score_memo?: number;
}

interface Props {
  meta?: MetaShape | null;
  footer?: FooterShape | null;
}

export default function SectionMetadataFooter({ meta, footer }: Props) {
  // Si rien à afficher, on ne rend rien
  const hasMeta = meta && (meta.redige_par || meta.data_par || meta.review_par || meta.valide_par || meta.version_label || meta.version_note || meta.auto_gen_note);
  const hasFooter = footer && (footer.auto_gen_summary || footer.last_generated_at || footer.score_memo != null || footer.sections_redigees != null);
  if (!hasMeta && !hasFooter) return null;

  return (
    <div className="border-t mt-6 pt-4 space-y-2 text-xs text-muted-foreground">
      <h5 className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">Métadonnées</h5>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        {meta?.redige_par && (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/70 shrink-0">Rédigé par :</dt>
            <dd>{meta.redige_par}</dd>
          </div>
        )}
        {meta?.data_par && (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/70 shrink-0">Data par :</dt>
            <dd>{meta.data_par}</dd>
          </div>
        )}
        {meta?.review_par && (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/70 shrink-0">Review par :</dt>
            <dd>{meta.review_par}</dd>
          </div>
        )}
        {meta?.valide_par && (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/70 shrink-0">Validé par :</dt>
            <dd>{meta.valide_par}</dd>
          </div>
        )}
        {meta?.version_label && (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/70 shrink-0">Version :</dt>
            <dd>{meta.version_label}</dd>
          </div>
        )}
        {(meta?.last_generated_at || footer?.last_generated_at) && (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/70 shrink-0">Dernière génération :</dt>
            <dd>{meta?.last_generated_at ?? footer?.last_generated_at}</dd>
          </div>
        )}
        {(meta?.score_memo != null || footer?.score_memo != null) && (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/70 shrink-0">Score memo :</dt>
            <dd>{meta?.score_memo ?? footer?.score_memo}/100</dd>
          </div>
        )}
        {footer?.sections_redigees != null && footer?.sections_total != null && (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/70 shrink-0">Sections rédigées :</dt>
            <dd>{footer.sections_redigees}/{footer.sections_total}</dd>
          </div>
        )}
        {footer?.validations_im != null && (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/70 shrink-0">Validées IM :</dt>
            <dd>{footer.validations_im}/{footer.sections_total ?? 12}</dd>
          </div>
        )}
        {footer?.validations_md != null && (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/70 shrink-0">Validées MD :</dt>
            <dd>{footer.validations_md}/{footer.sections_total ?? 12}</dd>
          </div>
        )}
      </dl>
      {meta?.version_note && (
        <p className="text-[11px] leading-relaxed mt-2 pt-2 border-t border-dashed border-border">
          <span className="font-medium text-foreground/70">Note version :</span> {meta.version_note}
        </p>
      )}
      {meta?.auto_gen_note && (
        <p className="text-[11px] leading-relaxed">
          <span className="font-medium text-foreground/70">Note auto-génération :</span> {meta.auto_gen_note}
        </p>
      )}
      {footer?.auto_gen_summary && (
        <p className="text-[11px] leading-relaxed">
          <span className="font-medium text-foreground/70">Résumé auto-gen :</span> {footer.auto_gen_summary}
        </p>
      )}
    </div>
  );
}
