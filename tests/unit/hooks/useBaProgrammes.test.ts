// tests/unit/hooks/useBaProgrammes.test.ts
// Test du hook useBaProgrammes : retourne la liste des programmes BA d'une org
// triés par created_at desc, avec mapping correct du shape DB → UI.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock supabase client : on simule from('programmes').select(...).eq(...).eq(...).order(...)
const mockOrder = vi.fn();
const mockEq2 = vi.fn(() => ({ order: mockOrder }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { useBaProgrammes } from '@/hooks/useBaProgrammes';

const PROGRAMME_FIXTURE_A = {
  id: 'p-001',
  organization_id: 'org-cisse',
  name: 'Levée Tech UEMOA 2026',
  description: 'Appel pour startups tech',
  form_slug: 'leve-tech-uemoa-abc',
  form_fields: [{ id: 1, label: 'Pays', type: 'text', required: true }],
  start_date: '2026-05-01',
  end_date: '2026-08-31',
  status: 'in_progress',
  type: 'banque_affaires',
  country_filter: ["Côte d'Ivoire", 'Sénégal'],
  sector_filter: ['Tech', 'Fintech'],
  created_at: '2026-04-15T10:00:00Z',
};

const PROGRAMME_FIXTURE_B = {
  id: 'p-002',
  organization_id: 'org-cisse',
  name: 'Restructuration Agro SN',
  description: null,
  form_slug: 'restruct-agro-xyz',
  form_fields: null,
  start_date: null,
  end_date: null,
  status: 'closed',
  type: 'banque_affaires',
  country_filter: null,
  sector_filter: null,
  created_at: '2026-03-20T10:00:00Z',
};

describe('useBaProgrammes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne une liste vide quand aucun programme BA n\'existe', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    const { result } = renderHook(() => useBaProgrammes('org-cisse'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.programmes).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('mappe les rows DB en BaProgramme avec country_filter/sector_filter par défaut []', async () => {
    mockOrder.mockResolvedValueOnce({
      data: [PROGRAMME_FIXTURE_A, PROGRAMME_FIXTURE_B],
      error: null,
    });

    const { result } = renderHook(() => useBaProgrammes('org-cisse'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.programmes).toHaveLength(2);

    const [first, second] = result.current.programmes;
    expect(first.name).toBe('Levée Tech UEMOA 2026');
    expect(first.country_filter).toEqual(["Côte d'Ivoire", 'Sénégal']);
    expect(first.sector_filter).toEqual(['Tech', 'Fintech']);
    expect(first.type).toBe('banque_affaires');

    // Programme B : country_filter/sector_filter null DB → [] UI (jamais undefined)
    expect(second.country_filter).toEqual([]);
    expect(second.sector_filter).toEqual([]);
    expect(second.form_fields).toEqual([]);
    expect(second.status).toBe('closed');
  });

  it('filtre par organization_id et type banque_affaires (multi-tenant)', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    renderHook(() => useBaProgrammes('org-cisse'));

    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('programmes'));
    expect(mockEq1).toHaveBeenCalledWith('organization_id', 'org-cisse');
    expect(mockEq2).toHaveBeenCalledWith('type', 'banque_affaires');
  });

  it('tri par created_at desc (plus récent en premier)', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    renderHook(() => useBaProgrammes('org-cisse'));

    await waitFor(() => expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false }));
  });

  it('expose l\'erreur Supabase via state.error', async () => {
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { message: 'Permission denied' },
    });

    const { result } = renderHook(() => useBaProgrammes('org-cisse'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Permission denied');
    expect(result.current.programmes).toEqual([]);
  });

  it('ne charge rien si organizationId est undefined', async () => {
    const { result } = renderHook(() => useBaProgrammes(undefined));

    // Pas de waitFor : on vérifie juste que from() n'a jamais été appelé.
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.programmes).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
