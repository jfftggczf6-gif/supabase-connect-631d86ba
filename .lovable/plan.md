

# Upload Programme Criteria Document (PDF/Word) + AI Extraction

## What the user wants
Instead of manually filling form fields (score IR, marge min, ratio dette, etc.), coaches and super admins should be able to **upload a PDF or Word document** (like the ST4A call for proposals) and have the system **extract programme criteria automatically via AI**. These extracted criteria should also feed into the pre-screening process.

## Architecture

```text
Upload PDF/Word → Edge Function (parse + AI extract) → Save to programme_criteria table
                                                      → Store raw document in storage
                                                      → Criteria used by pre-screening
```

## Plan

### 1. Add `source_document_url` and `raw_criteria_text` columns to `programme_criteria`
- `source_document_url` (text, nullable): storage path to the uploaded document
- `raw_criteria_text` (text, nullable): full text extracted from the document (for AI context in pre-screening)

### 2. Create edge function `extract-programme-criteria`
- Accepts a `programme_criteria_id` or inline file upload
- Reads the uploaded document from storage (PDF via text extraction, DOCX via parseDocx)
- Calls AI to extract structured criteria matching the `programme_criteria` schema:
  - Programme name, description
  - Financial thresholds (min revenue, max debt ratio, min margin, min score)
  - Sector/country filters
  - Required deliverables
  - Any custom criteria as free-form JSON
- Also returns the raw text for storage (used in pre-screening prompts)
- Saves extracted data into `programme_criteria` table

### 3. Update `ProgrammeCriteriaEditor.tsx`
- Add an **"Upload document"** button (PDF/Word) alongside the existing "Nouveau programme" button
- Flow: upload file → store in `documents` bucket under `programme-docs/` → call `extract-programme-criteria` → show extracted criteria in the existing form dialog for review/edit → save
- Keep the manual form as fallback (user can still create manually)
- Display the source document name on each criteria card when one was uploaded

### 4. Update pre-screening to use raw document text
- In `generate-pre-screening/index.ts`, when `programmeCriteria` is provided, also fetch `raw_criteria_text` from the `programme_criteria` record
- Include the full raw document text in the AI prompt instead of just the structured JSON — this gives the AI the complete context of the programme requirements (eligibility criteria, social/environmental dimensions, etc.)

## Files to modify/create

| File | Change |
|------|--------|
| Migration | Add `source_document_url` and `raw_criteria_text` to `programme_criteria` |
| `supabase/functions/extract-programme-criteria/index.ts` | New edge function: parse doc + AI extraction |
| `src/components/dashboard/ProgrammeCriteriaEditor.tsx` | Add upload button, call edge function, show source doc |
| `supabase/functions/generate-pre-screening/index.ts` | Include `raw_criteria_text` in the programme section of the prompt |
| `supabase/config.toml` | Add `verify_jwt = false` for the new function |

