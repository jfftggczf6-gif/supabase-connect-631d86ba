

# Fix: Anomalies displayed as raw JSON in Screening and Pre-screening

## Root Cause

The `toArray()` helper in `normalizers.ts` (line 17) is designed for **string arrays**. When it receives an array of objects (like anomalies), it serializes them via `JSON.stringify()` because anomaly objects don't have `item`, `description`, or `name` keys that `toArray` looks for.

```text
Input:  [{severity: "bloquant", title: "Absence..."}]
toArray: → ['{"severity":"bloquant","title":"Absence..."}']  // stringified!
.map:   → {severity: 'attention', title: '{"severity":"bloquant"...}'}  // raw JSON as title
```

The anomaly then appears twice — once from the normalizer's string fallback (with "general" category badge), and once from the original data if it leaks through.

## Fix

### File: `supabase/functions/_shared/normalizers.ts`

Replace `toArray()` with direct `Array.isArray()` checks for anomalies in both normalizers:

**Line 1120 (normalizeScreeningReport)**:
```typescript
// Before:
d.anomalies = toArray(pick(d, 'anomalies', ...)).map(...)

// After:
const rawAnomalies = pick(d, 'anomalies', 'anomalies_detectees', 'issues', 'red_flags');
d.anomalies = (Array.isArray(rawAnomalies) ? rawAnomalies : []).map((a: any) => {
  if (typeof a === 'string') {
    try { const p = JSON.parse(a); if (p && typeof p === 'object') return { ...normalize fields from p... }; } catch {}
    return { severity: 'attention', category: 'general', title: a, detail: a, ... };
  }
  return { ...pick fields from a... };
});
```

**Line 1289 (normalizePreScreening)**: Same pattern.

### Summary

| File | Change |
|------|--------|
| `supabase/functions/_shared/normalizers.ts` | Stop using `toArray()` for anomalies in both `normalizeScreeningReport` and `normalizePreScreening` — preserve objects instead of stringifying them |

This is a 2-line scope change in the normalizer file. The viewer-side JSON.parse fallback already added earlier becomes a safety net rather than the primary fix.

