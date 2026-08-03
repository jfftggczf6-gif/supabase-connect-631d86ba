import { describe, it, expect } from "vitest";
import { mergeDocuments, buildCoordinatorDoc } from "@/lib/candidature-docs";

describe("mergeDocuments", () => {
  it("dédup par file_name (added écrase l'existant homonyme)", () => {
    const r = mergeDocuments(
      [{ file_name: "a.pdf", storage_path: "x" }],
      [{ file_name: "a.pdf", storage_path: "y" }, { file_name: "b.pdf", storage_path: "z" }],
    );
    expect(r).toHaveLength(2);
    expect(r.find((d) => d.file_name === "a.pdf")!.storage_path).toBe("y");
  });

  it("préserve les docs existants non homonymes", () => {
    const r = mergeDocuments([{ file_name: "a.pdf", storage_path: "x" }], [{ file_name: "b.pdf", storage_path: "y" }]);
    expect(r.map((d) => d.file_name).sort()).toEqual(["a.pdf", "b.pdf"]);
  });

  it("tolère des entrées nulles / listes vides", () => {
    expect(mergeDocuments(null as any, [{ file_name: "a.pdf", storage_path: "x" }])).toHaveLength(1);
    expect(mergeDocuments([{ file_name: "a.pdf", storage_path: "x" }], null as any)).toHaveLength(1);
  });
});

describe("buildCoordinatorDoc", () => {
  it("marque la traçabilité pour l'affichage optimiste", () => {
    const d = buildCoordinatorDoc(
      { file_name: "x.pdf", file_size: 10, storage_path: "candidature-documents/1_x.pdf" },
      { id: "u1", name: "Nathalie" },
      "2026-08-03T10:00:00Z",
    );
    expect(d).toMatchObject({
      field_label: "Ajouté par le coordinateur",
      file_name: "x.pdf",
      file_size: 10,
      storage_path: "candidature-documents/1_x.pdf",
      source: "coordinator",
      added_by_id: "u1",
      added_by_name: "Nathalie",
      added_at: "2026-08-03T10:00:00Z",
    });
  });

  it("respecte un field_label explicite", () => {
    const d = buildCoordinatorDoc(
      { file_name: "bilan.pdf", storage_path: "p", field_label: "États financiers" },
      { id: "u1", name: "N" },
      "2026-08-03T10:00:00Z",
    );
    expect(d.field_label).toBe("États financiers");
  });
});
