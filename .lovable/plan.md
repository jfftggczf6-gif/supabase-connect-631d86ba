

# Ajouter le Data Room dans la sidebar

## Changement

**Fichier unique** : `src/lib/dashboard-config.ts`

Ajouter le module `dataroom` dans la phase Investisseur (phase_3), car c'est lié au partage avec les investisseurs. Il faut aussi importer l'icône `FolderOpen` (ou `FolderPlus`) de lucide-react.

```typescript
// Phase 3 — Investisseur
modules: [
  { code: 'valuation', label: 'Valorisation', icon: TrendingUp },
  { code: 'onepager', label: 'One-Pager', icon: FileText },
  { code: 'investment_memo', label: 'Mémo Investissement', icon: Briefcase },
  { code: 'dataroom', label: 'Data Room', icon: FolderOpen, special: 'dataroom' },
],
```

Le code `dataroom` est déjà géré dans `EntrepreneurDashboard.tsx` (ligne 1251) avec le `DataRoomManager`, donc aucun autre fichier à modifier.

