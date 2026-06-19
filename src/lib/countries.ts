// Liste bilingue (FR/EN) des pays africains pour les formulaires publics.
// `value` = nom canonique (FR) stocké en base, indépendant de la langue d'affichage.
// `fr` / `en` = libellés affichés selon la langue courante de l'interface.

export interface CountryOption {
  value: string;
  fr: string;
  en: string;
}

export const AFRICAN_COUNTRIES: CountryOption[] = [
  { value: 'Afrique du Sud', fr: 'Afrique du Sud', en: 'South Africa' },
  { value: 'Algérie', fr: 'Algérie', en: 'Algeria' },
  { value: 'Angola', fr: 'Angola', en: 'Angola' },
  { value: 'Bénin', fr: 'Bénin', en: 'Benin' },
  { value: 'Botswana', fr: 'Botswana', en: 'Botswana' },
  { value: 'Burkina Faso', fr: 'Burkina Faso', en: 'Burkina Faso' },
  { value: 'Burundi', fr: 'Burundi', en: 'Burundi' },
  { value: 'Cameroun', fr: 'Cameroun', en: 'Cameroon' },
  { value: 'Cap-Vert', fr: 'Cap-Vert', en: 'Cape Verde' },
  { value: 'Comores', fr: 'Comores', en: 'Comoros' },
  { value: 'Congo', fr: 'Congo (Brazzaville)', en: 'Congo (Brazzaville)' },
  { value: "Côte d'Ivoire", fr: "Côte d'Ivoire", en: 'Ivory Coast' },
  { value: 'Djibouti', fr: 'Djibouti', en: 'Djibouti' },
  { value: 'Égypte', fr: 'Égypte', en: 'Egypt' },
  { value: 'Érythrée', fr: 'Érythrée', en: 'Eritrea' },
  { value: 'Eswatini', fr: 'Eswatini', en: 'Eswatini' },
  { value: 'Éthiopie', fr: 'Éthiopie', en: 'Ethiopia' },
  { value: 'Gabon', fr: 'Gabon', en: 'Gabon' },
  { value: 'Gambie', fr: 'Gambie', en: 'Gambia' },
  { value: 'Ghana', fr: 'Ghana', en: 'Ghana' },
  { value: 'Guinée', fr: 'Guinée', en: 'Guinea' },
  { value: 'Guinée-Bissau', fr: 'Guinée-Bissau', en: 'Guinea-Bissau' },
  { value: 'Guinée équatoriale', fr: 'Guinée équatoriale', en: 'Equatorial Guinea' },
  { value: 'Kenya', fr: 'Kenya', en: 'Kenya' },
  { value: 'Lesotho', fr: 'Lesotho', en: 'Lesotho' },
  { value: 'Liberia', fr: 'Liberia', en: 'Liberia' },
  { value: 'Libye', fr: 'Libye', en: 'Libya' },
  { value: 'Madagascar', fr: 'Madagascar', en: 'Madagascar' },
  { value: 'Malawi', fr: 'Malawi', en: 'Malawi' },
  { value: 'Mali', fr: 'Mali', en: 'Mali' },
  { value: 'Maroc', fr: 'Maroc', en: 'Morocco' },
  { value: 'Maurice', fr: 'Maurice', en: 'Mauritius' },
  { value: 'Mauritanie', fr: 'Mauritanie', en: 'Mauritania' },
  { value: 'Mozambique', fr: 'Mozambique', en: 'Mozambique' },
  { value: 'Namibie', fr: 'Namibie', en: 'Namibia' },
  { value: 'Niger', fr: 'Niger', en: 'Niger' },
  { value: 'Nigeria', fr: 'Nigeria', en: 'Nigeria' },
  { value: 'Ouganda', fr: 'Ouganda', en: 'Uganda' },
  { value: 'RD Congo', fr: 'RD Congo', en: 'DR Congo' },
  { value: 'République centrafricaine', fr: 'République centrafricaine', en: 'Central African Republic' },
  { value: 'Rwanda', fr: 'Rwanda', en: 'Rwanda' },
  { value: 'São Tomé-et-Principe', fr: 'São Tomé-et-Principe', en: 'São Tomé and Príncipe' },
  { value: 'Sénégal', fr: 'Sénégal', en: 'Senegal' },
  { value: 'Seychelles', fr: 'Seychelles', en: 'Seychelles' },
  { value: 'Sierra Leone', fr: 'Sierra Leone', en: 'Sierra Leone' },
  { value: 'Somalie', fr: 'Somalie', en: 'Somalia' },
  { value: 'Soudan', fr: 'Soudan', en: 'Sudan' },
  { value: 'Soudan du Sud', fr: 'Soudan du Sud', en: 'South Sudan' },
  { value: 'Tanzanie', fr: 'Tanzanie', en: 'Tanzania' },
  { value: 'Tchad', fr: 'Tchad', en: 'Chad' },
  { value: 'Togo', fr: 'Togo', en: 'Togo' },
  { value: 'Tunisie', fr: 'Tunisie', en: 'Tunisia' },
  { value: 'Zambie', fr: 'Zambie', en: 'Zambia' },
  { value: 'Zimbabwe', fr: 'Zimbabwe', en: 'Zimbabwe' },
];

// Retourne la liste triée par libellé dans la langue donnée (+ "Autre"/"Other" en fin).
export function getSortedCountries(lang: string): { value: string; label: string }[] {
  const isEn = lang.startsWith('en');
  const list = AFRICAN_COUNTRIES.map(c => ({ value: c.value, label: isEn ? c.en : c.fr }))
    .sort((a, b) => a.label.localeCompare(b.label, isEn ? 'en' : 'fr'));
  list.push({ value: 'Autre', label: isEn ? 'Other' : 'Autre' });
  return list;
}
