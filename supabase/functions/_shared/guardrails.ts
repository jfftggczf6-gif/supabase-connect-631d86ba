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

Sources possibles pour les données entrepreneur :
- "(source: états financiers [année])" — chiffre extrait d'un bilan ou compte de résultat
- "(source: pitch deck)" — chiffre mentionné dans la présentation
- "(source: BMC)" — information du business model canvas
- "(source: déclaratif entrepreneur)" — information donnée oralement
- "(source: calcul ESONO)" — ratio ou indicateur calculé par le système

Sources pour les benchmarks :
- "(benchmark: I&P IPAE 2023-2024)" — multiples ou marges issues du portefeuille I&P
- "(benchmark: AVCA 2024)" — données du rapport AVCA
- "(benchmark: Damodaran Jul 2025)" — ERP, WACC
- "(benchmark: estimation — non documenté dans la base)" — si pas de source fiable

Quand tu produis un objet JSON avec des constats, bloquants, ou observations chiffrées, ajoute un champ "source" à chaque élément. Exemple :
{ "titre": "Chute du CA de 39%", "constat": "Le CA est passé de 759M à 460M FCFA", "source": "États financiers 2023 et 2024", "severite": "urgent" }
`;

/** Injecte les guardrails dans un prompt système */
export function injectGuardrails(systemPrompt: string): string {
  return `${systemPrompt}\n\n══════ GUARDRAILS ANTI-HALLUCINATION ══════\n${AI_GUARDRAILS}\n══════ FIN GUARDRAILS ══════`;
}
