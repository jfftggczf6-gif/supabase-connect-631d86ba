import { describe, it, expect } from "vitest";
import { reorderById } from "@/lib/form-fields";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("reorderById", () => {
  it("déplace un élément vers le bas", () => {
    expect(reorderById(items, "a", "c").map((i) => i.id)).toEqual(["b", "c", "a"]);
  });
  it("déplace un élément vers le haut", () => {
    expect(reorderById(items, "c", "a").map((i) => i.id)).toEqual(["c", "a", "b"]);
  });
  it("no-op si même id", () => {
    expect(reorderById(items, "b", "b").map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  it("no-op si un id est introuvable", () => {
    expect(reorderById(items, "a", "z").map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  it("préserve les objets (pas de perte de propriétés)", () => {
    const rich = [{ id: "a", label: "A", options: ["x"] }, { id: "b", label: "B" }];
    const r = reorderById(rich, "b", "a");
    expect(r[0]).toEqual({ id: "b", label: "B" });
    expect(r[1]).toEqual({ id: "a", label: "A", options: ["x"] });
  });
});
