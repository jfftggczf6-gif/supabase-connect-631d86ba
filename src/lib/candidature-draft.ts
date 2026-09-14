// Brouillon local du formulaire public de candidature.
//
// Motif — signalé le 14/09 par un candidat ghanéen (ferme MSME-2K), après deux
// tentatives : « le formulaire se bloque ou devient vide. Lorsqu'ils tentent
// d'actualiser la page, celle-ci revient au début et toutes les informations
// saisies sont effacées. »
//
// La cause du blocage n'a pas été reproduite. Mais la PERTE, elle, n'était pas
// un incident : rien n'était sauvegardé pendant la saisie, nulle part. Le
// formulaire Ghana compte 22 questions personnalisées plus six champs de base.
// Un onglet fermé, un téléphone qui se verrouille, un rechargement — et tout
// était à refaire. Sur un candidat qui a déjà renoncé deux fois, c'est la perte
// qui décide, pas le bug.
//
// Ce module ne corrige donc pas le blocage : il en supprime la conséquence.
//
// PORTÉE. Le brouillon vit dans le navigateur du candidat, sur son appareil, et
// n'est jamais transmis. Il est effacé à la soumission réussie. Les fichiers
// joints n'y figurent pas — un File n'est pas sérialisable, et rien ne
// justifierait de recopier des pièces jointes dans le stockage du navigateur.

const PREFIXE = 'esono_candidature_draft_';

/** Au-delà, le brouillon est considéré périmé et ignoré. */
export const PEREMPTION_JOURS = 30;

export interface Brouillon {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  formData: Record<string, any>;
  displayLang: string | null;
  enregistreLe: string;
}

function cle(slug: string): string {
  return `${PREFIXE}${slug}`;
}

/** Vrai si le brouillon porte au moins une réponse. On n'écrit pas du vide. */
export function estVide(b: Omit<Brouillon, 'enregistreLe'>): boolean {
  if (b.companyName.trim() || b.contactName.trim() || b.contactEmail.trim() || b.contactPhone.trim()) {
    return false;
  }
  return Object.values(b.formData ?? {}).every((v) => {
    if (v == null) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
  });
}

/**
 * Écrit le brouillon. Silencieux en cas d'échec : un navigateur en navigation
 * privée, un quota plein ou un stockage désactivé ne doivent PAS casser la
 * saisie — le candidat perdrait alors bien plus que le brouillon.
 */
export function enregistrer(slug: string, b: Omit<Brouillon, 'enregistreLe'>): boolean {
  if (!slug || estVide(b)) return false;
  try {
    localStorage.setItem(cle(slug), JSON.stringify({ ...b, enregistreLe: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

/** Relit le brouillon. Renvoie null s'il est absent, illisible ou périmé. */
export function lire(slug: string, maintenant: Date = new Date()): Brouillon | null {
  if (!slug) return null;
  let brut: string | null = null;
  try {
    brut = localStorage.getItem(cle(slug));
  } catch {
    return null;
  }
  if (!brut) return null;

  let b: Brouillon;
  try {
    b = JSON.parse(brut);
  } catch {
    // Brouillon corrompu : on l'efface plutôt que de le laisser échouer à
    // chaque visite. Il n'y a rien à en tirer.
    effacer(slug);
    return null;
  }
  if (!b || typeof b !== 'object' || typeof b.enregistreLe !== 'string') return null;

  const age = maintenant.getTime() - new Date(b.enregistreLe).getTime();
  if (!Number.isFinite(age) || age > PEREMPTION_JOURS * 24 * 3600 * 1000) {
    effacer(slug);
    return null;
  }

  return {
    companyName: b.companyName ?? '',
    contactName: b.contactName ?? '',
    contactEmail: b.contactEmail ?? '',
    contactPhone: b.contactPhone ?? '',
    formData: b.formData ?? {},
    displayLang: b.displayLang ?? null,
    enregistreLe: b.enregistreLe,
  };
}

/** Efface le brouillon. Appelé à la soumission réussie et sur abandon explicite. */
export function effacer(slug: string): void {
  if (!slug) return;
  try {
    localStorage.removeItem(cle(slug));
  } catch {
    /* stockage indisponible : rien à effacer de toute façon */
  }
}
