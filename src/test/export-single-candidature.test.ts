import { describe, it, expect, vi, beforeAll } from "vitest";

// export-candidature-report-pdf importe transitivement le client Supabase
// (via export-pdf) → on le mocke pour tester les builders purs sans réveiller GoTrue.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null as any } }) } },
}));

import { buildSingleHtml, buildHtml, singleExtractFilename } from "@/lib/export-candidature-report-pdf";
import { __setRenderContext } from "@/lib/export-candidature-report-pdf";
import { seedLabelRows } from "./helpers/label-seed";

// Le builder est appelé directement, donc hors du chemin `beginRender()`. On lui
// fournit le contexte de rendu RÉEL (seed SQL), au lieu de compter sur un repli
// statique : le repli protégeait le test pendant que le lecteur, lui, recevait
// un document faux.
beforeAll(() => __setRenderContext("fr", seedLabelRows()));

const cand = {
  company_name: "ABEL FOOD SAS",
  screening_score: 62,
  screening_data: {
    resume_comite: "Abel Food est une PME agroalimentaire sénégalaise.",
    classification: "POTENTIEL",
  },
};

describe("buildSingleHtml", () => {
  it("contient l'entreprise + le résumé, en-tête solo, sans page cohorte, fiche en page 1", () => {
    const html = buildSingleHtml(cand, "Sénégal 2026");
    expect(html).toContain("ABEL FOOD SAS");
    expect(html).toContain("Abel Food est une PME agroalimentaire sénégalaise.");
    expect(html).toContain("Extract candidature"); // en-tête dédié
    expect(html).not.toContain("Reporting de candidatures"); // pas l'en-tête agrégé
    expect(html).toContain("page-break-before: auto"); // fiche non repoussée en page 2
  });

  it("dégrade proprement si le diagnostic est absent (pas de crash)", () => {
    const html = buildSingleHtml({ company_name: "X SARL" }, "P");
    expect(html).toContain("X SARL");
    expect(typeof html).toBe("string");
  });
});

describe("buildHtml (agrégé) — zéro régression", () => {
  it("garde l'en-tête agrégé et n'ajoute pas l'override page-break", () => {
    const html = buildHtml([cand], "Sénégal 2026");
    expect(html).toContain("Reporting de candidatures");
    expect(html).not.toContain("page-break-before: auto");
  });
});

describe("buildHtml — colonne Sourcing projet", () => {
  it("ajoute la colonne et la valeur depuis form_data", () => {
    const c = {
      company_name: "X SARL",
      screening_score: 50,
      screening_data: {},
      form_data: { "Quelle organisation vous a recommandé de postuler ?": "OVO" },
    };
    const html = buildHtml([c], "P");
    expect(html).toContain("Sourcing projet");
    expect(html).toContain("OVO");
  });
});

describe("singleExtractFilename", () => {
  it("nom de fichier lisible + repli", () => {
    expect(singleExtractFilename("ABEL FOOD SAS", "pdf")).toMatch(/^Extract_ABEL_FOOD_SAS_\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(singleExtractFilename(undefined, "doc")).toMatch(/^Extract_candidature_\d{4}-\d{2}-\d{2}\.doc$/);
  });
});
