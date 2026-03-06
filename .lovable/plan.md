

## Upload du template Excel OVO dans le bucket `ovo-templates`

Le fichier `251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY-2.xlsm` doit être uploadé dans le bucket Storage `ovo-templates` avec le nom exact attendu par la Edge Function : `251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm`.

### Étapes

1. **Créer une Edge Function utilitaire temporaire** `upload-template` qui :
   - Reçoit le fichier en base64 dans le body
   - L'upload dans le bucket `ovo-templates` sous le nom `251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm`
   - Utilise le `service_role` key (le bucket est privé, pas de RLS policies)

2. **Alternative plus simple** : Créer un petit script dans une page admin ou utiliser `supabase--curl_edge_functions` pour uploader directement.

**Note importante** : Le fichier uploadé s'appelle `...EMPTY-2.xlsm` mais la Edge Function attend `...EMPTY.xlsm`. Le renommage sera fait lors de l'upload.

