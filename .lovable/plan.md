

# Audit : le produit suit-il le flow attendu ?

## Comparaison Phase par Phase

```text
FLOW ATTENDU (document)              IMPLÉMENTATION ACTUELLE              STATUS
═══════════════════════════════════════════════════════════════════════════════════
Phase 0 — Entrée des données
  1. Upload documents                 ReconstructionUploader.tsx            ✅ OK
  2. Parsing universel                helpers.ts (parseDocx/Xlsx/Vision)    ✅ OK
  3. Reconstruction IA                reconstruct-from-traces               ✅ OK

Phase 1 — Pre-screening (AVANT pipeline)
  4. Pre-screening                    Déclenché après reconstruction        ⚠️ PARTIEL
                                      dans ReconstructionUploader, 
                                      MAIS absent du PIPELINE array.
                                      Si l'utilisateur clique "Générer
                                      tout" sans passer par la 
                                      reconstruction, le pre-screening
                                      n'est JAMAIS exécuté.

Phase 2 — Pipeline de génération (14 étapes)
  5. BMC                              PIPELINE[0] generate-bmc             ✅ OK
  6. SIC                              PIPELINE[1] generate-sic             ✅ OK
  7. Inputs enrichis                  PIPELINE[2] generate-inputs           ✅ OK
  8. Framework financier              PIPELINE[3] generate-framework        ✅ OK
  9. Plan OVO                         PIPELINE[4] generate-plan-ovo         ✅ OK
  —  Sync + Excel OVO                PIPELINE[5-6] reconcile + ovo-plan    ✅ OK
  10. Business Plan                   PIPELINE[7] generate-business-plan    ✅ OK
  11. ODD                             PIPELINE[8] generate-odd              ✅ OK
  12. Diagnostic expert               PIPELINE[9] generate-diagnostic       ✅ OK

Phase 3 — Livrables investisseur
  13. Valorisation                    PIPELINE[10] generate-valuation       ✅ OK
  14. One-Pager                       PIPELINE[11] generate-onepager        ✅ OK
  15. Pitch Deck                      PIPELINE[12] generate-pitch-deck      ✅ OK
  16. Investment Memo                 PIPELINE[13] generate-investment-memo  ✅ OK

Phase 4 — Screening final + Diffusion
  17. Screening final                 PIPELINE[14] generate-screening-report ✅ OK (ajouté)
  18. Data Room + Coach Report        DataRoomManager + generate-coach-report ✅ OK

Infrastructure transversale
  Post-validator                      post-validator.ts                     ✅ OK
  Normalizers                         normalizers.ts                        ✅ OK
  RAG vectorisé                       buildRAGContext + pgvector            ✅ OK
  Feedback loop                       corrections historiques dans RAG      ✅ OK
  Version history                     deliverable_versions table            ✅ OK
  Audit trail                         activity_log table                    ✅ OK
```

## Problème identifié

**Un seul écart significatif : le Pre-screening (Phase 1) n'est pas dans le pipeline automatique.**

- Il est déclenché uniquement après la reconstruction dans `ReconstructionUploader.tsx` (lignes 130-141)
- Il est dans `MODULE_FN_MAP` (peut être lancé manuellement)
- Mais il est **absent de `PIPELINE`** dans `dashboard-config.ts`
- Conséquence : quand l'utilisateur clique "Générer tout", le pre-screening est sauté

Le document spécifie que le pre-screening doit se faire **avant** le pipeline Phase 2 (entre la reconstruction et le BMC), avec un "feu vert" conditionnel.

## Plan de correction

### Ajouter Pre-screening comme première étape du PIPELINE

Dans `src/lib/dashboard-config.ts`, insérer en position 0 :

```typescript
{ name: 'Pre-screening', fn: 'generate-pre-screening', type: 'pre_screening' as DeliverableType },
```

Le PIPELINE deviendra : **Pre-screening → BMC → SIC → ... → Screening**

Cela respecte le flow : Phase 1 (triage) → Phase 2 (génération) → Phase 3 (investisseur) → Phase 4 (screening final).

### Impact

- `pipeline-runner.ts` itère dynamiquement sur `PIPELINE` — aucun changement nécessaire
- Le pre-screening sera automatiquement sauté s'il est déjà "rich + up-to-date" (logique existante)
- La reconstruction continuera aussi à déclencher le pre-screening indépendamment (pas de doublon grâce au skip)

### Résumé

| Aspect | Verdict |
|--------|---------|
| Phase 0 (Upload/Parsing/Reconstruction) | ✅ Conforme |
| Phase 1 (Pre-screening) | ⚠️ Manque dans PIPELINE — 1 ligne à ajouter |
| Phase 2 (14 étapes génération) | ✅ Conforme |
| Phase 3 (Livrables investisseur) | ✅ Conforme |
| Phase 4 (Screening final) | ✅ Conforme |
| Infrastructure transversale | ✅ Conforme |

