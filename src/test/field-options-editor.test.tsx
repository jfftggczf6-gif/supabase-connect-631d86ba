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

  it("coche « champ libre » sur une option → onFreeTextChange reçoit l'option", () => {
    const onChange = vi.fn();
    const onFreeTextChange = vi.fn();
    render(
      <FieldOptionsEditor
        value={["OVO", "Autre"]}
        onChange={onChange}
        freeTextOptions={{}}
        onFreeTextChange={onFreeTextChange}
      />,
    );
    const checks = screen.getAllByRole("checkbox");
    expect(checks).toHaveLength(2);
    fireEvent.click(checks[1]); // coche « Autre »
    expect(onFreeTextChange).toHaveBeenCalledWith({ Autre: "" });
  });

  it("bouton « Ajouter une option Autre » ajoute l'option + la pré-coche", () => {
    const onChange = vi.fn();
    const onFreeTextChange = vi.fn();
    render(
      <FieldOptionsEditor value={["OVO"]} onChange={onChange} freeTextOptions={{}} onFreeTextChange={onFreeTextChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /ajouter une option .*autre/i }));
    expect(onChange).toHaveBeenCalledWith(["OVO", "Autre"]);
    expect(onFreeTextChange).toHaveBeenCalledWith({ Autre: "" });
  });

  it("renommer une option à champ libre migre la clé", () => {
    const onChange = vi.fn();
    const onFreeTextChange = vi.fn();
    render(
      <FieldOptionsEditor
        value={["Autre"]}
        onChange={onChange}
        freeTextOptions={{ Autre: "Précisez" }}
        onFreeTextChange={onFreeTextChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "Autres" } });
    expect(onFreeTextChange).toHaveBeenCalledWith({ Autres: "Précisez" });
  });

  it("sans onFreeTextChange : pas de case ni de bouton Autre (compat)", () => {
    render(<FieldOptionsEditor value={["A", "B"]} onChange={() => {}} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /autre/i })).toBeNull();
  });
});
