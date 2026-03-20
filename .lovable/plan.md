

## Plan : Bouton éphémère "Générer Mémo d'Investissement"

### Changement unique — `src/components/dashboard/EntrepreneurDashboard.tsx`

Après le bloc `odd` (ligne 1316) et avant le commentaire `{/* Viewers */}` (ligne 1318), ajouter un bloc conditionnel pour `investment_memo` quand aucun livrable n'existe :

```tsx
{selectedModule === 'investment_memo' && !getDeliverable('investment_memo') && (
  <div className="flex flex-col items-center justify-center h-64 text-center px-6">
    <Briefcase className="h-16 w-16 text-muted-foreground/20 mb-4" />
    <h3 className="font-semibold text-lg mb-2">Mémo d'Investissement</h3>
    <p className="text-sm text-muted-foreground/70 max-w-sm mb-6">
      Génération en 2 passes (~6 min chacune).
    </p>
    <button
      onClick={() => handleGenerateModule('investment_memo')}
      disabled={generating}
      className="flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
    >
      {generatingModule === 'investment_memo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      Générer le Mémo d'Investissement
    </button>
  </div>
)}
```

C'est un seul bloc de ~15 lignes ajouté à la ligne 1317. Aucun autre fichier modifié. Le bouton disparaît naturellement une fois le livrable généré (car `getDeliverable('investment_memo')` retournera le résultat).

