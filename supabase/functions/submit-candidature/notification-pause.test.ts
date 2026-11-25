/**
 * Interrupteur de la notification équipe dans submit-candidature.
 *
 * Le 25/11/2026, la notification email envoyée à l'équipe à chaque nouvelle
 * candidature a été mise en pause : elle partait à tous les owner/admin/manager
 * de l'organisation, y compris ceux qui ne suivaient pas le programme. La pause
 * a d'abord été déployée hors dépôt (version 192), puis reportée sur main.
 *
 * Ce test garantit qu'un déploiement depuis main ne réactive pas l'envoi :
 *   1. l'envoi n'a lieu que si le secret NOTIFY_TEAM_NEW_CANDIDATURE vaut
 *      exactement "true" ; absent, vide ou toute autre valeur, il est coupé ;
 *   2. chaque appel à notifyTeamNewCandidature est placé derrière cet
 *      interrupteur.
 *
 * index.ts n'exporte rien et démarre un serveur à l'import, et il doit rester
 * identique à la version de production. Le test lit donc la source au lieu de
 * l'importer.
 *
 * Lancer : deno test --allow-read --allow-env supabase/functions/submit-candidature/
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SECRET = "NOTIFY_TEAM_NEW_CANDIDATURE";
const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

function loadSwitch(): () => boolean {
  const match = source.match(/function isTeamNotificationEnabled\(\): boolean \{([\s\S]*?)\n\}/);
  assert(match, "isTeamNotificationEnabled() est absente de submit-candidature/index.ts");
  return new Function("Deno", match[1]).bind(null, Deno) as () => boolean;
}

function withSecret(value: string | undefined, fn: () => void) {
  const previous = Deno.env.get(SECRET);
  if (value === undefined) Deno.env.delete(SECRET);
  else Deno.env.set(SECRET, value);
  try {
    fn();
  } finally {
    if (previous === undefined) Deno.env.delete(SECRET);
    else Deno.env.set(SECRET, previous);
  }
}

Deno.test("secret absent : la notification équipe est coupée", () => {
  const isEnabled = loadSwitch();
  withSecret(undefined, () => assertEquals(isEnabled(), false));
});

Deno.test("toute valeur autre que \"true\" laisse la notification coupée", () => {
  const isEnabled = loadSwitch();
  for (const value of ["", "false", "TRUE", "True", "1", "yes", " true", "true "]) {
    withSecret(value, () => assertEquals(isEnabled(), false, `valeur ${JSON.stringify(value)}`));
  }
});

Deno.test("secret à \"true\" : la notification équipe est active", () => {
  const isEnabled = loadSwitch();
  withSecret("true", () => assertEquals(isEnabled(), true));
});

Deno.test("chaque appel à notifyTeamNewCandidature est derrière l'interrupteur", () => {
  const lines = source.split("\n");
  const calls = lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => /notifyTeamNewCandidature\(/.test(line) && !/async function notifyTeamNewCandidature\(/.test(line));

  assert(calls.length > 0, "aucun appel à notifyTeamNewCandidature trouvé");
  for (const { i } of calls) {
    assertEquals(
      lines[i - 1].trim(),
      "if (isTeamNotificationEnabled()) {",
      `ligne ${i + 1} : appel non protégé par isTeamNotificationEnabled()`,
    );
  }
});

Deno.test("interrupteur coupé : la pause est journalisée", () => {
  assert(
    source.includes('console.log("[notify] notification équipe en pause (NOTIFY_TEAM_NEW_CANDIDATURE != true)");'),
    "le log de pause est absent",
  );
});
