/**
 * FieldOptionsEditor — options façon Google Forms : ajout / édition / suppression ligne par ligne.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FieldOptionsEditor } from "@/components/programme/FieldOptionsEditor";

describe("FieldOptionsEditor", () => {
  it("affiche une ligne par option", () => {
    render(<FieldOptionsEditor value={["A", "B", "C"]} onChange={() => {}} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
  });

  it("liste vide → affiche quand même une ligne (au moins une option)", () => {
    render(<FieldOptionsEditor value={[]} onChange={() => {}} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("« Ajouter une option » ajoute une ligne vide", () => {
    const onChange = vi.fn();
    render(<FieldOptionsEditor value={["A"]} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Ajouter une option/i));
    expect(onChange).toHaveBeenCalledWith(["A", ""]);
  });

  it("éditer une option remonte la nouvelle valeur", () => {
    const onChange = vi.fn();
    render(<FieldOptionsEditor value={["A", "B"]} onChange={onChange} />);
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "Bee" } });
    expect(onChange).toHaveBeenCalledWith(["A", "Bee"]);
  });

  it("retirer une option la supprime", () => {
    const onChange = vi.fn();
    render(<FieldOptionsEditor value={["A", "B"]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Retirer l'option 1/i));
    expect(onChange).toHaveBeenCalledWith(["B"]);
  });

  it("ne peut pas retirer la dernière option", () => {
    render(<FieldOptionsEditor value={["A"]} onChange={() => {}} />);
    expect(screen.getByLabelText(/Retirer l'option 1/i)).toBeDisabled();
  });
});
