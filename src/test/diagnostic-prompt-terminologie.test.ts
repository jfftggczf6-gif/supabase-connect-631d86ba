// Une seule vérité par terme.
//
// Le produit porte deux mécanismes de traduction, et c'est délibéré :
//
//   • `diagnostic_labels` — indexé par (FAMILLE, valeur). Il habille des
//     énumérations fermées, connues du schéma, affichées à des endroits précis.
//     Il sait que « Forte » se dit « High » pour une barrière à l'entrée et
//     « Strong » pour une mesurabilité, parce qu'il connaît le champ.
//
//   • Le bloc de terminologie de RENDER_DIAGNOSTIC v3 — indexé par MOT SEUL.
//     Il s'adresse au modèle, qui reçoit une appréciation isolée sans contexte.
//     Il ne peut pas distinguer les champs : un mot, une traduction.
//
// Les deux sont nécessaires — le premier ne couvre pas ce que le modèle rédige,
// le second ne peut pas être aussi fin. Mais s'ils se recouvrent en divergeant,
// le même document porte deux traductions du même mot français. C'est une
// seconde vérité, réintroduite par le mécanisme censé l'empêcher.
//
// Ce n'est pas hypothétique : la première rédaction du bloc verrouillait
// « Forte » sur « Strong » quand le référentiel le rend « High » pour
// barriere_entree. La cause était des variantes de genre ajoutées à la main,
// absentes du schéma. D'où les deux assertions de ce fichier : le bloc ne couvre
// que des valeurs du schéma, et tout recouvrement concorde.

import { describe, it, expect } from 'vitest';
import { normalizeEnum } from '@/lib/diagnostic-labels';
import { seedLabelRows } from './helpers/label-seed';
import { vocabulaireVerrouille, systemPromptV3, abreviationsProscritesDuPrompt, versionPrompt } from './helpers/terminologie-seed';
import { ABREVIATIONS_PROSCRITES, SIGLES_INVARIANTS } from '@/lib/prose-controls';

const VOCABULAIRE = vocabulaireVerrouille();
const ENUMS = seedLabelRows().filter((r) => r.match_fr);

/**
 * Valeurs déclarées par SCREENING_SCHEMA pour les deux champs passés en prose.
 *
 * Copiées de esono-ai-worker/api/agents/screen_candidatures.py — clés
 * `diagnostic_dimensions` (l. 96-102) et `risques_programme` (l. 185). Le worker
 * n'est pas dans ce dépôt ; cette liste est donc le point où une évolution du
 * schéma doit être répercutée, et l'assertion ci-dessous la rend visible : un
 * libellé ajouté au schéma et oublié au prompt fait échouer le test.
 */
const VALEURS_DU_SCHEMA: readonly string[] = [
  // diagnostic_dimensions[].label
  'Mature', 'En croissance', 'Démarrage', 'Pré-démarrage',
  'Solide', 'Correcte', 'Fragile', 'Insuffisante',
  'Fort', 'Modéré', 'Limité',
  'Significatif', 'Faible', 'Non évaluable',
  'Excellent', 'Bon', 'Moyen', 'Insuffisant',
  // risques_programme[].type
  'financier', 'opérationnel', 'réputationnel', 'exécution', 'concentration',
];

/**
 * Divergences ACCEPTÉES, chacune avec sa raison. Sans raison écrite, c'est une
 * dette, pas une exemption — et la liste doit rester courte, sinon l'assertion
 * ne protège plus rien.
 */
const DIVERGENCES_ADMISES: { terme: string; famille: string; pourquoi: string }[] = [
  {
    terme: 'Faible', famille: 'probabilite',
    pourquoi:
      "casse seulement : le référentiel rend « low » en minuscule pour la probabilité " +
      "d'un risque, parce que le schéma la stocke en minuscule (« faible | moyenne | " +
      "élevée »), là où un libellé de dimension est capitalisé. Deux champs distincts, " +
      "même mot anglais, casse différente — pas deux traductions.",
  },
];
const ADMISE = new Set(DIVERGENCES_ADMISES.map((d) => `${normalizeEnum(d.terme)}::${d.famille}`));

describe('le bloc de terminologie ne couvre que des valeurs du schéma', () => {
  it('aucun terme inventé', () => {
    const attendus = new Set(VALEURS_DU_SCHEMA);
    const inventes = Object.keys(VOCABULAIRE).filter((t) => !attendus.has(t));
    expect(
      inventes,
      `termes verrouillés absents de SCREENING_SCHEMA : ${inventes.join(', ')}.\n` +
      `Un terme hors schéma n'a aucune garantie d'être le seul sens du mot — c'est ` +
      `ainsi que « Forte » a été verrouillé sur « Strong » contre « High » au référentiel.`,
    ).toEqual([]);
  });

  it('aucune valeur du schéma oubliée', () => {
    const manquants = VALEURS_DU_SCHEMA.filter((t) => !(t in VOCABULAIRE));
    expect(
      manquants,
      `valeurs du schéma absentes du bloc de terminologie : ${manquants.join(', ')}`,
    ).toEqual([]);
  });

  it('le prompt annonce que les valeurs hors table restent libres', () => {
    // Sans cette phrase, le modèle pourrait tenir la table pour exhaustive et
    // buter sur une valeur non prévue plutôt que de la traduire.
    expect(systemPromptV3()).toMatch(/ABSENTE de cette table se traduit librement/);
  });
});

describe('concordance entre diagnostic_labels et le bloc de terminologie', () => {
  it('tout terme couvert par les deux reçoit la même traduction', () => {
    const divergences: string[] = [];
    for (const [termeFr, termeEn] of Object.entries(VOCABULAIRE)) {
      const n = normalizeEnum(termeFr);
      for (const row of ENUMS) {
        if (normalizeEnum(row.fr) !== n) continue;
        if (row.en === termeEn) continue;
        if (ADMISE.has(`${n}::${row.category}`)) continue;
        divergences.push(
          `« ${termeFr} » → prompt « ${termeEn} » / diagnostic_labels « ${row.en} »   [${row.category}]`,
        );
      }
    }
    expect(
      divergences,
      `${divergences.length} terme(s) traduit(s) différemment par les deux mécanismes.\n` +
      `Le même document porterait les deux formes. Aligner l'un sur l'autre, ou ` +
      `déclarer la divergence dans DIVERGENCES_ADMISES avec sa raison :\n` +
      divergences.map((d) => `   ${d}`).join('\n'),
    ).toEqual([]);
  });

  it('chaque divergence admise porte une raison, et existe encore', () => {
    for (const d of DIVERGENCES_ADMISES) {
      expect(d.pourquoi.length, `divergence sans raison : « ${d.terme} »`).toBeGreaterThan(40);
      // Une exception qui ne correspond plus à rien doit être retirée, sinon la
      // liste se remplit de permissions mortes qui couvriront un vrai défaut.
      const existe = ENUMS.some(
        (r) => r.category === d.famille && normalizeEnum(r.fr) === normalizeEnum(d.terme),
      );
      expect(existe, `divergence admise obsolète : « ${d.terme} » n'existe plus dans ${d.famille}`).toBe(true);
    }
  });

  it('le détecteur attrape une divergence réelle', () => {
    // Contre-épreuve sur le cas historique : « Forte » verrouillé sur « Strong »
    // alors que diagnostic_labels le rend « High » pour barriere_entree.
    const barriereForte = ENUMS.find(
      (r) => r.category === 'barriere_entree' && normalizeEnum(r.fr) === normalizeEnum('Forte'),
    );
    expect(barriereForte?.en).toBe('High');
    expect(barriereForte!.en === 'Strong').toBe(false);
  });

  it('les recouvrements concordants sont bien réels — l\'assertion n\'est pas vide', () => {
    // Une assertion de concordance qui ne recouvre rien passerait toujours.
    const recouvrements = Object.keys(VOCABULAIRE).filter((t) =>
      ENUMS.some((r) => normalizeEnum(r.fr) === normalizeEnum(t)),
    );
    expect(recouvrements.length, 'aucun recouvrement : l\'assertion ne prouve rien').toBeGreaterThanOrEqual(5);
  });
});


// ═══ Bloc C — abréviations françaises proscrites ════════════════════════════
//
// Le prompt PORTE le registre (consigne au modèle) et prose-controls.ts le
// CONTRÔLE (assertion sur le rendu). Deux endroits, un seul contenu possible :
// s'ils divergent, le modèle serait instruit d'une règle et jugé sur une autre.
// C'est la même exigence que pour le vocabulaire verrouillé du bloc A.

describe('bloc C — le prompt et le détecteur disent la même chose', () => {
  const DU_PROMPT = abreviationsProscritesDuPrompt();

  it('le bloc C existe et n\'est pas vide', () => {
    expect(Object.keys(DU_PROMPT).length).toBeGreaterThanOrEqual(14);
  });

  it('toute abréviation proscrite au prompt est contrôlée par le détecteur', () => {
    const manquantes = Object.keys(DU_PROMPT).filter((a) => !(a in ABREVIATIONS_PROSCRITES));
    expect(
      manquantes,
      `abréviations interdites au modèle mais non contrôlées au rendu : ${manquantes.join(', ')}.\n` +
      `Le modèle serait instruit d'une règle et jugé sur une autre.`,
    ).toEqual([]);
  });

  it('toute abréviation contrôlée est aussi interdite au prompt', () => {
    const manquantes = Object.keys(ABREVIATIONS_PROSCRITES).filter((a) => !(a in DU_PROMPT));
    expect(
      manquantes,
      `abréviations contrôlées au rendu mais non interdites au modèle : ${manquantes.join(', ')}.\n` +
      `Le rendu échouerait sur une règle que le modèle n'a jamais reçue.`,
    ).toEqual([]);
  });

  it('les équivalents anglais concordent', () => {
    const divergences: string[] = [];
    for (const [fr, en] of Object.entries(DU_PROMPT)) {
      const attendu = ABREVIATIONS_PROSCRITES[fr];
      if (attendu && attendu.toLowerCase() !== en.toLowerCase()) {
        divergences.push(`« ${fr} » → prompt « ${en} » / détecteur « ${attendu} »`);
      }
    }
    expect(divergences, divergences.join('\n')).toEqual([]);
  });

  it('le prompt rappelle que les sigles d\'institutions ne sont pas concernés', () => {
    // Sans cette phrase, le modèle pourrait traduire « ORC » ou « GRA », qui
    // sont des noms propres. Le détecteur les déclare invariants ; le prompt
    // doit le dire aussi.
    const corps = systemPromptV3();
    expect(corps).toMatch(/ne sont pas concern|NE SONT PAS concern/i);
    for (const sigle of ['ORC', 'GRA', 'ISO', 'EUR']) {
      expect(sigle in SIGLES_INVARIANTS, `${sigle} devrait être déclaré invariant`).toBe(true);
    }
  });

  it('les tests valident bien la version de prompt la plus récente', () => {
    // Garde contre le mode de défaillance le plus bête : une version ajoutée en
    // base pendant que les tests continuent de valider la précédente.
    expect(versionPrompt()).toBeGreaterThanOrEqual(4);
  });
});
