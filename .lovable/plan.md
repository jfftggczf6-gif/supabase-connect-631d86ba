

## Diagnostic

### Bug 1: Boutons d'upload Sources dans la Vue Miroir
Les boutons "BMC & Impact Social", "Inputs Financiers" et "Documents supplémentaires" dans la sidebar de la Vue Miroir (onglet `mirror`) réutilisent les mêmes refs (`bmcInputRef`, `inputsInputRef`, `suppInputRef`) que l'onglet Parcours Rapide. Or les éléments `<input type="file" hidden>` correspondants ne sont rendus que dans l'onglet `parcours`. Quand l'utilisateur est sur l'onglet `mirror`, ces inputs n'existent pas dans le DOM → `.click()` ne fait rien.

**Solution**: Ajouter des `<input type="file" hidden>` dédiés dans le bloc mirror, avec des refs séparées (`mirrorBmcRef`, `mirrorInputsRef`, `mirrorSuppRef`), ou déplacer les inputs existants en dehors du bloc conditionnel `detailTab === 'parcours'`.

**Approche retenue** (plus simple): Déplacer les 3 `<input>` hidden hors des blocs conditionnels de tabs, juste après la fermeture des tabs, pour qu'ils soient toujours dans le DOM quel que soit l'onglet actif.

### Fichier modifié
- `src/components/dashboard/CoachDashboard.tsx`:
  - Retirer les 3 `<input ref={bmcInputRef}>`, `<input ref={inputsInputRef}>`, `<input ref={suppInputRef}>` de l'intérieur du bloc `parcours`
  - Les placer juste avant la fermeture du conteneur principal du detail view, en dehors de tout `{detailTab === ...}` conditionnel

---

### Info: Structure du Rapport IA Détaillé (`generate-coach-report`)

Le rapport est un document HTML complet généré par Claude Sonnet 4, avec cette structure :

1. **Page de garde** — Nom entreprise, secteur, pays, date, nom du coach, score global
2. **Table des matières**
3. **Résumé exécutif** (1-2 pages) — Forces, faiblesses, potentiel
4. **Section 1 : Présentation de l'entreprise** — Contexte, historique, positionnement
5. **Section 2 : Analyse du modèle économique (BMC)** — Proposition de valeur, segments, canaux, partenaires, revenus
6. **Section 3 : Impact social et développement durable (SIC + ODD)** — Mission sociale, théorie du changement, alignement ODD, recommandations ESG
7. **Section 4 : Analyse financière historique** — Compte de résultat, bilan, ratios
8. **Section 5 : Projections financières et scénarios** — Revenue 5 ans, TRI, VAN, ROI, seuil de rentabilité
9. **Section 6 : Business Plan** — Résumé, analyse de marché, stratégie commerciale, plan opérationnel
10. **Section 7 : Diagnostic global et SWOT** — Forces/faiblesses/opportunités/menaces, score par dimension
11. **Section 8 : Recommandations stratégiques et plan d'action** — Priorités court/moyen/long terme, KPIs
12. **Annexe** — Tableau récapitulatif des scores par module

**Note importante** : Ce rapport utilise actuellement l'API Anthropic directement avec une clé `ANTHROPIC_API_KEY`. L'erreur que vous voyez ("credit balance too low") signifie que les crédits Anthropic sont épuisés. Il faudrait migrer vers Lovable AI (modèles supportés sans clé API) pour éviter ce problème.

