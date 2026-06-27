/**
 * Bande « Partenaires » (Option B) : une rangée de logos dédiée, séparée du texte, en bas de la
 * présentation. Affichée seulement s'il y a au moins un logo valide ; ignore les entrées vides.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PartnerLogos } from "@/components/programme/PartnerLogos";

describe("PartnerLogos — bande dédiée", () => {
  it("rend un <img> par logo valide, avec src et alt", () => {
    render(<PartnerLogos logos={[{ url: "https://x/ovo.png", name: "OVO" }, { url: "https://x/p2.png", name: "Partenaire 2" }]} />);
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute("src", "https://x/ovo.png");
    expect(imgs[0]).toHaveAttribute("alt", "OVO");
  });

  it("affiche le libellé « Avec le soutien de » par défaut", () => {
    render(<PartnerLogos logos={[{ url: "https://x/ovo.png" }]} />);
    expect(screen.getByText(/Avec le soutien de/i)).toBeTruthy();
  });

  it("libellé personnalisable", () => {
    render(<PartnerLogos logos={[{ url: "https://x/ovo.png" }]} label="Nos partenaires" />);
    expect(screen.getByText(/Nos partenaires/i)).toBeTruthy();
  });

  it("aucun logo (liste vide / null / undefined) → ne rend RIEN", () => {
    const { container: c1 } = render(<PartnerLogos logos={[]} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<PartnerLogos logos={null} />);
    expect(c2.firstChild).toBeNull();
    const { container: c3 } = render(<PartnerLogos />);
    expect(c3.firstChild).toBeNull();
  });

  it("ignore les entrées sans url valide", () => {
    // alt="" (logo sans nom) → rôle ARIA 'presentation', donc on compte les <img> via le DOM.
    const { container } = render(<PartnerLogos logos={[{ url: "https://x/ok.png" }, { url: "  " } as any, { url: "" } as any]} />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
});
