// Garde-fou d'envoi — chantier e-mails candidats (août 2026).
//
// Rend RÉVERSIBLE le NOUVEAU type d'envoi ('communication') : tant que
// ALLOWLIST_ACTIVE est vrai, une communication ne peut atteindre aucune adresse
// hors de la liste blanche interne. Les PLAFONDS, eux, encadrent les DEUX types.
//
// La levée de l'allowlist est une ÉTAPE NOMMÉE (feu vert explicite requis) :
//   1. journal vérifié sur des envois internes réels
//   2. levée (ALLOWLIST_ACTIVE = false) sur feu vert
//   3. premier envoi réel vers UN destinataire désigné
//   4. vérification du journal et de la réception
//   5. seulement ensuite, la cohorte
//
// Tout est appliqué DANS l'edge function d'envoi, jamais côté front.

export type TypeEnvoi = "relance" | "communication";

/**
 * Tant que vrai : les types soumis à l'allowlist (cf. ALLOWLIST_PAR_TYPE) sont bridés.
 * LEVÉE le 20/08/2026 sur feu vert explicite (recette du chantier effectuée) :
 * les communications peuvent désormais atteindre de vrais candidats. Les PLAFONDS
 * (30/opération, 150/jour/org) restent en vigueur — cf. plus bas.
 */
export const ALLOWLIST_ACTIVE = false;

// ─────────────────────────────────────────────────────────────────────────────
// À QUELS TYPES L'ALLOWLIST S'APPLIQUE — décision structurante, à lire telle quelle.
//
// Le garde-fou protège ce qu'on CONSTRUIT, pas ce qui tourne déjà.
// La relance documentaire est en production depuis des mois et n'est PAS touchée
// par ce chantier. La soumettre à l'allowlist reviendrait à la geler en prod :
// une panne qu'on s'inflige, invisible côté OVO jusqu'à ce qu'un entrepreneur
// cesse d'être relancé. On ne bride donc que le NOUVEAU type, 'communication'.
//
// Ce booléen par type décide, concrètement, si la production continue de
// fonctionner. Le laisser lisible ici est délibéré : dans trois mois, on doit
// comprendre d'un coup d'œil ce qu'il tient.
// ─────────────────────────────────────────────────────────────────────────────
export const ALLOWLIST_PAR_TYPE: Record<TypeEnvoi, boolean> = {
  relance: false, // existant, en prod depuis des mois — JAMAIS bridé par l'allowlist
  communication: true, // nouveau — bridé tant que ALLOWLIST_ACTIVE
};

/** Adresses internes autorisées pendant le chantier (forme de base, sans sous-adressage). */
export const ALLOWLIST_CHANTIER: readonly string[] = [
  "adiallo23@gmail.com", // Kadry (coach OVO) — Gmail : test de rendu critère 6
  "sellarts.ci@gmail.com", // compte porteur — Gmail
  "philyace@gmail.com", // dev — Gmail
];

/** Plafonds nommés — filet anti-boucle emballée, appliqués aux DEUX types. */
export const MAX_DESTINATAIRES_PAR_OPERATION = 30;
export const MAX_ENVOIS_PAR_JOUR_PAR_ORG = 150;

/**
 * Normalise une adresse pour la comparaison à la liste blanche :
 *  - minuscules + trim
 *  - retire le SOUS-ADRESSAGE : `locale+tag@domaine` → `locale@domaine`.
 * Permet de tester l'envoi groupé avec N destinataires distincts
 * (locale+1@, locale+2@…) sans jamais approcher une adresse de candidat.
 */
export function normaliserPourAllowlist(email: string): string {
  const e = (email || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return e;
  const locale = e.slice(0, at).split("+")[0];
  const domaine = e.slice(at + 1);
  return `${locale}@${domaine}`;
}

/** Appartenance brute à la liste blanche (sous-adressage normalisé). */
export function estDansAllowlist(email: string): boolean {
  return ALLOWLIST_CHANTIER.includes(normaliserPourAllowlist(email));
}

/** L'allowlist bride-t-elle CE type d'envoi en ce moment ? */
export function allowlistSApplique(type: TypeEnvoi): boolean {
  return ALLOWLIST_ACTIVE && ALLOWLIST_PAR_TYPE[type];
}

export interface VerdictGardeFou {
  autorise: boolean;
  refuses: { email: string; motif: string }[]; // à journaliser (delivery_status='failed')
  motif_operation?: string;                     // refus global (plafond) — rien n'est envoyé
}

/**
 * Vérifie une opération d'envoi complète AVANT tout envoi.
 * `envoisAujourdhuiPourOrg` est lu du journal candidature_emails (compte du jour, par org).
 *
 * Plafonds : les DEUX types. Allowlist : seulement les types soumis (ALLOWLIST_PAR_TYPE).
 */
export function verifierOperation(params: {
  type: TypeEnvoi;
  destinataires: string[];
  envoisAujourdhuiPourOrg: number;
}): VerdictGardeFou {
  const { type, destinataires, envoisAujourdhuiPourOrg } = params;

  // 1. Plafond par opération — LES DEUX TYPES
  if (destinataires.length > MAX_DESTINATAIRES_PAR_OPERATION) {
    return {
      autorise: false, refuses: [],
      motif_operation: `Plafond par opération dépassé : ${destinataires.length} destinataires (maximum ${MAX_DESTINATAIRES_PAR_OPERATION}).`,
    };
  }
  // 2. Plafond quotidien par organisation — LES DEUX TYPES
  if (envoisAujourdhuiPourOrg + destinataires.length > MAX_ENVOIS_PAR_JOUR_PAR_ORG) {
    return {
      autorise: false, refuses: [],
      motif_operation: `Plafond quotidien de l'organisation dépassé : ${envoisAujourdhuiPourOrg} déjà envoyés + ${destinataires.length} demandés > ${MAX_ENVOIS_PAR_JOUR_PAR_ORG}.`,
    };
  }
  // 3. Liste blanche — seulement pour les types qui y sont soumis
  const refuses = allowlistSApplique(type)
    ? destinataires
        .filter((email) => !estDansAllowlist(email))
        .map((email) => ({ email, motif: "Hors liste blanche du chantier (garde-fou actif)." }))
    : [];

  return { autorise: refuses.length === 0, refuses };
}
