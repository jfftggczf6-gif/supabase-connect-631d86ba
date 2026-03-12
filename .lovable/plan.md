

## Supprimer les livrables de Prestige Traiteur Abidjan SARL

### Contexte
- Enterprise ID : `38667b5a-bde4-4e86-bbe0-43692b04eb56`
- 11 livrables existants à supprimer

### Action
Exécuter une suppression SQL via l'outil de données :

```sql
DELETE FROM deliverables WHERE enterprise_id = '38667b5a-bde4-4e86-bbe0-43692b04eb56';
```

Cela supprimera les 11 livrables. Les données entreprise, modules et historique de scores resteront intacts.

