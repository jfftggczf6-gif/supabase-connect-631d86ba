## Architecture : Fix timeout définitif (v2)

**Problème** : Les Edge Functions crashaient (WORKER_LIMIT 546) quand elles tentaient de parser + OCR + reconstruire dans un seul appel.

**Solution** : Séparer parsing et reconstruction en étapes isolées.

### Flow actuel

| Étape | Où | Temps |
|-------|-----|-------|
| Upload fichiers | Client → Storage | instantané |
| Parse DOCX/XLSX/CSV/TXT/PDF texte | **Client (navigateur)** | instantané |
| OCR PDF scannés / images | **Edge function `parse-vision-file`** (1 par 1, max 3) | 10-30s chacun |
| Cache texte | Client → `enterprises.document_content` | instantané |
| Reconstruction IA | Edge function `reconstruct-from-traces` (lit le cache) | 20-40s |
| Pre-screening | Edge function `generate-pre-screening` | 15-30s |

### Fichiers créés/modifiés

| Fichier | Changement |
|---------|------------|
| `src/lib/document-parser.ts` | **Nouveau** — parsing côté client (mammoth, xlsx-js-style) |
| `supabase/functions/parse-vision-file/index.ts` | **Nouveau** — Vision API pour UN fichier |
| `supabase/functions/_shared/helpers.ts` | `verifyAndGetContext` simplifié (lit `document_content` du cache) |
| `supabase/functions/reconstruct-from-traces/index.ts` | max_tokens 8192, check cache |
| `src/components/dashboard/ReconstructionUploader.tsx` | Nouveau flow client-side |
| Migration SQL | `document_content`, `document_content_updated_at`, `document_files_count` ajoutés à `enterprises` |
