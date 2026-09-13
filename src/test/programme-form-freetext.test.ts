import { describe, it, expect } from "vitest";
import { cleanFreeTextOptions } from "@/lib/form-fields";

describe("cleanFreeTextOptions", () => {
  it("retire les clés freeText qui ne sont plus des options", () => {
    const r = cleanFreeTextOptions({
      id: "1",
      type: "select",
      label: "Q",
      required: false,
      options: ["A", "Autre"],
      freeTextOptions: { Autre: "Précisez", Supprimée: "x" },
    } as any);
    expect(r).toEqual({ Autre: "Précisez" });
  });

  it("retourne undefined si aucune option freeText ne subsiste", () => {
    const r = cleanFreeTextOptions({
      id: "1",
      type: "select",
      label: "Q",
      required: false,
      options: ["A"],
      freeTextOptions: { Autre: "x" },
    } as any);
    expect(r).toBeUndefined();
  });

  it("retourne undefined si le champ n'a pas de freeTextOptions", () => {
    const r = cleanFreeTextOptions({ id: "1", type: "select", label: "Q", required: false, options: ["A"] } as any);
    expect(r).toBeUndefined();
  });
});
