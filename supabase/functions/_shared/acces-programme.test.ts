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

/**
 * manage-programme : règle distincte, voulue et documentée dans la fonction.
 * Le personnel d'organisation VOIT tous les programmes de son organisation ;
 * il n'en MODIFIE que ceux dont il est chef (owner/admin exceptés).
 *
 * Second point, de sécurité : `userOrgId` peut provenir du corps de la requête
 * (switcher d'organisation côté interface). Il est revendiqué, jamais prouvé.
 * Les contrôles s'appuient sur `membreOrgId`, issu d'une appartenance active
 * vérifiée en base.
 */

type Ctx = {
  roleHistorique?: string;
  membre: Membre;
  orgRevendiquee?: string | null;
  userId: string;
};

function contexte(c: Ctx) {
  const orgRole = c.membre?.role;
  const membreOrgId = c.membre?.organization_id ?? null;
  const userOrgId = c.orgRevendiquee ?? membreOrgId ?? null;
  const isAdmin = c.roleHistorique === "super_admin";
  const isOrgOwnerAdmin = !!membreOrgId && (orgRole === "owner" || orgRole === "admin");
  const isOrgStaff = isOrgOwnerAdmin || (!!membreOrgId && orgRole === "manager");
  const isChefProg =
    c.roleHistorique === "chef_programme" || orgRole === "owner" || orgRole === "admin" || orgRole === "manager";
  return { isAdmin, isOrgOwnerAdmin, isOrgStaff, isChefProg, membreOrgId, userOrgId, userId: c.userId };
}

function listeNonFiltreeSurSesProgrammes(c: Ctx): boolean {
  const x = contexte(c);
  return x.isOrgStaff && x.userOrgId === x.membreOrgId;
}

function peutModifier(c: Ctx, prog: { organization_id: string | null; chef_programme_id: string | null }): boolean {
  const x = contexte(c);
  if (x.isAdmin) return true;
  if (x.isOrgOwnerAdmin && prog.organization_id === x.membreOrgId) return true;
  if (x.isChefProg && prog.chef_programme_id === x.userId) return true;
  return false;
}

Deno.test("manage-programme · la liste s'ouvre à toute l'organisation", async (t) => {
  await t.step("Karen, manager OVO → liste non filtrée sur ses seuls programmes", () => {
    assertEquals(
      listeNonFiltreeSurSesProgrammes({ membre: { role: "manager", organization_id: OVO }, userId: KAREN }),
      true,
    );
  });

  await t.step("owner et admin : inchangés", () => {
    for (const role of ["owner", "admin"]) {
      assertEquals(
        listeNonFiltreeSurSesProgrammes({ membre: { role, organization_id: OVO }, userId: "x" }),
        true,
      );
    }
  });

  await t.step("coach : toujours filtré", () => {
    assertEquals(
      listeNonFiltreeSurSesProgrammes({ membre: { role: "coach", organization_id: OVO }, userId: "c" }),
      false,
    );
  });
});

Deno.test("manage-programme · l'écriture reste au chef du programme", async (t) => {
  await t.step("Karen, manager, non chef → ne modifie pas Uganda", () => {
    assertEquals(
      peutModifier({ membre: { role: "manager", organization_id: OVO }, userId: KAREN }, UGANDA),
      false,
    );
  });

  await t.step("Francis, manager ET chef de Ghana → modifie Ghana", () => {
    assertEquals(
      peutModifier({ membre: { role: "manager", organization_id: OVO }, userId: FRANCIS }, GHANA),
      true,
    );
  });

  await t.step("owner de l'org → modifie tous les programmes de son org", () => {
    assertEquals(
      peutModifier({ membre: { role: "owner", organization_id: OVO }, userId: "o" }, UGANDA),
      true,
    );
  });
});

Deno.test("manage-programme · une organisation revendiquée ne vaut pas une appartenance", async (t) => {
  await t.step("owner d'OVO réclamant une autre org → liste filtrée sur ses programmes", () => {
    assertEquals(
      listeNonFiltreeSurSesProgrammes({
        membre: { role: "owner", organization_id: OVO },
        orgRevendiquee: AUTRE_ORG,
        userId: "o",
      }),
      false,
    );
  });

  await t.step("owner d'OVO ne modifie pas un programme d'une autre org", () => {
    assertEquals(
      peutModifier(
        { membre: { role: "owner", organization_id: OVO }, orgRevendiquee: AUTRE_ORG, userId: "o" },
        PROG_AUTRE_ORG,
      ),
      false,
    );
  });

  await t.step("manager d'OVO réclamant une autre org → liste filtrée", () => {
    assertEquals(
      listeNonFiltreeSurSesProgrammes({
        membre: { role: "manager", organization_id: OVO },
        orgRevendiquee: AUTRE_ORG,
        userId: OLIVIER,
      }),
      false,
    );
  });

  await t.step("réclamer sa propre organisation reste valide", () => {
    assertEquals(
      listeNonFiltreeSurSesProgrammes({
        membre: { role: "manager", organization_id: OVO },
        orgRevendiquee: OVO,
        userId: OLIVIER,
      }),
      true,
    );
  });
});

/**
 * resolveEffectiveRoles : rôles historiques ET rôles d'organisation.
 *
 * Deux défauts réunis dans quatre fonctions (ODD portefeuille, score IR,
 * checklist pré-CI, matrice de risques), toutes montées sur la page programme :
 *
 * 1. `user_roles` était lu avec `.maybeSingle()`. 18 comptes en production
 *    portent deux rôles : la requête échouait et `data` tombait à `null`,
 *    effaçant silencieusement tout droit hérité de l'ancien système.
 * 2. Le contrôle comparait `user_roles.role` à ["super_admin","admin","manager","owner"],
 *    alors que l'énumération `app_role` ne contient ni `admin`, ni `manager`, ni `owner`
 *    — ce sont des rôles d'ORGANISATION. Seul `super_admin` pouvait donc passer.
 */

const APP_ROLE = [
  "coach", "entrepreneur", "super_admin", "chef_programme", "analyste",
  "investment_manager", "managing_director", "conseiller_pme", "analyste_credit",
  "directeur_agence", "direction_pme", "directeur_pme", "partner",
];

/** Réplique de resolveEffectiveRoles, côté drapeaux. */
function rolesEffectifs(legacyRoles: string[], orgRole?: string) {
  return {
    isSuperAdmin: legacyRoles.includes("super_admin"),
    isOwnerOrAdmin: orgRole === "owner" || orgRole === "admin",
    isChefProg:
      legacyRoles.includes("chef_programme") ||
      orgRole === "owner" || orgRole === "admin" || orgRole === "manager",
    isCoach: legacyRoles.includes("coach") || orgRole === "coach" || orgRole === "analyst",
  };
}

const admisSurOngletProgramme = (r: ReturnType<typeof rolesEffectifs>) => r.isSuperAdmin || r.isChefProg;

Deno.test("onglets ODD et conformité · le manager d'organisation est admis", async (t) => {
  await t.step("Karen : deux rôles historiques + manager OVO", () => {
    assertEquals(
      admisSurOngletProgramme(rolesEffectifs(["chef_programme", "entrepreneur"], "manager")),
      true,
    );
  });

  await t.step("un rôle historique unique reste pris en compte", () => {
    assertEquals(admisSurOngletProgramme(rolesEffectifs(["chef_programme"])), true);
    assertEquals(admisSurOngletProgramme(rolesEffectifs(["super_admin"])), true);
  });

  await t.step("coach et entrepreneur restent refusés", () => {
    assertEquals(admisSurOngletProgramme(rolesEffectifs(["coach"], "coach")), false);
    assertEquals(admisSurOngletProgramme(rolesEffectifs(["entrepreneur"])), false);
    assertEquals(admisSurOngletProgramme(rolesEffectifs([])), false);
  });
});

Deno.test("l'ancien contrôle n'acceptait que super_admin", async (t) => {
  const ANCIEN = ["super_admin", "admin", "manager", "owner"];

  await t.step("admin, manager et owner n'existent pas dans app_role", () => {
    for (const r of ["admin", "manager", "owner"]) {
      assertEquals(APP_ROLE.includes(r), false, `${r} ne devrait pas être un rôle historique`);
    }
  });

  await t.step("aucun rôle historique réel ne passait, sauf super_admin", () => {
    const passants = APP_ROLE.filter((r) => ANCIEN.includes(r));
    assertEquals(passants, ["super_admin"]);
  });

  await t.step("Karen était donc refusée, même sans le bug du maybeSingle", () => {
    assertEquals(ANCIEN.includes("chef_programme"), false);
  });
});

Deno.test("maybeSingle sur un compte à deux rôles effaçait les droits", () => {
  // Comportement PostgREST : `.maybeSingle()` échoue si plus d'une ligne → data: null.
  const simuleMaybeSingle = (lignes: string[]) => (lignes.length === 1 ? lignes[0] : null);

  assertEquals(simuleMaybeSingle(["chef_programme"]), "chef_programme");
  assertEquals(simuleMaybeSingle(["chef_programme", "entrepreneur"]), null);

  // Après correctif : la liste complète est conservée.
  assertEquals(rolesEffectifs(["chef_programme", "entrepreneur"]).isChefProg, true);
});
