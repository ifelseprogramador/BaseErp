import { describe, expect, it } from "vitest";
import type { ActionResult } from "@/core/action-result";

describe("ActionResult", () => {
  it("aceita um resultado de sucesso mínimo", () => {
    const result: ActionResult = { ok: true };
    expect(result.ok).toBe(true);
  });

  it("aceita erros de validação por campo", () => {
    const result: ActionResult = {
      ok: false,
      errors: { name: ["Informe o nome."] },
    };
    expect(result.ok).toBe(false);
    expect(result.errors?.name).toContain("Informe o nome.");
  });

  it("aceita uma mensagem geral de falha", () => {
    const result: ActionResult = { ok: false, message: "Não foi possível salvar." };
    expect(result.message).toBe("Não foi possível salvar.");
  });
});
