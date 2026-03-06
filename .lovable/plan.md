

## Problem

`generate-ovo-plan` keeps hitting the `max_tokens` limit (16384) because the requested JSON output is enormous: 20 products × 8 years of detailed data, 10 services × 8 years, 30+ opex sub-arrays of 10 values each. The JSON repair fails, triggering 3 retries that all fail, causing infinite spinning.

## Solution: Two-pronged fix

### 1. Increase `max_tokens` to 32768
`claude-sonnet-4-20250514` supports up to 64K output tokens. Doubling to 32768 gives enough headroom for the full JSON.

**File**: `supabase/functions/generate-ovo-plan/index.ts`, line 235
- Change `max_tokens: 16384` to `max_tokens: 32768`

### 2. Reduce output size by capping product/service slots
The prompt currently asks for up to 20 product slots and 10 service slots (mostly inactive/empty). This wastes tokens on zeros.

**File**: `supabase/functions/generate-ovo-plan/index.ts`, lines 368-369
- Cap active products to `Math.min(products.length, 8)` instead of 20
- Cap active services to `Math.min(services.length, 5)` instead of 10
- Update the instruction to only generate active items, not pad to 20/10 with inactive slots

### 3. Improve JSON repair fallback
If truncation still occurs, the repair logic should strip more aggressively (remove trailing incomplete `per_year` arrays).

**File**: `supabase/functions/generate-ovo-plan/index.ts`, lines 270-283
- Add additional cleanup: remove incomplete `per_year` array entries before closing braces

### 4. Redeploy
Redeploy `generate-ovo-plan` after changes.

