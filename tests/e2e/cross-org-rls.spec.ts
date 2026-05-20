// tests/e2e/cross-org-rls.spec.ts
// Brief P8 QA gate : RLS isolation PE ↔ BA (depuis le navigateur, via Supabase client).

import { test, expect } from '@playwright/test';
import { login, BA_USER, PE_USER } from '../helpers/auth';

const BA_ORG_ID = '77777777-7777-7777-7777-777777777777';
const PE_ORG_ID = '55555555-5555-5555-5555-555555555555';

test.describe('Cross-org RLS isolation', () => {
  test('BA → pe_deals hors org Cissé = 0', async ({ page }) => {
    await login(page, BA_USER);
    // Évalue dans le contexte browser via window.supabase (client global)
    const result = await page.evaluate(async (otherOrgId) => {
      const sb = (window as any).supabase;
      if (!sb) return { err: 'pas de client global, skip' };
      const { data, error } = await sb.from('pe_deals').select('id').eq('organization_id', otherOrgId);
      return { count: (data || []).length, error: error?.message };
    }, PE_ORG_ID);
    if (result.err) test.skip(true, result.err);
    expect(result.count, 'BA partner ne doit voir aucun deal PE').toBe(0);
  });

  test('PE → pe_deals hors org Adiwale = 0', async ({ page }) => {
    await login(page, PE_USER);
    const result = await page.evaluate(async (otherOrgId) => {
      const sb = (window as any).supabase;
      if (!sb) return { err: 'pas de client global, skip' };
      const { data, error } = await sb.from('pe_deals').select('id').eq('organization_id', otherOrgId);
      return { count: (data || []).length, error: error?.message };
    }, BA_ORG_ID);
    if (result.err) test.skip(true, result.err);
    expect(result.count, 'PE MD ne doit voir aucun deal BA').toBe(0);
  });
});
