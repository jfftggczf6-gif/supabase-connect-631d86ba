/**
 * Champs par défaut du formulaire de candidature (refonte constructeur).
 * - 3 champs cœur (entreprise / contact / email) VERROUILLÉS : toujours présents + requis, libellé éditable.
 * - téléphone / pays / secteur : activables/désactivables + requis/optionnel, libellé éditable.
 * - mergeDefaultFields() fusionne la config stockée avec le canon (repli zéro-régression + invariants locked).
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_FIELDS, mergeDefaultFields } from "@/lib/default-fields";

describe("default-fields — canon", () => {
  it("expose 6 champs dans l'ordre attendu avec les bons contrôles", () => {
    expect(DEFAULT_FIELDS.map(f => f.key)).toEqual([
      "company_name", "contact_name", "contact_email", "contact_phone", "pays", "secteur",
    ]);
    expect(DEFAULT_FIELDS.find(f => f.key === "pays")!.control).toBe("country");
    expect(DEFAULT_FIELDS.find(f => f.key === "secteur")!.control).toBe("sector");
  });

  it("les 3 champs cœur sont locked + required par défaut", () => {
    for (const k of ["company_name", "contact_name", "contact_email"]) {
      const f = DEFAULT_FIELDS.find(x => x.key === k)!;
      expect(f.locked).toBe(true);
      expect(f.required).toBe(true);
    }
  });
});

describe("mergeDefaultFields", () => {
  it("config vide / null → renvoie le canon complet (repli zéro régression)", () => {
    expect(mergeDefaultFields(null).map(f => f.key)).toEqual(DEFAULT_FIELDS.map(f => f.key));
    expect(mergeDefaultFields([]).length).toBe(6);
  });

  it("override du libellé et des flags pour un champ non-cœur (téléphone)", () => {
    const merged = mergeDefaultFields([{ key: "contact_phone", label: "Tél. mobile", enabled: false, required: false }]);
    const tel = merged.find(f => f.key === "contact_phone")!;
    expect(tel.label).toBe("Tél. mobile");
    expect(tel.enabled).toBe(false);
  });

  it("rend pays/secteur requis/optionnel selon la config stockée", () => {
    const merged = mergeDefaultFields([{ key: "secteur", required: false }]);
    expect(merged.find(f => f.key === "secteur")!.required).toBe(false);
  });

  it("INVARIANT locked : impossible de désactiver/rendre optionnel un champ cœur", () => {
    const merged = mergeDefaultFields([{ key: "company_name", enabled: false, required: false }]);
    const core = merged.find(f => f.key === "company_name")!;
    expect(core.enabled).toBe(true);  // locked → toujours présent
    expect(core.required).toBe(true); // locked → toujours requis
  });

  it("ignore les clés inconnues et préserve l'ordre canonique", () => {
    const merged = mergeDefaultFields([{ key: "inconnu", enabled: true }, { key: "pays", label: "Pays d'opération" }]);
    expect(merged.map(f => f.key)).toEqual(DEFAULT_FIELDS.map(f => f.key));
    expect(merged.find(f => f.key === "pays")!.label).toBe("Pays d'opération");
  });
});

describe("libellé multilingue (labelKey / labelIsOverride)", () => {
  it("chaque champ canonique porte une clé i18n candidature.public_*", () => {
    for (const f of DEFAULT_FIELDS) {
      expect(f.labelKey).toMatch(/^candidature\.public_/);
    }
  });

  it("sans override : labelIsOverride=false → le rendu doit passer par la clé i18n", () => {
    for (const f of mergeDefaultFields(null)) {
      expect(f.labelIsOverride).toBe(false);
    }
  });

  it("avec override : labelIsOverride=true et label = valeur personnalisée", () => {
    const merged = mergeDefaultFields([{ key: "secteur", label: "Domaine d'activité" }]);
    const sect = merged.find(f => f.key === "secteur")!;
    expect(sect.labelIsOverride).toBe(true);
    expect(sect.label).toBe("Domaine d'activité");
  });

  it("override vide/blanc → traité comme absence d'override (labelIsOverride=false)", () => {
    const merged = mergeDefaultFields([{ key: "secteur", label: "   " }]);
    expect(merged.find(f => f.key === "secteur")!.labelIsOverride).toBe(false);
  });
});
