import { describe, expect, it } from "vitest";
import {
  FULL_MODULE_ACCESS,
  buildModuleAccess,
  canAccessModule,
  filterModulesByAccess,
} from "@/core/module-access";

const modules = [{ slug: "ordens" }, { slug: "clientes" }, { slug: "financeiro" }];

describe("buildModuleAccess", () => {
  it("dono acessa tudo, mesmo sem nenhuma linha em membership_modules", () => {
    expect(buildModuleAccess("owner", [])).toBe(FULL_MODULE_ACCESS);
  });

  it("staff só acessa o que foi liberado", () => {
    const access = buildModuleAccess("staff", ["ordens"]);
    expect(canAccessModule(access, "ordens")).toBe(true);
    expect(canAccessModule(access, "financeiro")).toBe(false);
  });

  it("staff sem nenhum módulo liberado não acessa nada", () => {
    const access = buildModuleAccess("staff", []);
    expect(modules.some((m) => canAccessModule(access, m.slug))).toBe(false);
  });
});

describe("filterModulesByAccess", () => {
  it("dono vê o menu inteiro", () => {
    expect(filterModulesByAccess(modules, FULL_MODULE_ACCESS)).toEqual(modules);
  });

  it("staff vê só os módulos liberados, na ordem original", () => {
    const access = buildModuleAccess("staff", ["clientes", "ordens"]);
    expect(filterModulesByAccess(modules, access).map((m) => m.slug)).toEqual([
      "ordens",
      "clientes",
    ]);
  });

  it("ignora slug liberado que não existe mais no registro", () => {
    const access = buildModuleAccess("staff", ["modulo-removido"]);
    expect(filterModulesByAccess(modules, access)).toEqual([]);
  });
});
