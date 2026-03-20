

## Plan : Nettoyage complet de GOTCHE-SARL (données + fichiers)

### Enterprise
- ID : `e7cfb861-02b0-4679-a91f-4d399001fa4f`

### Actions

**1. Migration SQL — Supprimer toutes les données liées**

```sql
DELETE FROM deliverable_versions WHERE enterprise_id = 'e7cfb861-02b0-4679-a91f-4d399001fa4f';
DELETE FROM deliverable_corrections WHERE enterprise_id = 'e7cfb861-02b0-4679-a91f-4d399001fa4f';
DELETE FROM deliverables WHERE enterprise_id = 'e7cfb861-02b0-4679-a91f-4d399001fa4f';
DELETE FROM enterprise_modules WHERE enterprise_id = 'e7cfb861-02b0-4679-a91f-4d399001fa4f';
DELETE FROM score_history WHERE enterprise_id = 'e7cfb861-02b0-4679-a91f-4d399001fa4f';
DELETE FROM activity_log WHERE enterprise_id = 'e7cfb861-02b0-4679-a91f-4d399001fa4f';
UPDATE enterprises SET score_ir = 0, phase = 'identite', document_content = NULL, document_content_updated_at = NULL, document_files_count = 0, document_parsing_report = NULL, operating_mode = NULL, data_room_enabled = false, data_room_slug = NULL WHERE id = 'e7cfb861-02b0-4679-a91f-4d399001fa4f';
```

**2. Script — Supprimer les fichiers dans le bucket `documents`**

Lister et supprimer tous les fichiers dans `documents/e7cfb861-02b0-4679-a91f-4d399001fa4f/` (dossiers `reconstruction/` et autres).

| Action | Cible |
|---|---|
| DELETE (SQL) | deliverable_versions, deliverable_corrections, deliverables, enterprise_modules, score_history, activity_log |
| UPDATE (SQL) | enterprises — reset complet |
| DELETE (Storage) | Tous les fichiers dans `documents/{enterpriseId}/` |

