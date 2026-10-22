/**
 * Règle d'accès à un programme et à ses candidatures.
 *
 * Ce test existe à cause d'un incident constaté le 2026-10-21/22 : huit edge
 * functions laissaient un `manager` d'organisation franchir le contrôle de rôle,
 * puis le recalaient au contrôle de périmètre, parce que la seule branche
 * honorant l'appartenance à l'organisation était verrouillée sur
 * `owner || admin`. Deux utilisateurs OVO — l'un sur le programme Ghana, l'autre
 * sur Uganda — recevaient un 403 que l'interface affichait en « Edge function
 * returned a non-2xx status code ».
 *
 * La base de données, elle, accordait déjà le périmètre org aux managers :
 * les policies `candidatures_update` et `programmes_update` listent
 * owner, admin, manager. Un manager pouvait donc MODIFIER une candidature
 * sans pouvoir l'OUVRIR. Le correctif aligne les edge functions sur la RLS.
 *
 * `render-diagnostic` et `get-programme-compliance` portaient déjà la règle
 * correcte : elle n'avait simplement jamais été reportée sur les autres.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Membre = { role: string; organization_id: string } | undefined;

/** Réplique fidèle du contrôle tel qu'il est écrit dans les edge functions. */
function peutAcceder(opts: {
  roleHistorique?: string;
  membre: Membre;
  programme: { organization_id: string | null; chef_programme_id: string | null };
  userId: string;
  coachAssigneId?: string | null;
}): boolean {
  const { roleHistorique, membre, programme, userId, coachAssigneId } = opts;
  const orgRole = membre?.role;
  const userOrgId = membre?.organization_id;

  const isAdmin = roleHistorique === "super_admin";
  const isOwnerOrAdmin = orgRole === "owner" || orgRole === "admin";
  const isOrgStaff = isOwnerOrAdmin || orgRole === "manager";
  const isChef = roleHistorique === "chef_programme" || isOwnerOrAdmin || orgRole === "manager";
  const isCoach = roleHistorique === "coach" || orgRole === "coach" || orgRole === "analyst";

  // Porte 1 — admission
  if (!isAdmin && !isChef && !isCoach) return false;
  if (isAdmin) return true;

  // Porte 2 — périmètre
  return (
    (isOrgStaff && programme.organization_id === userOrgId) ||
    (isChef && programme.chef_programme_id === userId) ||
    (isCoach && coachAssigneId === userId)
  );
}

const OVO = "69eb5440-81e0-4446-81e3-a308dd2cc369";
const AUTRE_ORG = "483e35a1-0e4d-4aab-842b-cb763b600e80";

const KAREN = "2e653756-7027-4caf-add2-bc7ef980b19e";
const OLIVIER = "f867f6a2-7cf9-4bfa-afa1-f0ebdb413f48";
const FRANCIS = "francis-chef-ghana";

const GHANA = { organization_id: OVO, chef_programme_id: FRANCIS };
const UGANDA = { organization_id: OVO, chef_programme_id: "joseph-chef-uganda" };
const PROG_AUTRE_ORG = { organization_id: AUTRE_ORG, chef_programme_id: "chef-externe" };

Deno.test("le manager accède aux programmes de son organisation — le cas corrigé", async (t) => {
  await t.step("Olivier, manager OVO, chef d'aucun programme → Ghana", () => {
    assertEquals(
      peutAcceder({
        roleHistorique: undefined, // null : deux rôles en base, maybeSingle échoue
        membre: { role: "manager", organization_id: OVO },
        programme: GHANA,
        userId: OLIVIER,
      }),
      true,
    );
  });

  await t.step("Karen, manager OVO, chef d'aucun programme → Uganda", () => {
    assertEquals(
      peutAcceder({
        membre: { role: "manager", organization_id: OVO },
        programme: UGANDA,
        userId: KAREN,
      }),
      true,
    );
  });

  await t.step("Francis, manager OVO ET chef de Ghana → Ghana", () => {
    assertEquals(
      peutAcceder({
        membre: { role: "manager", organization_id: OVO },
        programme: GHANA,
        userId: FRANCIS,
      }),
      true,
    );
  });
});

Deno.test("le correctif n'élargit rien au-delà de l'organisation", async (t) => {
  await t.step("manager d'une autre organisation → refusé", () => {
    assertEquals(
      peutAcceder({
        membre: { role: "manager", organization_id: AUTRE_ORG },
        programme: GHANA,
        userId: "intrus",
      }),
      false,
    );
  });

  await t.step("manager OVO → programme d'une autre organisation : refusé", () => {
    assertEquals(
      peutAcceder({
        membre: { role: "manager", organization_id: OVO },
        programme: PROG_AUTRE_ORG,
        userId: OLIVIER,
      }),
      false,
    );
  });

  await t.step("programme sans organisation → le manager n'y accède pas par l'org", () => {
    assertEquals(
      peutAcceder({
        membre: { role: "manager", organization_id: OVO },
        programme: { organization_id: null, chef_programme_id: "quelqu-un" },
        userId: OLIVIER,
      }),
      false,
    );
  });
});

Deno.test("les autres rôles sont inchangés", async (t) => {
  await t.step("coach non assigné → refusé malgré la même organisation", () => {
    assertEquals(
      peutAcceder({
        membre: { role: "coach", organization_id: OVO },
        programme: GHANA,
        userId: "coach-x",
        coachAssigneId: "coach-y",
      }),
      false,
    );
  });

  await t.step("coach assigné à la candidature → accepté", () => {
    assertEquals(
      peutAcceder({
        membre: { role: "coach", organization_id: OVO },
        programme: GHANA,
        userId: "coach-x",
        coachAssigneId: "coach-x",
      }),
      true,
    );
  });

  await t.step("entrepreneur → refusé dès la porte 1", () => {
    assertEquals(
      peutAcceder({
        membre: { role: "entrepreneur", organization_id: OVO },
        programme: GHANA,
        userId: "entrepreneur-x",
      }),
      false,
    );
  });

  await t.step("sans aucun membership ni rôle → refusé", () => {
    assertEquals(
      peutAcceder({ membre: undefined, programme: GHANA, userId: "inconnu" }),
      false,
    );
  });

  await t.step("super_admin → accepté partout", () => {
    assertEquals(
      peutAcceder({
        roleHistorique: "super_admin",
        membre: undefined,
        programme: PROG_AUTRE_ORG,
        userId: "sa",
      }),
      true,
    );
  });

  await t.step("chef_programme nommé, sans membership org → son programme seulement", () => {
    assertEquals(
      peutAcceder({
        roleHistorique: "chef_programme",
        membre: undefined,
        programme: GHANA,
        userId: FRANCIS,
      }),
      true,
    );
    assertEquals(
      peutAcceder({
        roleHistorique: "chef_programme",
        membre: undefined,
        programme: UGANDA,
        userId: FRANCIS,
      }),
      false,
    );
  });
});

Deno.test("régression : l'ancienne règle refusait Olivier sur Ghana", () => {
  // Reproduction de la porte 2 d'avant correctif.
  const orgRole: string = "manager";
  const isOwnerOrAdmin = orgRole === "owner" || orgRole === "admin";
  const isChef = isOwnerOrAdmin || orgRole === "manager";
  const ancienCanAccess =
    (isOwnerOrAdmin && GHANA.organization_id === OVO) ||
    (isChef && GHANA.chef_programme_id === OLIVIER);
  assertEquals(ancienCanAccess, false, "c'est bien l'ancien comportement qui produisait le 403");
});
