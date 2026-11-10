import { describe, expect, it } from "vitest";
import { isForeignKeyViolation, isUniqueViolation, pgErrorCode } from "@/core/db-errors";

/** Como o Drizzle entrega: mensagem "Failed query", código só em `cause`. */
function wrapped(code: string) {
  return new Error("Failed query: insert into …", {
    cause: Object.assign(new Error("pg"), { code }),
  });
}

describe("db-errors", () => {
  it("enxerga o código do Postgres mesmo embrulhado pelo Drizzle", () => {
    expect(isUniqueViolation(wrapped("23505"))).toBe(true);
    expect(isForeignKeyViolation(wrapped("23503"))).toBe(true);
    expect(pgErrorCode(wrapped("42P01"))).toBe("42P01");
  });

  it("continua funcionando com o erro cru do driver", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isForeignKeyViolation({ code: "23503" })).toBe(true);
  });

  it("não confunde um tipo de violação com outro nem com erro comum", () => {
    expect(isUniqueViolation(wrapped("23503"))).toBe(false);
    expect(isForeignKeyViolation(wrapped("23505"))).toBe(false);
    expect(isUniqueViolation(new Error("conexão caiu"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
