-- Seed bank_team NSIA "Équipe Bouaké" + réassignation des dossiers existants.
--
-- Distribution :
--   conseiller@nsia.local  → 5 dossiers (les + intéressants : Maison Ivoire, Boulangerie, Ferme Soleil, Garage Central, Ets Diaby)
--   conseiller2@nsia.local → 4 dossiers (les autres)
--   analyste@nsia.local    → lead de l'équipe Bouaké → voit les 9
--   directeur@nsia.local   → voit l'org entière (10 dossiers, dont monitoring Bâtiment Pro)
--
-- L'idée : valider que conseiller voit 5, conseiller2 voit 4 (cloisonnement),
-- analyste voit 9 (équipe), directeur voit 10 (org).

DO $$
DECLARE
  team_id_bouake uuid := 'bbbb1111-bbbb-bbbb-bbbb-111111111111';
  v_conseiller_id  uuid := '11111111-aaaa-aaaa-aaaa-111111111111';
  v_conseiller2_id uuid := '22222222-aaaa-aaaa-aaaa-222222222222';
  v_analyste_id    uuid := '33333333-aaaa-aaaa-aaaa-333333333333';
  nsia_org_id    uuid := '66666666-6666-6666-6666-666666666666';
BEGIN
  -- bank_teams
  INSERT INTO bank_teams (id, organization_id, name, lead_user_id, description)
  VALUES (team_id_bouake, nsia_org_id, 'Équipe Bouaké', v_analyste_id, 'Conseillers PME en agence de Bouaké')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, lead_user_id = EXCLUDED.lead_user_id, description = EXCLUDED.description;

  -- bank_team_members (analyste = lead, n'apparaît pas comme membre ; conseillers = membres)
  INSERT INTO bank_team_members (team_id, user_id, role_in_team)
  VALUES
    (team_id_bouake, v_conseiller_id,  'conseiller'),
    (team_id_bouake, v_conseiller2_id, 'conseiller')
  ON CONFLICT (team_id, user_id) DO UPDATE SET role_in_team = EXCLUDED.role_in_team;

  -- Réassignation : conseiller@ a les 5 premiers dossiers (Maison Ivoire + 4 autres)
  UPDATE credit_dossiers SET conseiller_id = v_conseiller_id
   WHERE organization_id = nsia_org_id
     AND numero IN ('NSIA-2026-042','NSIA-2026-043','NSIA-2026-045','NSIA-2026-047','NSIA-2026-049');

  -- conseiller2@ a 4 dossiers
  UPDATE credit_dossiers SET conseiller_id = v_conseiller2_id
   WHERE organization_id = nsia_org_id
     AND numero IN ('NSIA-2026-044','NSIA-2026-046','NSIA-2026-048','NSIA-2026-035');

  -- Le 10ème dossier (Bâtiment Pro CI, monitoring) reste sans conseiller
  -- → seul le directeur le voit, ce qui valide le filtre par rôle.
  UPDATE credit_dossiers SET conseiller_id = NULL
   WHERE organization_id = nsia_org_id
     AND numero = 'NSIA-2026-022';
END $$;

-- Vérifications
\echo '=== Team + members ==='
SELECT t.name, t.lead_user_id, count(m.user_id) AS nb_members
  FROM bank_teams t
  LEFT JOIN bank_team_members m ON m.team_id = t.id
 GROUP BY t.id, t.name, t.lead_user_id;

\echo '=== Distribution dossiers NSIA par conseiller ==='
SELECT
  COALESCE(p.full_name, '(non assigné)') AS conseiller,
  count(*) AS nb_dossiers,
  string_agg(numero, ', ' ORDER BY numero) AS numeros
FROM credit_dossiers d
LEFT JOIN profiles p ON p.user_id = d.conseiller_id
WHERE d.organization_id = '66666666-6666-6666-6666-666666666666'::uuid
GROUP BY conseiller
ORDER BY conseiller;
