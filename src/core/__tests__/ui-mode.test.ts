import { describe, expect, it } from "vitest";
import { DEFAULT_UI_MODE, isUiMode } from "@/core/ui-mode";
import { isMissingTableError } from "@/core/profile/ui-mode";

describe("ui-mode", () => {
  it("aceita só os modos conhecidos", () => {
    expect(isUiMode("formal")).toBe(true);
    expect(isUiMode("facil")).toBe(true);
    expect(isUiMode("fácil")).toBe(false);
    expect(isUiMode(undefined)).toBe(false);
    expect(isUiMode(1)).toBe(false);
  });

  it("o padrão é o formal", () => {
    expect(DEFAULT_UI_MODE).toBe("formal");
  });
});

describe("isMissingTableError", () => {
  it("reconhece o código 42P01 cru ou embrulhado em `cause`", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError(new Error("falhou", { cause: { code: "42P01" } }))).toBe(true);
  });

  it("não engole outros erros", () => {
    expect(isMissingTableError({ code: "08006" })).toBe(false);
    expect(isMissingTableError(new Error("conexão caiu"))).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError("42P01")).toBe(false);
  });
});
