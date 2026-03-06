

## Plan : Bouton "Générer mon Plan Financier OVO" dans le module Plan Financier Final

### Modification unique : `src/components/dashboard/EntrepreneurDashboard.tsx`

**1. Ajouter deux états :**
- `generatingOvoPlan: boolean` (loader)
- `ovoDownloadUrl: string | null` (URL du fichier généré)

**2. Ajouter une fonction `handleGenerateOvoPlan` :**
- Récupère la session auth
- Construit le payload depuis `enterprise` + deliverables existants (BMC, inputs)
- POST vers `generate-ovo-plan`
- À la réception : stocke `download_url`, déclenche un téléchargement direct (via `fetch` + `blob` + `<a download>`, pas d'ouverture dans un nouvel onglet)
- Sauvegarde `file_url` dans la table `deliverables` (upsert type `plan_ovo`)
- Erreur → toast "La génération a échoué, veuillez réessayer"

**3. Ajouter un bloc UI vert** (lignes ~519, après le bloc framework) :
- Condition : `selectedModule === 'plan_ovo'`
- Même style que le bloc emerald du framework (lignes 491-518)
- Contenu :
  - **État initial** : bouton vert "Générer mon Plan Financier OVO"
  - **Pendant génération** : `Loader2` animé + "Génération en cours… (30-60 secondes)"
  - **Après génération** : bouton "Télécharger mon Plan Financier Excel" qui télécharge directement le fichier (fetch blob → download, pas de nouvel onglet)

Les boutons de téléchargement HTML/XLSX existants en haut restent inchangés.

