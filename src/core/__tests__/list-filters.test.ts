import { describe, expect, it } from "vitest";
import { parsePeriod, periodStart, pickOption, sinceFromParam } from "../list-filters";

const now = new Date(2026, 10, 18, 15, 30); // 18/11/2026

describe("list-filters", () => {
  it("parsePeriod só aceita períodos conhecidos", () => {
    expect(parsePeriod("30d")).toBe("30d");
    expect(parsePeriod("ontem")).toBeUndefined();
    expect(parsePeriod(undefined)).toBeUndefined();
  });

  it("periodStart devolve o início de cada período", () => {
    expect(periodStart("hoje", now)).toEqual(new Date(2026, 10, 18));
    expect(periodStart("7d", now)).toEqual(new Date(2026, 10, 12));
    expect(periodStart("30d", now)).toEqual(new Date(2026, 9, 20));
    expect(periodStart("mes", now)).toEqual(new Date(2026, 10, 1));
    expect(periodStart("ano", now)).toEqual(new Date(2026, 0, 1));
  });

  it("pickOption aceita lista ou objeto e ignora o resto", () => {
    expect(pickOption("pf", ["pf", "pj"] as const)).toBe("pf");
    expect(pickOption("x", ["pf", "pj"] as const)).toBeUndefined();
    expect(pickOption("name_asc", { name_asc: "A", name_desc: "B" })).toBe("name_asc");
    expect(pickOption(["pf"], ["pf"] as const)).toBeUndefined();
  });

  it("sinceFromParam converte o parâmetro em data", () => {
    expect(sinceFromParam("mes", now)).toEqual(new Date(2026, 10, 1));
    expect(sinceFromParam("xyz", now)).toBeUndefined();
  });
});
