import { afterEach, describe, expect, it } from "vitest";
import {
  __resetBusinessTypePresetsForTests,
  getBusinessTypePreset,
  getBusinessTypePresets,
  registerBusinessTypePreset,
} from "../business-type-presets";

afterEach(__resetBusinessTypePresetsForTests);

describe("registro de presets por ramo", () => {
  it("nasce vazio e não encontra nada", () => {
    expect(getBusinessTypePresets()).toEqual([]);
    expect(getBusinessTypePreset("bordados")).toBeUndefined();
    expect(getBusinessTypePreset(null)).toBeUndefined();
  });

  it("registra e encontra por valor; a lista devolvida é uma cópia", () => {
    registerBusinessTypePreset({
      value: "bordados",
      label: "Bordados",
      defaultModuleSlugs: ["pedidos"],
    });
    expect(getBusinessTypePreset("bordados")?.defaultModuleSlugs).toEqual(["pedidos"]);
    getBusinessTypePresets().pop();
    expect(getBusinessTypePresets()).toHaveLength(1);
  });
});
