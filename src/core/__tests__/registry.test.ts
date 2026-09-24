import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetRegistryForTests,
  getAllModules,
  getEnabledModules,
  registerModule,
} from "@/core/registry";

beforeEach(() => {
  __resetRegistryForTests();
});

describe("registerModule / getEnabledModules / getAllModules", () => {
  it("começa vazio", () => {
    expect(getEnabledModules()).toEqual([]);
    expect(getAllModules()).toEqual([]);
  });

  it("getEnabledModules só devolve módulos habilitados, ordenados", () => {
    registerModule({
      slug: "b",
      label: "B",
      iconName: "Package",
      href: "/b",
      order: 2,
      enabled: true,
    });
    registerModule({
      slug: "a",
      label: "A",
      iconName: "Users",
      href: "/a",
      order: 1,
      enabled: true,
    });
    registerModule({
      slug: "c",
      label: "C",
      iconName: "Box",
      href: "/c",
      order: 0,
      enabled: false,
    });

    const enabled = getEnabledModules();
    expect(enabled.map((m) => m.slug)).toEqual(["a", "b"]);
  });

  it("getAllModules inclui os desabilitados também", () => {
    registerModule({
      slug: "a",
      label: "A",
      iconName: "Users",
      href: "/a",
      order: 1,
      enabled: true,
    });
    registerModule({
      slug: "c",
      label: "C",
      iconName: "Box",
      href: "/c",
      order: 0,
      enabled: false,
    });

    expect(getAllModules().map((m) => m.slug)).toEqual(["c", "a"]);
  });
});
