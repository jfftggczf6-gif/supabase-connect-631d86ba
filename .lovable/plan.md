

## Plan: Switch to Claude Anthropic API

### What's happening
The `callAI()` function in `helpers.ts` currently calls the Lovable AI Gateway which returns 402 (credits exhausted). We'll switch it to call the Anthropic API directly using Claude claude-sonnet-4-20250514.

### Steps

**1. Store the ANTHROPIC_API_KEY secret**
Use the `add_secret` tool to securely store the key you just provided.

**2. Update `supabase/functions/_shared/helpers.ts` — `callAI()` function (lines 213-290)**
- Change endpoint from `ai.gateway.lovable.dev` to `https://api.anthropic.com/v1/messages`
- Replace `LOVABLE_API_KEY` with `ANTHROPIC_API_KEY`
- Adapt request format:
  - `system` becomes a top-level parameter (not in messages array)
  - Add `max_tokens: 8192`
  - Set `model: "claude-sonnet-4-20250514"`
  - Headers: `x-api-key` + `anthropic-version: 2023-06-01`
- Adapt response parsing: `content[0].text` instead of `choices[0].message.content`
- Keep all existing JSON cleanup/repair logic unchanged

**3. Redeploy all edge functions** that import `helpers.ts`:
`generate-bmc`, `generate-sic`, `generate-inputs`, `generate-framework`, `generate-diagnostic`, `generate-plan-ovo`, `generate-business-plan`, `generate-odd`, `generate-deliverables`, `download-deliverable`

### No other changes needed
- All prompts remain identical
- JSON parsing logic stays the same
- Frontend code unchanged

