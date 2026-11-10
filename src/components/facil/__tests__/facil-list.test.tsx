import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { FacilList } from "../facil-list";

const items = Array.from({ length: 5 }, (_, i) => ({
  id: String(i),
  href: `/clientes/${i}`,
  title: `Cliente ${i}`,
  subtitle: `Tel ${i}`,
}));

afterEach(cleanup);

describe("FacilList", () => {
  it("mostra o estado vazio com a ação", () => {
    render(
      <FacilList
        items={[]}
        emptyTitle="Nenhum cliente"
        emptyAction={<button type="button">Novo</button>}
      />,
    );
    expect(screen.getByText("Nenhum cliente")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Novo" })).toBeTruthy();
  });

  it("limita a lista e oferece 'Ver todos' com o total", () => {
    render(<FacilList items={items} limit={3} moreHref="/clientes?ver=todos" emptyTitle="x" />);
    expect(screen.getAllByRole("link", { name: /Cliente/ })).toHaveLength(3);
    const more = screen.getByRole("link", { name: "Ver todos (5)" });
    expect(more.getAttribute("href")).toBe("/clientes?ver=todos");
  });

  it("sem limite mostra tudo e esconde 'Ver todos'", () => {
    render(<FacilList items={items} limit={Number.POSITIVE_INFINITY} emptyTitle="x" />);
    expect(screen.getAllByRole("link", { name: /Cliente/ })).toHaveLength(5);
    expect(screen.queryByText(/Ver todos/)).toBeNull();
  });

  it("usa as iniciais do título quando não há ícone", () => {
    render(<FacilList items={[{ id: "1", href: "/c/1", title: "Maria Souza" }]} emptyTitle="x" />);
    expect(screen.getByText("MS")).toBeTruthy();
  });
});
