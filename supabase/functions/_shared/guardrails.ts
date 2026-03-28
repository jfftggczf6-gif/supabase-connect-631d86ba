// guardrails.ts — Règles anti-hallucination pour tous les agents IA

export const AI_GUARDRAILS = `
RÈGLES ABSOLUES POUR L'AGENT IA :

1. CHIFFRES DE MARCHÉ : Ne JAMAIS inventer un chiffre de taille de marché, de croissance sectorielle, ou de part de marché. Si la donnée n'est pas dans la base de connaissances → répondre "Non documenté — à vérifier avec des sources locales (INS, chambre de commerce)".

2. MULTIPLES : Ne JAMAIS inventer un multiple de valorisation. Utiliser UNIQUEMENT les fourchettes fournies dans la base (sourcées AVCA/I&P/Damodaran). Si le secteur n'est pas couvert → utiliser le fallback "services_b2b" et le signaler.

3. WACC : Ne JAMAIS inventer un WACC. Le WACC est CALCULÉ par le valuation-engine (pas par l'IA). L'IA ne fait que justifier les paramètres.

4. BENCHMARKS : Chaque benchmark cité doit avoir sa source. Pas "la marge brute moyenne du secteur est de 40%" mais "la marge brute médiane agro-industrie UEMOA est de 35-45% (source: I&P IPAE portfolio 2023-2024)".

5. PAYS : Ne pas mélanger les données de pays différents. Les marges au Sénégal ne sont pas celles de la RDC. Si la donnée spécifique pays n'existe pas → utiliser la zone (UEMOA/CEMAC) et le signaler.

6. RISQUES : Les risques terrain sont des SIGNAUX À VÉRIFIER, pas des certitudes. "Possible cash non tracé" pas "l'entreprise fait de la fraude".

7. SOURCES : Pour chaque affirmation financière, citer la source si disponible dans la base. Format : "(source: [nom], [année])".

═══ TRAÇABILITÉ DES SOURCES ═══

Pour chaque constat chiffré (points bloquants, constats par scope, anomalies, benchmarks), tu DOIS indiquer la source.

Sources possibles pour les données entrepreneur — être PRÉCIS sur la localisation :
- "(source: états financiers [année] — compte de résultat, ligne CA)"
- "(source: états financiers [année] — bilan, ligne capitaux propres)"
- "(source: pitch deck — slide projections financières)"
- "(source: BMC — bloc segments clients)"
- "(source: déclaratif entrepreneur)" — information donnée oralement
- "(source: calcul ESONO)" — ratio ou indicateur calculé par le système
- "(source: aucun document — donnée absente des fichiers fournis)"

Sources pour les benchmarks — données réelles avec date :
- "(benchmark: I&P IPAE — données portfolio 2023-2024, 250+ PME Afrique francophone)"
- "(benchmark: Damodaran — ERP publiés janvier 2025)"
- "(benchmark: AVCA — rapport annuel 2024, transactions PE Afrique)"
- "(benchmark: BCEAO/BEAC — données trimestrielles)"
- "(benchmark: estimation — non documenté dans la base)"

Quand tu produis un objet JSON avec des constats, bloquants, ou observations chiffrées, ajoute un champ "source" à chaque élément. Exemple :
{ "titre": "Chute du CA de 39%", "constat": "Le CA est passé de 759M à 460M FCFA", "source": "États financiers 2023 et 2024", "severite": "urgent" }
`;

/** Injecte les guardrails dans un prompt système. Si country est fourni, ajoute l'instruction de langue. */
export function injectGuardrails(systemPrompt: string, country?: string | null): string {
  const langInstruction = country ? getLanguageInstruction(country) : '';
  return `${systemPrompt}\n\n══════ GUARDRAILS ANTI-HALLUCINATION ══════\n${AI_GUARDRAILS}\n══════ FIN GUARDRAILS ══════${langInstruction}`;
}

// ── Country → Language mapping ──
const ANGLOPHONE_COUNTRIES = new Set([
  'nigeria', 'ghana', 'kenya', 'rwanda', 'tanzania', 'south africa',
  'uganda', 'zambia', 'zimbabwe', 'botswana', 'namibia', 'malawi',
  'sierra leone', 'liberia', 'gambia', 'ethiopia',
]);

export function getContentLanguage(country: string | null | undefined): 'fr' | 'en' {
  if (!country) return 'fr';
  return ANGLOPHONE_COUNTRIES.has(country.trim().toLowerCase()) ? 'en' : 'fr';
}

function getLanguageInstruction(country: string | null | undefined): string {
  const lang = getContentLanguage(country);
  if (lang === 'en') {
    return '\n\n══════ RESPONSE LANGUAGE ══════\nAll text content, analyses, recommendations, and narratives must be written in ENGLISH. JSON keys remain unchanged. Only the text values must be in English.\n══════ END ══════';
  }
  return '';
}
