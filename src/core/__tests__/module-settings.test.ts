import { describe, expect, it } from "vitest";
import { computeEnabledModules } from "@/core/module-settings";
import type { ModuleDefinition } from "@/core/registry";

const modules: ModuleDefinition[] = [
  { slug: "a", label: "A", iconName: "Users", href: "/a", order: 1, enabled: true },
  { slug: "b", label: "B", iconName: "Package", href: "/b", order: 0, enabled: false },
];

describe("computeEnabledModules", () => {
  it("sem overrides, usa o padrão de cada módulo", () => {
    const result = computeEnabledModules(modules, []);
    expect(result.map((m) => m.slug)).toEqual(["a"]);
  });

  it("um override pode ligar um módulo desligado por padrão", () => {
    const result = computeEnabledModules(modules, [{ moduleSlug: "b", enabled: true }]);
    expect(result.map((m) => m.slug)).toEqual(["b", "a"]);
  });

  it("um override pode desligar um módulo ligado por padrão", () => {
    const result = computeEnabledModules(modules, [{ moduleSlug: "a", enabled: false }]);
    expect(result).toEqual([]);
  });
});
