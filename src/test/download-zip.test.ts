import { describe, it, expect } from "vitest";
import { buildZipBlob, zipFilename } from "@/lib/download-zip";

describe("buildZipBlob", () => {
  it("zippe les blobs récupérés, compte les ajouts", async () => {
    const files = [
      { name: "a.pdf", fetch: async () => new Blob(["aaa"]) },
      { name: "b.pdf", fetch: async () => new Blob(["bbb"]) },
    ];
    const { blob, added, failed } = await buildZipBlob(files);
    expect(added).toBe(2);
    expect(failed).toEqual([]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("un fichier en échec (fetch null/throw) n'empêche pas les autres", async () => {
    const files = [
      { name: "ok.pdf", fetch: async () => new Blob(["x"]) },
      { name: "null.pdf", fetch: async (): Promise<Blob | null> => null },
      { name: "boom.pdf", fetch: async () => { throw new Error("boom"); } },
    ];
    const { added, failed } = await buildZipBlob(files);
    expect(added).toBe(1);
    expect(failed.sort()).toEqual(["boom.pdf", "null.pdf"]);
  });

  it("déduplique les noms de fichiers identiques", async () => {
    const files = [
      { name: "doc.pdf", fetch: async () => new Blob(["1"]) },
      { name: "doc.pdf", fetch: async () => new Blob(["2"]) },
    ];
    const { added } = await buildZipBlob(files);
    expect(added).toBe(2); // doc.pdf + doc_1.pdf, aucun écrasement
  });
});

describe("zipFilename", () => {
  it("nom lisible + repli", () => {
    expect(zipFilename("ABEL FOOD SAS")).toBe("Documents_ABEL_FOOD_SAS.zip");
    expect(zipFilename(undefined)).toBe("Documents_documents.zip");
  });
});
