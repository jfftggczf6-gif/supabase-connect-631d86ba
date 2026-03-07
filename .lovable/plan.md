

## Plan : Aligner le Word BP sur le template OVO original

Le document Word généré doit reproduire fidèlement la structure du template OVO officiel, comme si on remplissait le formulaire original avec les données de l'entreprise.

### Écarts identifiés entre le document actuel et le template OVO

1. **Page de couverture** : Manque le branding OVO ("entrepreneurs for entrepreneurs", "Sustainable cooperation with Africa", "Business Plan Guide 2025")
2. **Sommaire (page 2)** : Absent du document généré
3. **En-têtes/pieds de page** : Pas de header OVO ni de footer "Business Plan Guide 2025" sur chaque page
4. **Introduction** : Le template a 3 paragraphes explicatifs spécifiques, le code actuel n'en met qu'un
5. **Textes guides sous chaque section** : Le template inclut des questions directrices (ex: "Quand l'entreprise a-t-elle démarré ?") avant le contenu. Le code actuel saute directement au contenu IA
6. **Labels du tableau financier** : Différences mineures ("Contribution des entreprises locales" vs "Contribution locale", "Chiffre d'affaires au seuil de rentabilité" vs "Seuil de rentabilité", "Bilan final de la trésorerie" vs "Trésorerie finale")
7. **Section 12 Impact** : Le template a 3 sous-sections séparées avec intro, le code actuel fait 3 bullets inline

### Changements dans `supabase/functions/generate-business-plan/index.ts`

**1. Page de couverture enrichie**
- Ajouter les lignes de branding OVO : "entrepreneurs for entrepreneurs", "Sustainable cooperation with Africa"
- Ajouter "Business Plan Guide 2025" en bas de la couverture
- Structurer : Titre > Nom entreprise > Fondateur > Adresse > Email > Site web > Logo placeholder

**2. Ajouter un Sommaire (page 2)**
- Reproduire la table des matières du template : INTRODUCTION, PRÉSENTATION DE L'ENTREPRISE (1-6), OPÉRATIONS COMMERCIALES (7-10), VOTRE PROJET (11-14)
- Page break après

**3. En-têtes et pieds de page**
- Ajouter header avec "entrepreneurs for entrepreneurs" + "Sustainable cooperation with Africa"
- Ajouter footer "Business Plan Guide 2025" sur chaque page
- Utiliser la propriété `headers`/`footers` de la section docx

**4. Introduction fidèle au template**
- Reproduire les 3 paragraphes originaux du template (présentation, activités, projet)
- Ajouter le paragraphe sur l'importance du BP pour l'investisseur
- Ajouter la note sur la liberté d'utiliser un autre modèle

**5. Textes directeurs avant chaque contenu**
- Sous chaque h2, ajouter les questions guides du template en italique/gris AVANT le contenu IA
- Exemples : Section 3 "Revue historique" → ajouter les 3 questions ("Quand l'entreprise a-t-elle démarré ?", etc.) puis le contenu généré
- Cela reproduit l'effet "template rempli"

**6. Labels financiers corrigés**
- "Contribution locale" → "Contribution des entreprises locales"
- "Prêts bancaires locaux" → "Prêts bancaires locaux, taux d'intérêt"
- "Prêts de l'étranger" → "Prêts de l'étranger, taux d'intérêt"
- "Seuil de rentabilité" → "Chiffre d'affaires au seuil de rentabilité"
- "Trésorerie finale" → "Bilan final de la trésorerie"
- Ajouter la note italique exacte du template après le tableau

**7. Section 12 Impact restructurée**
- 3 sous-paragraphes séparés avec contexte (social, environnemental, économique) au lieu de 3 bullets
- Ajouter la note du template : "Le projet doit au moins avoir un impact positif sur l'un des domaines mentionnés"

Fichier unique modifié : `supabase/functions/generate-business-plan/index.ts` (fonction `generateWordDoc`)

