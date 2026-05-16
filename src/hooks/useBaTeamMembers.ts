// src/hooks/useBaTeamMembers.ts
// Charge la liste des membres BA pour la page Équipe (Partner only).
//
// Compose 4 sources :
//   1. organization_members (role + is_active)
//   2. profiles               (full_name + email)
//   3. pe_deals               (count source='mandat_ba' WHERE lead_analyst_id = user_id)
//   4. pe_deal_history        (max(created_at) par changed_by → last_activity_at)
//   5. organization_invitations (rows pending → membres status='invited' sans entry org_members)
//
// Le preset.roles_labels est utilisé pour le role_label (fallback BA_ROLE_LABELS).

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgPreset } from '@/hooks/useOrgPreset';
import {
  BA_ROLE_LABELS,
  type BaInviteRole,
  type BaTeamMember,
} from '@/types/equipe-ba';

interface State {
  members: BaTeamMember[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBaTeamMembers(organizationId: string | undefined): State {
  const { workflow } = useOrgPreset();
  const [members, setMembers] = useState<BaTeamMember[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const roleLabelFor = useCallback(
    (role: string): string => {
      const fromPreset = workflow?.roles_labels?.[role];
      if (fromPreset) return fromPreset;
      const fallback = BA_ROLE_LABELS[role as BaInviteRole];
      return fallback ?? role;
    },
    [workflow],
  );

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Membres actifs ET désactivés — on retire le filtre is_active pour
      //    afficher les comptes désactivés avec un Badge "Désactivé" et
      //    permettre leur réactivation depuis le dropdown actions.
      const { data: orgMembers, error: omErr } = await supabase
        .from('organization_members')
        .select('user_id, role, is_active, created_at')
        .eq('organization_id', organizationId);
      if (omErr) throw omErr;

      const userIds = (orgMembers || []).map((m: any) => m.user_id);

      // 2. Profils.
      const { data: profiles } = userIds.length
        ? await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds)
        : { data: [] as any[] };
      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      // 3. Mandats assignés par analyste (source='mandat_ba').
      const { data: deals } = userIds.length
        ? await supabase
            .from('pe_deals')
            .select('lead_analyst_id')
            .eq('organization_id', organizationId)
            .eq('source', 'mandat_ba')
            .in('lead_analyst_id', userIds)
            .neq('stage', 'close')
        : { data: [] as any[] };
      const mandatesByUser = new Map<string, number>();
      for (const d of deals || []) {
        const uid = (d as any).lead_analyst_id;
        if (!uid) continue;
        mandatesByUser.set(uid, (mandatesByUser.get(uid) ?? 0) + 1);
      }

      // 4. Dernière activité (pe_deal_history, max created_at par changed_by).
      const { data: histRows } = userIds.length
        ? await supabase
            .from('pe_deal_history')
            .select('changed_by, created_at')
            .in('changed_by', userIds)
            .order('created_at', { ascending: false })
            .limit(500)
        : { data: [] as any[] };
      const lastActByUser = new Map<string, string>();
      for (const h of histRows || []) {
        const uid = (h as any).changed_by;
        if (!uid) continue;
        if (!lastActByUser.has(uid)) {
          lastActByUser.set(uid, (h as any).created_at as string);
        }
      }

      // 5. Invitations en cours (non acceptées, non révoquées, non expirées).
      const { data: invitations } = await supabase
        .from('organization_invitations')
        .select('id, email, role, created_at, accepted_at, revoked_at, expires_at, full_name')
        .eq('organization_id', organizationId)
        .is('accepted_at', null)
        .is('revoked_at', null);
      const nowIso = new Date().toISOString();
      const pendingInvitations = (invitations || []).filter(
        (i: any) => !i.expires_at || i.expires_at > nowIso,
      );

      const activeMembers: BaTeamMember[] = (orgMembers || []).map((m: any) => {
        const prof = profMap.get(m.user_id) as any;
        return {
          user_id: m.user_id,
          full_name: prof?.full_name ?? null,
          email: prof?.email ?? '',
          role: m.role,
          role_label: roleLabelFor(m.role),
          status: m.is_active ? 'active' : 'disabled',
          mandates_count: mandatesByUser.get(m.user_id) ?? 0,
          last_activity_at: lastActByUser.get(m.user_id) ?? null,
          invited_at: null,
        };
      });

      const invitedMembers: BaTeamMember[] = pendingInvitations.map((i: any) => ({
        // pas de user_id (compte non créé) — on utilise l'id de l'invitation préfixé
        user_id: `invite:${i.id}`,
        full_name: i.full_name ?? null,
        email: i.email,
        role: i.role,
        role_label: roleLabelFor(i.role),
        status: 'invited',
        mandates_count: 0,
        last_activity_at: null,
        invited_at: i.created_at,
      }));

      setMembers([...activeMembers, ...invitedMembers]);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement équipe');
    } finally {
      setLoading(false);
    }
  }, [organizationId, roleLabelFor]);

  useEffect(() => { load(); }, [load]);

  return { members, loading, error, reload: load };
}
