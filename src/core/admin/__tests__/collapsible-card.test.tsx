import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CollapsibleCard } from "../components/collapsible-card";

describe("CollapsibleCard", () => {
  it("começa recolhido, mas com o conteúdo montado (só oculto)", () => {
    render(
      <CollapsibleCard title="Cobrança">
        <input aria-label="campo" defaultValue="x" />
      </CollapsibleCard>,
    );

    const header = screen.getByRole("button", { name: "Cobrança" });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.getByLabelText("campo", { selector: "input" }).closest("[hidden]"),
    ).not.toBeNull();
  });

  it("abre e fecha ao clicar no título", () => {
    render(
      <CollapsibleCard title="Cobrança">
        <p>conteúdo</p>
      </CollapsibleCard>,
    );
    const header = screen.getByRole("button", { name: "Cobrança" });

    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("conteúdo").closest("[hidden]")).toBeNull();

    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });

  it("defaultOpen abre de início, e as ações só aparecem com o cartão aberto", () => {
    const { rerender } = render(
      <CollapsibleCard title="A" actions={<button>Limpar</button>}>
        <p>x</p>
      </CollapsibleCard>,
    );
    expect(screen.queryByRole("button", { name: "Limpar" })).toBeNull();

    rerender(
      <CollapsibleCard title="A" defaultOpen actions={<button>Limpar</button>} key="open">
        <p>x</p>
      </CollapsibleCard>,
    );
    expect(screen.getByRole("button", { name: "Limpar" })).toBeTruthy();
  });
});
