// Détecteur de chaînes françaises en dur dans le chemin de rendu du diagnostic.
//
// Pourquoi une règle et pas un inventaire : le recensement manuel du 2026-09-10
// annonçait cinq sites de comparaison, il y en avait sept, et « une soixantaine
// de libellés » dans le générateur — chiffre non vérifié. Un inventaire humain
// se périme à la première édition. Cette règle, elle, tourne à chaque commit.
//
// Détection sur DEUX critères, chacun suffisant :
//   1. littéral de chaîne contenant un diacritique français ;
//   2. littéral figurant dans la colonne `fr` de diagnostic_labels — ce qui
//      attrape « Marge », « Contact » ou « Impact », sans accent mais bien
//      traduisibles.
//
// Toute exception doit être ajoutée à ALLOWLIST **avec sa raison**. Une entrée
// sans justification est un aveu de dette, pas une exemption.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { seedFrenchValues } from './helpers/label-seed';

const ROOT = path.resolve(__dirname, '../..');

/** Fichiers du chemin de rendu : ce que voit un lecteur de diagnostic. */
const RENDER_PATH_FILES = [
  'src/components/programmes/CandidatureDetailDrawer.tsx',
  'src/lib/export-candidature-report-pdf.ts',
  'src/lib/candidature-format.ts',
];

/**
 * Exceptions légitimes, chacune justifiée.
 *
 * Règle d'admission : la chaîne ne doit JAMAIS atteindre l'œil d'un lecteur de
 * diagnostic dans une langue autre que celle où elle est écrite.
 */
const ALLOWLIST: { value: string; why: string }[] = [
  // ── Valeurs STOCKÉES, comparées et non affichées ──────────────────────────
  // Ces chaînes sont les valeurs françaises écrites par le modèle dans
  // screening_data. Le code les compare via enumIs() pour décider d'une couleur
  // ou d'un seuil ; l'affichage passe systématiquement par L.enumLabel().
  // Les traduire casserait la comparaison sans rien gagner à l'écran.
  { value: 'Élevée', why: 'valeur stockée (fiabilite) comparée par enumIs, affichée via enumLabel' },
  { value: 'Élevé', why: 'valeur stockée (niveau_endettement) comparée par enumIs, affichée via enumLabel' },
  { value: 'élevée', why: 'valeur stockée (probabilite, minuscule au schéma) comparée par enumIs' },
  { value: 'Faible', why: 'valeur stockée (fiabilite) comparée par enumIs pour la couleur' },
  { value: 'Rentable', why: 'valeur stockée (rentabilite) comparée par enumIs pour la couleur' },
  { value: 'Déficitaire', why: 'valeur stockée (rentabilite) comparée par enumIs pour la couleur' },
  { value: 'Critique', why: 'valeur stockée (tresorerie_estimee) comparée par enumIs pour la couleur' },
  { value: 'Tendue', why: 'valeur stockée (tresorerie_estimee) comparée par enumIs pour la couleur' },
  { value: 'Cohérent', why: 'valeur stockée (coherence_vs_ca) comparée par enumIs pour la couleur' },
  { value: 'Déclaratif uniquement', why: 'valeur stockée (traction.niveau_preuve) comparée par enumIs' },
  { value: 'moyenne', why: 'valeur stockée (probabilite) comparée par enumIs pour la couleur' },
  { value: 'Forte', why: 'valeur stockée (mesurabilite) comparée par enumIs pour la couleur' },
  { value: 'Solide', why: 'valeur stockée (niveau_preuve) comparée par enumIs pour la couleur' },
  { value: 'Au-dessus', why: 'valeur stockée (benchmark.position_vs_secteur) comparée par enumIs, affichée via enumLabel' },
  { value: 'En-dessous', why: 'valeur stockée (benchmark.position_vs_secteur) comparée par enumIs, affichée via enumLabel' },
  { value: 'INFO', why: 'valeur stockée (incoherences.severite) comparée pour la couleur du badge' },
  { value: 'ATTENTION', why: 'valeur stockée (incoherences.severite) comparée pour la couleur du badge' },
  { value: 'BLOQUANT', why: 'valeur stockée (incoherences.severite) comparée pour la couleur du badge' },

  // ── Textes adressés à l'OPÉRATEUR, pas au lecteur du diagnostic ───────────
  // Chef de programme et coordinateurs travaillent en français. Ces chaînes
  // relèvent de l'i18n d'interface (t()), chantier distinct — elles n'entrent
  // jamais dans un diagnostic ni dans un document exporté.
  { value: 'Erreur', why: 'titre de toast opérateur — relève de l\'i18n d\'interface, hors document' },
  { value: 'Téléchargement impossible', why: 'toast opérateur, jamais présent dans un document exporté' },
  { value: 'Transfer relancé', why: 'toast opérateur, jamais présent dans un document exporté' },
  { value: 'Générer la version EN', why: 'bouton opérateur ; le chef de programme travaille en français' },
  { value: 'Langue du diagnostic', why: 'aria-label du sélecteur, adressé à l\'opérateur' },
  { value: 'Envoyer au candidat un lien pour re-déposer ses documents', why: 'infobulle opérateur sur une action, hors document' },
  { value: 'Envoyer un message à ce candidat', why: 'infobulle opérateur sur une action, hors document' },
  { value: 'Référentiel de libellés injoignable — export annulé. Le document aurait été produit avec des libellés manquants.', why: 'message d\'erreur technique levé vers l\'opérateur, jamais rendu dans un document' },

  // ── Métadonnées ───────────────────────────────────────────────────────────
  { value: 'Segoe UI', why: 'nom de police CSS, ce n\'est pas du texte lisible' },
];

const ALLOWED = new Set(ALLOWLIST.map((a) => a.value));

const DIACRITIC = /[àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ]/;

/** Extrait les littéraux de chaîne d'un source TS/TSX (simple et suffisant ici). */
function stringLiterals(src: string): { value: string; line: number }[] {
  const out: { value: string; line: number }[] = [];
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // On saute les lignes de commentaire : elles n'atteignent aucun lecteur.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const v = (m[1] ?? m[2] ?? '').trim();
      if (v) out.push({ value: v, line: i + 1 });
    }
  });
  return out;
}

/** Texte JSX nu : `>Ancienneté :<`, qui n'est pas un littéral de chaîne. */
function jsxText(src: string): { value: string; line: number }[] {
  const out: { value: string; line: number }[] = [];
  src.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    const re = />([^<>{}\n]{2,60})</g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const v = m[1].trim();
      if (v && /[A-Za-zÀ-ÿ]{2,}/.test(v)) out.push({ value: v, line: i + 1 });
    }
  });
  return out;
}

interface Finding { file: string; line: number; value: string; reason: string }

function scan(): Finding[] {
  const frValues = seedFrenchValues();
  const findings: Finding[] = [];

  for (const rel of RENDER_PATH_FILES) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
    const candidates = [...stringLiterals(src), ...jsxText(src)];

    for (const c of candidates) {
      if (ALLOWED.has(c.value)) continue;
      // Le référentiel lui-même contient ses valeurs françaises : normal.
      if (rel.includes('diagnostic-labels')) continue;

      const inReferential = frValues.has(c.value) || frValues.has(c.value.replace(/\s*:$/, ''));
      const hasDiacritic = DIACRITIC.test(c.value);
      if (!inReferential && !hasDiacritic) continue;

      // Un appel L.label('champ.x') n'est pas un littéral français.
      if (/^[a-z_]+\.[a-z_0-9]+$/.test(c.value)) continue;
      // Classes utilitaires Tailwind, sélecteurs, unités.
      if (/^[a-z-]+(\s+[a-z0-9:/[\]#.%-]+)*$/.test(c.value) && !hasDiacritic) continue;

      findings.push({
        file: rel,
        line: c.line,
        value: c.value,
        reason: hasDiacritic ? 'diacritique' : 'présent dans diagnostic_labels.fr',
      });
    }
  }
  return findings;
}

describe('aucune chaîne française en dur dans le chemin de rendu', () => {
  it('viewer et générateur passent par le référentiel', () => {
    const findings = scan();

    if (findings.length) {
      const report = findings
        .map((f) => `  ${f.file}:${f.line}  « ${f.value} »  [${f.reason}]`)
        .join('\n');
      throw new Error(
        `${findings.length} chaîne(s) française(s) en dur dans le chemin de rendu.\n` +
        `Chacune doit passer par L.label()/L.enumLabel(), ou rejoindre ALLOWLIST avec sa raison.\n\n` +
        report,
      );
    }
    expect(findings).toEqual([]);
  });

  it('chaque exception porte une justification', () => {
    for (const a of ALLOWLIST) {
      expect(a.why.length, `exception sans raison : « ${a.value} »`).toBeGreaterThan(10);
    }
  });
});
