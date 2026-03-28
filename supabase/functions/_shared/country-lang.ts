// Country → AI response language mapping
const ANGLOPHONE_COUNTRIES = new Set([
  'nigeria', 'ghana', 'kenya', 'rwanda', 'tanzania', 'south africa',
  'uganda', 'zambia', 'zimbabwe', 'botswana', 'namibia', 'malawi',
  'sierra leone', 'liberia', 'gambia', 'ethiopia',
]);

/**
 * Returns the language code for AI-generated content based on country.
 * Francophone countries → 'fr', Anglophone → 'en'
 */
export function getContentLanguage(country: string | null | undefined): 'fr' | 'en' {
  if (!country) return 'fr';
  const c = country.trim().toLowerCase();
  return ANGLOPHONE_COUNTRIES.has(c) ? 'en' : 'fr';
}

/**
 * Returns the instruction to append to AI prompts for language control.
 */
export function getLanguageInstruction(country: string | null | undefined): string {
  const lang = getContentLanguage(country);
  if (lang === 'en') {
    return '\n\nLANGUE DE RÉPONSE : English. All text content, analyses, and recommendations must be written in English.';
  }
  return '';  // French is the default prompt language, no extra instruction needed
}
