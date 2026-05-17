// tests/mocks/handlers.ts
// Mocks des edge functions Supabase utilisées dans l'app.
// Chaque handler retourne une shape réaliste alignée sur ce que renvoie l'EF prod.
//
// Convention : SUPABASE_URL = https://test.supabase.co dans les tests (env override).
// Override possible par test via server.use(http.post(...)) pour cas d'erreur.

import { http, HttpResponse } from 'msw';
import {
  baProgramme, baCandidatures, baMandates, baTeamMembers,
} from '../fixtures/ba-data';

const SUPABASE_URL = 'https://test.supabase.co';
const FN = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;
const REST = (table: string) => `${SUPABASE_URL}/rest/v1/${table}`;

export const handlers = [
  // ─── Edge functions ───────────────────────────────────────────

  // create-pe-deal : création mandat
  http.post(FN('create-pe-deal'), async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      deal: {
        id: 'mock-deal-' + Date.now(),
        deal_ref: 'MCA-2026-MOCK',
        organization_id: body.organization_id,
        enterprise_id: 'mock-ent-' + Date.now(),
        stage: body.stage ?? 'sourcing',
        source: body.source ?? 'autre',
        source_detail: body.source_detail ?? null,
        ticket_demande: body.ticket_demande ?? null,
        currency: body.currency ?? 'XOF',
        lead_analyst_id: body.lead_analyst_id ?? null,
        lead_im_id: body.lead_im_id ?? null,
      },
    });
  }),

  // update-pe-deal-stage : drag & drop kanban
  http.post(FN('update-pe-deal-stage'), async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      deal: { id: body.deal_id, stage: body.new_stage },
    });
  }),

  // manage-programme : create/update/list/publish
  http.post(FN('manage-programme'), async ({ request }) => {
    const body = (await request.json()) as any;
    if (body.action === 'create') {
      return HttpResponse.json({
        success: true,
        programme: { ...baProgramme, ...body, id: 'mock-prog-' + Date.now() },
      });
    }
    if (body.action === 'update') {
      return HttpResponse.json({
        success: true,
        programme: { ...baProgramme, ...body },
      });
    }
    if (body.action === 'list') {
      return HttpResponse.json({ success: true, programmes: [baProgramme] });
    }
    return HttpResponse.json({ success: true });
  }),

  // get-programme-form : page publique
  http.post(FN('get-programme-form'), async () => {
    return HttpResponse.json({
      success: true,
      programme: {
        name: baProgramme.name,
        description: baProgramme.description,
        organization: 'Cissé Advisory',
        logo_url: null,
        country_filter: [],
        sector_filter: [],
        end_date: baProgramme.end_date,
        form_fields: baProgramme.form_fields,
        nb_places: null,
        candidatures_count: baCandidatures.length,
      },
    });
  }),

  // submit-candidature : soumission publique
  http.post(FN('submit-candidature'), async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      candidature_id: 'mock-cand-' + Date.now(),
      programme_name: baProgramme.name,
      company_name: body.company_name,
    });
  }),

  // update-candidature : change_status
  http.post(FN('update-candidature'), async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      candidature: { id: body.candidature_id, status: body.new_status },
    });
  }),

  // send-invitation
  http.post(FN('send-invitation'), async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      invitation_id: 'mock-inv-' + Date.now(),
      invitation_url: `https://test.app/invitation/mock-token`,
      email_sent: true,
    });
  }),

  // ─── REST (PostgREST) ────────────────────────────────────────

  // pe_deals (lecture pipeline)
  http.get(REST('pe_deals'), () => HttpResponse.json(baMandates)),

  // organization_members (lecture équipe)
  http.get(REST('organization_members'), () => HttpResponse.json(
    baTeamMembers.map((m) => ({
      user_id: m.user_id,
      role: m.role,
      is_active: m.status === 'active',
      joined_at: m.joined_at,
    })),
  )),

  // profiles (jointures noms)
  http.get(REST('profiles'), () => HttpResponse.json(
    baTeamMembers.map((m) => ({
      user_id: m.user_id,
      full_name: m.full_name,
      email: m.email,
    })),
  )),

  // candidatures (lecture liste BA)
  http.get(REST('candidatures'), () => HttpResponse.json(
    baCandidatures.map((c) => ({
      id: c.id,
      programme_id: c.programme_id,
      organization_id: c.organization_id,
      company_name: c.company_name,
      contact_name: c.contact_name,
      contact_email: c.contact_email,
      contact_phone: c.contact_phone,
      form_data: c.form_data,
      status: c.statusDb,
      screening_score: c.screening_score,
      screening_data: c.screening_data,
      documents: c.documents,
      submitted_at: c.created_at,
    })),
  )),

  // programmes (lecture programme BA actif)
  http.get(REST('programmes'), () => HttpResponse.json([baProgramme])),

  // pe_team_assignments (bindings IM↔Analyst)
  http.get(REST('pe_team_assignments'), () => HttpResponse.json([])),

  // pe_deal_history (activité récente)
  http.get(REST('pe_deal_history'), () => HttpResponse.json([])),

  // organization_invitations (invitations en attente)
  http.get(REST('organization_invitations'), () => HttpResponse.json([])),
];
