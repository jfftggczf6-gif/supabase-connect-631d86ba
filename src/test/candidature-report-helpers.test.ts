import { describe, it, expect } from "vitest";
import { getProjectSourcing, isRetainedForReport } from "@/lib/candidature-format";

describe("getProjectSourcing", () => {
  it("extrait la réponse à « Quelle organisation vous a recommandé… »", () => {
    const c = { form_data: { "Quelle organisation vous a recommandé de postuler à cet appel à projets ?": "OVO" } };
    expect(getProjectSourcing(c)).toBe("OVO");
  });

  it("trouve aussi une formulation différente contenant 'recommandé'", () => {
    const c = { form_data: { "Qui vous a recommandé ?": "GIZ" } };
    expect(getProjectSourcing(c)).toBe("GIZ");
  });

  it("retourne — si absent ou vide", () => {
    expect(getProjectSourcing({ form_data: { secteur: "agro" } })).toBe("—");
    expect(getProjectSourcing({ form_data: { "Qui vous a recommandé ?": "  " } })).toBe("—");
    expect(getProjectSourcing({})).toBe("—");
    expect(getProjectSourcing(null)).toBe("—");
  });

  it("résout la précision quand la réponse est 'Autre' (champ libre)", () => {
    const c = {
      form_data: {
        "Quelle organisation vous a recommandé de postuler ?": "Autre",
        "Quelle organisation vous a recommandé de postuler ?__precisions": { Autre: "Fondation Sococim" },
      },
    };
    expect(getProjectSourcing(c)).toBe("Fondation Sococim");
  });

  it("garde la réponse brute si pas de précision associée", () => {
    const c = { form_data: { "Qui vous a recommandé ?": "OVO", "Qui vous a recommandé ?__precisions": { Autre: "X" } } };
    expect(getProjectSourcing(c)).toBe("OVO");
  });

  it("choix multiple : joint les valeurs en résolvant les précisions", () => {
    const c = {
      form_data: {
        "Qui vous a recommandé ?": ["OVO", "Autre"],
        "Qui vous a recommandé ?__precisions": { Autre: "Fondation X" },
      },
    };
    expect(getProjectSourcing(c)).toBe("OVO, Fondation X");
  });
});

describe("isRetainedForReport", () => {
  it("garde pré-sélectionnée / sélectionnée / entreprise", () => {
    expect(isRetainedForReport("pre_selected")).toBe(true);
    expect(isRetainedForReport("selected")).toBe(true);
    expect(isRetainedForReport("enterprise")).toBe(true);
  });
  it("exclut reçue et rejetée (doublons/refus)", () => {
    expect(isRetainedForReport("received")).toBe(false);
    expect(isRetainedForReport("rejected")).toBe(false);
    expect(isRetainedForReport(null)).toBe(false);
  });
});
