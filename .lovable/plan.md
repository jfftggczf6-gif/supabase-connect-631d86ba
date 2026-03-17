

## Audit : Vue Entrepreneur (mirror) vs Dashboard Entrepreneur

### Résultat de l'analyse

Après comparaison détaillée des deux composants, la Vue Entrepreneur du coach est **fonctionnellement correcte et cohérente** avec le dashboard entrepreneur. Voici le détail :

### Structure identique ✓
- Panel gauche Sources (BMC & Impact Social, Inputs Financiers, Documents supplémentaires)
- Panel central avec barre titre module + contenu scrollable
- Barre de modules en bas (bottom bar)
- Bouton flottant "Générer les livrables" + "Régénération complète"
- Bannière de progression non-bloquante pendant la génération

### Modules dans la barre du bas
Les deux utilisent `MODULE_CONFIG` (7 modules) : Diagnostic, BMC, SIC, Framework, Plan OVO, Business Plan, ODD. Le module `inputs` n'apparaît dans aucune des deux barres — c'est cohérent.

### Barres de téléchargement par module — différences mineures

| Module | Entrepreneur | Coach Mirror | Écart |
|--------|-------------|--------------|-------|
| Diagnostic | Rapport HTML | Rapport HTML + Regénérer | Coach a un bouton en plus ✓ |
| BMC | Rapport HTML | Rapport HTML + Regénérer | Coach a un bouton en plus ✓ |
| SIC | Rapport HTML | Rapport HTML + Regénérer | Coach a un bouton en plus ✓ |
| Framework | Rapport HTML | Rapport HTML (pas de Regénérer) | Identique |
| Plan OVO | Excel + HTML + Regénérer | Excel + HTML + Regénérer | Identique |
| Business Plan | Word + Regénérer | Word + Regénérer | Identique |
| ODD | Excel + HTML | Excel + HTML | Identique |

### Ce qui manque dans la Vue Entrepreneur (mirror) par rapport à l'Entrepreneur

1. **Barre de score Investment Readiness** (barre sombre en bas avec score global, jauge, label maturité, historique) — absente du mirror, remplacée par un simple badge score dans le header.

2. **Bouton "Rapport HTML" pour Plan OVO** quand le livrable existe mais pas l'Excel — l'entrepreneur affiche le bouton "Rapport HTML" seul, le coach mirror l'affiche aussi ✓.

### Conclusion

Aucun bouton critique n'est manquant. La seule différence notable est la **barre de score IR** qui n'est pas reproduite dans le mirror. Les boutons regénérer supplémentaires côté coach sont un avantage (pas un défaut).

**Aucune modification n'est nécessaire** — la vue miroir fonctionne correctement et tous les boutons essentiels (génération, téléchargement, upload) sont présents.

