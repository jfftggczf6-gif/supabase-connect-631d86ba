/**
 * DefaultFieldsEditor — champs cœur verrouillés (« Toujours »), bascule Affiché/Masqué sur les autres,
 * et édition du libellé. (La logique de fusion/invariants est testée dans default-fields.test.ts.)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DefaultFieldsEditor } from "@/components/programme/DefaultFieldsEditor";
import { mergeDefaultFields } from "@/lib/default-fields";

const base = mergeDefaultFields(null);

describe("DefaultFieldsEditor", () => {
  it("rend un champ libellé éditable par champ par défaut (6)", () => {
    render(<DefaultFieldsEditor value={base} onChange={() => {}} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  it("les 3 champs cœur affichent « Toujours » (non désactivables)", () => {
    render(<DefaultFieldsEditor value={base} onChange={() => {}} />);
    expect(screen.getAllByText("Toujours")).toHaveLength(3);
  });

  it("bascule Affiché → Masqué sur un champ non-cœur appelle onChange", () => {
    const onChange = vi.fn();
    render(<DefaultFieldsEditor value={base} onChange={onChange} />);
    fireEvent.click(screen.getAllByText("Affiché")[0]); // contact_phone / pays / secteur
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next.filter((f: any) => f.enabled === false)).toHaveLength(1);
  });

  it("éditer un libellé appelle onChange avec le nouveau texte", () => {
    const onChange = vi.fn();
    render(<DefaultFieldsEditor value={base} onChange={onChange} />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Raison sociale" } });
    const next = onChange.mock.calls[0][0];
    expect(next[0].label).toBe("Raison sociale");
  });
});
