

# Supprimer les livrables du compte "eco brin"

## Contexte
L'entreprise "eco brin" (`58a59982-b425-449d-85b7-26a22c4f8023`) a 9 livrables. L'autre compte "eco brin" (`7f2dc4a3`) n'en a aucun.

## Actions (migration SQL)

1. **Supprimer tous les livrables** de l'entreprise `58a59982-b425-449d-85b7-26a22c4f8023`
2. **Supprimer l'historique de scores** associé dans `score_history`
3. **Remettre `score_ir` à 0** sur l'entreprise

Une seule migration SQL suffit.

