import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/clientes",
  useSearchParams: () => new URLSearchParams(search),
}));

import { FacilFilters } from "../facil-filters";

const filters = [
  {
    param: "type",
    allLabel: "Todos os tipos",
    options: [
      { value: "pf", label: "Pessoa" },
      { value: "pj", label: "Empresa" },
    ],
  },
];
const sortOptions = [
  { value: "created_desc", label: "Mais recentes" },
  { value: "name_asc", label: "Nome (A→Z)" },
];

afterEach(() => {
  cleanup();
  replace.mockReset();
  search = "";
});

describe("FacilFilters", () => {
  it("tocar numa opção escreve o parâmetro na URL, preservando os outros", () => {
    search = "q=ana";
    render(<FacilFilters filters={filters} sortOptions={sortOptions} defaultSort="created_desc" />);
    fireEvent.click(screen.getByRole("button", { name: "Empresa" }));
    expect(replace).toHaveBeenCalledWith("/clientes?q=ana&type=pj");
  });

  it("'Todos' remove o parâmetro e marca a opção ativa", () => {
    search = "type=pj";
    render(<FacilFilters filters={filters} sortOptions={sortOptions} defaultSort="created_desc" />);
    expect(screen.getByRole("button", { name: "Empresa" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Todos os tipos" }));
    expect(replace).toHaveBeenCalledWith("/clientes");
  });

  it("a ordem padrão não vai para a URL; outra ordem vai", () => {
    render(<FacilFilters filters={filters} sortOptions={sortOptions} defaultSort="created_desc" />);
    fireEvent.change(screen.getByLabelText("Ordenar por"), { target: { value: "name_asc" } });
    expect(replace).toHaveBeenCalledWith("/clientes?sort=name_asc");
  });

  it("'Limpar filtros' só aparece com filtro ativo e zera tudo", () => {
    render(<FacilFilters filters={filters} sortOptions={sortOptions} defaultSort="created_desc" />);
    expect(screen.queryByText("Limpar filtros")).toBeNull();
    cleanup();
    search = "type=pf&sort=name_asc&q=x";
    render(<FacilFilters filters={filters} sortOptions={sortOptions} defaultSort="created_desc" />);
    fireEvent.click(screen.getByText("Limpar filtros"));
    expect(replace).toHaveBeenCalledWith("/clientes?q=x");
  });
});
