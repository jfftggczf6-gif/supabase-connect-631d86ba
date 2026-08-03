import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FreeTextPrecision } from "@/components/programme/FreeTextPrecision";

describe("FreeTextPrecision", () => {
  it("affiche un champ par option sélectionnée à champ libre, avec son libellé", () => {
    const onChange = vi.fn();
    render(
      <FreeTextPrecision
        field={{ label: "Q", freeTextOptions: { Autre: "Précisez", "Non applicable": "Autre source" } }}
        selected={["Autre"]}
        precisions={{}}
        onChange={onChange}
      />,
    );
    expect(screen.getByPlaceholderText("Précisez")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Autre source")).toBeNull(); // non sélectionné
    fireEvent.change(screen.getByPlaceholderText("Précisez"), { target: { value: "ONG X" } });
    expect(onChange).toHaveBeenCalledWith("Autre", "ONG X");
  });

  it("n'affiche rien si aucune option sélectionnée n'est à champ libre", () => {
    const { container } = render(
      <FreeTextPrecision
        field={{ label: "Q", freeTextOptions: { Autre: "" } }}
        selected={["OVO"]}
        precisions={{}}
        onChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("repli sur le libellé par défaut si le libellé d'invite est vide", () => {
    render(
      <FreeTextPrecision
        field={{ label: "Q", freeTextOptions: { Autre: "" } }}
        selected={["Autre"]}
        precisions={{}}
        onChange={vi.fn()}
        defaultLabel="Précisez…"
      />,
    );
    expect(screen.getByPlaceholderText("Précisez…")).toBeInTheDocument();
  });

  it("checkbox : une précision par option cochée à champ libre", () => {
    render(
      <FreeTextPrecision
        field={{ label: "Q", freeTextOptions: { Autre: "Précisez", "Non applicable": "Source" } }}
        selected={["Autre", "Non applicable"]}
        precisions={{ Autre: "ONG" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Précisez")).toHaveValue("ONG");
    expect(screen.getByPlaceholderText("Source")).toBeInTheDocument();
  });
});
