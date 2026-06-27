/**
 * Rendu Markdown de la présentation programme : la structure du texte (titres, paragraphes, listes)
 * doit être INTERPRÉTÉE, plus jamais affichée d'un bloc avec des `*`/`#` littéraux (cf. capture OVO).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "@/components/ui/markdown";

const ovo = `# Appel à candidature – Programme OVO Sénégal 2026

OVO lance un programme d'accompagnement destiné aux entreprises sénégalaises.

## Déroulement du programme

- un Boost Camp d'une journée mi-octobre
- un coaching individuel de six mois`;

describe("Markdown — structure interprétée", () => {
  it("rend les titres comme des vrais éléments de titre (pas de # littéral)", () => {
    render(<Markdown>{ovo}</Markdown>);
    const heading = screen.getByText(/Déroulement du programme/i);
    expect(heading.tagName).toMatch(/^H[1-6]$/); // un <h*>, pas un <p> avec "## ..."
    expect(heading.textContent).not.toContain("#");
  });

  it("rend les puces comme une vraie liste <li> (pas d'astérisques littéraux)", () => {
    render(<Markdown>{ovo}</Markdown>);
    const item = screen.getByText(/Boost Camp/i);
    expect(item.closest("li")).not.toBeNull();
    expect(item.textContent).not.toContain("*");
  });

  it("rend les images Markdown (logos incorporables au fil du texte)", () => {
    const { container } = render(<Markdown>{`Texte ![OVO](https://x/ovo.png) suite`}</Markdown>);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://x/ovo.png");
  });

  it("chaîne vide → ne casse pas, rend un conteneur vide", () => {
    const { container } = render(<Markdown>{""}</Markdown>);
    expect(container).toBeTruthy();
  });
});
